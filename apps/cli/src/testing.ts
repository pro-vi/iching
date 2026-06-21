// Test support for the cli subprocess suites. Imported relatively by apps/cli's
// own __tests__ (the analogue of @iching/core/testing); not part of the public
// surface.

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

// Repo root is THREE levels up from this file (apps/cli/src/) — not four. The
// test suites that each defined this sat one level deeper, in __tests__/, so they
// used four; import.meta.dir here is apps/cli/src, so three reaches the root.
export const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
export const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn the CLI (`bun main.ts ...args`) and capture its output — the subprocess
 * harness the cli suites each hand-rolled. `opts.dataDir` injects `--data-dir
 * <dir>`; `opts.env` merges over the default `{ NO_COLOR: "1" }` (e.g.
 * `{ TZ: "UTC" }` for date determinism); `opts.stdin`, when given, is written to
 * the child's stdin before it's closed (hook mode reads a JSON event from stdin).
 * Always captures stdout + stderr; callers that only read stdout ignore the rest.
 */
export async function runCli(
  args: string[],
  opts: { dataDir?: string; env?: Record<string, string>; stdin?: string } = {},
): Promise<RunResult> {
  const fullArgs = opts.dataDir ? ["--data-dir", opts.dataDir, ...args] : args;
  const proc = Bun.spawn(["bun", MAIN_TS, ...fullArgs], {
    cwd: REPO_ROOT,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1", ...opts.env },
  });
  if (opts.stdin !== undefined) proc.stdin.write(opts.stdin);
  proc.stdin.end();
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

/** Create a fresh OS temp directory for a test, `prefix`-tagged for debuggability. */
export async function freshTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `${prefix}-`));
}

/** Seed a data dir's history.jsonl with `entries` — one JSON record per line. */
export async function seedJournal(dataDir: string, entries: unknown[]): Promise<void> {
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(join(dataDir, "history.jsonl"), lines, "utf-8");
}

/** Today's date (YYYY-MM-DD) in UTC — the test clock's "today". */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
