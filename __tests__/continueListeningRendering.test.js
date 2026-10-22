import React from "react";
import { act, create } from "react-test-renderer";
import { AppState } from "react-native";
import { atom, getDefaultStore } from "jotai";
import FastImage from "@/components/base/fastImage";
import ContinueListening from "@/pages/home/components/homeBody/continueListening";

const mockProgressAtom = atom({ position: 10, duration: 100, buffered: 20 });
const mockFocusedAtom = atom(true);
const mockSong = { id: "song", title: "Song", artist: "Artist", artwork: "cover", platform: "Fixture" };
let mockCurrentSong = mockSong;
let mockProgressMounts = 0;

jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: {
        isCurrentMusic: item => item === mockCurrentSong,
        play: jest.fn(),
        pause: jest.fn(),
    },
    useCurrentMusic: () => mockCurrentSong,
    useMusicState: () => "playing",
    useProgress: () => {
        require("react").useEffect(() => {
            mockProgressMounts += 1;
            return () => { mockProgressMounts -= 1; };
        }, []);
        return require("jotai").useAtomValue(mockProgressAtom);
    },
}));
jest.mock("@/core/musicHistory", () => ({ useMusicHistory: () => [mockSong] }));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: state => state !== "playing" }));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: { SEARCH_PAGE: "search", MUSIC_DETAIL: "player" },
    useNavigate: () => jest.fn(),
}));
jest.mock("@react-navigation/native", () => ({
    useIsFocused: () => require("jotai").useAtomValue(mockFocusedAtom),
}));
jest.mock("@/components/base/fastImage", () => ({
    __esModule: true,
    default: jest.fn(props => require("react").createElement("CoverImage", props)),
}));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("react-native-linear-gradient", () => "Gradient");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { logo: 1, albumDefault: 2 } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: key => key }) }));
jest.mock("@/hooks/useColors", () => () => ({ card: "#121212", text: "#ffffff", shadow: "#000000" }));
jest.mock("react-native-reanimated", () => {
    const builder = { delay() { return this; }, duration() { return this; } };
    return {
        __esModule: true,
        default: { View: require("react-native").View },
        FadeInDown: builder,
    };
});

const store = getDefaultStore();
let renderer;
let appStateHandlers;
const originalAppState = AppState.currentState;

beforeEach(() => {
    mockCurrentSong = mockSong;
    mockProgressMounts = 0;
    store.set(mockFocusedAtom, true);
    store.set(mockProgressAtom, { position: 10, duration: 100, buffered: 20 });
    AppState.currentState = "active";
    appStateHandlers = new Set();
    jest.spyOn(AppState, "addEventListener").mockImplementation((event, handler) => {
        if (event === "change") { appStateHandlers.add(handler); }
        return { remove: () => appStateHandlers.delete(handler) };
    });
});

afterEach(() => {
    act(() => renderer?.unmount());
    AppState.currentState = originalAppState;
    jest.restoreAllMocks();
    jest.clearAllMocks();
});

function mountCard() {
    act(() => { renderer = create(<ContinueListening />); });
}

test("ten playback progress ticks do not rerender the album artwork", () => {
    mountCard();
    const initial = FastImage.mock.calls.length;
    for (let position = 11; position <= 20; position += 1) {
        act(() => store.set(mockProgressAtom, { position, duration: 100, buffered: 20 }));
    }
    expect(FastImage.mock.calls.length - initial).toBe(0);
});

test("a history-only card does not start a native progress poll", () => {
    mockCurrentSong = null;
    mountCard();
    expect(mockProgressMounts).toBe(0);
});

test("a covered home screen stops its progress poll and resumes on focus", () => {
    mountCard();
    expect(mockProgressMounts).toBe(1);
    act(() => store.set(mockFocusedAtom, false));
    expect(mockProgressMounts).toBe(0);
    act(() => store.set(mockFocusedAtom, true));
    expect(mockProgressMounts).toBe(1);
});

test("backgrounding stops the home progress poll and foregrounding restores it", () => {
    mountCard();
    act(() => {
        AppState.currentState = "background";
        appStateHandlers.forEach(handler => handler("background"));
    });
    expect(mockProgressMounts).toBe(0);
    act(() => {
        AppState.currentState = "active";
        appStateHandlers.forEach(handler => handler("active"));
    });
    expect(mockProgressMounts).toBe(1);
});
