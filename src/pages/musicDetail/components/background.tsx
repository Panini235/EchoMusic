import React, { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { ImgAsset } from "@/constants/assetsConst";
import { useCurrentMusic } from "@/core/trackPlayer";
import LinearGradient from "react-native-linear-gradient";

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
        <>
            <View style={style.background} />
            <Image style={style.blur} blurRadius={42} source={artworkSource} />
            <LinearGradient
                colors={["rgba(9,8,7,0.34)", "rgba(9,8,7,0.50)", "rgba(9,8,7,0.90)"]}
                locations={[0, 0.48, 1]}
                style={style.overlay}
            />
        </>
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
        opacity: 0.62,
        transform: [{ scale: 1.12 }],
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
});
