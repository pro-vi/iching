# Plan 001: Consolidate the duplicated cast test-fixtures into one shared builder

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP conditions" item occurs, stop and report — do not improvise. When done,
> update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 88d08aeb..HEAD -- packages/storage/src/__tests__ apps/cli/src/__tests__ packages/core/src`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (cross-package import resolution; test-only — no production behavior)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `88d08aeb`, 2026-06-15

## Why this matters

Every test file that builds a `Cast` rolls its own `makeCast` / `makeEntry` /
`makeLine`. After the read-time integrity check landed (`isCastShaped` now
reconstructs a cast from its lines and compares — see
`packages/storage/src/json/cast-shape.ts`), any cast persisted in a test must be
internally consistent (primary/becoming/derived must match the lines), or the
store tears it on read. That made a single change ripple across ~8 test files in
lockstep, each re-deriving the same "build a consistent cast for a hexagram"
logic. One shared builder removes the lockstep: a `Cast`-shape change is then a
one-file edit.

Scope is deliberately the **store-round-tripping** test files (the ones that
write a cast through a store and read it back, so the integrity check applies).
In-memory-only builders in `packages/core` and `packages/terminal` tests are
explicitly OUT of scope — they don't round-trip, didn't break, and use varied
override-style signatures; folding them in is a separate, lower-value pass.

## Current state

The shared helper has a single home: `@iching/core` already exports from
`./src/index.ts` and is a dependency of every other workspace package, so a
`@iching/core/testing` subpath is importable by both `packages/storage` and
`apps/cli` tests.

The round-tripping builders to replace (each currently re-derives the same way):

- `packages/storage/src/__tests__/journal-query.test.ts` — builds a static cast OF a hexagram:
  ```ts
  function makeCast(primary: number): Cast {
    const lines: Line[] = GUA[primary - 1].l.map((bit) => ({
      value: bit ? 7 : 8, isYang: bit === 1, isChanging: false,
    }));
    return assembleCast(lines);
  }
  ```
- `apps/cli/src/__tests__/journal-command.test.ts` — builds a cast OF `primary` that becomes `becoming` by flipping the differing lines:
  ```ts
  function makeCast(primary: number, becoming: number | null): Cast {
    const p = GUA[primary - 1].l;
    const b = becoming === null ? null : GUA[becoming - 1].l;
    const lines: Line[] = p.map((bit, i) => {
      const moves = b !== null && b[i] !== bit;
      return moves
        ? { value: (bit ? 9 : 6) as 6 | 9, isYang: bit === 1, isChanging: true }
        : { value: (bit ? 7 : 8) as 7 | 8, isYang: bit === 1, isChanging: false };
    });
    return assembleCast(lines);
  }
  ```
- `packages/storage/src/__tests__/journal-store.test.ts` — `makeLine(7|8)`, `baseLines()`, `makeEntry(date)` = `{ date, cast: assembleCast(baseLines()) }`.
- `packages/storage/src/__tests__/daily-cache-store.test.ts` — `makeLine`, `makeCache(date)` wraps `assembleCast([...])`.
- `apps/cli/src/__tests__/today-command.test.ts` — `makeCast()` returns `assembleCast([...KW3 with line 1 moving...])`.
- `apps/cli/src/__tests__/today-cache.test.ts` — `makeLine(6|7|8|9)`, `makeCache` wraps `assembleCast([...])`.
- `apps/cli/src/__tests__/reading-flow.test.ts` — inline `assembleCast([...six young-yang lines...])`.
- `apps/cli/src/__tests__/scene-factories.test.ts` — `makeReplayEntry(date, ts)` wraps `assembleCast([...])`.

Repo conventions to match:
- Core data + derivation live in `packages/core/src` (`data/gua.ts` exports `GUA`; `casting/cast.ts` exports `assembleCast`; `types.ts` exports `Cast`, `Line`). Match ESM `.js` import specifiers (the repo uses `.js` suffixes in source imports even for `.ts` files — see `packages/core/src/index.ts`).
- Tests import production code by package name: `import { GUA, assembleCast } from "@iching/core"`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun run typecheck` | exit 0, no errors |
| Tests (all) | `bun run test` | all pass (~1279+) |
| Tests (one file) | `bun test <path>` | that file's tests pass |
| Language gate | `bun scripts/verify-language-surfaces.ts` | `PASS — 0 issues` |
| Build + smoke | `bun run build && bun run smoke` | build done; `5 passed, 0 failed` |

## Scope

**In scope:**
- `packages/core/src/testing.ts` (create) — the shared builder.
- `packages/core/package.json` (add a `./testing` export subpath).
- The 8 round-tripping test files listed in "Current state" (replace their local builders).

**Out of scope (do NOT touch):**
- Any `packages/core/src/index.ts` change — the testing helpers must NOT be re-exported from the main entry (they'd ship in the production bundle). The `./testing` subpath is separate on purpose.
- In-memory-only builders in `packages/core/src/__tests__/*` (derivation, format, journal-patterns, reading-focus) and all `packages/terminal/src/__tests__/*` — different signatures, don't round-trip, lower value. A follow-up plan can absorb them.
- Any production source file. This is test-only.

## Git workflow

- Branch: work on the current branch (do not create a new one unless instructed).
- Commit style: Conventional Commits, e.g. `test(core): add shared cast fixture builder`. End the commit body with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Use `git commit -F -` with a heredoc (backticks in `-m` trigger shell command-substitution in this repo).
- Do NOT push or open a PR.

## Steps

### Step 1: Create the shared builder

Create `packages/core/src/testing.ts`:

```ts
// Test-only cast fixtures. NOT re-exported from index.ts — imported via the
// "@iching/core/testing" subpath so it never ships in the production bundle.
import type { Cast, Line } from "./types.js";
import { GUA } from "./data/gua.js";
import { assembleCast } from "./casting/cast.js";

/** A single line by its value: 6 old-yin, 7 young-yang, 8 young-yin, 9 old-yang. */
export function lineOf(value: 6 | 7 | 8 | 9): Line {
  return { value, isYang: value === 7 || value === 9, isChanging: value === 6 || value === 9 };
}

/**
 * A consistent cast OF hexagram `primary`. assembleCast derives
 * primary/becoming/the four hexagrams FROM the lines, so the result always
 * passes isCastShaped's reconstruct-and-compare.
 *
 * - `castOf(kw)` — a static cast of `kw` (no moving lines).
 * - `castOf(kw, { becoming })` — flips exactly the lines where `kw` and
 *   `becoming` differ, so the derived becoming equals `becoming`.
 * - `castOf(kw, { changing })` — marks those 1-based positions moving; the
 *   becoming is then whatever those flips produce.
 *
 * Pass at most one of `becoming` / `changing`.
 */
export function castOf(
  primary: number,
  opts: { becoming?: number; changing?: number[] } = {},
): Cast {
  const p = GUA[primary - 1].l;
  const target = opts.becoming != null ? GUA[opts.becoming - 1].l : null;
  const lines: Line[] = p.map((bit, i) => {
    const moves = target != null ? target[i] !== bit : Boolean(opts.changing?.includes(i + 1));
    return moves ? lineOf(bit ? 9 : 6) : lineOf(bit ? 7 : 8);
  });
  return assembleCast(lines);
}
```

Add the subpath export to `packages/core/package.json` — change:
```json
  "exports": {
    ".": "./src/index.ts"
  }
```
to:
```json
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing.ts"
  }
```

**Verify** the subpath resolves (Bun honors `exports` for workspace packages):
`bun -e 'import("@iching/core/testing").then(m => console.log(typeof m.castOf, typeof m.lineOf))'`
→ prints `function function`

If that import fails to resolve, **STOP** (see STOP conditions) — do not fall back to a relative cross-package import without reporting.

### Step 2: Migrate one storage file as the proof of concept

In `packages/storage/src/__tests__/journal-query.test.ts`, replace the local
`makeCast`/`makeLine` with the import:
```ts
import { castOf } from "@iching/core/testing";
```
and replace `makeCast(primary)` call sites with `castOf(primary)`. Delete the
local `makeCast` and `makeLine` definitions and any now-unused imports
(`GUA`, `assembleCast`, `Line`) — but keep imports still used elsewhere.

**Verify**: `bun test packages/storage/src/__tests__/journal-query.test.ts` → all pass.

### Step 3: Migrate the remaining storage files

`journal-store.test.ts` and `daily-cache-store.test.ts`: replace `baseLines()`
+ `makeLine` usage and the inline `assembleCast([...])` with `castOf(...)` /
`lineOf(...)`. The base lines `[7,8,7,8,7,8]` form hexagram 63, so
`assembleCast(baseLines())` becomes `castOf(63)`; a line-1-moving variant
becomes `castOf(63, { changing: [1] })`.

**Verify**: `bun test packages/storage/` → all pass.

### Step 4: Migrate the cli files

`journal-command.test.ts` (`makeCast(primary, becoming)` → `castOf(primary, { becoming })`,
keeping `makeEntry` as a thin wrapper that calls `castOf`), `today-command.test.ts`,
`today-cache.test.ts`, `reading-flow.test.ts`, `scene-factories.test.ts`.
Preserve each file's existing assertions exactly — `castOf` produces the same
casts the inlined `assembleCast` calls did, so no assertion should change.

**Verify**: `bun test apps/cli/` → all pass.

### Step 5: Full gates

**Verify**:
- `bun run typecheck` → exit 0
- `bun run test` → all pass
- `bun scripts/verify-language-surfaces.ts` → `PASS — 0 issues`
- `bun run build && bun run smoke` → `5 passed, 0 failed`

## Test plan

No new behavior — this is a refactor of test fixtures. The existing suites ARE
the test: every migrated file must keep passing with identical assertions. Add
ONE direct test of the helper, `packages/core/src/__tests__/testing.test.ts`,
covering: `castOf(63)` is static (`changingPositions` empty); `castOf(3, { becoming: 8 })`
has `becoming === 8` and `changingPositions === [1]`; `castOf(3, { changing: [1,3] })`
moves lines 1 and 3; and every produced cast satisfies the round-trip (write
through `JsonlJournalStore`, read back, assert it survived — model after an
existing admit-case in `packages/storage/src/__tests__/journal-store.test.ts`).

## Done criteria

ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run test` exits 0; `testing.test.ts` exists and passes
- [ ] `bun scripts/verify-language-surfaces.ts` prints `PASS — 0 issues`
- [ ] `bun run build && bun run smoke` → `5 passed, 0 failed`
- [ ] `grep -rln "function makeCast" packages/storage/src/__tests__ apps/cli/src/__tests__` returns no matches in the 8 migrated files (the in-memory core/terminal files are out of scope and may still match)
- [ ] `packages/core/src/index.ts` is unchanged (the helper is NOT re-exported there)
- [ ] No production source file modified (`git status` shows only the 8 test files, `testing.ts`, `testing.test.ts`, `packages/core/package.json`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- `bun -e 'import("@iching/core/testing")...'` in Step 1 fails to resolve — the `exports` subpath approach doesn't work in this Bun version; report so the placement can be reconsidered (a `packages/test-support` workspace package is the fallback, but that's a different plan).
- A migrated file's assertions start failing — `castOf` is producing a different cast than the inlined builder did. Compare the two builders for that file's hexagram before changing any assertion.
- The drift check shows the "Current state" excerpts no longer match.

## Maintenance notes

- Future `Cast`-shape changes now touch `castOf` once instead of N test files — that's the win to protect; resist re-adding local `makeCast`es.
- The in-memory core/terminal builders remain duplicated (out of scope here). A follow-up plan can migrate them to `castOf` with an `overrides` parameter if their override-style call sites justify it.
- A reviewer should confirm `testing.ts` is never imported by `index.ts` or any production file (`grep -rn "core/testing" packages apps --include="*.ts" | grep -v __tests__` → empty).
