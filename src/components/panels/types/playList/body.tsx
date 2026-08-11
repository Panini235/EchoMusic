import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import Tag from "@/components/base/tag";
import ThemeText from "@/components/base/themeText";
import { fontSizeConst } from "@/constants/uiConst";
import { getMediaUniqueKey, isSameMediaItem } from "@/utils/mediaUtils";
import Loading from "@/components/base/loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useColors from "@/hooks/useColors";
import TrackPlayer, { useCurrentMusic, usePlayList } from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import SortableFlatList from "@/components/base/SortableFlatList";
import useOrientation from "@/hooks/useOrientation";
import { vh } from "@/utils/rpx";

const ITEM_HEIGHT = rpx(108);
const ITEM_WIDTH = rpx(750);

interface IPlayListProps {
    item: IMusic.IMusicItem;
    isCurrentMusic: boolean;
}

function _PlayListItem(props: IPlayListProps) {
    const colors = useColors();
    const { item, isCurrentMusic } = props;

    return (
        <Pressable
            onPress={() => {
                TrackPlayer.play(item);
            }}
            style={style.musicItem}>
            {isCurrentMusic && (
                <Icon
                    name="musical-note"
                    color={colors.textHighlight ?? colors.primary}
                    size={fontSizeConst.content}
                    style={style.currentPlaying}
                />
            )}
            <ThemeText
                style={[
                    style.musicItemTitle,
                    {
                        color: isCurrentMusic
                            ? colors.textHighlight ?? colors.primary
                            : colors.text,
                    },
                ]}
                ellipsizeMode="tail"
                numberOfLines={1}>
                {item.title}
                {item.artist && (
                    <Text style={{ fontSize: fontSizeConst.description }}>
                        {" "}
                        - {item.artist}
                    </Text>
                )}
            </ThemeText>
            <Tag tagName={item.platform} />
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="从播放队列移除"
                hitSlop={6}
                style={({ pressed }) => [
                    style.removeButton,
                    pressed ? style.removeButtonPressed : null,
                ]}
                onPress={event => {
                    event.stopPropagation();
                    TrackPlayer.remove(item);
                }}>
                <Icon
                    pointerEvents="none"
                    name="x-mark"
                    size={rpx(36)}
                    color={colors.textSecondary}
                />
            </Pressable>
        </Pressable>
    );
}

const PlayListItem = React.memo(
    _PlayListItem,
    (prev, next) =>
        !!isSameMediaItem(prev.item, next.item) &&
        prev.isCurrentMusic === next.isCurrentMusic,
);

interface IBodyProps {
    loading?: boolean;
}
export default function Body(props: IBodyProps) {
    const { loading } = props;
    const playList = usePlayList();
    const currentMusicItem = useCurrentMusic();
    const safeAreaInsets = useSafeAreaInsets();
    const colors = useColors();
    const orientation = useOrientation();

    const initIndex = useMemo(() => {
        const id = playList.findIndex(_ =>
            isSameMediaItem(currentMusicItem, _),
        );

        if (id !== -1) {
            return id;
        }
        return undefined;
    }, [currentMusicItem, playList]);

    const renderItem = ({ item }: { item: IMusic.IMusicItem; index: number }) => {
        return (
            <PlayListItem
                item={item}
                isCurrentMusic={!!isSameMediaItem(item, currentMusicItem)}
            />
        );
    };

    const marginTop = useMemo(
        () =>
            orientation === "horizontal"
                ? safeAreaInsets.top + rpx(110)
                : vh(20) + rpx(110),
        [orientation, safeAreaInsets.top],
    );

    return loading ? (
        <Loading />
    ) : (
        <View
            style={[
                style.playList,
                {
                    paddingBottom: safeAreaInsets.bottom,
                },
            ]}>
            <SortableFlatList
                activeBackgroundColor={colors.placeholder}
                extraData={{ currentMusicItem }}
                data={playList}
                itemHeight={ITEM_HEIGHT}
                initialScrollIndex={initIndex}
                keyExtractor={item => getMediaUniqueKey(item)}
                marginTop={marginTop}
                renderItem={renderItem}
                onSortEnd={newPlayList => {
                    TrackPlayer.reorderPlayList(newPlayList);
                }}
            />
        </View>
    );
}

const style = StyleSheet.create({
    playList: {
        width: rpx(750),
        flex: 1,
    },
    currentPlaying: {
        marginRight: rpx(6),
    },
    musicItem: {
        width: ITEM_WIDTH,
        height: ITEM_HEIGHT,
        paddingLeft: rpx(24),
        paddingRight: rpx(106),
        flexDirection: "row",
        alignItems: "center",
    },
    musicItemTitle: {
        flex: 1,
    },
    removeButton: {
        width: rpx(58),
        height: rpx(58),
        marginLeft: rpx(8),
        borderRadius: rpx(20),
        alignItems: "center",
        justifyContent: "center",
    },
    removeButtonPressed: {
        opacity: 0.56,
        backgroundColor: "rgba(127,127,127,0.12)",
    },
});
