import Icon from "@/components/base/icon";
import FastImage from "@/components/base/fastImage";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { useMusicHistory } from "@/core/musicHistory";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, {
    useCurrentMusic,
    useMusicState,
    useProgress,
} from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { musicIsPaused } from "@/utils/trackUtils";
import Color from "color";
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function ContinueListening() {
    const currentMusic = useCurrentMusic();
    const history = useMusicHistory();
    const progress = useProgress(1000);
    const musicState = useMusicState();
    const navigate = useNavigate();
    const colors = useColors();
    const { t } = useI18N();

    const musicItem = currentMusic ?? history[0] ?? null;
    const isCurrent = !!musicItem && TrackPlayer.isCurrentMusic(musicItem);
    const paused = !isCurrent || musicIsPaused(musicState);
    const progressPercent = useMemo(() => {
        if (!isCurrent || !progress.duration) {
            return 0;
        }
        return Math.max(0, Math.min(100, progress.position / progress.duration * 100));
    }, [isCurrent, progress.duration, progress.position]);

    const openTarget = () => {
        if (musicItem) {
            navigate(ROUTE_PATH.MUSIC_DETAIL);
        } else {
            navigate(ROUTE_PATH.SEARCH_PAGE);
        }
    };

    const togglePlayback = async () => {
        if (!musicItem) {
            navigate(ROUTE_PATH.SEARCH_PAGE);
            return;
        }
        if (isCurrent && !paused) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play(musicItem);
        }
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(60).duration(420)}
            style={[
                styles.card,
                {
                    backgroundColor: Color(colors.card).alpha(0.96).toString(),
                    borderColor: Color(colors.text).alpha(0.09).toString(),
                    shadowColor: colors.shadow,
                },
            ]}>
            {musicItem ? (
                <FastImage
                    style={styles.artwork}
                    source={musicItem.artwork}
                    placeholderSource={ImgAsset.albumDefault}
                />
            ) : (
                <View style={styles.emptyArtwork}>
                    <Image source={ImgAsset.logo} style={styles.emptyLogo} />
                </View>
            )}
            <LinearGradient
                pointerEvents="none"
                colors={[
                    "rgba(7,9,13,0.98)",
                    "rgba(7,9,13,0.84)",
                    "rgba(7,9,13,0.22)",
                ]}
                locations={[0, 0.54, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
            />
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                    musicItem
                        ? `${t("home.continueListening")}: ${musicItem.title}`
                        : t("home.startListening")
                }
                onPress={openTarget}
                style={({ pressed }) => [
                    styles.copy,
                    pressed ? styles.copyPressed : null,
                ]}>
                <View style={styles.eyebrowRow}>
                    <Icon name="musical-note" size={rpx(27)} color="#F5A462" />
                    <ThemeText
                        color="#F5A462"
                        fontSize="description"
                        fontWeight="semibold"
                        style={styles.eyebrow}>
                        {musicItem ? t("home.continueListening") : t("home.readyToListen")}
                    </ThemeText>
                </View>
                <ThemeText
                    color="#FFFFFF"
                    fontSize="appbar"
                    fontWeight="bold"
                    numberOfLines={1}
                    style={styles.title}>
                    {musicItem?.title ?? t("home.startListening")}
                </ThemeText>
                <ThemeText
                    color="rgba(255,255,255,0.66)"
                    fontSize="subTitle"
                    numberOfLines={1}>
                    {musicItem?.artist ?? t("home.startListeningDescription")}
                </ThemeText>
            </Pressable>

            <View style={styles.footer}>
                <View style={styles.progressTrack}>
                    <View
                        style={[
                            styles.progressActive,
                            { width: `${progressPercent}%` },
                        ]}
                    />
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={paused ? t("common.play") : t("common.pause")}
                    hitSlop={8}
                    onPress={togglePlayback}
                    style={({ pressed }) => [
                        styles.playButton,
                        pressed ? styles.playPressed : null,
                    ]}>
                    <Icon
                        pointerEvents="none"
                        name={paused ? "play" : "pause"}
                        size={rpx(48)}
                        color="#211B18"
                    />
                </Pressable>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        height: rpx(340),
        marginHorizontal: rpx(28),
        marginTop: rpx(12),
        borderRadius: rpx(34),
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
        shadowOpacity: 0.24,
        shadowRadius: rpx(26),
        shadowOffset: { width: 0, height: rpx(14) },
        elevation: 8,
    },
    artwork: {
        position: "absolute",
        top: 0,
        right: 0,
        width: "72%",
        height: "100%",
        opacity: 0.82,
    },
    emptyArtwork: {
        position: "absolute",
        top: 0,
        right: 0,
        width: "58%",
        height: "100%",
        backgroundColor: "#121722",
        alignItems: "center",
        justifyContent: "center",
    },
    emptyLogo: {
        width: rpx(156),
        height: rpx(156),
        borderRadius: rpx(46),
        opacity: 0.72,
    },
    copy: {
        position: "absolute",
        top: rpx(34),
        left: rpx(30),
        right: rpx(154),
        bottom: rpx(100),
        justifyContent: "center",
    },
    copyPressed: {
        opacity: 0.68,
    },
    eyebrowRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    eyebrow: {
        marginLeft: rpx(10),
        letterSpacing: 0.3,
    },
    title: {
        marginTop: rpx(24),
        marginBottom: rpx(7),
        lineHeight: rpx(54),
    },
    footer: {
        position: "absolute",
        left: rpx(30),
        right: rpx(30),
        bottom: rpx(28),
        height: rpx(72),
        flexDirection: "row",
        alignItems: "center",
    },
    progressTrack: {
        flex: 1,
        height: rpx(7),
        marginRight: rpx(26),
        borderRadius: rpx(4),
        backgroundColor: "rgba(255,255,255,0.16)",
        overflow: "hidden",
    },
    progressActive: {
        height: "100%",
        borderRadius: rpx(4),
        backgroundColor: "#F59B60",
    },
    playButton: {
        width: rpx(72),
        height: rpx(72),
        borderRadius: rpx(36),
        backgroundColor: "#F39A61",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#F1745E",
        shadowOpacity: 0.26,
        shadowRadius: rpx(14),
        shadowOffset: { width: 0, height: rpx(5) },
        elevation: 5,
    },
    playPressed: {
        opacity: 0.72,
        transform: [{ scale: 0.92 }],
    },
});
