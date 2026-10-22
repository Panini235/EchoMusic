import React from "react";
import { act, create } from "react-test-renderer";
import TrackPlayer, { useProgress } from "@/core/trackPlayer";
import SeekBar from "@/pages/musicDetail/components/bottom/seekBar";

jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: { seekTo: jest.fn() },
    useProgress: jest.fn(),
}));
jest.mock("@react-native-community/slider", () => "Slider");

let renderer;
let progress;
const slider = () => renderer.root.findByType("Slider");

beforeEach(() => {
    progress = { position: 10, duration: 100, buffered: 20 };
    useProgress.mockImplementation(() => progress);
});

afterEach(() => {
    act(() => renderer?.unmount());
    jest.clearAllMocks();
});

test("a short audio clip can seek without passing a negative time to the player", () => {
    progress = { position: 0, duration: 1, buffered: 1 };
    act(() => { renderer = create(<SeekBar />); });
    act(() => { slider().props.onSlidingComplete(0.5); });
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0.5);
});

test("an incoming playback tick cannot pull the thumb away from the user's drag", () => {
    act(() => { renderer = create(<SeekBar />); });
    act(() => {
        slider().props.onSlidingStart();
        slider().props.onValueChange(30);
    });
    progress = { ...progress, position: 11 };
    act(() => { renderer.update(<SeekBar />); });
    expect(slider().props.value).toBe(30);
    act(() => { slider().props.onSlidingComplete(30); });
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(30);
});

test("unknown or invalid duration disables seeking", () => {
    progress = { position: 0, duration: 0, buffered: 0 };
    act(() => { renderer = create(<SeekBar />); });
    expect(slider().props.disabled).toBe(true);
    act(() => { slider().props.onSlidingComplete(0); });
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
});

test("invalid progress cannot produce NaN slider values or seek requests", () => {
    progress = { position: NaN, duration: NaN, buffered: 0 };
    act(() => { renderer = create(<SeekBar />); });
    expect(slider().props.value).toBe(0);
    expect(slider().props.maximumValue).toBe(0);
    act(() => { slider().props.onSlidingComplete(NaN); });
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
});
