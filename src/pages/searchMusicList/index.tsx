import AppBar from "@/components/base/appBar";
import Input from "@/components/base/input";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import MusicBar from "@/components/musicBar";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import LocalMusicSheet from "@/core/localMusicSheet";
import { useParams } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React, { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import SearchResult from "./searchResult";

function filterMusic(query: string, musicList: IMusic.IMusicItem[]) {
    if (query.length === 0) {
        return musicList;
    }
    const normalizedQuery = query.toLowerCase();
    return musicList.filter(musicItem =>
        `${musicItem.title ?? ""} ${musicItem.artist ?? ""} ${musicItem.album ?? ""} ${musicItem.platform ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery),
    );
}

export default function SearchMusicList() {
    const { musicList: routeMusicList, musicSheet, isLocalMusicSearch } =
        useParams<"search-music-list">();
    const localMusicList = LocalMusicSheet.useMusicList();
    const [query, setQuery] = useState("");
    const musicList = isLocalMusicSearch
        ? localMusicList
        : routeMusicList ?? [];
    const result = useMemo(
        () => filterMusic(query.trim(), musicList),
        [musicList, query],
    );

    const colors = useColors();
    const { t } = useI18N();

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>
                <Input
                    style={style.searchBar}
                    fontColor={colors.appBarText}
                    placeholder={t("searchMusicList.searchPlaceHolder")}
                    accessible
                    autoFocus
                    accessibilityLabel="搜索框"
                    accessibilityHint={t("searchMusicList.searchLabel.a11y")}
                    value={query}
                    onChangeText={setQuery}
                />
            </AppBar>
            <SearchResult result={result} musicSheet={musicSheet} />
            <MusicBar />
        </VerticalSafeAreaView>
    );
}

const style = StyleSheet.create({
    searchBar: {
        minWidth: rpx(375),
        flex: 1,
        borderRadius: rpx(64),
        height: rpx(64),
        fontSize: rpx(32),
    },
});
