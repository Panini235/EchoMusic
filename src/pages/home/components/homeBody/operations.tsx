import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import rpx from "@/utils/rpx";
import React from "react";
import { StyleSheet, View } from "react-native";
import ActionButton from "../ActionButton";
import ThemeText from "@/components/base/themeText";

export default function Operations() {
    const navigate = useNavigate();
    const { t } = useI18N();

    const actionButtons = [
        {
            iconName: "fire",
            iconColor: "#E06B52",
            title: t("home.recommendSheet"),
            action() {
                navigate(ROUTE_PATH.RECOMMEND_SHEETS);
            },
        },
        {
            iconName: "trophy",
            iconColor: "#C9912E",
            title: t("home.topList"),
            action() {
                navigate(ROUTE_PATH.TOP_LIST);
            },
        },
        {
            iconName: "clock-outline",
            iconColor: "#7567C8",
            title: t("home.playHistory"),
            action() {
                navigate(ROUTE_PATH.HISTORY);
            },
        },
        {
            iconName: "folder-music-outline",
            iconColor: "#4D8E79",
            title: t("home.localMusic"),
            action() {
                navigate(ROUTE_PATH.LOCAL);
            },
        },
    ] as const;

    return (
        <View style={styles.section}>
            <ThemeText fontSize="title" fontWeight="bold" style={styles.title}>
                {t("home.quickAccess")}
            </ThemeText>
            <View style={styles.container}>
                {actionButtons.map((action, index) => (
                    <ActionButton
                        style={styles.actionButtonStyle}
                        delay={80 + index * 45}
                        key={action.title}
                        {...action}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginTop: rpx(40),
    },
    title: {
        marginHorizontal: rpx(28),
        marginBottom: rpx(18),
    },
    container: {
        width: rpx(750),
        paddingHorizontal: rpx(28),
        marginBottom: rpx(22),
        flexDirection: "row",
        gap: rpx(16),
    },
    actionButtonStyle: {
        width: rpx(161.5),
        height: rpx(142),
    },
});
