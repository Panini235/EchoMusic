import React, { ReactNode } from "react";
import {
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import rpx from "@/utils/rpx";

interface IPlayerActionButtonProps {
    accessibilityLabel: string;
    children: ReactNode;
    disabled?: boolean;
    onPress: () => void | Promise<void>;
    style?: StyleProp<ViewStyle>;
}

/**
 * A single, predictable touch target for every action on the player screen.
 * SVG elements are presentation-only so they cannot capture touches themselves.
 */
export default function PlayerActionButton(props: IPlayerActionButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel}
            accessibilityState={{ disabled: props.disabled }}
            disabled={props.disabled}
            hitSlop={8}
            pressRetentionOffset={12}
            onPress={props.onPress}
            style={({ pressed }) => [
                styles.button,
                props.style,
                props.disabled ? styles.disabled : null,
                pressed ? styles.pressed : null,
            ]}>
            <View pointerEvents="none" style={styles.content}>
                {props.children}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(22),
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        alignItems: "center",
        justifyContent: "center",
    },
    disabled: {
        opacity: 0.32,
    },
    pressed: {
        opacity: 0.56,
        backgroundColor: "rgba(255,255,255,0.10)",
        transform: [{ scale: 0.92 }],
    },
});
