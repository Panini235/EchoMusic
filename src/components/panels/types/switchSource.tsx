import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { FlatList, Pressable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import rpx, { vh } from "@/utils/rpx";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import { hidePanel } from "../usePanel";
import PanelBase from "../base/panelBase";
import PanelHeader from "../base/panelHeader";
import PluginManager, { Plugin } from "@/core/pluginManager";
import MusicSheet from "@/core/musicSheet";
import LocalMusicSheet from "@/core/localMusicSheet";
import musicHistory from "@/core/musicHistory";
import TrackPlayer from "@/core/trackPlayer";
import {
    localMusicSheetId,
    localPluginPlatform,
    musicHistorySheetId,
} from "@/constants/commonConst";
import { isSameMediaItem } from "@/utils/mediaUtils";
import { useI18N } from "@/core/i18n";

interface ISwitchSourceProps {
    musicItem: IMusic.IMusicItem;
    musicSheet?: IMusic.IMusicSheetItem;
}

export default function SwitchSource(props: ISwitchSourceProps) {
    const { musicItem, musicSheet } = props;
    const { t } = useI18N();
    const colors = useColors();
    const safeAreaInsets = useSafeAreaInsets();
    const plugins = useMemo(
        () => PluginManager.getSortedSearchablePlugins("music"),
        [],
    );
    const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
    const [query, setQuery] = useState(
        [musicItem?.title, musicItem?.artist].filter(Boolean).join(" "),
    );
    const [results, setResults] = useState<IMusic.IMusicItem[]>([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);

    const search = async () => {
        if (!selectedPlugin || !query.trim()) {
            return;
        }
        setLoading(true);
        setSearched(true);
        setResults([]);
        try {
            const result = await selectedPlugin.methods.search(
                query.trim(),
                1,
                "music",
            );
            setResults((result?.data ?? []) as IMusic.IMusicItem[]);
        } catch {
            setResults([]);
            Toast.warn(t("panel.switchSource.searchFailed"));
        } finally {
            setLoading(false);
        }
    };

    const applySource = async (replacement: IMusic.IMusicItem) => {
        let replaced = false;
        if (!musicSheet) {
            await TrackPlayer.play(replacement, true);
            Toast.success(t("panel.switchSource.playing", { name: replacement.platform }));
            hidePanel();
            return;
        }

        if (musicSheet.id === localMusicSheetId) {
            const localMusic = LocalMusicSheet.getMusicList();
            if (localMusic.some(item => isSameMediaItem(item, musicItem))) {
                await LocalMusicSheet.updateMusicList(
                    localMusic.map(item =>
                        isSameMediaItem(item, musicItem) ? replacement : item,
                    ),
                );
                replaced = true;
            }
        } else if (musicSheet.id === musicHistorySheetId) {
            const history = musicHistory.history;
            if (history.some(item => isSameMediaItem(item, musicItem))) {
                await musicHistory.setHistory(
                    history.map(item =>
                        isSameMediaItem(item, musicItem) ? replacement : item,
                    ),
                );
                replaced = true;
            }
        } else if (musicSheet.platform === localPluginPlatform) {
            replaced = await MusicSheet.replaceMusic(
                musicSheet.id,
                musicItem,
                replacement,
            );
        }

        if (!replaced) {
            Toast.warn(t("panel.switchSource.cannotReplace"));
            return;
        }

        if (TrackPlayer.isCurrentMusic(musicItem)) {
            await TrackPlayer.playWithReplacePlayList(
                replacement,
                TrackPlayer.playList.map(item =>
                    isSameMediaItem(item, musicItem) ? replacement : item,
                ),
            );
        }
        Toast.success(t("panel.switchSource.replaced", { name: replacement.platform }));
        hidePanel();
    };

    if (!selectedPlugin) {
        return (
            <PanelBase
                height={vh(70)}
                renderBody={() => (
                    <View style={styles.fill}>
                        <PanelHeader title={t("panel.switchSource.title")} hideButtons />
                        <FlatList
                            data={plugins}
                            keyExtractor={item => item.hash}
                            contentContainerStyle={{ paddingBottom: safeAreaInsets.bottom }}
                            renderItem={({ item }) => (
                                <ListItem
                                    withHorizontalPadding
                                    heightType="small"
                                    onPress={() => setSelectedPlugin(item)}>
                                    <ListItem.ListItemIcon
                                        width={rpx(48)}
                                        icon="musical-note"
                                        iconSize={iconSizeConst.light}
                                    />
                                    <ListItem.Content
                                        title={item.name}
                                        description={t("panel.switchSource.source", {
                                            name: item.instance.platform || item.name,
                                        })}
                                    />
                                </ListItem>
                            )}
                            ListEmptyComponent={
                                <ThemeText style={styles.empty} fontColor="textSecondary">
                                    {t("panel.switchSource.noSource")}
                                </ThemeText>
                            }
                        />
                    </View>
                )}
            />
        );
    }

    return (
        <PanelBase
            height={vh(78)}
            renderBody={() => (
                <View style={styles.fill}>
                    <PanelHeader
                        title={t("panel.switchSource.title")}
                        cancelText={t("common.cancel")}
                        onCancel={() => {
                            setSelectedPlugin(null);
                            setResults([]);
                            setSearched(false);
                        }}
                        hideDivider
                    />
                    <View style={[styles.searchRow, { backgroundColor: colors.placeholder }]}>
                        <TextInput
                            value={query}
                            style={[styles.input, { color: colors.text }]}
                            placeholder={t("panel.switchSource.searchPlaceholder")}
                            placeholderTextColor={colors.textSecondary}
                            returnKeyType="search"
                            onChangeText={setQuery}
                            onSubmitEditing={search}
                            maxLength={120}
                        />
                        <Pressable style={styles.searchButton} onPress={search}>
                            <ListItem.ListItemIcon
                                width={rpx(56)}
                                icon="magnifying-glass"
                                iconSize={iconSizeConst.light}
                            />
                        </Pressable>
                    </View>
                    <ThemeText style={styles.hint} fontColor="textSecondary">
                        {t("panel.switchSource.searchHint")}
                    </ThemeText>
                    <FlatList
                        data={results}
                        keyExtractor={item => `${item.platform}@${item.id}`}
                        contentContainerStyle={{ paddingBottom: safeAreaInsets.bottom }}
                        renderItem={({ item }) => (
                            <ListItem
                                withHorizontalPadding
                                heightType="small"
                                onPress={() => TrackPlayer.play(item, true)}>
                                <ListItem.ListItemIcon
                                    width={rpx(48)}
                                    icon="play-circle"
                                    iconSize={iconSizeConst.light}
                                />
                                <ListItem.Content
                                    title={`${item.title} · ${item.platform}`}
                                    description={[item.artist, item.album]
                                        .filter(Boolean)
                                        .join(" - ")}
                                />
                                <ListItem.ListItemIcon
                                    width={rpx(72)}
                                    position="right"
                                    icon="arrows-left-right"
                                    iconSize={iconSizeConst.normal}
                                    onPress={() => applySource(item)}
                                />
                            </ListItem>
                        )}
                        ListEmptyComponent={
                            searched && !loading ? (
                                <ThemeText style={styles.empty} fontColor="textSecondary">
                                    {t("panel.switchSource.noResults")}
                                </ThemeText>
                            ) : null
                        }
                    />
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    empty: {
        paddingHorizontal: rpx(48),
        paddingTop: rpx(60),
        textAlign: "center",
    },
    hint: {
        paddingHorizontal: rpx(40),
        paddingBottom: rpx(12),
        fontSize: rpx(22),
    },
    searchRow: {
        height: rpx(80),
        margin: rpx(20),
        borderRadius: rpx(14),
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: rpx(20),
    },
    input: {
        flex: 1,
        height: "100%",
        fontSize: rpx(27),
    },
    searchButton: {
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
});
