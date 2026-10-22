import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Exercises the checker only. These tests provide no evidence about an APK.
function runFixture(freeze) {
    const directory = mkdtempSync(join(tmpdir(), "echomusic-smoke-fixture-"));
    try {
        const executable = join(directory, "adb");
        copyFileSync(fileURLToPath(new URL("./fixtures/adb.cjs", import.meta.url)), executable);
        chmodSync(executable, 0o700);
        const statePath = join(directory, "state.json");
        const outputPath = join(directory, "output");
        const processResult = spawnSync(process.execPath, [
            fileURLToPath(new URL("./android-smoke.mjs", import.meta.url)),
            "fixture.apk", outputPath,
        ], {
            encoding: "utf8",
            timeout: 20_000,
            env: {
                ...process.env,
                PATH: `${directory}${delimiter}${process.env.PATH}`,
                QA_FAKE_ADB_STATE: statePath,
                QA_FAKE_FREEZE: String(freeze),
                ECHOMUSIC_SMOKE_WAIT_MS: "100",
            },
        });
        assert.ifError(processResult.error);
        return {
            status: processResult.status,
            report: JSON.parse(readFileSync(join(outputPath, "result.json"), "utf8")),
            device: JSON.parse(readFileSync(statePath, "utf8")),
        };
    } finally {
        // Only this test's freshly created temporary directory is removed.
        rmSync(directory, { recursive: true, force: true });
    }
}

test("checker requires actual navigation and text entry for every lifecycle scenario", () => {
    const result = runFixture(false);
    assert.equal(result.status, 0);
    assert.equal(result.report.passed, true);
    assert.equal(result.report.steps.length, 15);
    assert.equal(result.device.searches, 6);
    assert.equal(result.device.settings, 3);
});

test("visible home controls that do not navigate fail the checker", () => {
    const result = runFixture(true);
    assert.equal(result.status, 1);
    assert.equal(result.report.passed, false);
    assert.match(result.report.error, /search-input never became available/);
    assert.equal(result.report.steps.at(-1).passed, false);
});
