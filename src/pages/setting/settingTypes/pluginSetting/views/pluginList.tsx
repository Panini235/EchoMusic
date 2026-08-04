import React, { useState } from "react";
import { FlatList, Linking, Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import * as DocumentPicker from "expo-document-picker";
import Loading from "@/components/base/loading";

import PluginManager, { useSortedPlugins } from "@/core/pluginManager";
import { trace } from "@/utils/log";

import Toast from "@/utils/toast";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import Config from "@/core/appConfig";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import AppBar from "@/components/base/appBar";
import Fab from "@/components/base/fab";
import PluginItem from "../components/pluginItem";
import { IIconName } from "@/components/base/icon.tsx";
import { IInstallPluginResult } from "@/types/core/pluginManager";
import { useI18N } from "@/core/i18n";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import useColors from "@/hooks/useColors";
import Color from "color";

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
}

export default function PluginList() {
    const plugins = useSortedPlugins();
    const { t } = useI18N();

    const [loading, setLoading] = useState(false);

    const navigator = useNavigation<any>();

    const menuOptions: IOption[] = [
        {
            icon: "bookmark-square",
            title: t("pluginSetting.menu.subscriptionSetting"),
            async onPress() {
                navigator.navigate("/pluginsetting/subscribe");
            },
        },
        {
            icon: "bars-3",
            title: t("pluginSetting.menu.sort"),
            onPress() {
                navigator.navigate("/pluginsetting/sort");
            },
        },
        {
            icon: "trash-outline",
            title: t("pluginSetting.menu.uninstallAll"),
            onPress() {
                showDialog("SimpleDialog", {
                    title: t("pluginSetting.menu.uninstallAll"),
                    content: t("pluginSetting.menu.uninstallAllContent"),
                    async onOk() {
                        setLoading(true);
                        await PluginManager.uninstallAllPlugins();
                        setLoading(false);
                    },
                });
            },
        },
    ];

    async function onInstallFromLocalClick() {
        try {
            const results = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: true,
                type: ["application/javascript", "text/javascript"],
            });
            if (results.canceled) {
                // 用户取消
                return;
            }
            setLoading(true);

            await Promise.all(
                results.assets.map(async it => {
                    await PluginManager.installPluginFromLocalFile(it.uri, {
                        notCheckVersion: Config.getConfig(
                            "basic.notCheckPluginVersion",
                        ),
                        useExpoFs: true,
                    });
                }),
            );
            // 初步过滤

            Toast.success(t("toast.installPluginSuccess"));
        } catch (e: any) {
            trace("插件安装失败", e?.message);
            Toast.warn(t("toast.installPluginFail", {
                reason: e?.message ?? "",
            }));
        }
        setLoading(false);
    }

    async function onInstallFromNetworkClick() {
        showPanel("SimpleInput", {
            title: t("pluginSetting.menu.installPlugin"),
            placeholder: t("pluginSetting.menu.installPluginDialogPlaceholder"),
            maxLength: 200,
            async onOk(text, closePanel) {
                setLoading(true);
                closePanel();

                const result = await installPluginFromUrl(text.trim());

                // 检查是否全部安装成功
                const successResults: IInstallPluginResult[] = [];
                const failResults: IInstallPluginResult[] = [];
                for (let i = 0; i < result.length; ++i) {
                    if (result[i].success) {
                        successResults.push(result[i]);
                    } else {
                        failResults.push(result[i]);
                    }
                }

                if (!failResults.length) {
                    Toast.success(t("toast.installPluginSuccess"));
                } else {
                    Toast.warn(successResults.length ? t("toast.partialPluginInstallFailed") : t("toast.allPluginInstallFailed"), {
                        "type": "warn",
                        "actionText": t("common.view"),
                        "onActionClick": () => {
                            showDialog("SimpleDialog", {
                                title: t("pluginSetting.menu.pluginInstallFailedDialogTitle"),
                                content: t("pluginSetting.pluginInstallFailedDialogContent", {
                                    detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                        reason: it.message ?? "",
                                    })).join("\n-----\n"),
                                }),
                            });
                        },
                    });
                }


                setLoading(false);
            },
        });
    }

    async function onSubscribeClick() {
        const urls = Config.getConfig("plugin.subscribeUrl");
        if (!urls) {
            Toast.warn(t("toast.noSubscription"));
        }
        setLoading(true);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];

        try {
            const urlItems = JSON.parse(urls!);
            if (Array.isArray(urlItems)) {
                for (let i = 0; i < urlItems.length; ++i) {
                    const result = await installPluginFromUrl(urlItems[i].url);
                    if (result[0]) {
                        if (result[0].success) {
                            successResults.push(result[0]);
                        } else {
                            failResults.push(result[0]);
                        }
                    }
                }
            } else {
                throw new Error();
            }

            if (!failResults.length) {
                Toast.success(t("toast.installPluginSuccess"));
            } else {
                Toast.warn((successResults.length ? t("toast.partialPluginInstallFailed") : t("toast.allPluginInstallFailed")), {
                    "type": "warn",
                    "actionText": t("common.view"),
                    "onActionClick": () => {
                        showDialog("SimpleDialog", {
                            title: t("pluginSetting.menu.pluginInstallFailedDialogTitle"),
                            content: t("pluginSetting.pluginInstallFailedDialogContent", {
                                detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                    reason: it.message ?? "",
                                })).join("\n-----\n"),
                            }),
                        });
                    },
                });
            }

        } catch {
            if (urls?.length) {
                const result = await installPluginFromUrl(urls);
                if (result[0]) {
                    if (result[0].success) {
                        Toast.success(t("toast.installPluginSuccess"));
                    } else {
                        Toast.warn(t("toast.partialPluginInstallFailedWithReason", {
                            reason: result[0].message ?? "",
                        }));
                    }
                } else {
                    Toast.warn(t("toast.subscriptionInvalid"));
                }
            }
        }
        setLoading(false);
    }

    async function onUpdateAllClick() {
        const enabledPlugins = PluginManager.getEnabledPlugins();
        setLoading(true);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];

        try {
            for (let i = 0; i < enabledPlugins.length; ++i) {
                const srcUrl = enabledPlugins[i].instance.srcUrl;
                if (srcUrl) {
                    const result = await installPluginFromUrl(srcUrl);
                    if (result[0]) {
                        if (result[0].success) {
                            successResults.push(result[0]);
                        } else {
                            failResults.push(result[0]);
                        }
                    }
                }
            }

            if (!failResults.length) {
                Toast.success(t("toast.updatePluginSuccess"));
            } else {
                Toast.warn((successResults.length ? t("toast.partialPluginUpdateFailed") : t("toast.allPluginUpdateFailed")), {
                    "type": "warn",
                    "actionText": t("common.view"),
                    "onActionClick": () => {
                        showDialog("SimpleDialog", {
                            title: t("pluginSetting.menu.pluginUpdateFailedDialogTitle"),
                            content: t("pluginSetting.pluginUpdateFailedDialogContent", {
                                detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                    reason: it.message ?? "",
                                })).join("\n-----\n"),
                            }),
                        });
                    },
                });
            }

        } catch (e: any) {
            Toast.warn(t("toast.unknownError", {
                reason: e?.message ?? e,
            }));
        }
        setLoading(false);
    }

    return (
        <>
            <AppBar menu={menuOptions}>{t("sidebar.pluginManagement")}</AppBar>
            <HorizontalSafeAreaView style={style.wrapper}>
                <>
                    {loading ? (
                        <Loading />
                    ) : (
                        <FlatList
                            ListHeaderComponent={
                                plugins.length ? (
                                    <PluginSummary count={plugins.length} />
                                ) : null
                            }
                            ListEmptyComponent={
                                <PluginWelcome
                                    onInstallLocal={onInstallFromLocalClick}
                                    onInstallNetwork={onInstallFromNetworkClick}
                                />
                            }
                            ListFooterComponent={<View style={style.blank} />}
                            data={plugins ?? []}
                            keyExtractor={_ => _.hash}
                            renderItem={({ item: plugin }) => (
                                <PluginItem key={plugin.hash} plugin={plugin} />
                            )}
                        />
                    )}

                    <Fab
                        icon="plus"
                        onPress={() => {
                            showPanel("SimpleSelect", {
                                header: t("pluginSetting.menu.installPlugin"),
                                candidates: [
                                    {
                                        value: "从本地安装插件",
                                        title: t("pluginSetting.fabOptions.installFromLocal"),
                                    },
                                    {
                                        value: "从网络安装插件",
                                        title: t("pluginSetting.fabOptions.installFromNetwork"),
                                    },
                                    {
                                        value: "更新全部插件",
                                        title: t("pluginSetting.fabOptions.updateAllPlugins"),
                                    },
                                    {
                                        value: "更新订阅",
                                        title: t("pluginSetting.fabOptions.updateSubscription"),
                                    },
                                ],
                                onPress(item) {
                                    if (item.value === "从本地安装插件") {
                                        onInstallFromLocalClick();
                                    } else if (
                                        item.value === "从网络安装插件"
                                    ) {
                                        onInstallFromNetworkClick();
                                    } else if (item.value === "更新订阅") {
                                        onSubscribeClick();
                                    } else if (item.value === "更新全部插件") {
                                        onUpdateAllClick();
                                    }
                                },
                            });
                        }}
                    />
                </>
            </HorizontalSafeAreaView>
        </>
    );
}

function PluginSummary({ count }: { count: number }) {
    const colors = useColors();
    const { t } = useI18N();

    return (
        <View
            style={[
                style.summary,
                {
                    backgroundColor: Color(colors.primary).alpha(0.11).toString(),
                    borderColor: Color(colors.primary).alpha(0.18).toString(),
                },
            ]}>
            <View
                style={[
                    style.summaryIcon,
                    { backgroundColor: Color(colors.primary).alpha(0.16).toString() },
                ]}>
                <Icon name="javascript" size={rpx(38)} color={colors.primary} />
            </View>
            <View style={style.summaryText}>
                <ThemeText fontWeight="semibold">
                    {t("pluginSetting.connectedCount", { count })}
                </ThemeText>
                <ThemeText fontSize="description" fontColor="textSecondary">
                    {t("pluginSetting.connectedDescription")}
                </ThemeText>
            </View>
            <View style={style.liveDot} />
        </View>
    );
}

function PluginWelcome(props: {
    onInstallLocal: () => void;
    onInstallNetwork: () => void;
}) {
    const { onInstallLocal, onInstallNetwork } = props;
    const colors = useColors();
    const { t } = useI18N();
    const sources = ["Bilibili", "抖音", "网易云", "QQ 音乐", "喜马拉雅"];

    return (
        <View style={style.welcome}>
            <View
                style={[
                    style.welcomeIcon,
                    { backgroundColor: Color(colors.primary).alpha(0.14).toString() },
                ]}>
                <Icon name="javascript" size={rpx(68)} color={colors.primary} />
            </View>
            <ThemeText
                fontSize="appbar"
                fontWeight="bold"
                style={style.welcomeTitle}>
                {t("pluginSetting.welcomeTitle")}
            </ThemeText>
            <ThemeText
                fontSize="subTitle"
                fontColor="textSecondary"
                style={style.welcomeDescription}>
                {t("pluginSetting.welcomeDescription")}
            </ThemeText>
            <View style={style.sourceChips}>
                {sources.map(source => (
                    <View
                        key={source}
                        style={[
                            style.sourceChip,
                            { backgroundColor: colors.placeholder },
                        ]}>
                        <ThemeText fontSize="description">{source}</ThemeText>
                    </View>
                ))}
            </View>
            <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                    style.primaryAction,
                    { backgroundColor: colors.primary },
                    pressed ? style.pressed : null,
                ]}
                onPress={onInstallNetwork}>
                <Icon name="link" size={rpx(38)} color="#FFFFFF" />
                <ThemeText color="#FFFFFF" fontWeight="semibold">
                    {t("pluginSetting.fabOptions.installFromNetwork")}
                </ThemeText>
            </Pressable>
            <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                    style.secondaryAction,
                    {
                        backgroundColor: colors.card,
                        borderColor: Color(colors.text).alpha(0.08).toString(),
                    },
                    pressed ? style.pressed : null,
                ]}
                onPress={onInstallLocal}>
                <Icon name="folder-outline" size={rpx(38)} color={colors.text} />
                <ThemeText fontWeight="semibold">
                    {t("pluginSetting.fabOptions.installFromLocal")}
                </ThemeText>
            </Pressable>
            <Pressable
                accessibilityRole="link"
                style={style.docsLink}
                onPress={() => Linking.openURL("https://musicfree.catcat.work/plugin/introduction.html")}>
                <ThemeText color={colors.primary} fontSize="subTitle">
                    {t("pluginSetting.openDocs")}
                </ThemeText>
                <Icon name="arrow-right-end-on-rectangle" size={rpx(30)} color={colors.primary} />
            </Pressable>
            <ThemeText
                fontSize="description"
                fontColor="textSecondary"
                style={style.legalTip}>
                {t("pluginSetting.legalTip")}
            </ThemeText>
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    blank: {
        height: rpx(200),
    },
    summary: {
        minHeight: rpx(114),
        marginHorizontal: rpx(24),
        marginTop: rpx(24),
        marginBottom: rpx(4),
        paddingHorizontal: rpx(22),
        borderRadius: rpx(26),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
    },
    summaryIcon: {
        width: rpx(70),
        height: rpx(70),
        marginRight: rpx(18),
        borderRadius: rpx(22),
        alignItems: "center",
        justifyContent: "center",
    },
    summaryText: {
        flex: 1,
        gap: rpx(4),
    },
    liveDot: {
        width: rpx(14),
        height: rpx(14),
        borderRadius: rpx(7),
        backgroundColor: "#2AA66A",
    },
    welcome: {
        minHeight: rpx(840),
        paddingHorizontal: rpx(44),
        paddingTop: rpx(70),
        alignItems: "center",
    },
    welcomeIcon: {
        width: rpx(128),
        height: rpx(128),
        borderRadius: rpx(42),
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: "-4deg" }],
    },
    welcomeTitle: {
        marginTop: rpx(34),
        textAlign: "center",
    },
    welcomeDescription: {
        maxWidth: rpx(600),
        marginTop: rpx(16),
        lineHeight: rpx(42),
        textAlign: "center",
    },
    sourceChips: {
        marginTop: rpx(24),
        marginBottom: rpx(30),
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: rpx(10),
    },
    sourceChip: {
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(8),
        borderRadius: rpx(20),
    },
    primaryAction: {
        width: "100%",
        minHeight: rpx(88),
        borderRadius: rpx(28),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: rpx(14),
    },
    secondaryAction: {
        width: "100%",
        minHeight: rpx(88),
        marginTop: rpx(14),
        borderRadius: rpx(28),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: rpx(14),
    },
    docsLink: {
        marginTop: rpx(28),
        flexDirection: "row",
        alignItems: "center",
        gap: rpx(8),
    },
    legalTip: {
        marginTop: rpx(24),
        lineHeight: rpx(32),
        textAlign: "center",
    },
    pressed: {
        opacity: 0.76,
        transform: [{ scale: 0.985 }],
    },
});



async function installPluginFromUrl(text: string): Promise<IInstallPluginResult[]> {
    try {
        let urls: string[] = [];
        const inputUrl = text.trim();
        if (text.endsWith(".json")) {
            const jsonFile = (
                await axios.get(inputUrl, {
                    headers: {
                        "Cache-Control": "no-cache",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                })
            ).data;
            /**
             * {
             *     plugins: [{
             *          version: xxx,
             *          url: xxx
             *      }]
             * }
             */
            urls = (jsonFile?.plugins ?? []).map((_: any) => _.url);
        } else {
            urls = [inputUrl];
        }
        return await Promise.all(
            urls.map(url =>
                PluginManager.installPluginFromUrl(url, {
                    notCheckVersion: Config.getConfig(
                        "basic.notCheckPluginVersion",
                    ),
                }),
            ),
        );
    } catch (e: any) {
        return [{ success: false, message: e?.message, pluginUrl: text }];
    }
}
