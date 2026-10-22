#!/usr/bin/env node
// Test double for the smoke checker, never used as Android runtime evidence.
const fs = require("node:fs");
const path = process.env.QA_FAKE_ADB_STATE;
const state = fs.existsSync(path)
    ? JSON.parse(fs.readFileSync(path, "utf8"))
    : { page: "home", text: "", searches: 0, settings: 0 };
const args = process.argv.slice(2);
const command = args.join(" ");
const node = (id, bounds, text = "") =>
    `<node resource-id="${id}" text="${text}" enabled="true" bounds="${bounds}"/>`;

if (command === "shell wm size") {
    console.log("Physical size: 1080x2400");
} else if (command.startsWith("shell am start")) {
    state.page = "home";
    console.log("Status: ok\nTotalTime: 100");
} else if (command.startsWith("shell input tap")) {
    const x = Number(args[3]);
    if (state.page === "home" && x > 100 && process.env.QA_FAKE_FREEZE !== "true") {
        state.page = "search";
        state.text = "";
        state.searches += 1;
    } else if (state.page === "home" && x < 100) {
        state.page = "drawer";
    } else if (state.page === "drawer") {
        state.page = "settings";
        state.settings += 1;
    }
} else if (command.startsWith("shell input text")) {
    state.text = args[3];
} else if (command === "shell input keyevent KEYCODE_BACK") {
    state.page = state.page === "settings" ? "drawer" : "home";
} else if (command === "exec-out cat /sdcard/echomusic-qa.xml") {
    const pages = {
        home: node("home-search", "[100,80][1000,180]") + node("home-menu", "[10,80][90,180]"),
        search: node("search-input", "[100,80][1000,180]", state.text),
        // The covered home intentionally remains in the tree to check that the
        // smoke flow closes the drawer before trying to use home again.
        drawer: node("drawer-settings", "[100,80][200,180]") + node("home-search", "[100,80][1000,180]"),
        settings: node("settings-screen", "[0,0][1080,2400]"),
    };
    console.log(`<hierarchy>${pages[state.page]}</hierarchy>`);
} else if (command === "exec-out screencap -p") {
    process.stdout.write("TEST FIXTURE - NOT A DEVICE SCREENSHOT");
} else if (command === "shell getprop ro.build.version.release") {
    console.log("15");
}
fs.writeFileSync(path, JSON.stringify(state));
