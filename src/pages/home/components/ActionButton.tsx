import ThemeText from "@/components/base/themeText";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";

interface IActionButtonProps {
    iconName: IIconName;
    iconColor?: string;
    title: string;
    action?: () => void;
    style?: StyleProp<ViewStyle>;
    delay?: number;
}

export default function ActionButton(props: IActionButtonProps) {
    const { iconName, iconColor, title, action, style, delay = 0 } = props;
    const colors = useColors();
    const accent = iconColor ?? colors.primary;

    return (
        <Animated.View entering={FadeInDown.delay(delay).duration(320)} style={style}>
            <TouchableOpacity
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={title}
                onPress={action}
                style={[
                    styles.wrapper,
                    {
                        backgroundColor: colors.card,
                        borderColor: Color(colors.text).alpha(0.05).toString(),
                    },
                ]}>
                <View
                    accessible={false}
                    style={[
                        styles.iconWell,
                        { backgroundColor: Color(accent).alpha(0.13).toString() },
                    ]}>
                    <Icon
                        accessible={false}
                        name={iconName}
                        color={accent}
                        size={rpx(52)}
                    />
                </View>
                <ThemeText
                    accessible={false}
                    fontSize="subTitle"
                    fontWeight="semibold"
                    numberOfLines={1}
                    style={styles.text}>
                    {title}
                </ThemeText>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: "100%",
        borderRadius: rpx(26),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
    iconWell: {
        width: rpx(90),
        height: rpx(90),
        borderRadius: rpx(29),
        alignItems: "center",
        justifyContent: "center",
    },
    text: {
        marginTop: rpx(14),
    },
});
