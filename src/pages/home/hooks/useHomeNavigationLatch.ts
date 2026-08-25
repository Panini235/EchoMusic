import { useNavigate } from "@/core/router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";

export type HomeNavigate = ReturnType<typeof useNavigate>;
export type HomeNavigationHandler = (
    ...args: Parameters<HomeNavigate>
) => unknown;
export type GuardedHomeNavigate = (
    ...args: Parameters<HomeNavigate>
) => boolean;

/**
 * Allows one affected home navigation for each focus -> blur -> focus cycle.
 * The lock is acquired synchronously before dispatch and is never time based.
 */
export default function useHomeNavigationLatch(): GuardedHomeNavigate {
    const navigate = useNavigate();
    const isFocused = useIsFocused();
    const lockedRef = useRef(false);
    const blurredAfterLockRef = useRef(false);

    useEffect(() => {
        if (!isFocused) {
            if (lockedRef.current) {
                blurredAfterLockRef.current = true;
            }
            return;
        }

        if (blurredAfterLockRef.current) {
            lockedRef.current = false;
            blurredAfterLockRef.current = false;
        }
    }, [isFocused]);

    return useCallback(
        (...args: Parameters<HomeNavigate>) => {
            if (!isFocused || lockedRef.current) {
                return false;
            }

            lockedRef.current = true;
            navigate(...args);
            return true;
        },
        [isFocused, navigate],
    );
}
