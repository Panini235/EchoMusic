import { devLog, errorLog, trace } from "@/utils/log";
import { RequestStateCode } from "@/constants/commonConst";
import { produce } from "immer";
import { useStore } from "jotai";
import { useCallback } from "react";
import { ISearchResult, PageStatus, pageStatusAtom, searchResultsAtom, selectedSearchPluginHashesAtom } from "../store/atoms";
import PluginManager, { Plugin } from "@/core/pluginManager";

// Plugins can use their own networking implementation. Bound the wait without
// changing the MusicFree plugin signature or relying on its HTTP client.
export const SEARCH_TIMEOUT_MS = 15_000;

export default function useSearch() {
    // Dispatch against the current store, shared by all search/result views.
    // This also avoids rerendering every search control for each plugin result.
    const store = useStore();

    /**
     * query: 搜索词
     * queryPage: 搜索页码
     * type: 搜索类型
     * pluginHash: 结果页单个音源的分页/重试条件
     * selectedPluginHashes: 新搜索选择的音源集合
     */
    const search = useCallback(
        async function (
            query?: string,
            queryPage?: number,
            type?: ICommon.SupportMediaType,
            pluginHash?: string,
            selectedPluginHashes?: string[],
        ) {
            let plugins: Plugin[] = [];
            if (pluginHash) {
                const tgtPlugin = PluginManager.getByHash(pluginHash);
                tgtPlugin && (plugins = [tgtPlugin]);
            } else {
                plugins = PluginManager.getSearchablePlugins();
                const selected = selectedPluginHashes ?? store.get(selectedSearchPluginHashesAtom);
                if (selected) {
                    const selectedHashes = new Set(selected);
                    plugins = plugins.filter(plugin =>
                        selectedHashes.has(plugin.hash),
                    );
                }
            }
            if (plugins.length === 0) {
                store.set(pageStatusAtom, PageStatus.NO_PLUGIN);
                return;
            }
            // 使用选中插件搜素
            await Promise.all(plugins.map(async plugin => {
                const _platform = plugin.instance.platform;
                const _hash = plugin.hash;
                if (!_platform || !_hash) {
                    // 插件无效，此时直接进入结果页
                    if (store.get(pageStatusAtom) !== PageStatus.EDITING) {
                        store.set(pageStatusAtom, PageStatus.RESULT);
                    }
                    return;
                }

                const searchType =
                    type ?? plugin.instance.defaultSearchType ?? "music";
                // 上一份搜索结果
                const prevPluginResult = store.get(searchResultsAtom)[searchType][_hash];
                const newSearch = !prevPluginResult || queryPage === 1 ||
                    (query !== undefined && query !== prevPluginResult.query);
                /** 上一份搜索还没返回/已经结束 */
                if (
                    (prevPluginResult?.state === RequestStateCode.PENDING_FIRST_PAGE ||
                        prevPluginResult?.state ===
                        RequestStateCode.PENDING_REST_PAGE ||
                        prevPluginResult?.state ===
                        RequestStateCode.FINISHED) &&
                    !newSearch
                ) {
                    return;
                }

                // 本次搜索关键词
                const keyword = query ?? prevPluginResult?.query ?? "";

                /** 搜索的页码 */
                const page =
                    queryPage ?? (newSearch ? 1 :
                        prevPluginResult.state === RequestStateCode.ERROR
                            ? prevPluginResult.page ?? 1
                            : (prevPluginResult.page ?? 0) + 1);

                const pending: ISearchResult = {
                    state: newSearch
                        ? RequestStateCode.PENDING_FIRST_PAGE
                        : RequestStateCode.PENDING_REST_PAGE,
                    data: newSearch ? [] : prevPluginResult.data,
                    query: keyword,
                    page,
                };
                store.set(searchResultsAtom, produce(draft => {
                    const results: Record<string, ISearchResult> = draft[searchType];
                    results[_hash] = pending;
                }));

                // A reset or newer request replaces this record. Identity protects
                // both success and failure, even when the keyword is unchanged.
                const ownsRequest = () => store.get(searchResultsAtom)[searchType][_hash] === pending;

                trace("开始搜索", {
                    _platform,
                    query: keyword,
                    page,
                    searchType,
                });

                let timeout: ReturnType<typeof setTimeout> | undefined;
                try {
                    const result = await Promise.race([
                        plugin.methods.search?.(keyword, page, searchType),
                        new Promise<never>((_, reject) => {
                            timeout = setTimeout(() => reject(new Error("搜索超时，请重试")), SEARCH_TIMEOUT_MS);
                        }),
                    ]);
                    /** 如果搜索结果不是本次结果 */
                    if (!ownsRequest()) {
                        return;
                    }
                    /** 切换到结果页 */
                    const currentPageStatus =
                        store.get(pageStatusAtom);
                    if (currentPageStatus !== PageStatus.EDITING) {
                        store.set(pageStatusAtom, PageStatus.RESULT);
                    }
                    if (!result || !Array.isArray(result.data ?? [])) {
                        throw new Error("搜索结果格式无效");
                    }
                    store.set(searchResultsAtom,
                        produce(draft => {
                            const prevMediaResult: Record<string, ISearchResult> = draft[searchType];
                            const currResult = result.data ?? [];

                            prevMediaResult[_hash] = {
                                state:
                                    result?.isEnd === false &&
                                        result?.data?.length
                                        ? RequestStateCode.PARTLY_DONE
                                        : RequestStateCode.FINISHED,
                                query: keyword,
                                page,
                                data: newSearch
                                    ? currResult
                                    : pending.data.concat(
                                        currResult,
                                    ),
                            };
                            return draft;
                        }),
                    );
                } catch (e: any) {
                    if (!ownsRequest()) {
                        return;
                    }
                    errorLog("搜索失败", e?.message);
                    devLog(
                        "error",
                        "搜索失败",
                        `Plugin: ${plugin.name} Query: ${keyword} Page: ${page}`,
                        e,
                        e?.message,
                    );
                    const currentPageStatus =
                        store.get(pageStatusAtom);
                    if (currentPageStatus !== PageStatus.EDITING) {
                        store.set(pageStatusAtom, PageStatus.RESULT);
                    }
                    store.set(searchResultsAtom,
                        produce(draft => {
                            const prevMediaResult = draft[searchType];
                            prevMediaResult[_hash].state = RequestStateCode.ERROR;
                            return draft;
                        }),
                    );
                } finally {
                    if (timeout !== undefined) {
                        clearTimeout(timeout);
                    }
                }
            }));
        },
        [store],
    );

    return search;
}
