import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import Color from "color";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

interface IDockItem {
    icon: IIconName;
    label: string;
    accessibilityLabel?: string;
    active?: boolean;
    onPress: () => void;
}

export default function BottomDock() {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const navigation = useNavigation<any>();

    const items: IDockItem[] = [
        {
            icon: "home-outline",
            label: t("home.home"),
            active: true,
            onPress: () => navigation.navigate("HOME-MAIN"),
        },
        {
            icon: "bars-3",
            label: t("sidebar.controlCenter"),
            accessibilityLabel: t("home.openControlCenter.a11y"),
            onPress: () => navigation.openDrawer(),
        },
        {
            icon: "fire-outline",
            label: t("home.discover"),
            onPress: () => navigate(ROUTE_PATH.RECOMMEND_SHEETS),
        },
    ];

    return (
        <Animated.View
            entering={FadeInUp.duration(420)}
            style={[
                styles.wrapper,
                {
                    backgroundColor: colors.card,
                    borderColor: Color(colors.text).alpha(0.08).toString(),
                    shadowColor: colors.shadow,
                },
            ]}>
            {items.map(item => (
                <DockButton key={item.label} item={item} />
            ))}
        </Animated.View>
    );
}

function DockButton({ item }: { item: IDockItem }) {
    const colors = useColors();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityState={{ selected: item.active }}
            onPress={item.onPress}
            style={({ pressed }) => [
                styles.item,
                item.active
                    ? { backgroundColor: Color(colors.primary).alpha(0.10).toString() }
                    : null,
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
        shadowOpacity: 0.18,
        shadowRadius: rpx(22),
        shadowOffset: { width: 0, height: rpx(10) },
        elevation: 12,
    },
    item: {
        flex: 1,
        minWidth: 0,
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
});
