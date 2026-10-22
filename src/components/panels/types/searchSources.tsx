import Checkbox from "@/components/base/checkbox";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import PluginManager from "@/core/pluginManager";
import { useI18N } from "@/core/i18n";
import { selectedSearchPluginHashesAtom } from "@/pages/searchPage/store/atoms";
import Toast from "@/utils/toast";
import rpx, { vh } from "@/utils/rpx";
import { useAtom } from "jotai";
import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PanelBase from "../base/panelBase";
import PanelHeader from "../base/panelHeader";
import { hidePanel } from "../usePanel";

export default function SearchSources() {
    const { t } = useI18N();
    const safeAreaInsets = useSafeAreaInsets();
    const plugins = useMemo(
        () => PluginManager.getSortedSearchablePlugins(),
        [],
    );
    const [selectedHashes, setSelectedHashes] = useAtom(
        selectedSearchPluginHashesAtom,
    );
    const [draftHashes, setDraftHashes] = useState<string[]>(() =>
        selectedHashes === null
            ? plugins.map(plugin => plugin.hash)
            : selectedHashes.filter(hash =>
                plugins.some(plugin => plugin.hash === hash),
            ),
    );

    const allSelected =
        plugins.length > 0 && draftHashes.length === plugins.length;

    const toggleHash = (hash: string) => {
        setDraftHashes(current =>
            current.includes(hash)
                ? current.filter(item => item !== hash)
                : [...current, hash],
        );
    };

    const confirm = () => {
        if (draftHashes.length === 0) {
            Toast.warn(t("searchPage.selectAtLeastOneSource"));
            return;
        }
        setSelectedHashes(allSelected ? null : draftHashes);
        hidePanel();
    };

    return (
        <PanelBase
            height={vh(68)}
            renderBody={() => (
                <View style={styles.fill}>
                    <PanelHeader
                        title={t("searchPage.selectSources")}
                        onCancel={hidePanel}
                        onOk={confirm}
                    />
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={() => {
                            setDraftHashes(
                                allSelected
                                    ? []
                                    : plugins.map(plugin => plugin.hash),
                            );
                        }}>
                        <ListItem.Content
                            title={t("searchPage.allSources")}
                            description={t(
                                "searchPage.allSourcesDescription",
                            )}
                        />
                        <Checkbox checked={allSelected} />
                    </ListItem>
                    <FlatList
                        data={plugins}
                        keyExtractor={item => item.hash}
                        contentContainerStyle={{
                            paddingBottom: safeAreaInsets.bottom,
                        }}
                        renderItem={({ item }) => (
                            <ListItem
                                withHorizontalPadding
                                heightType="small"
                                onPress={() => toggleHash(item.hash)}>
                                <ListItem.Content
                                    title={item.name}
                                    description={t(
                                        "searchPage.sourceDescription",
                                        {
                                            name:
                                                item.instance.platform ||
                                                item.name,
                                        },
                                    )}
                                />
                                <Checkbox
                                    checked={draftHashes.includes(item.hash)}
                                />
                            </ListItem>
                        )}
                        ListEmptyComponent={
                            <ThemeText
                                style={styles.empty}
                                fontColor="textSecondary">
                                {t("panel.switchSource.noSource")}
                            </ThemeText>
                        }
                    />
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    fill: {
        flex: 1,
    },
    empty: {
        padding: rpx(24),
        textAlign: "center",
    },
});
