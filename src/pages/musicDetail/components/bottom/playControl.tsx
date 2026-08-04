import repeatModeConst from "@/constants/repeatModeConst";
import rpx from "@/utils/rpx";
import React from "react";
import { InteractionManager, Pressable, StyleSheet, View } from "react-native";

import Icon from "@/components/base/icon.tsx";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useMusicState, useRepeatMode } from "@/core/trackPlayer";
import useOrientation from "@/hooks/useOrientation";
import delay from "@/utils/delay";
import { musicIsPaused } from "@/utils/trackUtils";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function () {
    const repeatMode = useRepeatMode();
    const musicState = useMusicState();

    const orientation = useOrientation();

    return (
        <>
            <View
                style={[
                    style.wrapper,
                    orientation === "horizontal" ? style.horizontalWrapper : null,
                ]}>
                <Icon
                    color={"white"}
                    name={repeatModeConst[repeatMode].icon}
                    size={rpx(56)}
                    onPress={async () => {
                        InteractionManager.runAfterInteractions(async () => {
                            await delay(20, false);
                            TrackPlayer.toggleRepeatMode();
                        });
                    }}
                />
                <Icon
                    color={"white"}
                    name={"skip-left"}
                    size={rpx(56)}
                    onPress={() => {
                        TrackPlayer.skipToPrevious();
                    }}
                />
                <AnimatedPlayButton
                    paused={musicIsPaused(musicState)}
                    onPress={() => {
                        if (musicIsPaused(musicState)) {
                            TrackPlayer.play();
                        } else {
                            TrackPlayer.pause();
                        }
                    }}
                />
                <Icon
                    color={"white"}
                    name={"skip-right"}
                    size={rpx(56)}
                    onPress={() => {
                        TrackPlayer.skipToNext();
                    }}
                />
                <Icon
                    color={"white"}
                    name={"playlist"}
                    size={rpx(56)}
                    onPress={() => {
                        showPanel("PlayList");
                    }}
                />
            </View>
        </>
    );
}

function AnimatedPlayButton(props: { paused: boolean; onPress: () => void }) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            accessibilityRole="button"
            style={[style.playButton, animatedStyle]}
            onPressIn={() => {
                scale.value = withSpring(0.90, { damping: 18, stiffness: 260 });
            }}
            onPressOut={() => {
                scale.value = withSpring(1, { damping: 16, stiffness: 220 });
            }}
            onPress={props.onPress}>
            <Icon
                color="#201C19"
                name={props.paused ? "play" : "pause"}
                size={rpx(66)}
            />
        </AnimatedPressable>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        marginTop: rpx(36),
        height: rpx(100),
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
    horizontalWrapper: {
        marginTop: 0,
    },
    playButton: {
        width: rpx(104),
        height: rpx(104),
        borderRadius: rpx(52),
        backgroundColor: "rgba(255,255,255,0.94)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: rpx(18),
        shadowOffset: { width: 0, height: rpx(8) },
        elevation: 8,
    },
});
