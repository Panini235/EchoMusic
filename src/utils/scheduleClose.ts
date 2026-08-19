import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import TrackPlayer from "@/core/trackPlayer";
import NativeUtils from "@/native/utils";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import BackgroundTimer from "react-native-background-timer";

const deadlineAtom = atom<number | null>(null);
const closeAfterPlayEndAtom = atom(false);

let scheduleToken = 0;
let timerId: any = null;
let afterCurrentListener: (() => void) | null = null;

function clearScheduledWork() {
    if (timerId) {
        BackgroundTimer.clearTimeout(timerId);
        timerId = null;
    }
    if (afterCurrentListener) {
        TrackPlayer.off(TrackPlayerEvents.PlayEnd, afterCurrentListener);
        afterCurrentListener = null;
    }
}

async function exitApp() {
    await TrackPlayer.reset();
    NativeUtils.exitApp();
}

function consumeSchedule(token: number, deadline: number): boolean {
    if (
        token !== scheduleToken ||
        getDefaultStore().get(deadlineAtom) !== deadline ||
        Date.now() < deadline
    ) {
        return false;
    }
    ++scheduleToken;
    clearScheduledWork();
    getDefaultStore().set(deadlineAtom, null);
    return true;
}

function armSchedule(token: number, deadline: number) {
    timerId = BackgroundTimer.setTimeout(() => {
        if (
            token !== scheduleToken ||
            getDefaultStore().get(deadlineAtom) !== deadline
        ) {
            return;
        }
        const remaining = deadline - Date.now();
        if (remaining > 0) {
            armSchedule(token, deadline);
            return;
        }
        if (getDefaultStore().get(closeAfterPlayEndAtom)) {
            if (afterCurrentListener) {
                return;
            }
            afterCurrentListener = () => {
                if (consumeSchedule(token, deadline)) {
                    void exitApp();
                }
            };
            TrackPlayer.on(TrackPlayerEvents.PlayEnd, afterCurrentListener);
            return;
        }
        if (consumeSchedule(token, deadline)) {
            void exitApp();
        }
    }, Math.max(0, deadline - Date.now()));
}

function setScheduleClose(deadline: number | null) {
    const token = ++scheduleToken;
    clearScheduledWork();
    getDefaultStore().set(deadlineAtom, deadline);
    if (deadline !== null) {
        armSchedule(token, deadline);
    }
}

function setCloseAfterPlayEnd(closeAfterPlayEnd: boolean) {
    getDefaultStore().set(closeAfterPlayEndAtom, closeAfterPlayEnd);
    const deadline = getDefaultStore().get(deadlineAtom);
    setScheduleClose(deadline);
}

function useScheduleCloseCountDown() {
    const deadline = useAtomValue(deadlineAtom);
    const [countDown, setCountDown] = useState(
        deadline ? deadline - Date.now() : null,
    );
    const intervalRef = useRef<any>();

    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        intervalRef.current = null;
        if (!deadline || deadline <= Date.now()) {
            setCountDown(null);
            return;
        }
        setCountDown(Math.max(deadline - Date.now(), 0) / 1000);
        intervalRef.current = setInterval(() => {
            setCountDown(Math.max(deadline - Date.now(), 0) / 1000);
        }, 1000);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            intervalRef.current = null;
        };
    }, [deadline]);

    return countDown;
}

const useCloseAfterPlayEnd = () => useAtomValue(closeAfterPlayEndAtom);

export {
    setScheduleClose,
    useScheduleCloseCountDown,
    setCloseAfterPlayEnd,
    useCloseAfterPlayEnd,
};
