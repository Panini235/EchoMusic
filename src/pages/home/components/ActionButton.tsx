import ThemeText from "@/components/base/themeText";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";

interface IActionButtonProps {
    iconName: IIconName;
    iconColor?: string;
    title: string;
    action?: () => void;
    style?: StyleProp<ViewStyle>;
}

export default function ActionButton(props: IActionButtonProps) {
    const { iconName, iconColor, title, action, style } = props;
    const colors = useColors();
    const accent = iconColor ?? colors.primary;

    return (
        <TouchableOpacity
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={action}
            style={[
                styles.wrapper,
                style,
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
                    size={rpx(42)}
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
    );
}

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: rpx(26),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
    iconWell: {
        width: rpx(74),
        height: rpx(74),
        borderRadius: rpx(24),
        alignItems: "center",
        justifyContent: "center",
    },
    text: {
        marginTop: rpx(14),
    },
});
