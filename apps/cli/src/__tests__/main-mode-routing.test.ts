// Subprocess entrypoint tests for main.ts mode selection.
// These pin the routing seam: --help and unknown options must reach
// Commander (the CLI parser), not fall through into hook adapter or
// interactive TUI mode. Without these tests, regressions in the
// `if (!hasSubcommand && ...)` checks at the top of main() are silent
// because no unit test exercises the entrypoint.

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync } from "node:fs";
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

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "iching-mode-routing-test-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

async function runCli(args: string[]): Promise<RunResult> {
  // Always pass --data-dir to an ephemeral temp dir so a regression that
  // routes routing-mode args into hook/TUI mode can't write to the user's
  // real ~/.local/state/iching journal or cache.
  const proc = Bun.spawn(["bun", MAIN_TS, "--data-dir", dataDir, ...args], {
    cwd: REPO_ROOT,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  // Close stdin immediately so any reader (e.g. hook mode) sees EOF.
  proc.stdin.end();
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

describe("main.ts mode routing", () => {
  test("--help reaches Commander, not hook/TUI mode", async () => {
    const { exitCode, stdout, stderr } = await runCli(["--help"]);
    const combined = stdout + stderr;

    expect(exitCode).toBe(0);
    expect(combined).toContain("Usage:");
    // Should list registered subcommands somewhere in the help output.
    expect(combined).toMatch(/cast|dict|journal/);
    // Should NOT have produced any TUI alt-screen escape or hook-adapter output.
    expect(combined).not.toContain("[?1049"); // alt-screen enter
    expect(combined).not.toContain("HookSpecificOutput"); // Claude Code hook payload
  }, 20_000);

  test("-h short form also reaches Commander", async () => {
    const { exitCode, stdout, stderr } = await runCli(["-h"]);
    const combined = stdout + stderr;
    expect(exitCode).toBe(0);
    expect(combined).toContain("Usage:");
  }, 20_000);

  test("unknown top-level option errors via Commander, not hook mode", async () => {
    const { exitCode, stdout, stderr } = await runCli(["--bogus-flag"]);
    const combined = (stdout + stderr).toLowerCase();
    expect(exitCode).not.toBe(0);
    expect(combined).toMatch(/unknown option|unknown argument|unrecognized/);
    // Confirm we didn't accidentally enter hook mode (which would print
    // structured JSON or nothing rather than a Commander error).
    expect(stderr + stdout).not.toContain("HookSpecificOutput");
  }, 20_000);

  test("--version reaches Commander", async () => {
    const { exitCode, stdout } = await runCli(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  }, 20_000);

  test("a garbage --seed exits 1 before any no-subcommand mode runs", async () => {
    // Without the up-front guard, `iching --seed abc` fell through into
    // hook/TUI mode: Number("abc") is NaN, NaN|0 collapses the seeded PRNG
    // to a constant cast (always KW 2), and the result was persisted to the
    // daily cache while skipping the journal. The seed must be refused
    // loudly before either mode touches storage or the alt screen.
    // ICHING_HOME pins ALL storage (hook mode ignores --data-dir) to the
    // ephemeral temp dir so even a regression can't touch real user data.
    const proc = Bun.spawn(["bun", MAIN_TS, "--seed", "abc"], {
      cwd: REPO_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, NO_COLOR: "1", ICHING_HOME: dataDir },
    });
    proc.stdin.end();
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid --seed "abc"');
    expect(stdout).toBe(""); // no hook cast output
    // …and nothing was persisted on the invalid path.
    expect(existsSync(join(dataDir, "daily-cache.json"))).toBe(false);
    expect(existsSync(join(dataDir, "history.jsonl"))).toBe(false);
  }, 20_000);
});
