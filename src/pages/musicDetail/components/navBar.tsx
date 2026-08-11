import React from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import Share from "react-native-share";
import { B64Asset } from "@/constants/assetsConst";
import { useCurrentMusic } from "@/core/trackPlayer";
import { useI18N } from "@/core/i18n";
import Icon from "@/components/base/icon";
import PlayerActionButton from "./playerActionButton";

export default function NavBar() {
    const navigation = useNavigation();
    const musicItem = useCurrentMusic();
    const { t } = useI18N();
    // const {showShare} = useShare();

    return (
        <View style={styles.container}>
            <PlayerActionButton
                accessibilityLabel="返回"
                style={styles.button}
                onPress={() => {
                    navigation.goBack();
                }}>
                <Icon name="arrow-left" size={rpx(44)} color="white" />
            </PlayerActionButton>
            <View style={styles.headerContent}>
                <Text numberOfLines={1} style={styles.eyebrow}>
                    {musicItem?.platform
                        ? `${t("musicDetail.nowPlaying")} · ${musicItem.platform}`
                        : t("musicDetail.nowPlaying")}
                </Text>
            </View>
            <PlayerActionButton
                accessibilityLabel="分享 EchoMusic"
                style={styles.button}
                onPress={async () => {
                    try {
                        await Share.open({
                            type: "image/jpeg",
                            title: "畅听 · 插件化音乐播放器",
                            message: "畅听 · 安静、自由的插件化音乐播放器",
                            url: B64Asset.share,
                            subject: "畅听分享",
                        });
                    } catch {}
                }}>
                <Icon name="share" size={rpx(44)} color="white" />
            </PlayerActionButton>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: rpx(100),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    button: {
        marginHorizontal: rpx(24),
        width: rpx(72),
        height: rpx(72),
        borderRadius: rpx(36),
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    headerContent: {
        flex: 1,
        height: rpx(100),
        justifyContent: "center",
        alignItems: "center",
    },
    eyebrow: {
        color: "rgba(255,255,255,0.58)",
        fontWeight: fontWeightConst.semibold,
        fontSize: fontSizeConst.description,
        letterSpacing: 1.1,
        includeFontPadding: false,
        textTransform: "uppercase",
    },
});
