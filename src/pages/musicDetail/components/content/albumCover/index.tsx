import React, { useMemo } from "react";
import rpx from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import useOrientation from "@/hooks/useOrientation";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCurrentMusic } from "@/core/trackPlayer";
import Operations from "./operations";
import { showPanel } from "@/components/panels/usePanel.ts";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { StyleSheet, useWindowDimensions, View } from "react-native";

interface IProps {
    onTurnPageClick?: () => void;
}

export default function AlbumCover(props: IProps) {
    const { onTurnPageClick } = props;

    const musicItem = useCurrentMusic();
    const orientation = useOrientation();
    const window = useWindowDimensions();

    const artworkStyle = useMemo(() => {
        if (orientation === "vertical") {
            const size = Math.max(
                rpx(260),
                Math.min(rpx(510), window.width - rpx(72), window.height * 0.34),
            );
            return {
                width: size,
                height: size,
                borderRadius: rpx(42),
            };
        } else {
            const size = Math.max(
                rpx(200),
                Math.min(rpx(260), window.height * 0.42),
            );
            return {
                width: size,
                height: size,
                borderRadius: rpx(26),
            };
        }
    }, [orientation, window.height, window.width]);

    const longPress = Gesture.LongPress()
        .onStart(() => {
            if (musicItem?.artwork) {
                showPanel("ImageViewer", {
                    url: musicItem.artwork,
                });
            }
        })
        .runOnJS(true);

    const tap = Gesture.Tap()
        .onStart(() => {
            onTurnPageClick?.();
        })
        .runOnJS(true);

    const combineGesture = Gesture.Race(tap, longPress);

    return (
        <>
            <View style={styles.coverStage} pointerEvents="box-none">
                <GestureDetector gesture={combineGesture}>
                    <Animated.View
                        key={`${musicItem?.platform ?? "local"}-${musicItem?.id ?? musicItem?.title ?? "empty"}`}
                        entering={ZoomIn.duration(440).springify().damping(18)}
                        exiting={FadeOut.duration(180)}
                        style={styles.shadow}>
                        <Animated.View entering={FadeIn.duration(420)}>
                            <FastImage
                                style={artworkStyle}
                                source={musicItem?.artwork}
                                placeholderSource={ImgAsset.albumDefault}
                            />
                        </Animated.View>
                    </Animated.View>
                </GestureDetector>
            </View>
            <Operations />
        </>
    );
}

const styles = StyleSheet.create({
    coverStage: {
        width: "100%",
        flex: 1,
        minHeight: 0,
        paddingHorizontal: rpx(28),
        alignItems: "center",
        justifyContent: "center",
    },
    shadow: {
        borderRadius: rpx(38),
        shadowColor: "#000",
        shadowOpacity: 0.38,
        shadowRadius: rpx(34),
        shadowOffset: { width: 0, height: rpx(22) },
        elevation: 18,
    },
});
