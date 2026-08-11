import Empty from "@/components/base/empty";
import IconButton from "@/components/base/iconButton";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { localPluginPlatform } from "@/constants/commonConst";
import { useI18N } from "@/core/i18n";
import MusicSheet, { useSheetsBase, useStarredSheets } from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { FlashList } from "@shopify/flash-list";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Color from "color";

export default function Sheets() {
    const [index, setIndex] = useState(0);
    const colors = useColors();
    const navigate = useNavigate();

    const allSheets = useSheetsBase();
    const staredSheets = useStarredSheets();
    const { t } = useI18N();

    const selectedTabTextStyle = useMemo(() => {
        return [styles.selectTab, { backgroundColor: colors.card }];
    }, [colors]);


    return (
        <>
            <View style={styles.sectionHeader}>
                <ThemeText fontSize="title" fontWeight="bold">
                    {t("home.frequentPlaylists")}
                </ThemeText>
                <View style={styles.more}>
                    <IconButton
                        name="plus"
                        style={styles.newSheetButton}
                        sizeType="normal"
                        accessibilityLabel={t("home.newPlaylist.a11y")}
                        onPress={() => {
                            showPanel("CreateMusicSheet");
                        }}
                    />
                    <IconButton
                        name="inbox-arrow-down"
                        sizeType="normal"
                        accessibilityLabel={t("home.importPlaylist.a11y")}
                        onPress={() => {
                            showPanel("ImportMusicSheet");
                        }}
                    />
                </View>
            </View>
            <View style={styles.subTitleContainer}>
                <View style={[styles.segmented, { backgroundColor: colors.placeholder }]}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.tabContainer,
                            index === 0 ? selectedTabTextStyle : null,
                            pressed ? styles.tabPressed : null,
                        ]}
                        accessible
                        accessibilityLabel={t("home.myPlaylistsCount.a11y", {
                            count: allSheets.length,
                        })}
                        onPress={() => {
                            setIndex(0);
                        }}>
                        <ThemeText
                            accessible={false}
                            fontSize="title"
                            fontWeight={index === 0 ? "bold" : "medium"}
                            style={styles.tabText}>
                            {t("home.myPlaylists")}
                        </ThemeText>
                        <ThemeText
                            accessible={false}
                            fontColor="textSecondary"
                            fontSize="subTitle"
                            style={styles.tabText}>
                            {" "}
                        ({allSheets.length})
                        </ThemeText>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [
                            styles.tabContainer,
                            index === 1 ? selectedTabTextStyle : null,
                            pressed ? styles.tabPressed : null,
                        ]}
                        accessible
                        accessibilityLabel={t("home.starredPlaylistsCount.a11y", {
                            count: staredSheets.length,
                        })}
                        onPress={() => {
                            setIndex(1);
                        }}>
                        <ThemeText
                            fontSize="title"
                            accessible={false}
                            fontWeight={index === 1 ? "bold" : "medium"}
                            style={styles.tabText}>
                            {t("home.starredPlaylists")}
                        </ThemeText>
                        <ThemeText
                            fontColor="textSecondary"
                            fontSize="subTitle"
                            accessible={false}
                            style={styles.tabText}>
                            {" "}
                        ({staredSheets.length})
                        </ThemeText>
                    </Pressable>
                </View>
            </View>
            <FlashList
                ListEmptyComponent={<Empty />}
                contentContainerStyle={styles.listContent}
                extraData={{ t }}
                data={(index === 0 ? allSheets : staredSheets) ?? []}
                estimatedItemSize={ListItem.Size.big}
                renderItem={({ item: sheet }) => {
                    const isLocalSheet = !(
                        sheet.platform && sheet.platform !== localPluginPlatform
                    );


                    return (
                        <View
                            key={`${sheet.id}`}
                            style={[
                                styles.sheetCard,
                                {
                                    backgroundColor: colors.card,
                                    borderColor: Color(colors.text)
                                        .alpha(0.05)
                                        .toString(),
                                },
                            ]}>
                            <ListItem
                                heightType="big"
                                withHorizontalPadding
                                onPress={() => {
                                    if (isLocalSheet) {
                                        navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, {
                                            id: sheet.id,
                                        });
                                    } else {
                                        navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                                            sheetInfo: sheet,
                                        });
                                    }
                                }}>
                                <ListItem.ListItemImage
                                    uri={sheet.coverImg ?? sheet.artwork}
                                    fallbackImg={ImgAsset.albumDefault}
                                    maskIcon={
                                        sheet.id === MusicSheet.defaultSheet.id
                                            ? "heart"
                                            : null
                                    }
                                />
                                <ListItem.Content
                                    title={sheet.title}
                                    description={
                                        isLocalSheet
                                            ? t("home.songCount", { count: sheet.worksNum })
                                            : `${sheet.artist ?? ""}`
                                    }
                                />
                                {sheet.id !== MusicSheet.defaultSheet.id ? (
                                    <ListItem.ListItemIcon
                                        position="right"
                                        icon="trash-outline"
                                        onPress={() => {
                                            showDialog("SimpleDialog", {
                                                title: t("dialog.deleteSheetTitle"),
                                                content: t("dialog.deleteSheetContent", {
                                                    name: sheet.title,
                                                }),
                                                onOk: async () => {
                                                    if (isLocalSheet) {
                                                        await MusicSheet.removeSheet(
                                                            sheet.id,
                                                        );
                                                        Toast.success(t("toast.deleteSuccess"));
                                                    } else {
                                                        await MusicSheet.unstarMusicSheet(
                                                            sheet,
                                                        );
                                                        Toast.success(t("toast.hasUnstarred"));
                                                    }
                                                },
                                            });
                                        }}
                                    />
                                ) : null}
                            </ListItem>
                        </View>
                    );
                }}
                nestedScrollEnabled
            />
        </>
    );
}

const styles = StyleSheet.create({
    sectionHeader: {
        marginTop: rpx(42),
        marginBottom: rpx(16),
        paddingHorizontal: rpx(28),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    subTitleContainer: {
        paddingHorizontal: rpx(28),
        flexDirection: "row",
        alignItems: "center",
        marginBottom: rpx(18),
    },
    segmented: {
        flexDirection: "row",
        minHeight: rpx(66),
        padding: rpx(5),
        borderRadius: rpx(24),
    },
    tabContainer: {
        flexDirection: "row",
        paddingHorizontal: rpx(17),
        borderRadius: rpx(19),
        alignItems: "center",
    },

    tabText: {
        lineHeight: rpx(48),
    },
    selectTab: {
        shadowColor: "#000",
        shadowOpacity: 0.10,
        shadowRadius: rpx(8),
        shadowOffset: { width: 0, height: rpx(3) },
        elevation: 2,
    },
    tabPressed: {
        opacity: 0.72,
    },
    more: {
        height: rpx(64),
        flexDirection: "row",
        alignItems: "center",
    },
    newSheetButton: {
        marginRight: rpx(24),
    },
    listContent: {
        paddingHorizontal: rpx(28),
    },
    sheetCard: {
        marginBottom: rpx(14),
        borderRadius: rpx(26),
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
    },
});
