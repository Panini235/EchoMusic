import React from "react";
import { act, create } from "react-test-renderer";
import { createStore, getDefaultStore, Provider } from "jotai";
import { RequestStateCode } from "@/constants/commonConst";
import PluginManager from "@/core/pluginManager";
import useSearch, { SEARCH_TIMEOUT_MS } from "@/pages/searchPage/hooks/useSearch";
import {
    PageStatus,
    pageStatusAtom,
    searchResultsAtom,
    selectedSearchPluginHashesAtom,
} from "@/pages/searchPage/store/atoms";

jest.mock("react-native-reanimated", () => ({ Easing: require("react-native").Easing }));
jest.mock("@/utils/log", () => ({
    devLog: jest.fn(),
    errorLog: jest.fn(),
    trace: jest.fn(),
}));
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: {
        getByHash: jest.fn(),
        getSearchablePlugins: jest.fn(),
    },
}));

const store = getDefaultStore();
let renderer;
let firstSearch;
let secondSearch;
let plugin;

function Probe({ capture }) {
    capture(useSearch());
    return null;
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

function song(id) {
    return { id, title: id, platform: "Test Source" };
}

function seedPage(page = 1) {
    store.set(searchResultsAtom, {
        ...store.get(searchResultsAtom),
        music: {
            "source-a": {
                query: "song",
                page,
                state: RequestStateCode.PARTLY_DONE,
                data: [song("existing")],
            },
        },
    });
}

function mountSearches() {
    act(() => {
        renderer = create(
            <>
                <Probe capture={search => { firstSearch = search; }} />
                <Probe capture={search => { secondSearch = search; }} />
            </>,
        );
    });
}

async function settle(operation) {
    await act(async () => {
        operation();
        await Promise.resolve();
        await Promise.resolve();
    });
}

beforeEach(() => {
    store.set(searchResultsAtom, { music: {}, album: {}, artist: {}, sheet: {}, lyric: {} });
    store.set(pageStatusAtom, PageStatus.SEARCHING);
    store.set(selectedSearchPluginHashesAtom, null);
    plugin = {
        hash: "source-a",
        name: "Test Source",
        instance: { platform: "Test Source" },
        methods: { search: jest.fn() },
    };
    PluginManager.getSearchablePlugins.mockReturnValue([plugin]);
    PluginManager.getByHash.mockImplementation(hash => hash === plugin.hash ? plugin : undefined);
});

afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    jest.clearAllMocks();
    jest.useRealTimers();
});

test("requests the explicit page instead of silently fetching page one", async () => {
    seedPage(2);
    const response = deferred();
    plugin.methods.search.mockReturnValue(response.promise);
    mountSearches();

    act(() => { firstSearch(undefined, 3, "music", plugin.hash); });
    expect(plugin.methods.search).toHaveBeenCalledWith("song", 3, "music");
    await settle(() => response.resolve({ data: [song("third-page")], isEnd: true }));
    expect(store.get(searchResultsAtom).music[plugin.hash].data.map(item => item.id))
        .toEqual(["existing", "third-page"]);
});

test("an older success cannot replace a repeated search with the same keyword", async () => {
    const oldResponse = deferred();
    const newResponse = deferred();
    plugin.methods.search.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    mountSearches();

    act(() => { firstSearch("song", 1); });
    act(() => { secondSearch("song", 1); });
    await settle(() => newResponse.resolve({ data: [song("new")], isEnd: true }));
    await settle(() => oldResponse.resolve({ data: [song("old")], isEnd: true }));

    expect(store.get(searchResultsAtom).music[plugin.hash].data[0].id).toBe("new");
});

test("an old failed request cannot mark a newer successful query as failed", async () => {
    const oldResponse = deferred();
    const newResponse = deferred();
    plugin.methods.search.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    mountSearches();

    act(() => { firstSearch("old", 1); });
    act(() => { secondSearch("new", 1); });
    await settle(() => newResponse.resolve({ data: [song("new")], isEnd: true }));
    await settle(() => oldResponse.reject(new Error("late failure")));

    expect(store.get(searchResultsAtom).music[plugin.hash]).toMatchObject({
        query: "new",
        state: RequestStateCode.FINISHED,
        data: [song("new")],
    });
});

test("two result views reaching the end together issue only one pagination request", async () => {
    seedPage();
    const response = deferred();
    plugin.methods.search.mockReturnValue(response.promise);
    mountSearches();

    act(() => {
        firstSearch(undefined, undefined, "music", plugin.hash);
        secondSearch(undefined, undefined, "music", plugin.hash);
    });
    expect(plugin.methods.search).toHaveBeenCalledTimes(1);
    await settle(() => response.resolve({ data: [song("second")], isEnd: true }));
});

test("a response arriving after search results are reset cannot repopulate them", async () => {
    const response = deferred();
    plugin.methods.search.mockReturnValue(response.promise);
    mountSearches();
    act(() => { firstSearch("song", 1); });
    act(() => {
        store.set(searchResultsAtom, { music: {}, album: {}, artist: {}, sheet: {}, lyric: {} });
        store.set(pageStatusAtom, PageStatus.EDITING);
    });
    await settle(() => response.resolve({ data: [song("old")], isEnd: true }));

    expect(store.get(searchResultsAtom).music).toEqual({});
    expect(store.get(pageStatusAtom)).toBe(PageStatus.EDITING);
});

test("a failed next page retries the failed page and retains already loaded songs", async () => {
    seedPage();
    plugin.methods.search
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ data: [song("second")], isEnd: true });
    mountSearches();

    await act(async () => { await firstSearch(undefined, undefined, "music", plugin.hash); });
    expect(store.get(searchResultsAtom).music[plugin.hash]).toMatchObject({
        page: 2,
        state: RequestStateCode.ERROR,
        data: [song("existing")],
    });
    await act(async () => { await secondSearch("song", undefined, "music", plugin.hash); });
    expect(plugin.methods.search.mock.calls.map(call => call[1])).toEqual([2, 2]);
    expect(store.get(searchResultsAtom).music[plugin.hash].data)
        .toEqual([song("existing"), song("second")]);
});

test("a plugin that never responds becomes retryable instead of loading forever", async () => {
    jest.useFakeTimers();
    const response = deferred();
    plugin.methods.search.mockReturnValue(response.promise);
    mountSearches();
    act(() => { firstSearch("song", 1); });
    await act(async () => {
        jest.advanceTimersByTime(SEARCH_TIMEOUT_MS);
        await Promise.resolve();
        await Promise.resolve();
    });

    expect(store.get(searchResultsAtom).music[plugin.hash].state).toBe(RequestStateCode.ERROR);
    expect(store.get(pageStatusAtom)).toBe(PageStatus.RESULT);
    await settle(() => response.resolve({ data: [song("too-late")], isEnd: true }));
    expect(store.get(searchResultsAtom).music[plugin.hash].data).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
});

test("updating results does not rerender controls that only dispatch searches", async () => {
    let renders = 0;
    const response = deferred();
    plugin.methods.search.mockReturnValue(response.promise);
    act(() => {
        renderer = create(<Probe capture={search => { firstSearch = search; renders += 1; }} />);
    });
    const initialRenders = renders;
    act(() => { firstSearch("song", 1); });
    await settle(() => response.resolve({ data: [song("result")], isEnd: true }));

    expect(renders).toBe(initialRenders);
});

test("searches started from history respect the selected sources", async () => {
    const otherPlugin = {
        ...plugin,
        hash: "source-b",
        methods: { search: jest.fn().mockResolvedValue({ data: [], isEnd: true }) },
    };
    plugin.methods.search.mockResolvedValue({ data: [], isEnd: true });
    PluginManager.getSearchablePlugins.mockReturnValue([plugin, otherPlugin]);
    store.set(selectedSearchPluginHashesAtom, [otherPlugin.hash]);
    mountSearches();

    await act(async () => { await firstSearch("from history", 1); });
    expect(plugin.methods.search).not.toHaveBeenCalled();
    expect(otherPlugin.methods.search).toHaveBeenCalledWith("from history", 1, "music");
});

test("a responsive source is displayed while another source is still waiting", async () => {
    const slow = deferred();
    plugin.methods.search.mockReturnValue(slow.promise);
    const fastPlugin = {
        ...plugin,
        hash: "fast-source",
        methods: { search: jest.fn().mockResolvedValue({ data: [song("fast")], isEnd: true }) },
    };
    PluginManager.getSearchablePlugins.mockReturnValue([plugin, fastPlugin]);
    mountSearches();
    await act(async () => { firstSearch("song", 1); });

    expect(store.get(pageStatusAtom)).toBe(PageStatus.RESULT);
    expect(store.get(searchResultsAtom).music[fastPlugin.hash].data).toEqual([song("fast")]);
    expect(store.get(searchResultsAtom).music[plugin.hash].state).toBe(RequestStateCode.PENDING_FIRST_PAGE);
    await settle(() => slow.resolve({ data: [song("slow")], isEnd: true }));
    expect(store.get(searchResultsAtom).music[plugin.hash].data).toEqual([song("slow")]);
});

test("one failed source does not prevent another source from returning songs", async () => {
    plugin.methods.search.mockRejectedValue(new Error("source unavailable"));
    const workingPlugin = {
        ...plugin,
        hash: "working-source",
        methods: { search: jest.fn().mockResolvedValue({ data: [song("working")], isEnd: true }) },
    };
    PluginManager.getSearchablePlugins.mockReturnValue([plugin, workingPlugin]);
    mountSearches();
    await act(async () => { await firstSearch("song", 1); });

    const results = store.get(searchResultsAtom).music;
    expect(results[plugin.hash].state).toBe(RequestStateCode.ERROR);
    expect(results[workingPlugin.hash].data).toEqual([song("working")]);
});

test.each([null, { data: "invalid" }])("invalid plugin data (%p) becomes a retryable error", async response => {
    plugin.methods.search.mockResolvedValue(response);
    mountSearches();
    await act(async () => { await firstSearch("song", 1); });
    expect(store.get(searchResultsAtom).music[plugin.hash]).toMatchObject({
        state: RequestStateCode.ERROR,
        data: [],
    });
});

test("selecting no sources does not dispatch network requests", async () => {
    store.set(selectedSearchPluginHashesAtom, []);
    mountSearches();
    await act(async () => { await firstSearch("song", 1); });
    expect(plugin.methods.search).not.toHaveBeenCalled();
    expect(store.get(pageStatusAtom)).toBe(PageStatus.NO_PLUGIN);
});

test("successful plugin requests clear their timeout immediately", async () => {
    jest.useFakeTimers();
    plugin.methods.search.mockResolvedValue({ data: [song("result")], isEnd: true });
    mountSearches();
    await act(async () => { await firstSearch("song", 1); });
    expect(jest.getTimerCount()).toBe(0);
});

test("searches use their Provider store instead of the global default store", async () => {
    const isolatedStore = createStore();
    isolatedStore.set(pageStatusAtom, PageStatus.SEARCHING);
    plugin.methods.search.mockResolvedValue({ data: [song("isolated")], isEnd: true });
    act(() => {
        renderer = create(
            <Provider store={isolatedStore}>
                <Probe capture={search => { firstSearch = search; }} />
            </Provider>,
        );
    });
    await act(async () => { await firstSearch("song", 1); });

    expect(isolatedStore.get(pageStatusAtom)).toBe(PageStatus.RESULT);
    expect(isolatedStore.get(searchResultsAtom).music[plugin.hash].data).toEqual([song("isolated")]);
    expect(store.get(searchResultsAtom).music).toEqual({});
});
