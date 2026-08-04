import Icon, { IIconName } from "@/components/base/icon";
import ListItem from "@/components/base/listItem";
import PageBackground from "@/components/base/pageBackground";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { usePlugins } from "@/core/pluginManager";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import { checkUpdateAndShowResult } from "@/hooks/useCheckUpdate";
import useColors from "@/hooks/useColors";
import NativeUtils from "@/native/utils";
import rpx from "@/utils/rpx";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import Color from "color";
import React from "react";
import { BackHandler, Image, Platform, StyleSheet, View } from "react-native";
import DeviceInfo from "react-native-device-info";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

interface IDrawerItem {
    icon: IIconName;
    title: string;
    value?: string;
    onPress: () => void;
}

export default function HomeDrawer(props: any) {
    const navigate = useNavigate();
    const colors = useColors();
    const plugins = usePlugins();
    const { t, getSupportedLanguages, getLanguage, setLanguage } = useI18N();

    const navigateToSetting = (type: string) => {
        navigate(ROUTE_PATH.SETTING, { type });
    };

    const libraryItems: IDrawerItem[] = [
        {
            icon: "cog-8-tooth",
            title: t("sidebar.basicSettings"),
            onPress: () => navigateToSetting("basic"),
        },
        {
            icon: "javascript",
            title: t("sidebar.pluginManagement"),
            value: plugins.length ? `${plugins.length}` : undefined,
            onPress: () => navigateToSetting("plugin"),
        },
        {
            icon: "t-shirt-outline",
            title: t("sidebar.themeSettings"),
            onPress: () => navigateToSetting("theme"),
        },
    ];

    const utilityItems: IDrawerItem[] = [
        {
            icon: "alarm-outline",
            title: t("sidebar.scheduleClose"),
            onPress: () => showPanel("TimingClose"),
        },
        {
            icon: "circle-stack",
            title: t("sidebar.backupAndResume"),
            onPress: () => navigateToSetting("backup"),
        },
        ...(Platform.OS === "android"
            ? [{
                icon: "shield-keyhole-outline" as IIconName,
                title: t("sidebar.permissionManagement"),
                onPress: () => navigate(ROUTE_PATH.PERMISSIONS),
            }]
            : []),
        {
            icon: "language",
            title: t("sidebar.languageSettings"),
            value: getLanguage().name,
            onPress: () => {
                showDialog("RadioDialog", {
                    content: getSupportedLanguages().map(item => ({
                        title: item.name,
                        value: item.locale,
                        label: item.name,
                    })),
                    title: t("sidebar.languageSettings"),
                    onOk(value) {
                        setLanguage(value as string);
                    },
                    defaultSelected: getLanguage().locale,
                });
            },
        },
    ];

    const appItems: IDrawerItem[] = [
        {
            icon: "arrow-path",
            title: t("sidebar.checkUpdate"),
            value: DeviceInfo.getVersion(),
            onPress: () => checkUpdateAndShowResult(true),
        },
        {
            icon: "information-circle",
            title: `${t("common.about")} ${DeviceInfo.getApplicationName()}`,
            onPress: () => navigateToSetting("about"),
        },
    ];

    return (
        <View style={styles.screen}>
            <PageBackground />
            <DrawerContentScrollView
                {...props}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.duration(360).springify()}>
                    <LinearGradient
                        colors={["#F3B861", "#F08359", "#E65F58"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.brandCard}>
                        <View style={styles.brandGlow} />
                        <Image source={ImgAsset.logo} style={styles.logo} />
                        <View style={styles.brandCopy}>
                            <ThemeText color="#1B1714" fontSize="title" fontWeight="bold">
                                {DeviceInfo.getApplicationName()}
                            </ThemeText>
                            <ThemeText color="rgba(27,23,20,0.68)" fontSize="description">
                                {t("home.brandTagline")}
                            </ThemeText>
                        </View>
                        <View style={styles.sourceBadge}>
                            <View style={styles.sourceDot} />
                            <ThemeText color="#1B1714" fontSize="description">
                                {plugins.length ? t("home.sourceConnected", { count: plugins.length }) : t("home.pluginCompatible")}
                            </ThemeText>
                        </View>
                    </LinearGradient>
                </Animated.View>

                <DrawerSection delay={70} title={t("common.setting")} items={libraryItems} />
                <DrawerSection delay={120} title={t("common.other")} items={utilityItems} />
                <DrawerSection delay={170} title={t("common.software")} items={appItems} />

                <Animated.View
                    entering={FadeInDown.delay(210).duration(360)}
                    style={[
                        styles.exitRow,
                        { borderColor: Color(colors.text).alpha(0.08).toString() },
                    ]}>
                    <ExitButton
                        icon="home-outline"
                        title={t("sidebar.backToDesktop")}
                        onPress={() => BackHandler.exitApp()}
                    />
                    <View style={[styles.exitDivider, { backgroundColor: colors.divider }]} />
                    <ExitButton
                        icon="power-outline"
                        title={t("sidebar.exitApp")}
                        onPress={async () => {
                            await TrackPlayer.reset();
                            NativeUtils.exitApp();
                        }}
                    />
                </Animated.View>
            </DrawerContentScrollView>
        </View>
    );
}

function DrawerSection(props: { title: string; items: IDrawerItem[]; delay: number }) {
    const colors = useColors();

    return (
        <Animated.View
            entering={FadeInDown.delay(props.delay).duration(360)}
            style={[
                styles.section,
                {
                    backgroundColor: Color(colors.card).alpha(0.90).toString(),
                    borderColor: Color(colors.text).alpha(0.07).toString(),
                },
            ]}>
            <ThemeText
                fontSize="description"
                fontColor="textSecondary"
                fontWeight="semibold"
                style={styles.sectionTitle}>
                {props.title}
            </ThemeText>
            {props.items.map(item => (
                <ListItem
                    key={item.title}
                    heightType="small"
                    withHorizontalPadding
                    onPress={item.onPress}>
                    <ListItem.ListItemIcon
                        icon={item.icon}
                        iconSize={rpx(34)}
                        containerStyle={[
                            styles.iconWell,
                            { backgroundColor: Color(colors.primary).alpha(0.13).toString() },
                        ]}
                        color={colors.primary}
                    />
                    <ListItem.Content title={item.title} />
                    {item.value ? (
                        <ListItem.ListItemText
                            position="right"
                            fontSize="description"
                            fontColor="textSecondary">
                            {item.value}
                        </ListItem.ListItemText>
                    ) : null}
                </ListItem>
            ))}
        </Animated.View>
    );
}

function ExitButton(props: { icon: IIconName; title: string; onPress: () => void }) {
    const colors = useColors();
    return (
        <View style={styles.exitItem}>
            <Icon name={props.icon} size={rpx(34)} color={colors.textSecondary} onPress={props.onPress} />
            <ThemeText fontSize="description" fontColor="textSecondary" style={styles.exitText} onPress={props.onPress}>
                {props.title}
            </ThemeText>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: rpx(22),
        paddingTop: rpx(18),
        paddingBottom: rpx(40),
    },
    brandCard: {
        minHeight: rpx(250),
        padding: rpx(24),
        borderRadius: rpx(32),
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
    },
    brandGlow: {
        position: "absolute",
        width: rpx(260),
        height: rpx(260),
        borderRadius: rpx(130),
        right: rpx(-70),
        top: rpx(-100),
        backgroundColor: "rgba(255,255,255,0.22)",
    },
    logo: {
        width: rpx(92),
        height: rpx(92),
        borderRadius: rpx(24),
    },
    brandCopy: {
        flex: 1,
        marginLeft: rpx(20),
        gap: rpx(5),
    },
    sourceBadge: {
        minHeight: rpx(48),
        marginTop: rpx(20),
        paddingHorizontal: rpx(16),
        borderRadius: rpx(24),
        backgroundColor: "rgba(255,255,255,0.36)",
        flexDirection: "row",
        alignItems: "center",
    },
    sourceDot: {
        width: rpx(11),
        height: rpx(11),
        marginRight: rpx(10),
        borderRadius: rpx(6),
        backgroundColor: "#275D46",
    },
    section: {
        marginTop: rpx(18),
        paddingVertical: rpx(10),
        borderRadius: rpx(28),
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
    },
    sectionTitle: {
        paddingHorizontal: rpx(24),
        paddingTop: rpx(12),
        paddingBottom: rpx(7),
        letterSpacing: 0.5,
    },
    iconWell: {
        width: rpx(58),
        height: rpx(58),
        borderRadius: rpx(18),
        marginRight: rpx(18),
    },
    exitRow: {
        minHeight: rpx(84),
        marginTop: rpx(20),
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
    },
    exitItem: {
        flex: 1,
        height: rpx(72),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    exitDivider: {
        width: StyleSheet.hairlineWidth,
        height: rpx(34),
    },
    exitText: { marginLeft: rpx(10) },
});
