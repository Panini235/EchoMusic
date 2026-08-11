import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { iconSizeConst } from "@/constants/uiConst";
import TranslationIcon from "@/assets/icons/translation.svg";
import { useAppConfig } from "@/core/appConfig";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import { hidePanel, showPanel } from "@/components/panels/usePanel";
import TrackPlayer from "@/core/trackPlayer";
import PersistStatus from "@/utils/persistStatus";
import useOrientation from "@/hooks/useOrientation";
import HeartIcon from "../heartIcon";
import Icon from "@/components/base/icon.tsx";
import lyricManager, { useLyricState } from "@/core/lyricManager";
import PlayerActionButton from "../../playerActionButton";

interface ILyricOperationsProps {
    scrollToCurrentLrcItem: () => void;
}

export default function LyricOperations(props: ILyricOperationsProps) {
    const { scrollToCurrentLrcItem } = props;

    const detailFontSize = useAppConfig("lyric.detailFontSize");

    const { hasTranslation } = useLyricState();
    const showTranslation = PersistStatus.useValue(
        "lyric.showTranslation",
        false,
    );
    const colors = useColors();
    const orientation = useOrientation();

    return (
        <View style={styles.container}>
            {orientation === "vertical" ? <HeartIcon /> : null}
            <PlayerActionButton
                accessibilityLabel="歌词字号"
                onPress={() => {
                    showPanel("SetFontSize", {
                        defaultSelect: detailFontSize ?? 1,
                        onSelectChange(value) {
                            PersistStatus.set("lyric.detailFontSize", value);
                            scrollToCurrentLrcItem();
                        },
                    });
                }}>
                <Icon name="font-size" size={iconSizeConst.normal} color="white" />
            </PlayerActionButton>
            <PlayerActionButton
                accessibilityLabel="调整歌词时间"
                onPress={() => {
                    const currentMusicItem = TrackPlayer.currentMusic;

                    if (currentMusicItem) {
                        showPanel("SetLyricOffset", {
                            musicItem: currentMusicItem,
                            onSubmit(offset) {
                                lyricManager.updateLyricOffset(currentMusicItem, offset);
                                scrollToCurrentLrcItem();
                                hidePanel();
                            },
                        });
                    }
                }}>
                <Icon name="arrows-left-right" size={iconSizeConst.normal} color="white" />
            </PlayerActionButton>

            <PlayerActionButton
                accessibilityLabel="搜索歌词"
                onPress={() => {
                    const currentMusic = TrackPlayer.currentMusic;
                    if (!currentMusic) {
                        return;
                    }
                    // if (
                    //     Config.get('setting.basic.associateLyricType') ===
                    //     'input'
                    // ) {
                    //     showPanel('AssociateLrc', {
                    //         musicItem: currentMusic,
                    //     });
                    // } else {
                    showPanel("SearchLrc", {
                        musicItem: currentMusic,
                    });
                    // }
                }}>
                <Icon name="magnifying-glass" size={iconSizeConst.normal} color="white" />
            </PlayerActionButton>
            <PlayerActionButton
                accessibilityLabel="显示歌词翻译"
                onPress={() => {
                    if (!hasTranslation) {
                        Toast.warn("当前歌曲无翻译");
                        return;
                    }

                    PersistStatus.set(
                        "lyric.showTranslation",
                        !showTranslation,
                    );
                    scrollToCurrentLrcItem();
                }}>
                <TranslationIcon
                    width={iconSizeConst.normal}
                    height={iconSizeConst.normal}
                    opacity={!hasTranslation ? 0.2 : showTranslation ? 1 : 0.5}
                    color={
                        showTranslation && hasTranslation ? colors.primary : "white"
                    }
                />
            </PlayerActionButton>
            <PlayerActionButton
                accessibilityLabel="更多歌词选项"
                onPress={() => {
                    const currentMusic = TrackPlayer.currentMusic;
                    if (currentMusic) {
                        showPanel("MusicItemLyricOptions", {
                            musicItem: currentMusic,
                        });
                    }
                }}>
                <Icon name="ellipsis-vertical" size={iconSizeConst.normal} color="white" />
            </PlayerActionButton>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: rpx(80),
        marginBottom: rpx(24),
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },
});
