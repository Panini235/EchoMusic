import React from "react";
import globalStyle from "@/constants/globalStyle";
import Operations from "./operations";
import Sheets from "./sheets";
import { ScrollView } from "react-native-gesture-handler";
import SourceSpotlight from "./sourceSpotlight";
import { StyleSheet } from "react-native";

export default function HomeBody() {
    return (
        <ScrollView
            style={globalStyle.fwflex1}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <SourceSpotlight />
            <Operations />
            <Sheets />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 24,
    },
});
