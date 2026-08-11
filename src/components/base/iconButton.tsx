import React from "react";
import { ColorKey, colorMap, iconSizeConst } from "@/constants/uiConst";
import { TapGestureHandler } from "react-native-gesture-handler";
import {
    Insets,
    LayoutChangeEvent,
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import useColors from "@/hooks/useColors";
import { SvgProps } from "react-native-svg";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import rpx from "@/utils/rpx";

interface IIconButtonProps extends Omit<SvgProps, "style" | "onPress" | "onLayout"> {
    name: IIconName;
    style?: StyleProp<ViewStyle>;
    sizeType?: keyof typeof iconSizeConst;
    fontColor?: ColorKey;
    color?: string;
    onPress?: () => void;
    onLayout?: (event: LayoutChangeEvent) => void;
    accessibilityLabel?: string;
    hitSlop?: Insets | number;
}

export function IconButtonWithGesture(props: IIconButtonProps) {
    const {
        name,
        sizeType: size = "normal",
        fontColor = "normal",
        onPress,
        style,
        accessibilityLabel,
        color: explicitColor,
        ...iconProps
    } = props;
    const colors = useColors();
    const iconSize = iconSizeConst[size];
    const color = explicitColor ?? colors[colorMap[fontColor]];

    return (
        <TapGestureHandler onActivated={onPress}>
            <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                style={[styles.button, style]}>
                <Icon
                    {...iconProps}
                    pointerEvents="none"
                    accessible={false}
                    name={name}
                    color={color}
                    size={iconSize}
                />
            </View>
        </TapGestureHandler>
    );
}

/**
 * 统一的图标按钮触控层。图标本身不再承担点击，避免 SVG 只有可见路径响应。
 */
export default function IconButton(props: IIconButtonProps) {
    const {
        name,
        sizeType = "normal",
        fontColor = "normal",
        style,
        color,
        onPress,
        onLayout,
        accessibilityLabel,
        hitSlop = 8,
        ...iconProps
    } = props;
    const colors = useColors();
    const iconSize = iconSizeConst[sizeType];

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            disabled={!onPress}
            hitSlop={hitSlop}
            pressRetentionOffset={12}
            onLayout={onLayout}
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                style,
                pressed ? styles.pressed : null,
            ]}>
            <Icon
                {...iconProps}
                pointerEvents="none"
                accessible={false}
                name={name}
                color={color ?? colors[colorMap[fontColor]]}
                size={iconSize}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        minWidth: rpx(56),
        minHeight: rpx(56),
        borderRadius: rpx(20),
        alignItems: "center",
        justifyContent: "center",
    },
    pressed: {
        opacity: 0.56,
        transform: [{ scale: 0.92 }],
    },
});
