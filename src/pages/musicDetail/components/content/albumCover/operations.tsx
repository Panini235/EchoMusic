import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";

import LocalMusicSheet from "@/core/localMusicSheet";
import { ROUTE_PATH } from "@/core/router";
import { ImgAsset } from "@/constants/assetsConst";
import Toast from "@/utils/toast";
import toast from "@/utils/toast";
import useOrientation from "@/hooks/useOrientation";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useCurrentMusic, useMusicQuality } from "@/core/trackPlayer";
import { iconSizeConst } from "@/constants/uiConst";
import PersistStatus from "@/utils/persistStatus";
import HeartIcon from "../heartIcon";
import Icon from "@/components/base/icon.tsx";
import PluginManager from "@/core/pluginManager";
import downloader from "@/core/downloader";
import i18n from "@/core/i18n";
import ThemeText from "@/components/base/themeText";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function Operations() {
    const musicItem = useCurrentMusic();
    const currentQuality = useMusicQuality();
    const isDownloaded = LocalMusicSheet.useIsLocal(musicItem);

    const rate = PersistStatus.useValue("music.rate", 100);
    const orientation = useOrientation();

    const supportComment = useMemo(() => {
        return !musicItem
            ? false
            : !!PluginManager.getByMedia(musicItem)?.supportedMethods.has("getMusicComments");
    }, [musicItem]);

    return (
        <View
            style={[
                styles.wrapper,
                orientation === "horizontal" ? styles.horizontalWrapper : null,
            ]}>
            <Animated.View
                key={`${musicItem?.platform ?? "local"}-${musicItem?.id ?? musicItem?.title ?? "empty"}`}
                entering={FadeInDown.duration(360)}
                style={styles.metadata}>
                <ThemeText
                    color="white"
                    fontSize="title"
                    fontWeight="bold"
                    numberOfLines={1}>
                    {musicItem?.title ?? "--"}
                </ThemeText>
                <ThemeText
                    color="rgba(255,255,255,0.62)"
                    fontSize="subTitle"
                    numberOfLines={1}>
                    {musicItem?.artist ?? ""}
                </ThemeText>
            </Animated.View>
            <View style={styles.actionSurface}>
                <HeartIcon />
                <Pressable
                    onPress={() => {
                        if (!musicItem) {
                            return;
                        }
                        showPanel("MusicQuality", {
                            musicItem,
                            async onQualityPress(quality) {
                                const changeResult =
                                await TrackPlayer.changeQuality(quality);
                                if (!changeResult) {
                                    Toast.warn(i18n.t("toast.currentQualityNotAvailableForCurrentMusic"));
                                }
                            },
                        });
                    }}>
                    <Image
                        source={ImgAsset.quality[currentQuality]}
                        style={styles.quality}
                    />
                </Pressable>
                <Icon
                    name={isDownloaded ? "check-circle-outline" : "arrow-down-tray"}
                    size={iconSizeConst.normal}
                    color="white"
                    onPress={() => {
                        if (musicItem && !isDownloaded) {
                            showPanel("MusicQuality", {
                                type: "download",
                                musicItem,
                                async onQualityPress(quality) {
                                    downloader.download(musicItem, quality);
                                },
                            });
                        }
                    }}
                />
                <Pressable
                    onPress={() => {
                        if (!musicItem) {
                            return;
                        }
                        showPanel("PlayRate", {
                            async onRatePress(newRate) {
                                if (rate !== newRate) {
                                    try {
                                        await TrackPlayer.setRate(newRate / 100);
                                        PersistStatus.set("music.rate", newRate);
                                    } catch { }
                                }
                            },
                        });
                    }}>
                    <Image source={ImgAsset.rate[rate!]} style={styles.quality} />
                </Pressable>
                <Icon
                    name="chat-bubble-oval-left-ellipsis"
                    size={iconSizeConst.normal}
                    color="white"
                    opacity={supportComment ? 1 : 0.2}
                    onPress={() => {
                        if (!supportComment) {
                            toast.warn(i18n.t("toast.commmentNotAvaliableForCurrentMusic"));
                            return;
                        }
                        if (musicItem) {
                            showPanel("MusicComment", {
                                musicItem,
                            });
                        }
                    }}
                />
                <Icon
                    name="ellipsis-vertical"
                    size={iconSizeConst.normal}
                    color="white"
                    onPress={() => {
                        if (musicItem) {
                            showPanel("MusicItemOptions", {
                                musicItem: musicItem,
                                from: ROUTE_PATH.MUSIC_DETAIL,
                            });
                        }
                    }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        minHeight: rpx(172),
        marginBottom: rpx(8),
        paddingHorizontal: rpx(28),
    },
    horizontalWrapper: {
        minHeight: rpx(140),
    },
    metadata: {
        minHeight: rpx(76),
        justifyContent: "center",
        gap: rpx(4),
    },
    actionSurface: {
        height: rpx(78),
        borderRadius: rpx(28),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.10)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },
    quality: {
        width: rpx(52),
        height: rpx(52),
    },
});
