import React from "react";
import { StyleSheet } from "react-native";

import NavBar from "./components/navBar";
import MusicBar from "@/components/musicBar";
import { createDrawerNavigator } from "@react-navigation/drawer";
import HomeDrawer from "./components/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBar from "@/components/base/statusBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import Theme from "@/core/theme";
import HomeBody from "./components/homeBody";
import HomeBodyHorizontal from "./components/homeBodyHorizontal";
import useOrientation from "@/hooks/useOrientation";
import { useTheme } from "@react-navigation/native";
import Color from "color";
import rpx from "@/utils/rpx";

function Home() {
    const orientation = useOrientation();

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.appWrapper}>
            <HomeStatusBar />
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                <>
                    <NavBar />
                    {orientation === "vertical" ? (
                        <HomeBody />
                    ) : (
                        <HomeBodyHorizontal />
                    )}
                </>
            </HorizontalSafeAreaView>
            <MusicBar />
        </SafeAreaView>
    );
}

function HomeStatusBar() {
    const theme = Theme.useTheme();

    return (
        <StatusBar
            backgroundColor="transparent"
            barStyle={theme.dark ? undefined : "dark-content"}
        />
    );
}

// function Body() {
//     const orientation = useOrientation();
//     return (
//         <ScrollView
//             style={[
//                 styles.appWrapper,
//                 orientation === 'horizontal' ? styles.flexRow : null,
//             ]}>
//             <Operations orientation={orientation} />
//         </ScrollView>
//     );
// }

const LeftDrawer = createDrawerNavigator();
export default function App() {
    const { colors } = useTheme();

    return (
        <LeftDrawer.Navigator
            screenOptions={{
                headerShown: false,
                drawerType: "front",
                swipeEdgeWidth: rpx(48),
                overlayColor: Color(colors.text).alpha(0.34).toString(),
                drawerStyle: {
                    width: "86%",
                    backgroundColor: "transparent",
                    borderTopRightRadius: rpx(34),
                    borderBottomRightRadius: rpx(34),
                    overflow: "hidden",
                },
            }}
            initialRouteName="HOME-MAIN"
            drawerContent={props => <HomeDrawer {...props} />}>
            <LeftDrawer.Screen name="HOME-MAIN" component={Home} />
        </LeftDrawer.Navigator>
    );
}

const styles = StyleSheet.create({
    appWrapper: {
        flexDirection: "column",
        flex: 1,
    },
    flexRow: {
        flexDirection: "row",
    },
});
