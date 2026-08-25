import React, { useMemo } from "react";
import MusicList from "@/components/musicList";
import LocalMusicSheet from "@/core/localMusicSheet";
import { localMusicSheetId, localPluginPlatform, RequestStateCode, SortType } from "@/constants/commonConst";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import PersistStatus from "@/utils/persistStatus";

const collator = new Intl.Collator("zh");

export default function LocalMusicList() {
    const musicList = LocalMusicSheet.useMusicList();
    const sortType = PersistStatus.useValue("localMusic.sort", SortType.Oldest);
    const { t } = useI18N();
    const sortedMusicList = useMemo(() => {
        const list = [...musicList];
        if (sortType === SortType.Title) {
            return list.sort((left, right) => collator.compare(left.title, right.title));
        }
        if (sortType === SortType.Newest) {
            return list.reverse();
        }
        return list;
    }, [musicList, sortType]);

    return (
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <MusicList
                musicList={sortedMusicList}
                showIndex
                state={RequestStateCode.IDLE}
                musicSheet={{
                    id: localMusicSheetId,
                    title: t("common.local"),
                    platform: localPluginPlatform,
                    musicList: sortedMusicList,
                }}
            />
        </HorizontalSafeAreaView>
    );
}
