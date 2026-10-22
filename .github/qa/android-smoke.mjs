import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { findControl } from "./ui-dump.mjs";

const app = "com.panini.echomusic";
const activity = `${app}/fun.upup.musicfree.MainActivity`;
const apk = process.argv[2];
assert.ok(apk, "Provide the Release APK built by GitHub Actions");
const output = resolve(process.argv[3] ?? "artifacts/android-smoke");
const waitTimeout = Number(process.env.ECHOMUSIC_SMOKE_WAIT_MS ?? 35_000);
assert.ok(Number.isFinite(waitTimeout) && waitTimeout > 0, "Smoke wait timeout must be positive");
mkdirSync(output, { recursive: true });

function adb(args, binary = false) {
    return execFileSync("adb", args, {
        encoding: binary ? undefined : "utf8",
        timeout: 30_000,
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
    });
}

const sizeOutput = adb(["shell", "wm", "size"]);
const size = [...sizeOutput.matchAll(/(\d+)x(\d+)/g)].at(-1);
assert.ok(size, "Android display size is unavailable");
const viewport = { width: Number(size[1]), height: Number(size[2]) };
const steps = [];
let lastXml = "";

function dump() {
    adb(["shell", "rm", "-f", "/sdcard/echomusic-qa.xml"]);
    adb(["shell", "uiautomator", "dump", "/sdcard/echomusic-qa.xml"]);
    lastXml = adb(["exec-out", "cat", "/sdcard/echomusic-qa.xml"]);
    return lastXml;
}

async function waitFor(id, timeout = waitTimeout) {
    const deadline = Date.now() + timeout;
    let dumpError;
    do {
        try {
            const control = findControl(dump(), id, viewport);
            if (control) {
                return control;
            }
        } catch (error) {
            dumpError = error.message;
        }
        await delay(400);
    } while (Date.now() < deadline);
    throw new Error(`Control ${id} never became available${dumpError ? `: ${dumpError}` : ""}`);
}

async function tap(id) {
    const { x, y } = await waitFor(id);
    adb(["shell", "input", "tap", String(x), String(y)]);
}

function capture(name, passed = true) {
    writeFileSync(resolve(output, `${name}.png`), adb(["exec-out", "screencap", "-p"], true));
    writeFileSync(resolve(output, `${name}.xml`), lastXml);
    steps.push({ name, passed, completedAt: new Date().toISOString() });
    console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}

async function returnHome() {
    // The first Back can dismiss the keyboard or an open drawer.
    for (let attempts = 0; attempts < 3; attempts += 1) {
        adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
        try {
            await waitFor("home-search", 2500);
            // Some drawer implementations expose the covered home in the UI
            // tree. Close the drawer before treating that home as interactive.
            if (findControl(lastXml, "drawer-settings", viewport)) {
                continue;
            }
            return;
        } catch { /* Try the next navigation layer. */ }
    }
    throw new Error("Back did not restore the interactive home screen");
}

async function exerciseControls(prefix) {
    await waitFor("home-search", 60_000);
    capture(`${prefix}-home`);
    await tap("home-search");
    await waitFor("search-input");
    adb(["shell", "input", "text", "EchoMusicQA"]);
    const input = await waitFor("search-input");
    assert.equal(input.text, "EchoMusicQA", "Search control did not receive text input");
    capture(`${prefix}-search`);
    await returnHome();
    await tap("home-menu");
    await waitFor("drawer-settings");
    capture(`${prefix}-drawer`);
    await tap("drawer-settings");
    await waitFor("settings-screen");
    capture(`${prefix}-settings`);
    await returnHome();
    // Verify a second interaction after returning, rather than just a screenshot.
    await tap("home-search");
    await waitFor("search-input");
    capture(`${prefix}-search-again`);
    await returnHome();
}

let failure;
try {
    adb(["install", "-r", apk]);
    adb(["logcat", "-c"]);
    // These checks cover offline controls. They do not depend on the availability
    // of a music source or an update server, and install no third-party plugins.
    adb(["shell", "svc", "wifi", "disable"]);
    adb(["shell", "svc", "data", "disable"]);
    adb(["shell", "am", "force-stop", app]);
    writeFileSync(resolve(output, "cold-start.txt"), adb(["shell", "am", "start", "-W", "-n", activity]));
    adb(["shell", "dumpsys", "gfxinfo", app, "reset"]);
    await exerciseControls("01-cold");

    adb(["shell", "input", "keyevent", "KEYCODE_HOME"]);
    adb(["shell", "am", "start", "-W", "-n", activity]);
    await exerciseControls("02-resume");

    for (const setting of ["window_animation_scale", "transition_animation_scale", "animator_duration_scale"]) {
        adb(["shell", "settings", "put", "global", setting, "0"]);
    }
    adb(["shell", "am", "force-stop", app]);
    adb(["shell", "am", "start", "-W", "-n", activity]);
    await exerciseControls("03-reduced-motion");
} catch (error) {
    failure = error;
    console.error(error.message);
    try { capture("failure", false); } catch { /* Preserve the original failure. */ }
} finally {
    for (const [file, args] of [
        ["logcat.txt", ["logcat", "-d", "-t", "1500"]],
        ["memory.txt", ["shell", "dumpsys", "meminfo", app]],
        ["frames.txt", ["shell", "dumpsys", "gfxinfo", app, "framestats"]],
    ]) {
        try { writeFileSync(resolve(output, file), adb(args)); } catch { /* Best-effort diagnostics. */ }
    }
    let androidRelease = "unknown";
    try { androidRelease = adb(["shell", "getprop", "ro.build.version.release"]).trim(); } catch { /* Preserve the original failure. */ }
    writeFileSync(resolve(output, "result.json"), JSON.stringify({
        passed: !failure,
        androidRelease,
        viewport,
        steps,
        error: failure?.message,
        scope: "Offline Release APK interaction; emulator metrics are not Xiaomi 12S performance measurements.",
    }, null, 2));
}
if (failure) {
    process.exitCode = 1;
}
