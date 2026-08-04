import React, { useMemo } from "react";
import rpx from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import useOrientation from "@/hooks/useOrientation";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCurrentMusic } from "@/core/trackPlayer";
import globalStyle from "@/constants/globalStyle";
import Operations from "./operations";
import { showPanel } from "@/components/panels/usePanel.ts";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

interface IProps {
    onTurnPageClick?: () => void;
}

export default function AlbumCover(props: IProps) {
    const { onTurnPageClick } = props;

    const musicItem = useCurrentMusic();
    const orientation = useOrientation();

    const artworkStyle = useMemo(() => {
        if (orientation === "vertical") {
            return {
                width: rpx(500),
                height: rpx(500),
                borderRadius: rpx(38),
            };
        } else {
            return {
                width: rpx(260),
                height: rpx(260),
                borderRadius: rpx(26),
            };
        }
    }, [orientation]);

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
            <GestureDetector gesture={combineGesture}>
                <Animated.View
                    entering={ZoomIn.duration(480).springify()}
                    style={[globalStyle.fullCenter, styles.coverStage]}>
                    <Animated.View entering={FadeIn.duration(620)} style={styles.shadow}>
                        <FastImage
                            style={artworkStyle}
                            source={musicItem?.artwork}
                            placeholderSource={ImgAsset.albumDefault}
                        />
                    </Animated.View>
                </Animated.View>
            </GestureDetector>
            <Operations />
        </>
    );
}

const styles = {
    coverStage: {
        paddingHorizontal: rpx(28),
    },
    shadow: {
        borderRadius: rpx(38),
        shadowColor: "#000",
        shadowOpacity: 0.38,
        shadowRadius: rpx(34),
        shadowOffset: { width: 0, height: rpx(22) },
        elevation: 18,
    },
};
