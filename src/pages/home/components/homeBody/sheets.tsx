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
import type { HomeNavigationHandler } from "@/pages/home/hooks/useHomeNavigationLatch";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { FlashList } from "@shopify/flash-list";
import Color from "color";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export type HomeSheetItem = IMusic.IMusicSheetItemBase;
type SheetTab = 0 | 1;

export function getHomeSheetKey(sheet: HomeSheetItem) {
    return `${sheet.platform ?? localPluginPlatform}:${sheet.id}`;
}

export function isLocalHomeSheet(sheet: HomeSheetItem) {
    return !(sheet.platform && sheet.platform !== localPluginPlatform);
}

export function navigateToHomeSheet(
    navigate: HomeNavigationHandler,
    sheet: HomeSheetItem,
) {
    if (isLocalHomeSheet(sheet)) {
        navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: sheet.id });
        return;
    }

    navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, { sheetInfo: sheet });
}

export function useSheetSectionModel() {
    const [selectedTab, setSelectedTab] = useState<SheetTab>(0);
    const allSheets = useSheetsBase();
    const starredSheets = useStarredSheets();
    const data = useMemo(
        () => (selectedTab === 0 ? allSheets : starredSheets) ?? [],
        [allSheets, selectedTab, starredSheets],
    );

    return {
        selectedTab,
        setSelectedTab,
        allSheetsCount: allSheets.length,
        starredSheetsCount: starredSheets.length,
        data,
    };
}

interface SheetSectionHeaderProps {
    selectedTab: SheetTab;
    onSelectTab: (tab: SheetTab) => void;
    allSheetsCount: number;
    starredSheetsCount: number;
}

export function SheetSectionHeader(props: SheetSectionHeaderProps) {
    const {
        selectedTab,
        onSelectTab,
        allSheetsCount,
        starredSheetsCount,
    } = props;
    const colors = useColors();
    const { t } = useI18N();
    const selectedTabTextStyle = useMemo(
        () => [styles.selectTab, { backgroundColor: colors.card }],
        [colors.card],
    );

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
                        onPress={() => showPanel("CreateMusicSheet")}
                    />
                    <IconButton
                        name="inbox-arrow-down"
                        sizeType="normal"
                        accessibilityLabel={t("home.importPlaylist.a11y")}
                        onPress={() => showPanel("ImportMusicSheet")}
                    />
                </View>
            </View>
            <View style={styles.subTitleContainer}>
                <View
                    style={[
                        styles.segmented,
                        { backgroundColor: colors.placeholder },
                    ]}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.tabContainer,
                            selectedTab === 0 ? selectedTabTextStyle : null,
                            pressed ? styles.tabPressed : null,
                        ]}
                        accessible
                        accessibilityLabel={t("home.myPlaylistsCount.a11y", {
                            count: allSheetsCount,
                        })}
                        onPress={() => onSelectTab(0)}>
                        <ThemeText
                            accessible={false}
                            fontSize="title"
                            fontWeight={selectedTab === 0 ? "bold" : "medium"}
                            style={styles.tabText}>
                            {t("home.myPlaylists")}
                        </ThemeText>
                        <ThemeText
                            accessible={false}
                            fontColor="textSecondary"
                            fontSize="subTitle"
                            style={styles.tabText}>
                            {` (${allSheetsCount})`}
                        </ThemeText>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [
                            styles.tabContainer,
                            selectedTab === 1 ? selectedTabTextStyle : null,
                            pressed ? styles.tabPressed : null,
                        ]}
                        accessible
                        accessibilityLabel={t("home.starredPlaylistsCount.a11y", {
                            count: starredSheetsCount,
                        })}
                        onPress={() => onSelectTab(1)}>
                        <ThemeText
                            accessible={false}
                            fontSize="title"
                            fontWeight={selectedTab === 1 ? "bold" : "medium"}
                            style={styles.tabText}>
                            {t("home.starredPlaylists")}
                        </ThemeText>
                        <ThemeText
                            accessible={false}
                            fontColor="textSecondary"
                            fontSize="subTitle"
                            style={styles.tabText}>
                            {` (${starredSheetsCount})`}
                        </ThemeText>
                    </Pressable>
                </View>
            </View>
        </>
    );
}

interface SheetRowProps {
    sheet: HomeSheetItem;
    onOpen: (sheet: HomeSheetItem) => void;
}

export function SheetRow({ sheet, onOpen }: SheetRowProps) {
    const colors = useColors();
    const { t } = useI18N();
    const isLocalSheet = isLocalHomeSheet(sheet);

    return (
        <View
            style={[
                styles.sheetCard,
                {
                    backgroundColor: colors.card,
                    borderColor: Color(colors.text).alpha(0.05).toString(),
                },
            ]}>
            <ListItem
                heightType="big"
                withHorizontalPadding
                onPress={() => onOpen(sheet)}>
                <ListItem.ListItemImage
                    uri={sheet.coverImg ?? sheet.artwork}
                    fallbackImg={ImgAsset.albumDefault}
                    maskIcon={sheet.id === MusicSheet.defaultSheet.id ? "heart" : null}
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
                                        await MusicSheet.removeSheet(sheet.id);
                                        Toast.success(t("toast.deleteSuccess"));
                                    } else {
                                        await MusicSheet.unstarMusicSheet(sheet);
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
}

export default function Sheets() {
    const model = useSheetSectionModel();
    const navigate = useNavigate();
    const openSheet = useCallback(
        (sheet: HomeSheetItem) => navigateToHomeSheet(navigate, sheet),
        [navigate],
    );

    return (
        <>
            <SheetSectionHeader
                selectedTab={model.selectedTab}
                onSelectTab={model.setSelectedTab}
                allSheetsCount={model.allSheetsCount}
                starredSheetsCount={model.starredSheetsCount}
            />
            <FlashList
                ListEmptyComponent={<Empty />}
                data={model.data}
                estimatedItemSize={ListItem.Size.big}
                keyExtractor={getHomeSheetKey}
                renderItem={({ item }) => (
                    <SheetRow sheet={item} onOpen={openSheet} />
                )}
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
        shadowOpacity: 0.1,
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
    sheetCard: {
        marginHorizontal: rpx(28),
        marginBottom: rpx(14),
        borderRadius: rpx(26),
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
    },
});
