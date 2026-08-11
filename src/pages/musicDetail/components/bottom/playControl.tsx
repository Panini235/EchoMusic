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
import PlayerActionButton from "../playerActionButton";

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
                <PlayerActionButton
                    accessibilityLabel="切换播放模式"
                    style={style.controlButton}
                    onPress={async () => {
                        InteractionManager.runAfterInteractions(async () => {
                            await delay(20, false);
                            TrackPlayer.toggleRepeatMode();
                        });
                    }}>
                    <Icon color="white" name={repeatModeConst[repeatMode].icon} size={rpx(48)} />
                </PlayerActionButton>
                <PlayerActionButton
                    accessibilityLabel="上一首"
                    style={style.controlButton}
                    onPress={() => {
                        TrackPlayer.skipToPrevious();
                    }}>
                    <Icon color="white" name="skip-left" size={rpx(48)} />
                </PlayerActionButton>
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
                <PlayerActionButton
                    accessibilityLabel="下一首"
                    style={style.controlButton}
                    onPress={() => {
                        TrackPlayer.skipToNext();
                    }}>
                    <Icon color="white" name="skip-right" size={rpx(48)} />
                </PlayerActionButton>
                <PlayerActionButton
                    accessibilityLabel="播放队列"
                    style={style.controlButton}
                    onPress={() => {
                        showPanel("PlayList");
                    }}>
                    <Icon color="white" name="playlist" size={rpx(48)} />
                </PlayerActionButton>
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
                pointerEvents="none"
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
    controlButton: {
        width: rpx(72),
        height: rpx(72),
        borderRadius: rpx(24),
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
