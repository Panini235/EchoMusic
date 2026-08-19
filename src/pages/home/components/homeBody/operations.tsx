import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH } from "@/core/router";
import type { HomeNavigationHandler } from "@/pages/home/hooks/useHomeNavigationLatch";
import rpx from "@/utils/rpx";
import React from "react";
import { StyleSheet, View } from "react-native";
import ActionButton from "../ActionButton";

interface OperationsProps {
    navigate: HomeNavigationHandler;
}

export default function Operations({ navigate: navigateFromHome }: OperationsProps) {
    const { t } = useI18N();

    const actionButtons = [
        {
            id: "recommend-sheets",
            iconName: "fire",
            iconColor: "#E06B52",
            title: t("home.recommendSheet"),
            action() {
                navigateFromHome(ROUTE_PATH.RECOMMEND_SHEETS);
            },
        },
        {
            id: "top-list",
            iconName: "trophy",
            iconColor: "#C9912E",
            title: t("home.topList"),
            action() {
                navigateFromHome(ROUTE_PATH.TOP_LIST);
            },
        },
        {
            id: "play-history",
            iconName: "clock-outline",
            iconColor: "#7567C8",
            title: t("home.playHistory"),
            action() {
                navigateFromHome(ROUTE_PATH.HISTORY);
            },
        },
        {
            id: "local-music",
            iconName: "folder-music-outline",
            iconColor: "#4D8E79",
            title: t("home.localMusic"),
            action() {
                navigateFromHome(ROUTE_PATH.LOCAL);
            },
        },
    ] as const;

    return (
        <View style={styles.section}>
            <ThemeText fontSize="title" fontWeight="bold" style={styles.title}>
                {t("home.quickAccess")}
            </ThemeText>
            <View style={styles.container}>
                {actionButtons.map(action => (
                    <ActionButton
                        style={styles.actionButtonStyle}
                        key={action.id}
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
        width: "100%",
        paddingHorizontal: rpx(28),
        marginBottom: rpx(22),
        flexDirection: "row",
        gap: rpx(16),
    },
    actionButtonStyle: {
        flex: 1,
        minWidth: 0,
        height: rpx(142),
    },
});
