import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import Color from "color";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function NavBar() {
    const navigation = useNavigation<any>();
    const colors = useColors();
    const { t } = useI18N();

    return (
        <Animated.View
            entering={FadeInDown.duration(360)}
            style={styles.appbar}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.openControlCenter.a11y")}
                hitSlop={8}
                style={({ pressed }) => [
                    styles.menuButton,
                    {
                        backgroundColor: Color(colors.card).alpha(0.94).toString(),
                        borderColor: Color(colors.primary).alpha(0.22).toString(),
                    },
                    pressed ? styles.pressed : null,
                ]}
                onPress={() => navigation.openDrawer()}>
                <Icon name="bars-3" size={rpx(38)} color={colors.primary} />
            </Pressable>
            <Pressable
                accessibilityRole="search"
                accessibilityLabel={t("home.clickToSearch")}
                style={({ pressed }) => [
                    styles.search,
                    {
                        backgroundColor: Color(colors.card).alpha(0.92).toString(),
                        borderColor: Color(colors.text).alpha(0.07).toString(),
                    },
                    pressed ? styles.pressed : null,
                ]}
                onPress={() => navigation.navigate(ROUTE_PATH.SEARCH_PAGE)}>
                <Icon
                    name="magnifying-glass"
                    size={rpx(38)}
                    color={colors.textSecondary}
                />
                <ThemeText
                    fontSize="content"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    style={styles.searchText}>
                    {t("home.searchPlaceholder")}
                </ThemeText>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    appbar: {
        width: "100%",
        minHeight: rpx(112),
        paddingTop: rpx(12),
        paddingHorizontal: rpx(28),
        paddingBottom: rpx(12),
        flexDirection: "row",
        alignItems: "center",
    },
    menuButton: {
        width: rpx(76),
        height: rpx(76),
        marginRight: rpx(18),
        borderRadius: rpx(38),
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: "center",
        justifyContent: "center",
    },
    search: {
        flex: 1,
        height: rpx(84),
        paddingHorizontal: rpx(24),
        borderRadius: rpx(32),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
    },
    searchText: {
        flex: 1,
        marginLeft: rpx(16),
    },
    pressed: {
        opacity: 0.68,
        transform: [{ scale: 0.97 }],
    },
});
