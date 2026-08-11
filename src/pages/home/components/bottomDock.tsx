import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { useCurrentMusic } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import Color from "color";
import React from "react";
import { Image, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { showPanel } from "@/components/panels/usePanel";

interface IDockItem {
    icon: IIconName;
    label: string;
    active?: boolean;
    onPress: () => void;
}

export default function BottomDock() {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const navigation = useNavigation<any>();
    const currentMusic = useCurrentMusic();

    const items: IDockItem[] = [
        {
            icon: "home-outline",
            label: t("home.library"),
            active: true,
            onPress: () => navigation.navigate("HOME-MAIN"),
        },
        {
            icon: "fire-outline",
            label: t("home.discover"),
            onPress: () => navigate(ROUTE_PATH.RECOMMEND_SHEETS),
        },
        {
            icon: "musical-note",
            label: t("home.player"),
            onPress: () => {
                if (currentMusic) {
                    navigate(ROUTE_PATH.MUSIC_DETAIL);
                } else {
                    showPanel("PlayList");
                }
            },
        },
        {
            icon: "user",
            label: t("home.profile"),
            onPress: () => navigate(ROUTE_PATH.SETTING, { type: "basic" }),
        },
    ];

    return (
        <Animated.View
            entering={FadeInUp.duration(420)}
            style={[
                styles.wrapper,
                {
                    backgroundColor: Color(colors.card).alpha(0.96).toString(),
                    borderColor: Color(colors.text).alpha(0.08).toString(),
                    shadowColor: colors.shadow,
                },
            ]}>
            <DockButton item={items[0]} />
            <DockButton item={items[1]} />
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.openControlCenter.a11y")}
                onPress={() => navigation.openDrawer()}
                style={({ pressed }) => [
                    styles.controlButton,
                    {
                        borderColor: Color(colors.primary).alpha(0.44).toString(),
                        backgroundColor: Color(colors.primary).alpha(0.10).toString(),
                    },
                    pressed ? styles.controlPressed : null,
                ]}>
                <Image source={ImgAsset.logo} style={styles.controlLogo} />
            </Pressable>
            <DockButton item={items[2]} />
            <DockButton item={items[3]} />
        </Animated.View>
    );
}

function DockButton({ item }: { item: IDockItem }) {
    const colors = useColors();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.active }}
            onPress={item.onPress}
            style={({ pressed }) => [
                styles.item,
                pressed ? styles.itemPressed : null,
            ]}>
            <Icon
                name={item.icon}
                size={rpx(34)}
                color={item.active ? colors.primary : colors.textSecondary}
            />
            <ThemeText
                fontSize="tag"
                fontWeight={item.active ? "semibold" : "medium"}
                color={item.active ? colors.primary : colors.textSecondary}
                numberOfLines={1}
                style={styles.label}>
                {item.label}
            </ThemeText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        height: rpx(108),
        marginHorizontal: rpx(18),
        marginBottom: rpx(8),
        paddingHorizontal: rpx(8),
        borderRadius: rpx(34),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        shadowOpacity: 0.18,
        shadowRadius: rpx(22),
        shadowOffset: { width: 0, height: rpx(10) },
        elevation: 12,
    },
    item: {
        width: rpx(112),
        height: rpx(88),
        borderRadius: rpx(26),
        alignItems: "center",
        justifyContent: "center",
    },
    itemPressed: {
        opacity: 0.58,
        transform: [{ scale: 0.95 }],
    },
    label: {
        marginTop: rpx(7),
    },
    controlButton: {
        width: rpx(88),
        height: rpx(88),
        borderRadius: rpx(44),
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#F1745E",
        shadowOpacity: 0.20,
        shadowRadius: rpx(16),
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
    },
    controlLogo: {
        width: rpx(72),
        height: rpx(72),
        borderRadius: rpx(24),
    },
    controlPressed: {
        opacity: 0.66,
        transform: [{ scale: 0.93 }],
    },
});
