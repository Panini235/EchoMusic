import { useAppConfig } from "@/core/appConfig";
import React from "react";
import Theme from "@/core/theme";
import useCheckUpdate from "@/hooks/useCheckUpdate";
import { useListenOrientationChange } from "@/hooks/useOrientation";
import { getDefaultStore, useAtomValue } from "jotai";
import { useEffect } from "react";
import { AppState, Image, NativeEventSubscription, StyleSheet, useColorScheme, View } from "react-native";
import bootstrapAtom from "./bootstrap.atom";
import { initTrackPlayer } from "./bootstrap";
import { showDialog } from "@/components/dialogs/useDialog";
import i18n from "@/core/i18n";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "@/components/base/themeText";
import Animated, {
    cancelAnimation,
    Easing,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import rpx from "@/utils/rpx";

export function BootstrapComponent() {
    const bootstrapState = useAtomValue(bootstrapAtom);
    const pulse = useSharedValue(0);

    useListenOrientationChange();
    useCheckUpdate();

    const followSystem = useAppConfig("theme.followSystem");

    const colorScheme = useColorScheme();

    useEffect(() => {
        if (followSystem) {
            if (colorScheme === "dark") {
                Theme.setTheme("p-dark");
            } else if (colorScheme === "light") {
                Theme.setTheme("p-light");
            }
        }
    }, [colorScheme, followSystem]);

    useEffect(() => {
        let appStateEventSubscription: NativeEventSubscription | null = null;

        const reinitializeTrackPlayerWithDialog = () => {
            showDialog("LoadingDialog", {
                title: i18n.t("dialog.loading.reinitializeTrackPlayer"),
                promise: initTrackPlayer(),
                onResolve(data, hideDialog) {
                    getDefaultStore().set(bootstrapAtom, {
                        state: "Done",
                    });
                    hideDialog();
                },
                onReject(reason, hideDialog) {
                    hideDialog();
                },
            });
        };

        if (bootstrapState.state === "TrackPlayerError") {
            if (AppState.currentState === "active") {
                reinitializeTrackPlayerWithDialog();
            } else {
                appStateEventSubscription = AppState.addEventListener("change", (nextState) => {
                    if (nextState === "active" && getDefaultStore().get(bootstrapAtom).state === "TrackPlayerError") {
                        reinitializeTrackPlayerWithDialog();
                    }
                });
            }
        }

        return () => {
            if (appStateEventSubscription) {
                appStateEventSubscription.remove();
            }
        };
    }, [bootstrapState]);

    useEffect(() => {
        if (bootstrapState.state === "Loading") {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1, {
                        duration: 760,
                        easing: Easing.inOut(Easing.quad),
                    }),
                    withTiming(0, {
                        duration: 760,
                        easing: Easing.inOut(Easing.quad),
                    }),
                ),
                -1,
                false,
            );
        } else {
            cancelAnimation(pulse);
        }
        return () => cancelAnimation(pulse);
    }, [bootstrapState.state, pulse]);

    const logoStyle = useAnimatedStyle(() => ({
        opacity: 0.78 + pulse.value * 0.22,
        transform: [{ scale: 0.94 + pulse.value * 0.06 }],
    }));

    if (bootstrapState.state !== "Loading") {
        return null;
    }

    return (
        <Animated.View
            exiting={FadeOut.duration(260)}
            pointerEvents="auto"
            style={styles.launchOverlay}>
            <View style={styles.launchContent}>
                <Animated.View style={[styles.logoShadow, logoStyle]}>
                    <Image source={ImgAsset.logo} style={styles.logo} />
                </Animated.View>
                <ThemeText
                    color="rgba(255,255,255,0.72)"
                    fontSize="subTitle"
                    fontWeight="medium"
                    style={styles.launchText}>
                    {i18n.t("startup.preparing")}
                </ThemeText>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    launchOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 20000,
        elevation: 20000,
        backgroundColor: "#070A0F",
        alignItems: "center",
        justifyContent: "center",
    },
    launchContent: {
        alignItems: "center",
        justifyContent: "center",
        transform: [{ translateY: rpx(-18) }],
    },
    logoShadow: {
        width: rpx(174),
        height: rpx(174),
        borderRadius: rpx(50),
        shadowColor: "#F1745E",
        shadowOpacity: 0.30,
        shadowRadius: rpx(34),
        shadowOffset: { width: 0, height: 0 },
        elevation: 14,
    },
    logo: {
        width: "100%",
        height: "100%",
        borderRadius: rpx(50),
    },
    launchText: {
        marginTop: rpx(34),
        letterSpacing: 0.4,
    },
});
