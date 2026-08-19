import { getCurrentDialog, showDialog } from "@/components/dialogs/useDialog";
import {
    internalFakeSoundKey,
    sortIndexSymbol,
    timeStampSymbol,
} from "@/constants/commonConst";
import { MusicRepeatMode } from "@/constants/repeatModeConst";
import delay from "@/utils/delay";
import getUrlExt from "@/utils/getUrlExt";
import { errorLog, trace } from "@/utils/log";
import { createMediaIndexMap } from "@/utils/mediaIndexMap";
import {
    getLocalPath,
    isSameMediaItem,
} from "@/utils/mediaUtils";
import Network from "@/utils/network";
import PersistStatus from "@/utils/persistStatus";
import { getQualityOrder } from "@/utils/qualities";
import { musicIsPaused } from "@/utils/trackUtils";
import EventEmitter from "eventemitter3";
import { produce } from "immer";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import shuffle from "lodash.shuffle";
import ReactNativeTrackPlayer, {
    Event,
    State,
    Track,
    TrackMetadataBase,
    usePlaybackState,
    useProgress,
} from "react-native-track-player";
import LocalMusicSheet from "../localMusicSheet";

import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import type { IAppConfig } from "@/types/core/config";
import type { IMusicHistory } from "@/types/core/musicHistory";
import { ITrackPlayer } from "@/types/core/trackPlayer/index";
import minDistance from "@/utils/minDistance";
import { IPluginManager } from "@/types/core/pluginManager";
import { ImgAsset } from "@/constants/assetsConst";
import { resolveImportedAssetOrPath } from "@/utils/fileUtils";
import { resolveCompleteLocalPlaybackSource } from "./localPlaybackSource";
import {
    beginPlayRequest,
    getCurrentPlayGeneration,
    getPlaybackTrackTag,
    invalidatePlayRequests,
    isCurrentPlayRequest,
    stripPlaybackTrackTag,
    tagPlaybackTrack,
} from "./playbackSession";



const currentMusicAtom = atom<IMusic.IMusicItem | null>(null);
const repeatModeAtom = atom<MusicRepeatMode>(MusicRepeatMode.QUEUE);
const qualityAtom = atom<IMusic.IQualityKey>("standard");
const playListAtom = atom<IMusic.IMusicItem[]>([]);


class TrackPlayer extends EventEmitter<{
    [TrackPlayerEvents.PlayEnd]: () => void;
    [TrackPlayerEvents.CurrentMusicChanged]: (musicItem: IMusic.IMusicItem | null) => void;
    [TrackPlayerEvents.ProgressChanged]: (progress: {
        position: number;
        duration: number;
    }) => void;
}> implements ITrackPlayer {
    // 依赖
    private configService!: IAppConfig;
    private musicHistoryService!: IMusicHistory;
    private pluginManagerService!: IPluginManager;

    // 当前播放的音乐下标
    private currentIndex = -1;
    // 音乐播放器服务是否启动
    private serviceInited = false;
    // 播放队列索引map
    private playListIndexMap = createMediaIndexMap([] as IMusic.IMusicItem[]);
    private activeSourceGeneration = 0;
    private earlySentinelRecoveryGeneration: number | null = null;
    private handledErrorGeneration: number | null = null;
    private lastPlaybackPosition = 0;
    private lastPlaybackDuration = 0;


    private static maxMusicQueueLength = 10000;
    private static halfMaxMusicQueueLength = 5000;
    private static toggleRepeatMapping = {
        [MusicRepeatMode.SHUFFLE]: MusicRepeatMode.SINGLE,
        [MusicRepeatMode.SINGLE]: MusicRepeatMode.QUEUE,
        [MusicRepeatMode.QUEUE]: MusicRepeatMode.SHUFFLE,
    };
    private static fakeAudioUrl = "musicfree://fake-audio";
    private static proposedAudioUrl = "musicfree://proposed-audio";

    constructor() {
        super();
    }

    public get previousMusic() {
        const currentMusic = this.currentMusic;
        if (!currentMusic) {
            return null;
        }

        return this.getPlayListMusicAt(this.currentIndex - 1);
    }

    public get currentMusic() {
        return getDefaultStore().get(currentMusicAtom);
    }

    public get nextMusic() {
        const currentMusic = this.currentMusic;
        if (!currentMusic) {
            return null;
        }

        return this.getPlayListMusicAt(this.currentIndex + 1);
    }

    public get repeatMode() {
        return getDefaultStore().get(repeatModeAtom);
    }

    public get quality() {
        return getDefaultStore().get(qualityAtom);
    }

    public get playList() {
        return getDefaultStore().get(playListAtom);
    }


    injectDependencies(configService: IAppConfig, musicHistoryService: IMusicHistory, pluginManager: IPluginManager): void {
        this.configService = configService;
        this.musicHistoryService = musicHistoryService;
        this.pluginManagerService = pluginManager;
    }


    async setupTrackPlayer() {
        const rate = PersistStatus.get("music.rate");
        const musicQueue = PersistStatus.get("music.playList");
        const repeatMode = PersistStatus.get("music.repeatMode");
        const progress = PersistStatus.get("music.progress");
        const track = PersistStatus.get("music.musicItem");
        const quality =
            PersistStatus.get("music.quality") ||
            this.configService.getConfig("basic.defaultPlayQuality") ||
            "standard";

        // 状态恢复
        if (rate) {
            ReactNativeTrackPlayer.setRate(+rate / 100);
        }
        if (repeatMode) {
            getDefaultStore().set(repeatModeAtom, repeatMode as MusicRepeatMode);
        }

        if (musicQueue && Array.isArray(musicQueue)) {
            this.addAll(
                musicQueue,
                undefined,
                repeatMode === MusicRepeatMode.SHUFFLE,
            );
        }

        if (track && this.isInPlayList(track)) {
            if (!this.configService.getConfig("basic.autoPlayWhenAppStart")) {
                track.isInit = true;
            }
            const generation = beginPlayRequest();
            this.setCurrentMusic(track);
            void this.restoreTrackSource(track, quality, generation, progress);
        }

        if (!this.serviceInited) {

            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackProgressUpdated,
                evt => {
                    if (
                        this.activeSourceGeneration ===
                            getCurrentPlayGeneration() &&
                        Number.isFinite(evt.position) &&
                        evt.position >= this.lastPlaybackPosition
                    ) {
                        this.lastPlaybackPosition = evt.position;
                    }
                    if (Number.isFinite(evt.duration) && evt.duration > 0) {
                        this.lastPlaybackDuration = evt.duration;
                    }
                },
            );

            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackActiveTrackChanged,
                async evt => {
                    const tag = getPlaybackTrackTag(evt.track);
                    if (
                        evt.index === 1 &&
                        evt.lastIndex === 0 &&
                        evt.track?.url === TrackPlayer.fakeAudioUrl &&
                        tag?.role === "SENTINEL"
                    ) {
                        await this.handleSentinelActivation(tag.generation);
                    }
                },
            );

            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackError,
                async e => {
                    const generation = this.activeSourceGeneration;
                    errorLog("播放出错", e.code);
                    const currentTrack =
                        await ReactNativeTrackPlayer.getActiveTrack();
                    if (!isCurrentPlayRequest(generation)) {
                        return;
                    }
                    const tag = getPlaybackTrackTag(currentTrack);
                    if (currentTrack?.isInit) {
                        await ReactNativeTrackPlayer.updateMetadataForTrack(0, {
                            ...currentTrack,
                            // @ts-ignore
                            isInit: undefined,
                        });
                        return;
                    }

                    const activeIndex =
                        await ReactNativeTrackPlayer.getActiveTrackIndex();
                    if (
                        isCurrentPlayRequest(generation) &&
                        tag?.role === "CONTENT" &&
                        tag.generation === generation &&
                        activeIndex === 0 &&
                        e.message &&
                        e.message !== "android-io-file-not-found"
                    ) {
                        trace("播放出错", { code: e.code });
                        void this.handlePlayFail(generation);
                    }
                },
            );

            this.serviceInited = true;
        }
    }

    /**************** 播放队列 ******************/
    getMusicIndexInPlayList(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) {
            return -1;
        }
        return this.playListIndexMap.getIndex(musicItem);
    }

    isInPlayList(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) {
            return false;
        }

        return this.playListIndexMap.has(musicItem);
    }

    getPlayListMusicAt(index: number): IMusic.IMusicItem | null {
        const playList = this.playList;
        const len = playList.length;
        if (len === 0) {
            return null;
        }
        return playList[(index + len) % len];
    }

    isPlayListEmpty() {
        return this.playList.length === 0;
    }

    /****** 播放逻辑 *****/
    addAll(
        musicItems: Array<IMusic.IMusicItem>,
        beforeIndex?: number,
        shouldShuffle?: boolean,
    ): void {
        const now = Date.now();
        let newPlayList: IMusic.IMusicItem[] = [];
        let currentPlayList = this.playList;
        musicItems.forEach((item, index) => {
            item[timeStampSymbol] = now;
            item[sortIndexSymbol] = index;
        });

        if (beforeIndex === undefined || beforeIndex < 0) {
            // 1.1. 添加到歌单末尾，并过滤掉已有的歌曲
            newPlayList = currentPlayList.concat(
                musicItems.filter(item => !this.isInPlayList(item)),
            );
        } else {
            // 1.2. 新的播放列表，插入
            const indexMap = createMediaIndexMap(musicItems);
            const beforeDraft = currentPlayList
                .slice(0, beforeIndex)
                .filter(item => !indexMap.has(item));
            const afterDraft = currentPlayList
                .slice(beforeIndex)
                .filter(item => !indexMap.has(item));

            newPlayList = [...beforeDraft, ...musicItems, ...afterDraft];
        }

        // 如果太长了
        if (newPlayList.length > TrackPlayer.maxMusicQueueLength) {
            newPlayList = this.shrinkPlayListToSize(
                newPlayList,
                beforeIndex ?? newPlayList.length - 1,
            );
        }

        // 2. 如果需要随机
        if (shouldShuffle) {
            newPlayList = shuffle(newPlayList);
        }
        // 3. 设置播放列表
        this.setPlayList(newPlayList);
    }

    add(
        musicItem: IMusic.IMusicItem | IMusic.IMusicItem[],
        beforeIndex?: number,
    ): void {
        this.addAll(
            Array.isArray(musicItem) ? musicItem : [musicItem],
            beforeIndex,
        );
    }

    addNext(musicItem: IMusic.IMusicItem | IMusic.IMusicItem[]): void {
        const shouldAutoPlay = this.isPlayListEmpty() || !this.currentMusic;

        this.add(musicItem, this.currentIndex + 1);

        if (shouldAutoPlay) {
            this.play(Array.isArray(musicItem) ? musicItem[0] : musicItem);
        }
    }

    async remove(musicItem: IMusic.IMusicItem): Promise<void> {
        const playList = this.playList;

        let newPlayList: IMusic.IMusicItem[] = [];
        let currentMusic: IMusic.IMusicItem | null = this.currentMusic;
        const targetIndex = this.getMusicIndexInPlayList(musicItem);
        let shouldPlayCurrent: boolean | null = null;
        if (targetIndex === -1) {
            // 1. 这种情况应该是出错了
            return;
        }
        // 2. 移除的是当前项
        if (this.currentIndex === targetIndex) {
            // 2.1 停止播放，移除当前项
            newPlayList = produce(playList, draft => {
                draft.splice(targetIndex, 1);
            });
            // 2.2 设置新的播放列表，并更新当前音乐
            if (newPlayList.length === 0) {
                currentMusic = null;
                shouldPlayCurrent = false;
            } else {
                currentMusic = newPlayList[this.currentIndex % newPlayList.length];
                try {
                    const state = (
                        await ReactNativeTrackPlayer.getPlaybackState()
                    ).state;
                    shouldPlayCurrent = !musicIsPaused(state);
                } catch {
                    shouldPlayCurrent = false;
                }
            }
            this.setCurrentMusic(currentMusic);
        } else {
            // 3. 删除
            newPlayList = produce(playList, draft => {
                draft.splice(targetIndex, 1);
            });
        }

        this.setPlayList(newPlayList);
        if (shouldPlayCurrent === true) {
            await this.play(currentMusic, true);
        } else if (shouldPlayCurrent === false) {
            await this.reset();
        }
    }

    async reorderPlayList(
        newPlayList: IMusic.IMusicItem[],
    ): Promise<boolean> {
        const currentPlayList = this.playList;
        const newIndexMap = createMediaIndexMap(newPlayList);

        if (
            newPlayList.length !== currentPlayList.length ||
            currentPlayList.some(item => !newIndexMap.has(item))
        ) {
            return false;
        }

        const timestamp = Date.now();
        newPlayList.forEach((item, index) => {
            item[timeStampSymbol] = timestamp;
            item[sortIndexSymbol] = index;
        });

        this.setPlayList([...newPlayList]);

        try {
            await ReactNativeTrackPlayer.updateMetadataForTrack(
                1,
                this.getFakeNextTrack(),
            );
        } catch {
            // The UI queue is still valid when the native player is not ready.
        }
        return true;
    }

    isCurrentMusic(musicItem?: IMusic.IMusicItem | null) {
        return isSameMediaItem(musicItem, this.currentMusic);
    }

    async play(
        musicItem?: IMusic.IMusicItem | null,
        forcePlay?: boolean,
    ): Promise<void> {
        let generation: number | null = null;
        try {
            if (!musicItem) {
                musicItem = this.currentMusic;
            }
            if (!musicItem) {
                throw new Error(PlayFailReason.PLAY_LIST_IS_EMPTY);
            }

            const isCurrentMusic = this.isCurrentMusic(musicItem);
            generation = forcePlay || !isCurrentMusic
                ? beginPlayRequest()
                : getCurrentPlayGeneration() || beginPlayRequest();
            if (forcePlay || !isCurrentMusic) {
                this.handledErrorGeneration = null;
            }

            if (isCurrentMusic && !forcePlay) {
                const currentTrack = await ReactNativeTrackPlayer.getTrack(0);
                if (!isCurrentPlayRequest(generation)) {
                    return;
                }
                if (
                    currentTrack?.url &&
                    isSameMediaItem(
                        musicItem,
                        currentTrack as IMusic.IMusicItem,
                    )
                ) {
                    const currentActiveIndex =
                        await ReactNativeTrackPlayer.getActiveTrackIndex();
                    if (!isCurrentPlayRequest(generation)) {
                        return;
                    }
                    if (currentActiveIndex !== 0) {
                        await ReactNativeTrackPlayer.skip(0);
                    }
                    const currentState = (
                        await ReactNativeTrackPlayer.getPlaybackState()
                    ).state;
                    if (!isCurrentPlayRequest(generation)) {
                        return;
                    }
                    if (currentState !== State.Stopped) {
                        if (currentState !== State.Playing) {
                            await ReactNativeTrackPlayer.play();
                        }
                        return;
                    }
                }
            }

            const localSource = await resolveCompleteLocalPlaybackSource(
                musicItem,
                () => isCurrentPlayRequest(generation!),
            );
            if (!isCurrentPlayRequest(generation)) {
                return;
            }

            const localPath = getLocalPath(musicItem);
            if (
                !localSource &&
                Network.isCellular &&
                !this.configService.getConfig("basic.useCelluarNetworkPlay") &&
                !LocalMusicSheet.isLocalMusic(musicItem) &&
                !localPath
            ) {
                await this.reset();
                throw new Error(PlayFailReason.FORBID_CELLUAR_NETWORK_PLAY);
            }

            if (!this.isInPlayList(musicItem)) {
                this.add(musicItem);
            }
            this.setCurrentMusic(musicItem);

            const qualityOrder = getQualityOrder(
                this.configService.getConfig("basic.defaultPlayQuality") ??
                    "standard",
                this.configService.getConfig("basic.playQualityOrder") ??
                    "asc",
            );
            const plugin = this.pluginManagerService.getByName(
                musicItem.platform,
            );
            let source: IPlugin.IMediaSourceResult | null = localSource
                ? { url: localSource.playbackUri }
                : null;
            let selectedQuality: IMusic.IQualityKey | null = localSource
                ? qualityOrder[0] ?? "standard"
                : null;

            if (!localSource) {
                const proposedTrack = {
                    ...musicItem,
                    url: TrackPlayer.proposedAudioUrl,
                    artwork: resolveImportedAssetOrPath(
                        musicItem.artwork?.trim?.()?.length
                            ? musicItem.artwork
                            : ImgAsset.albumDefault,
                    ) as unknown as any,
                } as Track;
                if (
                    !(await this.applyNativeSource(
                        proposedTrack,
                        generation,
                        false,
                        false,
                    ))
                ) {
                    return;
                }

                for (const quality of qualityOrder) {
                    const candidate =
                        (await plugin?.getPlaybackMediaSource(
                            musicItem,
                            quality,
                        )) ?? null;
                    if (!isCurrentPlayRequest(generation)) {
                        return;
                    }
                    if (candidate?.url) {
                        source = candidate;
                        selectedQuality = quality;
                        break;
                    }
                }

                if (!source?.url && musicItem.source) {
                    for (const quality of qualityOrder) {
                        const storedSource = musicItem.source[quality];
                        if (storedSource?.url) {
                            source = storedSource;
                            selectedQuality = quality;
                            break;
                        }
                    }
                }

                if (!source?.url && !musicItem.url) {
                    if (
                        this.configService.getConfig(
                            "basic.tryChangeSourceWhenPlayFail",
                        )
                    ) {
                        const similarMusic = await this.getSimilarMusic(
                            musicItem,
                            "music",
                            () => !isCurrentPlayRequest(generation!),
                        );
                        if (!isCurrentPlayRequest(generation)) {
                            return;
                        }
                        if (similarMusic) {
                            const similarLocal =
                                await resolveCompleteLocalPlaybackSource(
                                    similarMusic,
                                    () => isCurrentPlayRequest(generation!),
                                );
                            if (!isCurrentPlayRequest(generation)) {
                                return;
                            }
                            if (similarLocal) {
                                source = { url: similarLocal.playbackUri };
                                selectedQuality =
                                    qualityOrder[0] ?? "standard";
                            } else {
                                const similarPlugin =
                                    this.pluginManagerService.getByMedia(
                                        similarMusic,
                                    );
                                for (const quality of qualityOrder) {
                                    const candidate =
                                        (await similarPlugin?.getPlaybackMediaSource(
                                            similarMusic,
                                            quality,
                                        )) ?? null;
                                    if (!isCurrentPlayRequest(generation)) {
                                        return;
                                    }
                                    if (candidate?.url) {
                                        source = candidate;
                                        selectedQuality = quality;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (!source?.url) {
                        throw new Error(PlayFailReason.INVALID_SOURCE);
                    }
                } else if (!source?.url && musicItem.url) {
                    source = { url: musicItem.url };
                    selectedQuality = "standard";
                }
            }

            if (!source?.url || !isCurrentPlayRequest(generation)) {
                return;
            }
            if (getUrlExt(source.url) === ".m3u8") {
                // @ts-ignore
                source.type = "hls";
            }
            const resolvedTrack = this.mergeTrackSource(
                musicItem,
                source,
            ) as IMusic.IMusicItem;
            this.musicHistoryService.addMusic(musicItem);
            trace("获取音源成功");
            if (
                !(await this.applyNativeSource(
                    resolvedTrack as Track,
                    generation,
                    true,
                ))
            ) {
                return;
            }
            if (selectedQuality) {
                this.setQuality(selectedQuality);
            }

            try {
                const info =
                    (await plugin?.methods?.getMusicInfo?.(musicItem)) ?? null;
                if (!isCurrentPlayRequest(generation) || !info) {
                    return;
                }
                if (
                    (typeof info.url === "string" && info.url.trim() === "") ||
                    (info.url && typeof info.url !== "string")
                ) {
                    delete info.url;
                }
                const mergedTrack = this.mergeTrackSource(resolvedTrack, info);
                getDefaultStore().set(
                    currentMusicAtom,
                    mergedTrack as IMusic.IMusicItem,
                );
                if (!isCurrentPlayRequest(generation)) {
                    return;
                }
                await ReactNativeTrackPlayer.updateMetadataForTrack(
                    0,
                    mergedTrack as TrackMetadataBase,
                );
            } catch { }
        } catch (e: any) {
            const message = e?.message;
            if (
                message ===
                "The player is not initialized. Call setupPlayer first."
            ) {
                if (generation && !isCurrentPlayRequest(generation)) {
                    return;
                }
                await ReactNativeTrackPlayer.setupPlayer();
                if (generation && !isCurrentPlayRequest(generation)) {
                    return;
                }
                await this.play(musicItem, forcePlay);
            } else if (message === PlayFailReason.FORBID_CELLUAR_NETWORK_PLAY) {
                if (getCurrentDialog()?.name !== "SimpleDialog") {
                    showDialog("SimpleDialog", {
                        title: "流量提醒",
                        content:
                            "当前非WIFI环境，侧边栏设置中打开【使用移动网络播放】功能后可继续播放",
                    });
                }
            } else if (message === PlayFailReason.INVALID_SOURCE) {
                trace("音源为空，播放失败");
                if (generation) {
                    await this.handlePlayFail(generation);
                }
            }
        }
    }

    async pause(): Promise<void> {
        await ReactNativeTrackPlayer.pause();
    }

    toggleRepeatMode(): void {
        this.setRepeatMode(TrackPlayer.toggleRepeatMapping[this.repeatMode]);
    }

    // 清空播放队列
    async clearPlayList(): Promise<void> {
        this.setPlayList([]);
        this.setCurrentMusic(null);

        await this.reset();
        PersistStatus.set("music.musicItem", undefined);
        PersistStatus.set("music.progress", 0);
    }

    async skipToNext(): Promise<void> {
        if (this.isPlayListEmpty()) {
            this.setCurrentMusic(null);
            return;
        }

        await this.play(this.getPlayListMusicAt(this.currentIndex + 1), true);
    }

    async skipToPrevious(): Promise<void> {
        if (this.isPlayListEmpty()) {
            this.setCurrentMusic(null);
            return;
        }

        await this.play(
            this.getPlayListMusicAt(this.currentIndex === -1 ? 0 : this.currentIndex - 1),
            true,
        );
    }

    async changeQuality(newQuality: IMusic.IQualityKey): Promise<boolean> {
        if (newQuality === this.quality) {
            return true;
        }
        const musicItem = this.currentMusic;
        const generation = getCurrentPlayGeneration();
        if (!musicItem || !generation) {
            return false;
        }
        try {
            const progress = await ReactNativeTrackPlayer.getProgress();
            if (!isCurrentPlayRequest(generation)) {
                return false;
            }
            const localSource = await resolveCompleteLocalPlaybackSource(
                musicItem,
                () => isCurrentPlayRequest(generation),
            );
            if (!isCurrentPlayRequest(generation)) {
                return false;
            }
            const plugin = this.pluginManagerService.getByMedia(musicItem);
            const newSource = localSource
                ? { url: localSource.playbackUri }
                : await plugin?.getPlaybackMediaSource(
                    musicItem,
                    newQuality,
                );
            if (!isCurrentPlayRequest(generation) || !newSource?.url) {
                return false;
            }
            const playingState = (
                await ReactNativeTrackPlayer.getPlaybackState()
            ).state;
            if (!isCurrentPlayRequest(generation)) {
                return false;
            }
            if (
                !(await this.applyNativeSource(
                    this.mergeTrackSource(
                        musicItem,
                        newSource,
                    ) as unknown as Track,
                    generation,
                    !musicIsPaused(playingState),
                ))
            ) {
                return false;
            }
            await this.seekTo(progress.position ?? 0);
            if (!isCurrentPlayRequest(generation)) {
                return false;
            }
            this.setQuality(newQuality);
            return true;
        } catch {
            return false;
        }
    }

    async playWithReplacePlayList(
        musicItem: IMusic.IMusicItem,
        newPlayList: IMusic.IMusicItem[],
    ): Promise<void> {
        if (newPlayList.length !== 0) {
            const now = Date.now();
            if (newPlayList.length > TrackPlayer.maxMusicQueueLength) {
                newPlayList = this.shrinkPlayListToSize(
                    newPlayList,
                    newPlayList.findIndex(it => isSameMediaItem(it, musicItem)),
                );
            }

            newPlayList.forEach((it, index) => {
                it[timeStampSymbol] = now;
                it[sortIndexSymbol] = index;
            });

            this.setPlayList(
                this.repeatMode === MusicRepeatMode.SHUFFLE
                    ? shuffle(newPlayList)
                    : newPlayList,
            );
            await this.play(musicItem, true);
        }
    }

    async seekTo(progress: number) {
        PersistStatus.set("music.progress", progress);
        this.lastPlaybackPosition = progress;
        return ReactNativeTrackPlayer.seekTo(progress);
    }

    getProgress = ReactNativeTrackPlayer.getProgress;
    getRate = ReactNativeTrackPlayer.getRate;
    setRate = ReactNativeTrackPlayer.setRate;

    async reset() {
        invalidatePlayRequests();
        this.activeSourceGeneration = 0;
        this.earlySentinelRecoveryGeneration = null;
        await ReactNativeTrackPlayer.reset();
    }


    /**************** 辅助函数 -- 设置内部状态 ****************/

    private setCurrentMusic(musicItem?: IMusic.IMusicItem | null) {
        // 设置UI内部状态的musicitem
        if (!musicItem) {
            invalidatePlayRequests();
            this.activeSourceGeneration = 0;
            this.earlySentinelRecoveryGeneration = null;
            this.currentIndex = -1;
            getDefaultStore().set(currentMusicAtom, null);
            PersistStatus.set("music.musicItem", undefined);
            PersistStatus.set("music.progress", 0);

            this.emit(TrackPlayerEvents.CurrentMusicChanged, null);
            return;
        }
        if (typeof musicItem.artwork !== "string") {
            musicItem.artwork = ImgAsset.albumDefault;
        }
        this.currentIndex = this.getMusicIndexInPlayList(musicItem);
        getDefaultStore().set(currentMusicAtom, musicItem);

        this.emit(TrackPlayerEvents.CurrentMusicChanged, musicItem);
    }

    private setRepeatMode(mode: MusicRepeatMode) {
        const playList = this.playList;
        let newPlayList: IMusic.IMusicItem[];
        const prevMode = getDefaultStore().get(repeatModeAtom);
        if (
            (prevMode === MusicRepeatMode.SHUFFLE &&
                mode !== MusicRepeatMode.SHUFFLE) ||
            (mode === MusicRepeatMode.SHUFFLE &&
                prevMode !== MusicRepeatMode.SHUFFLE)
        ) {
            if (mode === MusicRepeatMode.SHUFFLE) {
                newPlayList = shuffle(playList);
            } else {
                newPlayList = this.sortByTimestampAndIndex(playList, true);
            }
            this.setPlayList(newPlayList);
        }

        getDefaultStore().set(repeatModeAtom, mode);
        // 更新下一首歌的信息
        ReactNativeTrackPlayer.updateMetadataForTrack(
            1,
            this.getFakeNextTrack(),
        );
        // 记录
        PersistStatus.set("music.repeatMode", mode);
    }

    private setQuality(quality: IMusic.IQualityKey) {
        getDefaultStore().set(qualityAtom, quality);
        PersistStatus.set("music.quality", quality);
    }

    private async applyNativeSource(
        track: Track,
        generation: number,
        autoPlay = true,
        persist = true,
    ): Promise<boolean> {
        if (!isCurrentPlayRequest(generation)) {
            return false;
        }
        const logicalTrack = stripPlaybackTrackTag(track);
        const clonedTrack = this.patchMediaArtwork(logicalTrack);
        if (!clonedTrack) {
            return false;
        }
        const contentTrack = tagPlaybackTrack(
            clonedTrack,
            generation,
            "CONTENT",
        );
        const sentinelTrack = this.getFakeNextTrack(generation);
        this.activeSourceGeneration = generation;
        this.earlySentinelRecoveryGeneration = null;
        this.lastPlaybackPosition = 0;
        this.lastPlaybackDuration =
            Number.isFinite(Number(logicalTrack.duration)) &&
            Number(logicalTrack.duration) > 0
                ? Number(logicalTrack.duration)
                : 0;
        await ReactNativeTrackPlayer.setQueue([contentTrack, sentinelTrack]);
        if (!isCurrentPlayRequest(generation)) {
            return false;
        }
        if (persist) {
            PersistStatus.set(
                "music.musicItem",
                logicalTrack as IMusic.IMusicItem,
            );
            PersistStatus.set("music.progress", 0);
        }
        if (autoPlay) {
            await ReactNativeTrackPlayer.play();
            if (!isCurrentPlayRequest(generation)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 设置播放队列
     * @param newPlayList 播放队列
     * @param persist 是否持久化
     */
    private setPlayList(newPlayList: IMusic.IMusicItem[], persist = true) {
        getDefaultStore().set(playListAtom, newPlayList);

        this.playListIndexMap = createMediaIndexMap(newPlayList);

        if (persist) {
            PersistStatus.set("music.playList", newPlayList);
        }

        this.currentIndex = this.getMusicIndexInPlayList(this.currentMusic);
    }


    /**************** 辅助函数 -- 工具方法 ****************/
    private shrinkPlayListToSize = (
        queue: IMusic.IMusicItem[],
        targetIndex = this.currentIndex,
    ) => {
        // 播放列表上限，太多无法缓存状态
        if (queue.length > TrackPlayer.maxMusicQueueLength) {
            if (targetIndex < TrackPlayer.halfMaxMusicQueueLength) {
                queue = queue.slice(0, TrackPlayer.maxMusicQueueLength);
            } else {
                const right = Math.min(
                    queue.length,
                    targetIndex + TrackPlayer.halfMaxMusicQueueLength,
                );
                const left = Math.max(0, right - TrackPlayer.maxMusicQueueLength);
                queue = queue.slice(left, right);
            }
        }
        return queue;
    };

    private mergeTrackSource(
        mediaItem: ICommon.IMediaBase,
        props: Record<string, any> | undefined,
    ) {
        return props
            ? {
                ...mediaItem,
                ...props,
                id: mediaItem.id,
                platform: mediaItem.platform,
            }
            : mediaItem;
    }

    private sortByTimestampAndIndex(array: any[], newArray = false) {
        if (newArray) {
            array = [...array];
        }
        return array.sort((a, b) => {
            const ts = a[timeStampSymbol] - b[timeStampSymbol];
            if (ts !== 0) {
                return ts;
            }
            return a[sortIndexSymbol] - b[sortIndexSymbol];
        });
    }

    private async restoreTrackSource(
        track: IMusic.IMusicItem,
        quality: IMusic.IQualityKey,
        generation: number,
        progress?: number,
    ): Promise<void> {
        const localSource = await resolveCompleteLocalPlaybackSource(
            track,
            () => isCurrentPlayRequest(generation),
        );
        if (!isCurrentPlayRequest(generation)) {
            return;
        }
        const plugin = this.pluginManagerService.getByMedia(track);
        const source = localSource
            ? { url: localSource.playbackUri }
            : await plugin?.getPlaybackMediaSource(track, quality);
        if (!isCurrentPlayRequest(generation)) {
            return;
        }
        const url = source?.url || track.url;
        if (!url) {
            return;
        }
        const restoredTrack = {
            ...track,
            url,
            headers: source?.headers || track.headers,
        } as Track;
        if (
            !(await this.applyNativeSource(
                restoredTrack,
                generation,
                false,
            ))
        ) {
            return;
        }
        if (progress && isCurrentPlayRequest(generation)) {
            await this.seekTo(progress);
        }
    }

    private async handleSentinelActivation(
        generation: number,
    ): Promise<void> {
        if (
            !isCurrentPlayRequest(generation) ||
            generation !== this.activeSourceGeneration
        ) {
            return;
        }
        const mediaDuration = Number(this.currentMusic?.duration);
        const duration = this.lastPlaybackDuration > 0
            ? this.lastPlaybackDuration
            : mediaDuration;
        const position = this.lastPlaybackPosition;
        const hasNaturalEndEvidence =
            Number.isFinite(duration) &&
            duration > 0 &&
            Number.isFinite(position) &&
            position >= duration - Math.max(5, duration * 0.02);

        if (hasNaturalEndEvidence) {
            this.emit(TrackPlayerEvents.PlayEnd);
            // A due after-current schedule resets synchronously in its listener,
            // invalidating this generation before ordinary next can run.
            if (!isCurrentPlayRequest(generation)) {
                return;
            }
            if (this.repeatMode === MusicRepeatMode.SINGLE) {
                await this.play(null, true);
            } else {
                await this.skipToNext();
            }
            return;
        }

        const recoveryAlreadyUsed =
            this.earlySentinelRecoveryGeneration === generation;
        this.earlySentinelRecoveryGeneration = generation;
        await ReactNativeTrackPlayer.skip(0);
        if (!isCurrentPlayRequest(generation)) {
            return;
        }
        await ReactNativeTrackPlayer.seekTo(Math.max(0, position));
        if (!isCurrentPlayRequest(generation)) {
            return;
        }
        if (recoveryAlreadyUsed) {
            await ReactNativeTrackPlayer.pause();
        } else {
            await ReactNativeTrackPlayer.play();
        }
    }

    private getFakeNextTrack(generation = getCurrentPlayGeneration()) {
        let track: Track | undefined;
        const repeatMode = this.repeatMode;
        if (repeatMode === MusicRepeatMode.SINGLE) {
            // 单曲循环
            track = this.getPlayListMusicAt(this.currentIndex) as Track;
        } else {
            // 下一曲
            track = this.getPlayListMusicAt(this.currentIndex + 1) as Track;
        }

        const sentinelTrack = track
            ? produce(track, _ => {
                _.url = TrackPlayer.fakeAudioUrl;
                _.$ = internalFakeSoundKey;
                _.artwork = resolveImportedAssetOrPath(
                    ImgAsset.albumDefault,
                ) as unknown as any;
            })
            : ({
                url: TrackPlayer.fakeAudioUrl,
                $: internalFakeSoundKey,
            } as Track);
        return tagPlaybackTrack(sentinelTrack, generation, "SENTINEL");
    }


    private async handlePlayFail(generation: number) {
        if (
            this.handledErrorGeneration === generation ||
            !isCurrentPlayRequest(generation)
        ) {
            return;
        }
        this.handledErrorGeneration = generation;
        if (!this.configService.getConfig("basic.autoStopWhenError")) {
            await delay(500);
            if (!isCurrentPlayRequest(generation)) {
                return;
            }
            await this.skipToNext();
        }
    }

    /**
 *
 * @param musicItem 音乐类型
 * @param type 媒体类型
 * @param abortFunction 如果函数为true，则中断
 * @returns
 */
    private async getSimilarMusic<T extends ICommon.SupportMediaType>(
        musicItem: IMusic.IMusicItem,
        type: T = "music" as T,
        abortFunction?: () => boolean,
    ): Promise<ICommon.SupportMediaItemBase[T] | null> {
        const keyword = musicItem.alias || musicItem.title;
        const plugins = this.pluginManagerService.getSearchablePlugins(type);

        let distance = Infinity;
        let minDistanceMusicItem;
        let targetPlugin;

        const startTime = Date.now();

        for (let plugin of plugins) {
            // 超时时间：8s
            if (abortFunction?.() || Date.now() - startTime > 8000) {
                break;
            }
            if (plugin.name === musicItem.platform) {
                continue;
            }
            const results = await plugin.methods
                .search(keyword, 1, type)
                .catch(() => null);

            // 取前两个
            const firstTwo = results?.data?.slice(0, 2) || [];

            for (let item of firstTwo) {
                if (item.title === keyword && item.artist === musicItem.artist) {
                    distance = 0;
                    minDistanceMusicItem = item;
                    targetPlugin = plugin;
                    break;
                } else {
                    const dist =
                        minDistance(keyword, musicItem.title) +
                        minDistance(item.artist, musicItem.artist);
                    if (dist < distance) {
                        distance = dist;
                        minDistanceMusicItem = item;
                        targetPlugin = plugin;
                    }
                }
            }

            if (distance === 0) {
                break;
            }
        }
        if (minDistanceMusicItem && targetPlugin) {
            return minDistanceMusicItem as ICommon.SupportMediaItemBase[T];
        }

        return null;
    }


    private patchMediaArtwork(track: Track) {
        // Bug: React native track player 在设置音频时，artwork不能为null，并且部分情况下artwork不能为ImageSource类型
        if (!track) {
            return null;
        }
        return {
            ...track,
            artwork: resolveImportedAssetOrPath(
                track.artwork?.trim?.()?.length ? track.artwork : ImgAsset.albumDefault,
            ) as unknown as any,
        };
    }

}

export const usePlayList = () => useAtomValue(playListAtom);
export const useCurrentMusic = () => useAtomValue(currentMusicAtom);
export const useRepeatMode = () => useAtomValue(repeatModeAtom);
export const useMusicQuality = () => useAtomValue(qualityAtom);
export function useMusicState() {
    const playbackState = usePlaybackState();

    return playbackState.state;
}
export { State as MusicState, useProgress };

enum PlayFailReason {
    /** 禁止移动网络播放 */
    FORBID_CELLUAR_NETWORK_PLAY = "FORBID_CELLUAR_NETWORK_PLAY",
    /** 播放列表为空 */
    PLAY_LIST_IS_EMPTY = "PLAY_LIST_IS_EMPTY",
    /** 无效源 */
    INVALID_SOURCE = "INVALID_SOURCE",
    /** 非当前音乐 */
}

const trackPlayer = new TrackPlayer();
export default trackPlayer;
