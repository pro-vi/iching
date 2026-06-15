// Subprocess coverage for the `paths` command — it resolves and prints the
// data-file locations, honoring --data-dir and --json. Command-wiring was
// otherwise untested.
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

async function runCli(args: string[]): Promise<RunResult> {
  const proc = Bun.spawn(["bun", MAIN_TS, ...args], {
    cwd: REPO_ROOT,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1", TZ: "UTC" },
  });
  proc.stdin.end();
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

let dataDir: string;
beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "iching-paths-test-"));
});
afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("paths command", () => {
  test("prints the resolved locations under the --data-dir override", async () => {
    const { exitCode, stdout } = await runCli(["--data-dir", dataDir, "paths"]);
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
    const { exitCode, stdout } = await runCli(["--data-dir", dataDir, "--json", "paths"]);
    expect(exitCode).toBe(0);
    const paths = JSON.parse(stdout);
    for (const key of ["config", "state", "cache"]) {
      expect(typeof paths[key]).toBe("string");
      expect(paths[key]).toContain(dataDir);
    }
  }, 20_000);
});
