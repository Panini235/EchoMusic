import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { usePlugins } from "@/core/pluginManager";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function SourceSpotlight() {
    const plugins = usePlugins();
    const navigate = useNavigate();
    const colors = useColors();
    const { t } = useI18N();
    const hasPlugin = plugins.length > 0;

    const onPress = () => {
        if (hasPlugin) {
            navigate(ROUTE_PATH.SEARCH_PAGE);
        } else {
            navigate(ROUTE_PATH.SETTING, { type: "plugin" });
        }
    };

    return (
        <Animated.View entering={FadeInDown.duration(320)}>
            <Pressable
                accessibilityRole="button"
                onPress={onPress}
                style={({ pressed }) => [
                    styles.card,
                    {
                        backgroundColor: Color(colors.card).alpha(0.84).toString(),
                        borderColor: Color(colors.text).alpha(0.07).toString(),
                    },
                    pressed ? styles.pressed : null,
                ]}>
                <LinearGradient
                    colors={["#F1BB68", "#EF7F59", "#E7645A"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sourceIcon}>
                    <Icon
                        name={hasPlugin ? "musical-note" : "javascript"}
                        size={rpx(34)}
                        color="#1B1714"
                    />
                </LinearGradient>
                <View style={styles.copy}>
                    <ThemeText fontSize="subTitle" fontWeight="semibold" numberOfLines={1}>
                        {hasPlugin ? t("home.searchAllSources") : t("home.addSource")}
                    </ThemeText>
                    <View style={styles.statusRow}>
                        <View
                            style={[
                                styles.statusDot,
                                hasPlugin
                                    ? styles.statusDotConnected
                                    : styles.statusDotDisconnected,
                            ]}
                        />
                        <ThemeText fontSize="description" fontColor="textSecondary" numberOfLines={1}>
                            {hasPlugin
                                ? t("home.sourceConnected", { count: plugins.length })
                                : t("home.pluginCompatible")}
                        </ThemeText>
                    </View>
                </View>
                <View
                    style={[
                        styles.action,
                        { backgroundColor: Color(colors.text).alpha(0.06).toString() },
                    ]}>
                    <Icon
                        name={hasPlugin ? "magnifying-glass" : "plus"}
                        size={rpx(32)}
                        color={colors.text}
                    />
                </View>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        minHeight: rpx(112),
        marginHorizontal: rpx(28),
        marginTop: rpx(6),
        paddingHorizontal: rpx(18),
        borderRadius: rpx(28),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
    },
    sourceIcon: {
        width: rpx(68),
        height: rpx(68),
        borderRadius: rpx(22),
        alignItems: "center",
        justifyContent: "center",
    },
    copy: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: rpx(18),
        gap: rpx(5),
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    statusDot: {
        width: rpx(10),
        height: rpx(10),
        marginRight: rpx(9),
        borderRadius: rpx(5),
    },
    statusDotConnected: { backgroundColor: "#4A9B72" },
    statusDotDisconnected: { backgroundColor: "rgba(128,128,128,0.55)" },
    action: {
        width: rpx(58),
        height: rpx(58),
        borderRadius: rpx(29),
        alignItems: "center",
        justifyContent: "center",
    },
    pressed: {
        opacity: 0.72,
        transform: [{ scale: 0.985 }],
    },
});
