import Icon from "@/components/base/icon";
import IconButton from "@/components/base/iconButton";
import ThemeText from "@/components/base/themeText";
import { ROUTE_PATH } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import Color from "color";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useI18N } from "@/core/i18n";

export default function NavBar() {
    const navigation = useNavigation<any>();
    const colors = useColors();
    const { t } = useI18N();

    const buttonColor = Color(colors.text).alpha(0.07).toString();

    return (
        <View style={styles.appbar}>
            <View style={styles.brand}>
                <ThemeText
                    fontSize="appbar"
                    fontWeight="bold"
                    style={styles.brandName}>
                    {t("home.brand")}
                </ThemeText>
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    numberOfLines={1}>
                    {t("home.brandTagline")}
                </ThemeText>
            </View>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.clickToSearch")}
                style={({ pressed }) => [
                    styles.roundButton,
                    { backgroundColor: buttonColor },
                    pressed ? styles.pressed : null,
                ]}
                onPress={() => navigation.navigate(ROUTE_PATH.SEARCH_PAGE)}>
                <Icon
                    name="magnifying-glass"
                    size={rpx(38)}
                    color={colors.text}
                />
            </Pressable>
            <IconButton
                accessibilityLabel={t("home.openSidebar.a11y")}
                name="bars-3"
                style={[styles.roundButton, { backgroundColor: buttonColor }]}
                color={colors.text}
                onPress={() => navigation.openDrawer()}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    appbar: {
        width: "100%",
        height: rpx(128),
        paddingHorizontal: rpx(28),
        flexDirection: "row",
        alignItems: "center",
    },
    brand: {
        flex: 1,
        justifyContent: "center",
    },
    brandName: {
        lineHeight: rpx(54),
        letterSpacing: -0.5,
    },
    roundButton: {
        width: rpx(72),
        height: rpx(72),
        marginLeft: rpx(16),
        borderRadius: rpx(36),
        alignItems: "center",
        justifyContent: "center",
    },
    pressed: {
        opacity: 0.62,
        transform: [{ scale: 0.96 }],
    },
});
