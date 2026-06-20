// Subprocess coverage for the `paths` command — it resolves and prints the
// data-file locations, honoring --data-dir and --json. Command-wiring was
// otherwise untested.
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { runCli } from "../testing.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dataDir: string;
beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "iching-paths-test-"));
});
afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("paths command", () => {
  test("prints the resolved locations under the --data-dir override", async () => {
    const { exitCode, stdout } = await runCli(["--data-dir", dataDir, "paths"], { env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Config:");
    expect(stdout).toContain("State:");
    expect(stdout).toContain("Cache:");
    // Each line resolves UNDER the override, proving --data-dir is honored.
    for (const line of stdout.trim().split("\n")) {
      expect(line).toContain(dataDir);
    }
  }, 20_000);

  test("--json emits the resolved paths as a parseable object under the override", async () => {
    const { exitCode, stdout } = await runCli(["--data-dir", dataDir, "--json", "paths"], { env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    const paths = JSON.parse(stdout);
    for (const key of ["config", "state", "cache"]) {
      expect(typeof paths[key]).toBe("string");
      expect(paths[key]).toContain(dataDir);
    }
  }, 20_000);
});
