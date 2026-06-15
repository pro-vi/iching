# Plan 003: Add subprocess tests for the `paths` and `hexagram` commands

> **Executor instructions**: Follow step by step; run every verification command.
> Honor STOP conditions. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 88d08aeb..HEAD -- apps/cli/src/commands/paths.ts apps/cli/src/commands/hexagram.ts apps/cli/src/__tests__`
> If any changed since this plan was written, re-read before trusting the excerpts.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (adds tests only; no production change)
- **Depends on**: none (may use the `castOf` helper from plan 001 if it has landed, but does not require it)
- **Category**: tests
- **Planned at**: commit `88d08aeb`, 2026-06-15

## Why this matters

Two top-level commands have no end-to-end coverage. `paths` (resolves and prints
file locations, honors `--data-dir` and `--json`) and `hexagram` (looks up a
hexagram by number/name and prints it, honors `--json` and `--style`) are
user-facing entry points whose command-wiring — argument parsing, the
`--data-dir`/`--json` global flags, error exit codes — is untested. A regression
in arg handling or output shape would ship silently. Their internals are partly
covered (`hexagram-output.test.ts` tests the formatter, `hexagram-resolve.test.ts`
tests the query parser), but nothing runs the actual command. This plan adds
subprocess tests using the existing harness pattern.

`dict` is intentionally NOT covered end-to-end: it launches an interactive TUI
(`BrowseScene` via `TerminalSession`) that needs a PTY and never returns
non-interactively — subprocess-testing it would hang. Its non-interactive
decision logic (`resolveHexagramQuery`) is already unit-tested. This is noted,
not a gap to force.

## Current state

- `apps/cli/src/commands/paths.ts` (whole file):
  ```ts
  import { Command } from "commander";
  import { resolvePaths } from "@iching/storage";
  import { outputJson } from "../output/json.js";

  export function registerPathsCommand(program: Command): void {
    program
      .command("paths")
      .description("Show all resolved file locations")
      .action(() => {
        const globalOpts = program.opts();
        const paths = resolvePaths(globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined);
        if (globalOpts.json) {
          outputJson(paths);
        } else {
          console.log(`Config:  ${paths.config}`);
          console.log(`State:   ${paths.state}`);
          console.log(`Cache:   ${paths.cache}`);
        }
      });
  }
  ```
- `apps/cli/src/commands/hexagram.ts` — registers `hexagram <query>`, resolves via `resolveHexagramQuery`, prints via the plain/JSON formatter; honors `--json` and a `--style` option. (Read the file before writing assertions; confirm the exact flag names and the error message/exit code for an out-of-range number.)
- The subprocess-test harness pattern (copy it) — `apps/cli/src/__tests__/journal-command.test.ts`:
  ```ts
  const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
  const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

  async function runCli(dataDir: string, args: string[]): Promise<RunResult> {
    const proc = Bun.spawn(["bun", MAIN_TS, "--data-dir", dataDir, ...args], {
      cwd: REPO_ROOT, stdin: "pipe", stdout: "pipe", stderr: "pipe",
      env: { ...process.env, NO_COLOR: "1", TZ: "UTC" },
    });
    proc.stdin.end();
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(), new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { exitCode, stdout, stderr };
  }
  ```
  Tests `mkdtemp` a temp data dir in `beforeEach` and `rm` it in `afterEach`.

Convention: subprocess CLI tests live in `apps/cli/src/__tests__/<command>-command.test.ts`, spawn `bun main.ts`, assert on `exitCode` + `stdout`/`stderr`, give each test a generous timeout (`20_000`).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Run new tests | `bun test apps/cli/src/__tests__/paths-command.test.ts apps/cli/src/__tests__/hexagram-command.test.ts` | all pass |
| Tests (all) | `bun run test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Language gate | `bun scripts/verify-language-surfaces.ts` | `PASS — 0 issues` |

## Scope

**In scope (create):**
- `apps/cli/src/__tests__/paths-command.test.ts`
- `apps/cli/src/__tests__/hexagram-command.test.ts`

**Out of scope (do NOT touch):**
- Any production command file. If a test surfaces a real bug in `paths.ts`/`hexagram.ts`, STOP and report it — do not fix it under a "tests" plan (separate concern, separate review).
- `dict` end-to-end testing — interactive, out of scope (see "Why this matters").
- The existing `hexagram-output.test.ts` / `hexagram-resolve.test.ts` — leave them; this plan adds command-level coverage alongside them.

## Git workflow

- Current branch; Conventional Commits, e.g. `test(cli): cover the paths and hexagram commands end-to-end`; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` via `git commit -F -`.

## Steps

### Step 1: `paths` command tests

Create `apps/cli/src/__tests__/paths-command.test.ts` with the `runCli` harness.
Cover:
- `iching --data-dir <tmp> paths` → exit 0; stdout contains `Config:`, `State:`, `Cache:` and each line contains `<tmp>` (the override is honored).
- `iching --data-dir <tmp> --json paths` → exit 0; `JSON.parse(stdout)` yields an object whose `config`/`state`/`cache` values are strings under `<tmp>`.

**Verify**: `bun test apps/cli/src/__tests__/paths-command.test.ts` → all pass.

### Step 2: `hexagram` command tests

First READ `apps/cli/src/commands/hexagram.ts` to confirm the exact argument
name, the `--style` values, the `--json` shape, and the out-of-range error
message + exit code. Then create `apps/cli/src/__tests__/hexagram-command.test.ts`
covering:
- `iching hexagram 1` → exit 0; stdout contains the hexagram-1 name (`乾`).
- `iching --json hexagram 1` → exit 0; `JSON.parse(stdout)` has the expected number/name fields (match the actual JSON shape you read).
- A by-name query (e.g. `iching hexagram <a name the resolver accepts>`) → exit 0; resolves to the right hexagram.
- An out-of-range / invalid query (e.g. `iching hexagram 99`) → non-zero exit OR the exact error message the command emits (use whichever the code actually does — confirm by reading, don't assume).

**Verify**: `bun test apps/cli/src/__tests__/hexagram-command.test.ts` → all pass.

### Step 3: Full gates

**Verify**:
- `bun run test` → all pass
- `bun run typecheck` → exit 0
- `bun scripts/verify-language-surfaces.ts` → `PASS — 0 issues` (the tests contain Chinese assertions like `乾`; the gate scans source surfaces, not test files, but run it to be safe)

## Test plan

This plan IS the test addition. New cases, by file:
- `paths-command.test.ts`: default-with-data-dir (plain), `--json` shape. (2)
- `hexagram-command.test.ts`: by-number plain, by-number `--json`, by-name, invalid/out-of-range. (4)
Model both on `apps/cli/src/__tests__/journal-command.test.ts` (the `runCli` harness, `mkdtemp`/`rm` lifecycle).

## Done criteria

- [ ] `bun test apps/cli/src/__tests__/paths-command.test.ts` passes (≥2 cases)
- [ ] `bun test apps/cli/src/__tests__/hexagram-command.test.ts` passes (≥4 cases)
- [ ] `bun run test` exits 0
- [ ] `bun run typecheck` exits 0
- [ ] No production source modified (`git status` shows only the two new test files)
- [ ] `plans/README.md` status row updated

## STOP conditions

- A test reveals a real bug in `paths.ts` or `hexagram.ts` (wrong exit code, malformed JSON, a crash) — STOP and report it as a separate finding; do not fix production code in this plan.
- The `hexagram` command's actual flags/error-shape differ from what this plan assumed — that's expected; assert what the code actually does (you read it in Step 2), and note the discrepancy in your report.
- `dict` seems testable after all and you're tempted to add it — don't; if it truly has a non-interactive path, raise it as a follow-up rather than expanding this plan.

## Maintenance notes

- If `dict` ever gains a non-interactive `--json` lookup mode, that becomes testable — add it then.
- These tests pin command-wiring (flags, exit codes, output shape); a reviewer should check they assert on `exitCode` and concrete output, not just "doesn't throw."
- If plan 001 (shared `castOf`) has landed and a hexagram test needs a seeded cast, import from `@iching/core/testing`; otherwise these tests need no cast fixtures.
