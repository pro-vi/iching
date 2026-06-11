// Subprocess tests for program metadata — the `iching` identity surface.
// Regression: the program name derived from the workspace package name, so
// `--help` printed "Usage: @iching/cli", and apps/cli/package.json lagged at
// 0.2.0 so `--version` reported a stale release.

import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import cliPkg from "../../package.json" with { type: "json" };
import rootPkg from "../../../../package.json" with { type: "json" };

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string }> {
  const proc = Bun.spawn(["bun", MAIN_TS, ...args], {
    cwd: REPO_ROOT,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { exitCode, stdout };
}

describe("program metadata", () => {
  test("--help header says 'Usage: iching', never the workspace package name", async () => {
    const { exitCode, stdout } = await runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: iching");
    expect(stdout).not.toContain("@iching/cli");
  }, 20_000);

  test("--version derives from apps/cli/package.json and tracks the root release", async () => {
    const { exitCode, stdout } = await runCli(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(cliPkg.version);
    // Release versions move together — a root bump must not strand the CLI.
    expect(cliPkg.version).toBe(rootPkg.version);
  }, 20_000);
});
