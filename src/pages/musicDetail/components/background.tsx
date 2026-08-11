import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ImgAsset } from "@/constants/assetsConst";
import { useCurrentMusic } from "@/core/trackPlayer";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

export default function Background() {
    const musicItem = useCurrentMusic();

    const artworkSource = useMemo(() => {
        if (!musicItem?.artwork) {
            return ImgAsset.albumDefault;
        }

        if(typeof musicItem.artwork === "string") {
            return {
                uri: musicItem.artwork,
            };
        }
        return musicItem.artwork;

    }, [musicItem?.artwork]);

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={style.background} />
            <Animated.Image
                key={`${musicItem?.platform ?? "local"}-${musicItem?.id ?? musicItem?.title ?? "empty"}`}
                entering={FadeIn.duration(650)}
                exiting={FadeOut.duration(220)}
                style={style.blur}
                blurRadius={32}
                source={artworkSource}
            />
            <LinearGradient
                colors={["rgba(8,8,9,0.26)", "rgba(8,8,9,0.48)", "rgba(8,8,9,0.94)"]}
                locations={[0, 0.50, 1]}
                style={style.overlay}
            />
        </View>
    );
}

const style = StyleSheet.create({
    background: {
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#000",
    },
    blur: {
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.54,
        transform: [{ scale: 1.08 }],
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
});
