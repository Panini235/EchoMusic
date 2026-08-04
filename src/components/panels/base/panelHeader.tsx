import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import { TouchableOpacity } from "react-native-gesture-handler";
import ThemeText from "@/components/base/themeText";
import Divider from "@/components/base/divider";
import i18n from "@/core/i18n";
import useColors from "@/hooks/useColors";
import Color from "color";

interface IPanelHeaderProps {
    title: string;
    cancelText?: string;
    okText?: string;
    onCancel?: () => void;
    onOk?: () => void;
    hideButtons?: boolean;
    hideDivider?: boolean;
    style?: StyleProp<ViewStyle>;
}
export default function PanelHeader(props: IPanelHeaderProps) {
    const colors = useColors();
    const {
        title,
        cancelText,
        okText,
        onOk,
        onCancel,
        hideButtons,
        hideDivider,
        style,
    } = props;

    return (
        <>
            <View style={[styles.header, style]}>
                <View
                    style={[
                        styles.handle,
                        { backgroundColor: Color(colors.text).alpha(0.20).toString() },
                    ]}
                />
                {hideButtons ? null : (
                    <TouchableOpacity style={styles.button} onPress={onCancel}>
                        <ThemeText fontWeight="medium">
                            {cancelText || i18n.t("common.cancel")}
                        </ThemeText>
                    </TouchableOpacity>
                )}
                <ThemeText
                    style={styles.title}
                    fontWeight="bold"
                    fontSize="title"
                    numberOfLines={1}>
                    {title}
                </ThemeText>
                {hideButtons ? null : (
                    <TouchableOpacity
                        style={[styles.button, styles.rightButton]}
                        onPress={onOk}>
                        <ThemeText fontWeight="medium" fontColor="primary">
                            {okText || i18n.t("common.confirm")}
                        </ThemeText>
                    </TouchableOpacity>
                )}
            </View>
            {hideDivider ? null : <Divider />}
        </>
    );
}

const styles = StyleSheet.create({
    header: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
        height: rpx(112),
        paddingTop: rpx(12),
    },
    handle: {
        position: "absolute",
        top: rpx(12),
        left: "50%",
        width: rpx(64),
        height: rpx(7),
        marginLeft: rpx(-32),
        borderRadius: rpx(4),
    },
    button: {
        width: rpx(120),
        height: "100%",
        justifyContent: "center",
    },
    rightButton: {
        alignItems: "flex-end",
    },
    title: {
        flex: 1,
        textAlign: "center",
    },
});
