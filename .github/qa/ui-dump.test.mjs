import assert from "node:assert/strict";
import test from "node:test";
import { findControl } from "./ui-dump.mjs";

const screen = { width: 1080, height: 2400 };
const node = attributes => `<hierarchy><node ${attributes}/></hierarchy>`;

test("finds native test IDs and calculates the actual tap center", () => {
    assert.deepEqual(findControl(node('resource-id="home-search" enabled="true" bounds="[20,80][800,180]"'), "home-search", screen), {
        x: 410, y: 130, text: "",
        attributes: { "resource-id": "home-search", enabled: "true", bounds: "[20,80][800,180]" },
    });
});

test("accepts Android package-prefixed IDs", () => {
    assert.equal(findControl(node('resource-id="com.panini.echomusic:id/search-input" text="EchoMusicQA" bounds="[10,10][500,100]"'), "search-input", screen)?.text, "EchoMusicQA");
});

test("does not confuse a matching text label with a native test ID", () => {
    assert.equal(findControl(node('text="home-search" resource-id="other" bounds="[10,10][500,100]"'), "home-search", screen), null);
});

test("rejects stale off-screen destinations, disabled, hidden, and zero-size controls", () => {
    for (const extra of [
        'bounds="[-1080,10][-200,200]"',
        'bounds="[1080,10][2160,200]"',
        'bounds="[10,10][10,10]"',
        'bounds="[10,10][300,200]" enabled="false"',
        'bounds="[10,10][300,200]" visible-to-user="false"',
    ]) {
        assert.equal(findControl(node(`resource-id="home-search" ${extra}`), "home-search", screen), null);
    }
});
