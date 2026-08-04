import React from "react";
import { iconSizeConst } from "@/constants/uiConst";
import { useCurrentMusic } from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { Pressable, StyleSheet } from "react-native";
import rpx from "@/utils/rpx";

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
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? "取消喜欢" : "喜欢"}
            hitSlop={8}
            onPress={onPress}
            style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}>
            <Icon
                pointerEvents="none"
                name={isFavorite ? "heart" : "heart-outline"}
                size={iconSizeConst.normal}
                color={isFavorite ? "#FF6B62" : "white"}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        width: rpx(64),
        height: rpx(64),
        alignItems: "center",
        justifyContent: "center",
    },
    pressed: {
        opacity: 0.56,
        transform: [{ scale: 0.92 }],
    },
});
