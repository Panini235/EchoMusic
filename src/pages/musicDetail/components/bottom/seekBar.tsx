import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import Slider from "@react-native-community/slider";
import timeformat from "@/utils/timeformat";
import { fontSizeConst } from "@/constants/uiConst";
import TrackPlayer, { useProgress } from "@/core/trackPlayer";

interface ITimeLabelProps {
    time: number;
}

function TimeLabel(props: ITimeLabelProps) {
    return (
        <Text style={style.text}>{timeformat(Math.max(props.time, 0))}</Text>
    );
}

export default function SeekBar() {
    const progress = useProgress(1000);
    const [tmpProgress, setTmpProgress] = useState<number | null>(null);
    const slidingRef = useRef(false);
    const duration = Number.isFinite(progress.duration)
        ? Math.max(0, progress.duration)
        : 0;
    const position = Number.isFinite(progress.position)
        ? Math.max(0, Math.min(duration, progress.position))
        : 0;

    return (
        <View style={style.wrapper}>
            <TimeLabel time={tmpProgress ?? position} />
            <Slider
                style={style.slider}
                minimumTrackTintColor={"#FFFFFF"}
                maximumTrackTintColor={"rgba(255,255,255,0.24)"}
                thumbTintColor={"#FFFFFF"}
                minimumValue={0}
                maximumValue={duration}
                disabled={duration <= 0}
                onSlidingStart={() => {
                    slidingRef.current = true;
                }}
                onValueChange={val => {
                    if (slidingRef.current && Number.isFinite(val)) {
                        setTmpProgress(Math.max(0, Math.min(duration, val)));
                    }
                }}
                onSlidingComplete={val => {
                    slidingRef.current = false;
                    setTmpProgress(null);
                    if (duration <= 0 || !Number.isFinite(val)) {
                        return;
                    }
                    TrackPlayer.seekTo(Math.max(0, Math.min(duration, val)));
                }}
                value={tmpProgress ?? position}
            />
            <TimeLabel time={duration} />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(40),
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
    },
    slider: {
        width: "73%",
        height: rpx(40),
    },
    text: {
        fontSize: fontSizeConst.description,
        includeFontPadding: false,
        color: "#cccccc",
    },
});
