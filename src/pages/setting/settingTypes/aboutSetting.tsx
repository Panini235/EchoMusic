import LinkText from "@/components/base/linkText";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import DeviceInfo from "react-native-device-info";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function AboutSetting() {
    const colors = useColors();
    const cardStyle = {
        backgroundColor: Color(colors.card).alpha(0.92).toString(),
        borderColor: Color(colors.text).alpha(0.08).toString(),
    };

    return (
        <ScrollView
            style={styles.wrapper}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(420).springify()}>
                <LinearGradient
                    colors={["#F3BC68", "#F18A58", "#E8645B"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}>
                    <View style={styles.heroGlow} />
                    <Image source={ImgAsset.logo} style={styles.logo} />
                    <View style={styles.heroCopy}>
                        <ThemeText color="#1A1714" fontSize="appbar" fontWeight="bold">
                            EchoMusic · 畅听
                        </ThemeText>
                        <ThemeText color="rgba(26,23,20,0.66)" fontSize="subTitle">
                            自由音源、无广告、为音乐本身留出空间
                        </ThemeText>
                        <ThemeText color="rgba(26,23,20,0.56)" fontSize="description">
                            版本 {DeviceInfo.getVersion()}
                        </ThemeText>
                    </View>
                </LinearGradient>
            </Animated.View>

            <InfoCard delay={70} title="关于畅听" style={cardStyle}>
                <ThemeText style={styles.paragraph}>
                    畅听是一款免费、开源的插件化音乐播放器。应用本身不内置广告，也不内置任何平台内容；搜索、播放、歌词与歌单能力由你选择并信任的插件提供。
                </ThemeText>
                <ThemeText style={styles.paragraph}>
                    你的歌单、配置和播放记录默认保存在设备本地。请只访问你有权使用的内容，并谨慎检查第三方插件来源。
                </ThemeText>
            </InfoCard>

            <InfoCard delay={120} title="开源与致谢" style={cardStyle}>
                <ThemeText style={styles.paragraph}>
                    EchoMusic 基于开源项目{" "}
                    <LinkText linkTo="https://github.com/maotoumao/MusicFree">
                        maotoumao/MusicFree
                    </LinkText>
                    {" "}进行界面与体验重构，继续遵循 AGPL-3.0 协议。感谢原作者及所有贡献者奠定的插件体系与播放器能力。
                </ThemeText>
                <ThemeText style={styles.paragraph}>
                    项目源码：{" "}
                    <LinkText linkTo="https://github.com/Panini235/EchoMusic">
                        Panini235/EchoMusic
                    </LinkText>
                </ThemeText>
                <ThemeText style={styles.paragraph}>
                    插件开发文档：{" "}
                    <LinkText linkTo="https://musicfree.catcat.work/plugin/introduction.html">
                        musicfree.catcat.work
                    </LinkText>
                </ThemeText>
            </InfoCard>

            <InfoCard delay={170} title="使用边界" style={cardStyle}>
                <ThemeText style={styles.paragraph}>
                    插件及其产生的数据由插件提供者和使用者负责。畅听不提供破解、付费内容绕过或任何平台账号服务；请遵守所在地法律法规、服务条款与内容版权。
                </ThemeText>
            </InfoCard>
        </ScrollView>
    );
}

function InfoCard(props: {
    title: string;
    delay: number;
    style: { backgroundColor: string; borderColor: string };
    children: React.ReactNode;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(props.delay).duration(380)}
            style={[styles.card, props.style]}>
            <ThemeText fontSize="title" fontWeight="bold" style={styles.cardTitle}>
                {props.title}
            </ThemeText>
            {props.children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1 },
    content: {
        paddingHorizontal: rpx(24),
        paddingTop: rpx(16),
        paddingBottom: rpx(80),
    },
    hero: {
        minHeight: rpx(240),
        padding: rpx(28),
        borderRadius: rpx(34),
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
    },
    heroGlow: {
        position: "absolute",
        width: rpx(310),
        height: rpx(310),
        right: rpx(-100),
        top: rpx(-130),
        borderRadius: rpx(155),
        backgroundColor: "rgba(255,255,255,0.22)",
    },
    logo: {
        width: rpx(126),
        height: rpx(126),
        borderRadius: rpx(31),
    },
    heroCopy: {
        flex: 1,
        marginLeft: rpx(24),
        gap: rpx(8),
    },
    card: {
        marginTop: rpx(18),
        padding: rpx(26),
        borderRadius: rpx(28),
        borderWidth: StyleSheet.hairlineWidth,
    },
    cardTitle: { marginBottom: rpx(8) },
    paragraph: {
        marginTop: rpx(12),
        lineHeight: rpx(43),
    },
});
