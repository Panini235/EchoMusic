import Empty from "@/components/base/empty";
import globalStyle from "@/constants/globalStyle";
import { useNavigate } from "@/core/router";
import useHomeNavigationLatch from "@/pages/home/hooks/useHomeNavigationLatch";
import rpx from "@/utils/rpx";
import { FlashList } from "@shopify/flash-list";
import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import ContinueListening from "./continueListening";
import Operations from "./operations";
import RecentlyPlayed from "./recentlyPlayed";
import {
    getHomeSheetKey,
    HomeSheetCard,
    HomeSheetItem,
    navigateToHomeSheet,
    SheetSectionHeader,
    useSheetSectionModel,
} from "./sheets";

export default function HomeBody() {
    const model = useSheetSectionModel();
    const navigate = useNavigate();
    const guardedNavigate = useHomeNavigationLatch();
    const openSheet = useCallback(
        (sheet: HomeSheetItem) => navigateToHomeSheet(navigate, sheet),
        [navigate],
    );

    return (
        <FlashList
            style={globalStyle.fwflex1}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            data={model.data}
            estimatedItemSize={rpx(284)}
            numColumns={2}
            keyExtractor={getHomeSheetKey}
            ListEmptyComponent={<Empty />}
            ListHeaderComponent={
                <>
                    <ContinueListening />
                    <Operations navigate={guardedNavigate} />
                    <RecentlyPlayed />
                    <SheetSectionHeader
                        selectedTab={model.selectedTab}
                        onSelectTab={model.setSelectedTab}
                        allSheetsCount={model.allSheetsCount}
                        starredSheetsCount={model.starredSheetsCount}
                    />
                </>
            }
            renderItem={({ item, index }) => (
                <HomeSheetCard
                    sheet={item}
                    onOpen={openSheet}
                    column={index % 2 === 0 ? "left" : "right"}
                />
            )}
        />
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 32,
    },
});
