import Empty from "@/components/base/empty";
import ListItem from "@/components/base/listItem";
import globalStyle from "@/constants/globalStyle";
import MusicSheet from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useHomeNavigationLatch from "@/pages/home/hooks/useHomeNavigationLatch";
import { FlashList } from "@shopify/flash-list";
import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import ContinueListening from "./continueListening";
import Operations from "./operations";
import RecentlyPlayed from "./recentlyPlayed";
import {
    getHomeSheetKey,
    HomeSheetItem,
    isLocalHomeSheet,
    navigateToHomeSheet,
    SheetRow,
    SheetSectionHeader,
    useSheetSectionModel,
} from "./sheets";

export default function HomeBody() {
    const model = useSheetSectionModel();
    const navigate = useNavigate();
    const guardedNavigate = useHomeNavigationLatch();
    const openSheet = useCallback(
        (sheet: HomeSheetItem) => {
            if (
                isLocalHomeSheet(sheet) &&
                sheet.id === MusicSheet.defaultSheet.id
            ) {
                guardedNavigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: sheet.id });
                return;
            }

            navigateToHomeSheet(navigate, sheet);
        },
        [guardedNavigate, navigate],
    );

    return (
        <FlashList
            style={globalStyle.fwflex1}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            data={model.data}
            estimatedItemSize={ListItem.Size.big}
            keyExtractor={getHomeSheetKey}
            ListEmptyComponent={<Empty />}
            ListHeaderComponent={
                <>
                    <ContinueListening />
                    <RecentlyPlayed />
                    <SheetSectionHeader
                        selectedTab={model.selectedTab}
                        onSelectTab={model.setSelectedTab}
                        allSheetsCount={model.allSheetsCount}
                        starredSheetsCount={model.starredSheetsCount}
                    />
                </>
            }
            ListFooterComponent={<Operations navigate={guardedNavigate} />}
            renderItem={({ item }) => (
                <SheetRow sheet={item} onOpen={openSheet} />
            )}
        />
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 32,
    },
});
