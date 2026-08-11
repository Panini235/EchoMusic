import React from "react";
import { iconSizeConst } from "@/constants/uiConst";
import { useCurrentMusic } from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import PlayerActionButton from "../../playerActionButton";

export default function () {
    const musicItem = useCurrentMusic();

    const isFavorite = useFavorite(musicItem);

    const onPress = () => {
        if (!musicItem) {
            return;
        }
        if (isFavorite) {
            MusicSheet.removeMusic(MusicSheet.defaultSheet.id, musicItem);
        } else {
            MusicSheet.addMusic(MusicSheet.defaultSheet.id, musicItem);
        }
    };

    return (
        <PlayerActionButton
            accessibilityLabel={isFavorite ? "取消喜欢" : "喜欢"}
            onPress={onPress}>
            <Icon
                name={isFavorite ? "heart" : "heart-outline"}
                size={iconSizeConst.normal}
                color={isFavorite ? "#FF6B62" : "white"}
            />
        </PlayerActionButton>
    );
}
