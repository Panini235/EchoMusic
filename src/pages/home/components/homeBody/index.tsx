import React from "react";
import globalStyle from "@/constants/globalStyle";
import Operations from "./operations";
import Sheets from "./sheets";
import { ScrollView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import ContinueListening from "./continueListening";
import RecentlyPlayed from "./recentlyPlayed";

export default function HomeBody() {
    return (
        <ScrollView
            style={globalStyle.fwflex1}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <ContinueListening />
            <RecentlyPlayed />
            <Sheets />
            <Operations />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 32,
    },
});
