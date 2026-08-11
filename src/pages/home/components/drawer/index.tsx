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
import { BackHandler, Image, Platform, Pressable, StyleSheet, View } from "react-native";
import DeviceInfo from "react-native-device-info";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDownloadQueue } from "@/core/downloader";

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
    const downloadQueue = useDownloadQueue();
    const { t, getSupportedLanguages, getLanguage, setLanguage } = useI18N();

    const navigateToSetting = (type: string) => {
        navigate(ROUTE_PATH.SETTING, { type });
    };

    const libraryItems: IDrawerItem[] = [
        {
            icon: plugins.length ? "musical-note" : "javascript",
            title: t("sidebar.sourceManagement"),
            value: plugins.length
                ? `${plugins.length}`
                : t("sidebar.sourceNotConfigured"),
            onPress: () => navigateToSetting("plugin"),
        },
        {
            icon: "cog-8-tooth",
            title: t("sidebar.basicSettings"),
            onPress: () => navigateToSetting("basic"),
        },
        {
            icon: "t-shirt-outline",
            title: t("sidebar.themeSettings"),
            onPress: () => navigateToSetting("theme"),
        },
    ];

    const utilityItems: IDrawerItem[] = [
        {
            icon: "arrow-down-tray",
            title: t("sidebar.downloadQueue"),
            value: downloadQueue.length ? `${downloadQueue.length}` : undefined,
            onPress: () => navigate(ROUTE_PATH.DOWNLOADING),
        },
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
        <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
            <PageBackground />
            <DrawerContentScrollView
                {...props}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <Animated.View
                    entering={FadeInDown.duration(340).springify().damping(18)}
                    style={[
                        styles.brandCard,
                        {
                            backgroundColor: Color(colors.card).alpha(0.94).toString(),
                            borderColor: Color(colors.primary).alpha(0.18).toString(),
                        },
                    ]}>
                    <Image source={ImgAsset.logo} style={styles.logo} />
                    <View style={styles.brandCopy}>
                        <ThemeText fontSize="title" fontWeight="bold">
                            {DeviceInfo.getApplicationName()}
                        </ThemeText>
                        <ThemeText fontColor="textSecondary" fontSize="description">
                            {t("home.brandTagline")}
                        </ThemeText>
                    </View>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("sidebar.basicSettings")}
                        hitSlop={8}
                        onPress={() => navigateToSetting("basic")}
                        style={[
                            styles.headerAction,
                            { backgroundColor: Color(colors.primary).alpha(0.12).toString() },
                        ]}>
                        <Icon name="cog-8-tooth" size={rpx(32)} color={colors.primary} />
                    </Pressable>
                </Animated.View>

                <DrawerSection delay={70} title={t("sidebar.controlCenter")} items={libraryItems} />
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
        </SafeAreaView>
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
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.title}
            onPress={props.onPress}
            style={({ pressed }) => [
                styles.exitItem,
                pressed ? styles.exitPressed : null,
            ]}>
            <Icon name={props.icon} size={rpx(34)} color={colors.textSecondary} />
            <ThemeText fontSize="description" fontColor="textSecondary" style={styles.exitText}>
                {props.title}
            </ThemeText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: rpx(22),
        paddingTop: rpx(12),
        paddingBottom: rpx(40),
    },
    brandCard: {
        minHeight: rpx(116),
        paddingHorizontal: rpx(18),
        borderRadius: rpx(28),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
    },
    logo: {
        width: rpx(70),
        height: rpx(70),
        borderRadius: rpx(22),
    },
    brandCopy: {
        flex: 1,
        marginLeft: rpx(16),
        gap: rpx(3),
    },
    headerAction: {
        width: rpx(56),
        height: rpx(56),
        borderRadius: rpx(20),
        alignItems: "center",
        justifyContent: "center",
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
    exitPressed: {
        opacity: 0.58,
    },
});
