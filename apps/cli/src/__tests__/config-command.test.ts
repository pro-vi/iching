// Subprocess tests for the `iching config` command.
//
// These pin the CONFIG_SCHEMA so that any future config field added in
// storage's UserConfig + JsonConfigStore.DEFAULT_CONFIG also gets exposed
// through the CLI surface. The original bug: castMode landed in storage
// and SettingsScene but never made it into CONFIG_SCHEMA, so
// `iching config get castMode` and `set` both failed with "Unknown key".
// Same hole for taijituStyle. Later the field was split into castMethod
// (coin|yarrow) × castMode (auto|manual); both must be reachable.

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

  test("list shows every persisted key, including language and cast settings", async () => {
    const { exitCode, stdout } = await runCli(dataDir, ["config", "list"]);
    expect(exitCode).toBe(0);
    // Every field that JsonConfigStore.DEFAULT_CONFIG persists must be visible.
    for (const key of [
      "theme",
      "motion",
      "language",
      "color",
      "timezone",
      "glyphAnim",
      "glyphFont",
      "taijituStyle",
      "castMethod",
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

  test("get language returns the default value", async () => {
    const { exitCode, stdout } = await runCli(dataDir, ["config", "get", "language"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("en");
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

  // Behavioral assertion: enabling yarrow goes through castMethod, not the
  // legacy `castMode yarrow` string. The previous test asserted only that the
  // string round-tripped — which it did, by writing an out-of-domain value
  // that silently fell back to coin auto at cast time. This locks the real
  // contract: castMethod=yarrow is how yarrow gets enabled.
  test("set castMethod yarrow persists, reload reads yarrow", async () => {
    const setResult = await runCli(dataDir, ["config", "set", "castMethod", "yarrow"]);
    expect(setResult.exitCode).toBe(0);
    const getResult = await runCli(dataDir, ["config", "get", "castMethod"]);
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout.trim()).toBe("yarrow");
  }, 20_000);

  // Round-trip a NON-default value (en is DEFAULT_CONFIG.language, so a silent
  // no-op write would still read back "en" — this would pass green even broken).
  test("set language zh-Hant persists, reload reads zh-Hant", async () => {
    const setResult = await runCli(dataDir, ["config", "set", "language", "zh-Hant"]);
    expect(setResult.exitCode).toBe(0);
    const getResult = await runCli(dataDir, ["config", "get", "language"]);
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout.trim()).toBe("zh-Hant");
  }, 20_000);

  test("set castMode rejects yarrow (now out of castMode's domain)", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "set", "castMode", "yarrow"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("invalid value");
  }, 20_000);

  test("set castMode rejects invalid value", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "set", "castMode", "wibble"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("invalid value");
  }, 20_000);

  test("set castMethod rejects invalid value", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "set", "castMethod", "stones"]);
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

  test("set language rejects invalid value", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "set", "language", "latin"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("invalid value");
  }, 20_000);

  test("get unknown key reports error", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "get", "notARealKey"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("unknown key");
  }, 20_000);

  // Regression: `key in CONFIG_SCHEMA` walked the prototype chain, so inherited
  // Object.prototype names slipped past the unknown-key guard — `get` printed the
  // inherited function and `set` crashed ("schema.set is not a function"). The
  // guard now uses Object.hasOwn; both must report a clean "unknown key" error.
  test("get inherited prototype key (toString) reports unknown key", async () => {
    const { exitCode, stderr, stdout } = await runCli(dataDir, ["config", "get", "toString"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("unknown key");
    expect(stdout).not.toContain("function");
  }, 20_000);

  test("set inherited prototype key (constructor) reports unknown key, does not crash", async () => {
    const { exitCode, stderr } = await runCli(dataDir, ["config", "set", "constructor", "x"]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain("unknown key");
    expect(stderr.toLowerCase()).not.toContain("is not a function");
  }, 20_000);
});
