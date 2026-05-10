// Subprocess tests for the `iching config` command.
//
// These pin the CONFIG_SCHEMA so that any future config field added in
// storage's UserConfig + JsonConfigStore.DEFAULT_CONFIG also gets exposed
// through the CLI surface. The original bug: castMode landed in storage
// and SettingsScene but never made it into CONFIG_SCHEMA, so
// `iching config get castMode` and `set` both failed with "Unknown key".
// Same hole for taijituStyle.

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(dataDir: string, args: string[]): Promise<RunResult> {
  const proc = Bun.spawn(
    ["bun", MAIN_TS, "--data-dir", dataDir, ...args],
    {
      cwd: REPO_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, NO_COLOR: "1" },
    },
  );
  proc.stdin.end();
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

describe("config command", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "iching-config-cmd-test-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("list shows every persisted key, including castMode and taijituStyle", async () => {
    const { exitCode, stdout } = await runCli(dataDir, ["config", "list"]);
    expect(exitCode).toBe(0);
    // Every field that JsonConfigStore.DEFAULT_CONFIG persists must be visible.
    for (const key of [
      "theme",
      "motion",
      "color",
      "timezone",
      "glyphAnim",
      "glyphFont",
      "taijituStyle",
      "castMode",
    ]) {
      expect(stdout).toContain(key);
    }
  }, 20_000);

  test("get castMode returns the default value", async () => {
    const { exitCode, stdout } = await runCli(dataDir, ["config", "get", "castMode"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("auto");
  }, 20_000);

  test("get taijituStyle returns the default value", async () => {
    const { exitCode, stdout } = await runCli(dataDir, ["config", "get", "taijituStyle"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("dots");
  }, 20_000);

  test("set castMode manual persists, reload reads manual", async () => {
    const setResult = await runCli(dataDir, ["config", "set", "castMode", "manual"]);
    expect(setResult.exitCode).toBe(0);
    const getResult = await runCli(dataDir, ["config", "get", "castMode"]);
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout.trim()).toBe("manual");
  }, 20_000);

  test("set castMode rejects invalid value", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "set", "castMode", "wibble"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("invalid value");
  }, 20_000);

  test("set taijituStyle dense persists", async () => {
    const setResult = await runCli(dataDir, ["config", "set", "taijituStyle", "dense"]);
    expect(setResult.exitCode).toBe(0);
    const getResult = await runCli(dataDir, ["config", "get", "taijituStyle"]);
    expect(getResult.stdout.trim()).toBe("dense");
  }, 20_000);

  test("set taijituStyle rejects invalid value", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "set", "taijituStyle", "outline"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("invalid value");
  }, 20_000);

  test("get unknown key reports error", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "get", "notARealKey"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("unknown key");
  }, 20_000);
});
