import {
    StorageKeys,
    internalSerializeKey,
    supportLocalMediaType,
} from "@/constants/commonConst";
import mp3Util, { IBasicMeta, ILocalMediaFile } from "@/native/mp3Util";
import { getFileName } from "@/utils/fileUtils.ts";
import { getLocalPath, isSameMediaItem } from "@/utils/mediaUtils";
import StateMapper from "@/utils/stateMapper";
import { getStorage, setStorage } from "@/utils/storage";
import CryptoJs from "crypto-js";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { ReadDirItem, exists, readDir, unlink } from "react-native-fs";

let localSheet: IMusic.IMusicItem[] = [];
const localSheetStateMapper = new StateMapper(() => localSheet);

function fileSystemPath(path: string) {
    if (!path.toLowerCase().startsWith("file://")) {
        return path;
    }
    try {
        return decodeURIComponent(path.slice(7));
    } catch {
        return path.slice(7);
    }
}

async function isPersistedLocalPathValid(localPath: string) {
    if (localPath.toLowerCase().startsWith("content://")) {
        // MediaStore URIs remain addressable after restart while the runtime audio
        // permission is granted. RNFS.exists cannot validate content:// URIs.
        return true;
    }
    try {
        return await exists(fileSystemPath(localPath));
    } catch {
        return false;
    }
}

export async function setup() {
    const sheet = await getStorage(StorageKeys.LocalMusicSheet);
    if (sheet) {
        const validity = await Promise.all(
            sheet.map(async musicItem => {
                const localPath = getLocalPath(musicItem);
                return (
                    !!localPath && (await isPersistedLocalPathValid(localPath))
                );
            }),
        );
        const validSheet = sheet.filter((_, index) => validity[index]);
        if (validSheet.length !== sheet.length) {
            await setStorage(StorageKeys.LocalMusicSheet, validSheet);
        }
        localSheet = validSheet;
    } else {
        await setStorage(StorageKeys.LocalMusicSheet, []);
    }
    localSheetStateMapper.notify();
}

export async function addMusic(
    musicItem: IMusic.IMusicItem | IMusic.IMusicItem[],
) {
    if (!Array.isArray(musicItem)) {
        musicItem = [musicItem];
    }
    let newSheet = [...localSheet];
    musicItem.forEach(mi => {
        if (localSheet.findIndex(_ => isSameMediaItem(mi, _)) === -1) {
            newSheet.push(mi);
        }
    });
    await setStorage(StorageKeys.LocalMusicSheet, newSheet);
    localSheet = newSheet;
    localSheetStateMapper.notify();
}

function addMusicDraft(musicItem: IMusic.IMusicItem | IMusic.IMusicItem[]) {
    if (!Array.isArray(musicItem)) {
        musicItem = [musicItem];
    }
    let newSheet = [...localSheet];
    musicItem.forEach(mi => {
        if (localSheet.findIndex(_ => isSameMediaItem(mi, _)) === -1) {
            newSheet.push(mi);
        }
    });
    localSheet = newSheet;
    localSheetStateMapper.notify();
}

async function saveLocalSheet() {
    await setStorage(StorageKeys.LocalMusicSheet, localSheet);
}

export async function removeMusic(
    musicItem: IMusic.IMusicItem,
    deleteOriginalFile = false,
) {
    const idx = localSheet.findIndex(_ => isSameMediaItem(_, musicItem));
    let newSheet = [...localSheet];
    if (idx !== -1) {
        const localMusicItem = localSheet[idx];
        newSheet.splice(idx, 1);
        const localPath =
            musicItem[internalSerializeKey]?.localPath ??
            localMusicItem[internalSerializeKey]?.localPath;
        if (deleteOriginalFile && localPath) {
            try {
                await unlink(localPath);
            } catch (e: any) {
                if (e.message !== "File does not exist") {
                    throw e;
                }
            }
        }
    }
    localSheet = newSheet;
    localSheetStateMapper.notify();
    saveLocalSheet();
}

function parseFilename(fn: string): Partial<IMusic.IMusicItem> | null {
    const data = fn.slice(0, fn.lastIndexOf(".")).split("@");
    const [platform, id, title, artist] = data;
    if (!platform || !id) {
        return null;
    }
    return {
        id,
        platform: platform,
        title: title ?? "",
        artist: artist ?? "",
    };
}

function localMediaFilter(filename: string) {
    const normalized = filename.toLowerCase();
    return supportLocalMediaType.some(ext => normalized.endsWith(ext));
}

function normalizeStoragePath(path: string) {
    let normalized = fileSystemPath(path)
        .trim()
        .replace(/\\/g, "/")
        .replace(/\/{2,}/g, "/")
        .replace(/\/$/, "")
        .toLowerCase();
    const aliases = [
        "/sdcard",
        "/mnt/sdcard",
        "/storage/self/primary",
        "/storage/emulated/legacy",
    ];
    const alias = aliases.find(
        candidate =>
            normalized === candidate || normalized.startsWith(`${candidate}/`),
    );
    if (alias) {
        normalized = `/storage/emulated/0${normalized.slice(alias.length)}`;
    }
    return normalized || "/";
}

interface DiscoveredMedia {
    uri: string;
    displayName?: string;
    sourcePath?: string;
}

function addDiscoveredMedia(
    media: DiscoveredMedia,
    bySourcePath: Map<string, DiscoveredMedia>,
    byUri: Map<string, DiscoveredMedia>,
) {
    const sourceKey = media.sourcePath
        ? normalizeStoragePath(media.sourcePath)
        : undefined;
    const uriKey = media.uri.toLowerCase();
    if (
        byUri.has(uriKey) ||
        (sourceKey !== undefined && bySourcePath.has(sourceKey))
    ) {
        return;
    }
    byUri.set(uriKey, media);
    if (sourceKey !== undefined) {
        bySourcePath.set(sourceKey, media);
    }
}

function nativeErrorCode(error: unknown) {
    if (!error || typeof error !== "object") {
        return "";
    }
    const candidate = error as { code?: unknown; message?: unknown };
    return `${candidate.code ?? candidate.message ?? ""}`;
}

let importToken: string | null = null;
// 获取本地的文件列表
async function getMusicStats(inputFolderPaths: string[]) {
    const _importToken = nanoid();
    importToken = _importToken;
    const selectedFolders = [
        ...new Map(
            inputFolderPaths
                .filter(Boolean)
                .map(path => [normalizeStoragePath(path), path] as const),
        ).values(),
    ];
    const folderQueue = [...selectedFolders];
    const visitedFolders = new Set<string>();
    const unreadableFolders = new Map<string, string>();
    const bySourcePath = new Map<string, DiscoveredMedia>();
    const byUri = new Map<string, DiscoveredMedia>();

    while (folderQueue.length !== 0) {
        if (importToken !== _importToken) {
            throw new Error("Import Broken");
        }
        const folderPath = folderQueue.shift() as string;
        const folderKey = normalizeStoragePath(folderPath);
        if (visitedFolders.has(folderKey)) {
            continue;
        }
        visitedFolders.add(folderKey);

        let dirFiles: ReadDirItem[];
        try {
            dirFiles = await readDir(folderPath);
        } catch {
            unreadableFolders.set(folderKey, folderPath);
            continue;
        }

        dirFiles.forEach(item => {
            if (item.isDirectory()) {
                const itemKey = normalizeStoragePath(item.path);
                if (!visitedFolders.has(itemKey)) {
                    folderQueue.push(item.path);
                }
            } else if (item.isFile() && localMediaFilter(item.path)) {
                addDiscoveredMedia(
                    {
                        uri: item.path,
                        displayName: item.name,
                        sourcePath: item.path,
                    },
                    bySourcePath,
                    byUri,
                );
            }
        });
    }

    const fallbackFolders =
        unreadableFolders.size > 0
            ? [...unreadableFolders.values()]
            : byUri.size === 0
                ? selectedFolders
                : [];
    if (fallbackFolders.length > 0) {
        let mediaStoreFiles: ILocalMediaFile[];
        try {
            mediaStoreFiles = await mp3Util.findAudioInFolders(
                fallbackFolders,
                supportLocalMediaType,
            );
        } catch (error) {
            const code = nativeErrorCode(error);
            throw new Error(
                code.includes("MEDIA_STORE_PERMISSION_DENIED")
                    ? "LOCAL_MEDIA_ACCESS_DENIED"
                    : "LOCAL_MEDIA_SCAN_FAILED",
            );
        }
        mediaStoreFiles.forEach(media => {
            if (
                media?.uri?.toLowerCase().startsWith("content://") &&
                localMediaFilter(media.displayName ?? media.sourcePath ?? "")
            ) {
                addDiscoveredMedia(media, bySourcePath, byUri);
            }
        });
    }

    return { musicList: [...byUri.values()], token: _importToken };
}

function cancelImportLocal() {
    importToken = null;
}

// 导入本地音乐
const groupNum = 25;
async function importLocal(folderPaths: string[]) {
    const { musicList, token } = await getMusicStats(folderPaths);
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    if (musicList.length === 0) {
        throw new Error("NO_LOCAL_MEDIA_FOUND");
    }
    // 分组请求，不然序列化可能出问题
    let metas: IBasicMeta[] = [];
    const groups = Math.ceil(musicList.length / groupNum);
    for (let i = 0; i < groups; ++i) {
        metas = metas.concat(
            await mp3Util.getMediaMeta(
                musicList
                    .slice(i * groupNum, (i + 1) * groupNum)
                    .map(media => media.uri),
            ),
        );
    }
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    const musicItems: IMusic.IMusicItem[] = await Promise.all(
        musicList.map(async (media, index) => {
            const musicPath = media.uri;
            const fileName = media.displayName ?? getFileName(musicPath, true);
            let { platform, id, title, artist } = parseFilename(fileName) ?? {};
            const meta = metas[index];
            if (!platform || !id) {
                platform = "本地";
                id = CryptoJs.MD5(musicPath).toString(CryptoJs.enc.Hex);
            }
            return {
                id,
                platform,
                title: title ?? meta?.title ?? getFileName(fileName),
                artist: artist ?? meta?.artist ?? "未知歌手",
                duration: parseInt(meta?.duration ?? "0", 10) / 1000,
                album: meta?.album ?? "未知专辑",
                artwork: "",
                [internalSerializeKey]: {
                    localPath: musicPath,
                },
            } as IMusic.IMusicItem;
        }),
    );
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    await addMusic(musicItems);
}

/** 是否为本地音乐 */
function isLocalMusic(
    musicItem: ICommon.IMediaBase | null,
): IMusic.IMusicItem | undefined {
    return musicItem
        ? localSheet.find(_ => isSameMediaItem(_, musicItem))
        : undefined;
}

/** 状态-是否为本地音乐 */
function useIsLocal(musicItem: IMusic.IMusicItem | null) {
    const localMusicState = localSheetStateMapper.useMappedState();
    const [isLocal, setIsLocal] = useState<boolean>(!!isLocalMusic(musicItem));
    useEffect(() => {
        if (!musicItem) {
            setIsLocal(false);
        } else {
            setIsLocal(!!isLocalMusic(musicItem));
        }
    }, [localMusicState, musicItem]);
    return isLocal;
}

function getMusicList() {
    return localSheet;
}

async function updateMusicList(newSheet: IMusic.IMusicItem[]) {
    const _localSheet = [...newSheet];
    try {
        await setStorage(StorageKeys.LocalMusicSheet, _localSheet);
        localSheet = _localSheet;
        localSheetStateMapper.notify();
    } catch {}
}

const LocalMusicSheet = {
    setup,
    addMusic,
    removeMusic,
    addMusicDraft,
    saveLocalSheet,
    importLocal,
    cancelImportLocal,
    isLocalMusic,
    useIsLocal,
    getMusicList,
    useMusicList: localSheetStateMapper.useMappedState,
    updateMusicList,
};

export default LocalMusicSheet;
