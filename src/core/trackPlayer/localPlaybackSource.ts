import { getLocalPath } from "@/utils/mediaUtils";
import {
    EncodingType,
    getInfoAsync,
    readAsStringAsync,
} from "expo-file-system";

export interface CompleteLocalPlaybackSource {
    playbackUri: string;
}

function encodeAbsolutePath(path: string): string {
    return path
        .split("/")
        .map((segment, index) =>
            index === 0 ? "" : encodeURIComponent(segment),
        )
        .join("/");
}

function normalizeLocalUri(candidate: string): string | null {
    if (candidate.startsWith("/")) {
        return `file://${encodeAbsolutePath(candidate)}`;
    }
    if (candidate.startsWith("file://")) {
        return candidate;
    }
    if (candidate.startsWith("content://")) {
        return candidate;
    }
    return null;
}

export async function resolveCompleteLocalPlaybackSource(
    mediaItem: ICommon.IMediaBase,
    isFresh: () => boolean,
): Promise<CompleteLocalPlaybackSource | null> {
    const candidate = getLocalPath(mediaItem);
    const playbackUri = candidate ? normalizeLocalUri(candidate) : null;
    if (!playbackUri || !isFresh()) {
        return null;
    }

    try {
        const info = await getInfoAsync(playbackUri, { size: true });
        if (
            !isFresh() ||
            !info.exists ||
            info.isDirectory ||
            (playbackUri.startsWith("file://") &&
                (!Number.isFinite(info.size) || info.size <= 0))
        ) {
            return null;
        }

        const firstByte = await readAsStringAsync(playbackUri, {
            encoding: EncodingType.Base64,
            length: 1,
            position: 0,
        });
        if (!isFresh() || !firstByte) {
            return null;
        }
        return { playbackUri };
    } catch {
        return null;
    }
}
