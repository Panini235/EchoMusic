import * as SplashScreen from "expo-splash-screen";
import { atom, getDefaultStore } from "jotai";

export const MAX_VISUAL_LAUNCH_DURATION = 1200;

export type LaunchHandoffPhase = "SYSTEM" | "APP_SURFACE" | "HOME";

const writableLaunchHandoffAtom = atom<LaunchHandoffPhase>("SYSTEM");

// Consumers can observe the phase, but only this module can move it forward.
export const launchHandoffAtom = atom(get => get(writableLaunchHandoffAtom));

const store = getDefaultStore();

let appSurfaceReady = false;
let appSurfaceHandoffAllowed = false;
let homeRequested = false;
let visualDeadlineTimer: ReturnType<typeof setTimeout> | undefined;
let nativeSplashHidePromise: Promise<void> | undefined;

function advanceTo(nextPhase: LaunchHandoffPhase) {
    const currentPhase = store.get(writableLaunchHandoffAtom);
    const isNextPhase =
        (currentPhase === "SYSTEM" && nextPhase === "APP_SURFACE") ||
        (currentPhase === "APP_SURFACE" && nextPhase === "HOME");

    if (isNextPhase) {
        store.set(writableLaunchHandoffAtom, nextPhase);
    }
}

function hideNativeSplashOnce() {
    if (!nativeSplashHidePromise) {
        nativeSplashHidePromise = SplashScreen.hideAsync().catch(error => {
            // A failed/already-hidden native surface must not reverse or duplicate the handoff.
            console.warn("Unable to hide the native splash surface", error);
        });
    }
    return nativeSplashHidePromise;
}

function clearVisualDeadline() {
    if (visualDeadlineTimer) {
        clearTimeout(visualDeadlineTimer);
        visualDeadlineTimer = undefined;
    }
}

function finishHomeAfterNativeHandoff() {
    void hideNativeSplashOnce().then(() => {
        if (
            homeRequested &&
            store.get(writableLaunchHandoffAtom) === "APP_SURFACE"
        ) {
            advanceTo("HOME");
            clearVisualDeadline();
        }
    });
}

function enterAppSurface(forceFallback = false) {
    if (store.get(writableLaunchHandoffAtom) !== "SYSTEM") {
        return;
    }
    if (
        !forceFallback &&
        (!appSurfaceReady || !appSurfaceHandoffAllowed)
    ) {
        return;
    }

    advanceTo("APP_SURFACE");
    if (homeRequested) {
        finishHomeAfterNativeHandoff();
    } else {
        void hideNativeSplashOnce();
    }
}

/** Starts the one-shot visual deadline without changing an already advanced phase. */
export function startLaunchHandoff() {
    if (
        visualDeadlineTimer ||
        store.get(writableLaunchHandoffAtom) === "HOME"
    ) {
        return;
    }

    visualDeadlineTimer = setTimeout(() => {
        visualDeadlineTimer = undefined;
        homeRequested = true;

        // If Image.onLoad never arrives, continue forward rather than blocking input forever.
        enterAppSurface(true);
        if (store.get(writableLaunchHandoffAtom) === "APP_SURFACE") {
            finishHomeAfterNativeHandoff();
        }
    }, MAX_VISUAL_LAUNCH_DURATION);
}

/** Called once the single contained brand image has decoded on the app surface. */
export function notifyAppSurfaceReady() {
    startLaunchHandoff();
    if (appSurfaceReady) {
        return;
    }

    appSurfaceReady = true;
    enterAppSurface();
}

/** Allows native hide only after bootstrap has prepared the existing theme and text. */
export function allowAppSurfaceHandoff() {
    startLaunchHandoff();
    appSurfaceHandoffAllowed = true;
    enterAppSurface();
}

/** Requests the terminal phase; it can never recreate an exited app surface. */
export function requestHomeHandoff() {
    startLaunchHandoff();
    homeRequested = true;

    const currentPhase = store.get(writableLaunchHandoffAtom);
    if (currentPhase === "SYSTEM") {
        enterAppSurface();
    } else if (currentPhase === "APP_SURFACE") {
        finishHomeAfterNativeHandoff();
    }
}
