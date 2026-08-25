import {
    internalSerializeKey,
    localPluginPlatform,
    supportLocalMediaType,
} from "@/constants/commonConst";
import appConfig from "@/core/appConfig";
import pathConst from "@/constants/pathConst";
import { escapeCharacter } from "@/utils/fileUtils";
import { exists, readDir } from "react-native-fs";
import { getMediaExtraProperty, patchMediaExtra } from "./mediaExtra";

/**
 * 获取媒体资源的唯一key
 * @param mediaItem 
 * @returns 
 */
export function getMediaUniqueKey(mediaItem: ICommon.IMediaBase) {
    return `${mediaItem.platform}@${mediaItem.id}`;
}

/**
 * 解析媒体资源的唯一key
 * @param key 
 * @returns 
 */
export function parseMediaUniqueKey(key: string): ICommon.IMediaBase {
    try {
        const str = JSON.parse(key.trim());
        let platform, id;
        if (typeof str === "string") {
            [platform, id] = str.split("@");
        } else {
            platform = str?.platform;
            id = str?.id;
        }
        if (!platform || !id) {
            throw new Error("mediakey不完整");
        }
        return {
            platform,
            id,
        };
    } catch (e: any) {
        throw e;
    }
}

/**
 * 比较两个媒体资源是否相同
 * @param a 
 * @param b 
 * @returns 
 */
export function isSameMediaItem(
    a: ICommon.IMediaBase | null | undefined,
    b: ICommon.IMediaBase | null | undefined,
) {
    // eslint-disable-next-line eqeqeq
    return !!(a && b && a.id == b.id && a.platform === b.platform);
}


/** 获取复位的mediaItem */
export function resetMediaItem<T extends ICommon.IMediaBase>(
    mediaItem: T,
    platform?: string,
    newObj?: boolean,
): T {
    // 本地音乐不做处理
    if (
        mediaItem.platform === localPluginPlatform ||
        platform === localPluginPlatform
    ) {
        return newObj ? { ...mediaItem } : mediaItem;
    }
    if (!newObj) {
        mediaItem.platform = platform ?? mediaItem.platform;
        mediaItem[internalSerializeKey] = undefined;
        return mediaItem;
    } else {
        return {
            ...mediaItem,
            platform: platform ?? mediaItem.platform,
            [internalSerializeKey]: undefined,
        };
    }
}

/**
 * 获取媒体资源的本地路径，如果本地路径不存在，则返回null
 * @param mediaItem 
 * @returns 
 */
export function getLocalPath(mediaItem: ICommon.IMediaBase) {
    if (!mediaItem) {
        return null;
    }

    // 如果本身就是一个内部音乐
    if (mediaItem.url && (mediaItem.url.startsWith("file://") || mediaItem.url.startsWith("content://"))) {
        return mediaItem.url;
    }

    // 尝试从内部数据中获取 -- legacy logic
    const legacyLocalPath = mediaItem?.[internalSerializeKey]?.localPath;
    if (legacyLocalPath && typeof legacyLocalPath === "string") {
        return legacyLocalPath;
    }

    // 从附加信息中获取
    const localPathInMediaExtra = getMediaExtraProperty(mediaItem, "localPath");

    return localPathInMediaExtra ?? null;
}

interface IDownloadDirFile {
    name: string;
    path: string;
}

const DOWNLOAD_DIR_CACHE_TTL = 30_000;
let downloadDirCache: IDownloadDirFile[] | null = null;
let downloadDirCacheTime = 0;

function normalizeFilePath(filePath: string) {
    return filePath.startsWith("file://") ? filePath.slice(7) : filePath;
}

async function getDownloadDirFiles(force = false): Promise<IDownloadDirFile[]> {
    const now = Date.now();
    if (
        !force &&
        downloadDirCache &&
        now - downloadDirCacheTime < DOWNLOAD_DIR_CACHE_TTL
    ) {
        return downloadDirCache;
    }

    const downloadPath =
        appConfig.getConfig("basic.downloadPath") ?? pathConst.downloadMusicPath;
    try {
        const files = await readDir(normalizeFilePath(downloadPath));
        downloadDirCache = files
            .filter(
                file =>
                    file.isFile() &&
                    supportLocalMediaType.some(ext =>
                        file.name.toLowerCase().endsWith(ext),
                    ),
            )
            .map(file => ({ name: file.name, path: file.path }));
        downloadDirCacheTime = now;
    } catch {
        downloadDirCache = [];
        downloadDirCacheTime = now;
    }
    return downloadDirCache;
}

/** 下载完成或本地文件变更时调用，确保下一次播放重新检查目录。 */
export function invalidateDownloadDirCache() {
    downloadDirCache = null;
    downloadDirCacheTime = 0;
}

/**
 * 返回已关联的本地路径；如果歌曲曾由其他插件下载，则按下载文件名中的
 * 「标题@作者」回退匹配。只接受支持的音频文件，并在返回前再次验证文件存在。
 */
export async function getLocalPathWithFallback(
    mediaItem: ICommon.IMediaBase,
): Promise<string | null> {
    if (!mediaItem) {
        return null;
    }

    const standardPath = getLocalPath(mediaItem);
    if (standardPath) {
        if (standardPath.startsWith("content://")) {
            return standardPath;
        }
        try {
            if (await exists(normalizeFilePath(standardPath))) {
                return standardPath;
            }
        } catch {
            // Continue to the download-directory fallback below.
        }
    }

    const title = escapeCharacter(mediaItem.title);
    const artist = escapeCharacter(mediaItem.artist);
    if (!title || !artist) {
        return null;
    }

    const filenameFragment = `${title}@${artist}`;
    const files = await getDownloadDirFiles();
    for (const file of files) {
        if (!file.name.includes(filenameFragment)) {
            continue;
        }
        try {
            if (!(await exists(normalizeFilePath(file.path)))) {
                invalidateDownloadDirCache();
                continue;
            }
        } catch {
            continue;
        }

        patchMediaExtra(mediaItem, {
            localPath: file.path,
            downloaded: true,
        });
        return file.path;
    }

    return null;
}