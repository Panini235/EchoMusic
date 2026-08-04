import React from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import Share from "react-native-share";
import { B64Asset } from "@/constants/assetsConst";
import IconButton from "@/components/base/iconButton";
import { useCurrentMusic } from "@/core/trackPlayer";
import { useI18N } from "@/core/i18n";

export default function NavBar() {
    const navigation = useNavigation();
    const musicItem = useCurrentMusic();
    const { t } = useI18N();
    // const {showShare} = useShare();

    return (
        <View style={styles.container}>
            <IconButton
                name="arrow-left"
                sizeType={"normal"}
                color="white"
                style={styles.button}
                onPress={() => {
                    navigation.goBack();
                }}
            />
            <View style={styles.headerContent}>
                <Text numberOfLines={1} style={styles.eyebrow}>
                    {musicItem?.platform
                        ? `${t("musicDetail.nowPlaying")} · ${musicItem.platform}`
                        : t("musicDetail.nowPlaying")}
                </Text>
                <Text numberOfLines={1} style={styles.headerTitleText}>
                    {musicItem?.title ?? "--"}
                </Text>
            </View>
            <IconButton
                name="share"
                color="white"
                sizeType="normal"
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
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: rpx(124),
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
        height: rpx(124),
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
    headerTitleText: {
        color: "white",
        fontWeight: fontWeightConst.semibold,
        fontSize: fontSizeConst.subTitle,
        marginTop: rpx(7),
        includeFontPadding: false,
    },
});
