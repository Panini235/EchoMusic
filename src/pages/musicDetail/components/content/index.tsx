import React, { useState } from "react";
import { View } from "react-native";
import AlbumCover from "./albumCover";
import Lyric from "./lyric";
import useOrientation from "@/hooks/useOrientation";
import Config from "@/core/appConfig";
import globalStyle from "@/constants/globalStyle";
import Animated, { FadeIn } from "react-native-reanimated";

export default function Content() {
    const [tab, selectTab] = useState<"album" | "lyric">(
        Config.getConfig("basic.musicDetailDefault") || "album",
    );
    const orientation = useOrientation();
    const showAlbumCover = tab === "album" || orientation === "horizontal";

    const onTurnPageClick = () => {
        if (orientation === "horizontal") {
            return;
        }
        if (tab === "album") {
            selectTab("lyric");
        } else {
            selectTab("album");
        }
    };

    return (
        <View style={globalStyle.fwflex1}>
            {showAlbumCover ? (
                <Animated.View
                    key="album"
                    entering={FadeIn.duration(300)}
                    style={globalStyle.fwflex1}>
                    <AlbumCover onTurnPageClick={onTurnPageClick} />
                </Animated.View>
            ) : (
                <Animated.View
                    key="lyric"
                    entering={FadeIn.duration(300)}
                    style={globalStyle.fwflex1}>
                    <Lyric onTurnPageClick={onTurnPageClick} />
                </Animated.View>
            )}
        </View>
    );
}
