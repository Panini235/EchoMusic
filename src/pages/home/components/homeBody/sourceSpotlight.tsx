import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { usePlugins } from "@/core/pluginManager";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import rpx from "@/utils/rpx";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";

const SOURCE_NAMES = ["Bilibili", "抖音", "网易云", "QQ 音乐", "喜马拉雅"];

export default function SourceSpotlight() {
    const plugins = usePlugins();
    const navigate = useNavigate();
    const { t } = useI18N();
    const hasPlugin = plugins.length > 0;

    return (
        <Animated.View entering={FadeInDown.duration(420).springify()}>
            <LinearGradient
                colors={["#CC6B4C", "#E38B67", "#E5A071"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}>
                <View style={styles.glowOne} />
                <View style={styles.glowTwo} />
                <View style={styles.statusRow}>
                    <View style={styles.statusPill}>
                        <View style={styles.statusDot} />
                        <ThemeText color="#FFF8F2" fontSize="description">
                            {hasPlugin
                                ? t("home.sourceConnected", { count: plugins.length })
                                : t("home.pluginCompatible")}
                        </ThemeText>
                    </View>
                    <Icon name="musical-note" size={rpx(54)} color="#FFF8F2" />
                </View>
                <ThemeText
                    color="#FFFDF9"
                    fontSize="appbar"
                    fontWeight="bold"
                    style={styles.title}>
                    {t("home.heroTitle")}
                </ThemeText>
                <ThemeText
                    color="rgba(255,253,249,0.78)"
                    fontSize="subTitle"
                    style={styles.description}>
                    {t("home.heroDescription")}
                </ThemeText>
                <View style={styles.sourceRow}>
                    {SOURCE_NAMES.map(source => (
                        <View key={source} style={styles.sourceChip}>
                            <ThemeText color="#FFFDF9" fontSize="description">
                                {source}
                            </ThemeText>
                        </View>
                    ))}
                </View>
                <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                        styles.action,
                        pressed ? styles.actionPressed : null,
                    ]}
                    onPress={() => {
                        if (hasPlugin) {
                            navigate(ROUTE_PATH.SEARCH_PAGE);
                        } else {
                            navigate(ROUTE_PATH.SETTING, { type: "plugin" });
                        }
                    }}>
                    <ThemeText color="#7C3E2D" fontWeight="semibold">
                        {hasPlugin ? t("home.searchAllSources") : t("home.addSource")}
                    </ThemeText>
                    <Icon
                        name={hasPlugin ? "magnifying-glass" : "plus"}
                        size={rpx(34)}
                        color="#7C3E2D"
                    />
                </Pressable>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        minHeight: rpx(410),
        marginHorizontal: rpx(28),
        marginTop: rpx(8),
        padding: rpx(30),
        borderRadius: rpx(36),
        overflow: "hidden",
        shadowColor: "#A64C32",
        shadowOpacity: 0.22,
        shadowRadius: rpx(22),
        shadowOffset: { width: 0, height: rpx(12) },
        elevation: 8,
    },
    glowOne: {
        position: "absolute",
        top: rpx(-130),
        right: rpx(-80),
        width: rpx(360),
        height: rpx(360),
        borderRadius: rpx(180),
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    glowTwo: {
        position: "absolute",
        bottom: rpx(-140),
        left: rpx(-80),
        width: rpx(330),
        height: rpx(330),
        borderRadius: rpx(165),
        backgroundColor: "rgba(114,45,29,0.10)",
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    statusPill: {
        minHeight: rpx(52),
        paddingHorizontal: rpx(18),
        borderRadius: rpx(26),
        backgroundColor: "rgba(89,39,28,0.20)",
        flexDirection: "row",
        alignItems: "center",
    },
    statusDot: {
        width: rpx(12),
        height: rpx(12),
        marginRight: rpx(12),
        borderRadius: rpx(6),
        backgroundColor: "#FFF4CE",
    },
    title: {
        maxWidth: "82%",
        marginTop: rpx(28),
        lineHeight: rpx(58),
        letterSpacing: -0.6,
    },
    description: {
        maxWidth: "90%",
        marginTop: rpx(12),
        lineHeight: rpx(40),
    },
    sourceRow: {
        marginTop: rpx(22),
        flexDirection: "row",
        flexWrap: "wrap",
        gap: rpx(10),
    },
    sourceChip: {
        paddingHorizontal: rpx(14),
        paddingVertical: rpx(7),
        borderRadius: rpx(18),
        backgroundColor: "rgba(255,255,255,0.13)",
    },
    action: {
        alignSelf: "flex-start",
        minHeight: rpx(64),
        marginTop: rpx(24),
        paddingHorizontal: rpx(22),
        borderRadius: rpx(32),
        backgroundColor: "#FFF8F2",
        flexDirection: "row",
        alignItems: "center",
        gap: rpx(12),
    },
    actionPressed: {
        opacity: 0.82,
        transform: [{ scale: 0.98 }],
    },
});
