import type { Track } from "react-native-track-player";

const playbackTagKey = "__echoPlayback";
const playbackTagVersion = "1";

export type PlaybackTrackRole = "CONTENT" | "SENTINEL";

export interface PlaybackTrackTag {
    generation: number;
    role: PlaybackTrackRole;
}

let playGeneration = 0;

export function beginPlayRequest(): number {
    return ++playGeneration;
}

export function invalidatePlayRequests(): number {
    return ++playGeneration;
}

export function getCurrentPlayGeneration(): number {
    return playGeneration;
}

export function isCurrentPlayRequest(generation: number): boolean {
    return generation === playGeneration;
}

export function tagPlaybackTrack<T extends Track>(
    track: T,
    generation: number,
    role: PlaybackTrackRole,
): T {
    return {
        ...track,
        [playbackTagKey]: `${playbackTagVersion}:${generation}:${role}`,
    };
}

export function stripPlaybackTrackTag<T extends Track>(track: T): T {
    const logicalTrack = { ...track } as T & Record<string, unknown>;
    delete logicalTrack[playbackTagKey];
    return logicalTrack;
}

export function getPlaybackTrackTag(
    track: Track | null | undefined,
): PlaybackTrackTag | null {
    const value = track?.[playbackTagKey];
    if (typeof value !== "string") {
        return null;
    }
    const [version, rawGeneration, role] = value.split(":");
    const generation = Number(rawGeneration);
    if (
        version !== playbackTagVersion ||
        !Number.isInteger(generation) ||
        generation <= 0 ||
        (role !== "CONTENT" && role !== "SENTINEL")
    ) {
        return null;
    }
    return { generation, role };
}
