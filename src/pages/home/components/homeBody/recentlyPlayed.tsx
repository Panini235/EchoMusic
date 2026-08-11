import Icon from "@/components/base/icon";
import FastImage from "@/components/base/fastImage";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { useMusicHistory } from "@/core/musicHistory";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function RecentlyPlayed() {
    const history = useMusicHistory().slice(0, 8);
    const navigate = useNavigate();
    const colors = useColors();
    const { t } = useI18N();

    if (!history.length) {
        return null;
    }

    return (
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <View style={styles.header}>
                <ThemeText fontSize="title" fontWeight="bold">
                    {t("home.recentlyPlayed")}
                </ThemeText>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("home.viewAllHistory")}
                    hitSlop={10}
                    onPress={() => navigate(ROUTE_PATH.HISTORY)}
                    style={({ pressed }) => [
                        styles.more,
                        pressed ? styles.pressed : null,
                    ]}>
                    <ThemeText fontSize="description" fontColor="textSecondary">
                        {t("common.viewAll")}
                    </ThemeText>
                    <Icon
                        name="arrow-left"
                        size={rpx(28)}
                        color={colors.textSecondary}
                        style={styles.moreIcon}
                    />
                </Pressable>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.list}>
                {history.map((musicItem, index) => (
                    <Pressable
                        key={`${musicItem.platform}-${musicItem.id ?? musicItem.title}-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${musicItem.title} - ${musicItem.artist ?? ""}`}
                        onPress={() => TrackPlayer.play(musicItem)}
                        style={({ pressed }) => [
                            styles.item,
                            pressed ? styles.pressed : null,
                        ]}>
                        <View
                            style={[
                                styles.coverFrame,
                                {
                                    backgroundColor: colors.card,
                                    borderColor: Color(colors.text).alpha(0.08).toString(),
                                },
                            ]}>
                            <FastImage
                                style={styles.cover}
                                source={musicItem.artwork}
                                placeholderSource={ImgAsset.albumDefault}
                            />
                            <View style={styles.playBadge}>
                                <Icon name="play" size={rpx(27)} color="#FFFFFF" />
                            </View>
                        </View>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="semibold"
                            numberOfLines={1}
                            style={styles.itemTitle}>
                            {musicItem.title}
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            numberOfLines={1}>
                            {musicItem.artist ?? musicItem.platform}
                        </ThemeText>
                    </Pressable>
                ))}
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    header: {
        marginTop: rpx(42),
        marginBottom: rpx(20),
        paddingHorizontal: rpx(28),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    more: {
        minHeight: rpx(54),
        paddingLeft: rpx(16),
        flexDirection: "row",
        alignItems: "center",
    },
    moreIcon: {
        marginLeft: rpx(8),
        transform: [{ rotate: "180deg" }],
    },
    list: {
        paddingHorizontal: rpx(28),
        paddingRight: rpx(12),
    },
    item: {
        width: rpx(174),
        marginRight: rpx(18),
    },
    coverFrame: {
        width: rpx(174),
        height: rpx(174),
        borderRadius: rpx(26),
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
    },
    cover: {
        width: "100%",
        height: "100%",
    },
    playBadge: {
        position: "absolute",
        right: rpx(10),
        bottom: rpx(10),
        width: rpx(48),
        height: rpx(48),
        borderRadius: rpx(24),
        backgroundColor: "rgba(12,13,16,0.72)",
        alignItems: "center",
        justifyContent: "center",
    },
    itemTitle: {
        marginTop: rpx(13),
        marginBottom: rpx(3),
    },
    pressed: {
        opacity: 0.64,
        transform: [{ scale: 0.97 }],
    },
});
