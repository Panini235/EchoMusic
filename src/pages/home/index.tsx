import React from "react";
import { StyleSheet } from "react-native";

import NavBar from "./components/navBar";
import MusicBar from "@/components/musicBar";
import { createDrawerNavigator } from "@react-navigation/drawer";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
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
import BottomDock from "./components/bottomDock";

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
            {orientation === "vertical" ? <BottomDock /> : null}
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

const ControlDrawer = createDrawerNavigator();

function renderHomeDrawer(props: DrawerContentComponentProps) {
    return <HomeDrawer {...props} />;
}

export default function App() {
    const { colors } = useTheme();

    return (
        <ControlDrawer.Navigator
            screenOptions={{
                headerShown: false,
                drawerType: "front",
                drawerPosition: "right",
                swipeEdgeWidth: rpx(48),
                overlayColor: Color(colors.text).alpha(0.34).toString(),
                drawerStyle: {
                    width: "78%",
                    backgroundColor: "transparent",
                    borderTopLeftRadius: rpx(34),
                    borderBottomLeftRadius: rpx(34),
                    overflow: "hidden",
                },
            }}
            initialRouteName="HOME-MAIN"
            drawerContent={renderHomeDrawer}>
            <ControlDrawer.Screen name="HOME-MAIN" component={Home} />
        </ControlDrawer.Navigator>
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
