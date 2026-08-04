import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import SeekBar from "./seekBar";
import PlayControl from "./playControl";
import useOrientation from "@/hooks/useOrientation";

export default function Bottom() {
    const orientation = useOrientation();
    return (
        <View
            style={[
                style.wrapper,
                orientation === "horizontal"
                    ? {
                        height: rpx(156),
                    }
                    : undefined,
            ]}>
            <SeekBar />
            <PlayControl />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        height: rpx(232),
        marginHorizontal: rpx(20),
        marginBottom: rpx(14),
        paddingTop: rpx(22),
        borderRadius: rpx(36),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.09)",
        overflow: "hidden",
    },
});
