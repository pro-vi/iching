# Plan 004: Split `patterns.ts` into concern-scoped modules (pure, behavior-preserving)

> **Executor instructions**: This is a behavior-preserving refactor of PURE
> functions, guarded by an existing integration test. Make ONE concern-move at a
> time and re-run the guard test after each. Honor STOP conditions. When done,
> update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 88d08aeb..HEAD -- packages/core/src/journal/patterns.ts packages/core/src/__tests__/journal-patterns.test.ts packages/core/src/index.ts`
> If any changed since this plan was written, re-read before proceeding.

## Status

- **Priority**: P3 (maintainability; do only if you want the seam — not a bug)
- **Effort**: L
- **Risk**: LOW–MED (pure functions; pinned by an existing integration test; the risk is an import/re-export slip)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `88d08aeb`, 2026-06-15

## Why this matters

`packages/core/src/journal/patterns.ts` is ~833 lines: it holds distribution
analysis (hexagrams, trigrams, moving-line counts, phase-of-day), cadence
(span/active-days/gaps/idle), diversity (entropy/concentration/expected repeats),
structural echoes (Hamming distance, locked pairs), the comparison/lift helpers,
and the `computeJournalPatterns` orchestrator that calls nearly all of them. Any
edit to one analysis hunts through the whole file. The functions are pure and
already covered by an integration test, so a split by concern is low-risk and
makes each analysis independently legible and testable.

This is the LOWER-risk half of the god-module finding. `journal-scene.ts` (the
1439-line TUI scene) is the higher-risk half — stateful, render+input coupled —
and is explicitly a separate follow-up, not this plan. Do not attempt it here.

Do this plan only if the maintainability win is wanted now; line count alone is
not a bug. If there's no near-term edit to `patterns.ts`, it's defensible to
leave it and close this plan as deferred.

## Current state

- `packages/core/src/journal/patterns.ts` — single module. Public exports that
  MUST stay importable unchanged (consumers reach them via `@iching/core`, which
  re-exports from this module): `computeJournalPatterns`, `entryTimeKey`,
  `compareEntryTime`, `phaseOfHour`, `PHASE_MIN_TIMESTAMPED`, and all exported
  result types (`JournalPatterns`, `CadenceSummary`, and the rest — enumerate
  them by reading the file's `export` lines before you start).
- `packages/core/src/index.ts` re-exports from `./journal/patterns.js`. Confirm
  the exact specifier; the goal is to NOT have to change it.
- The guard test: `packages/core/src/__tests__/journal-patterns.test.ts` (~1279
  suite includes it) asserts `computeJournalPatterns` output across totals,
  cadence, diversity, distribution, comparisons, and order-independence. It is
  the characterization test for this refactor — it must stay green at every step.

Internal function groups visible in the file (verify by reading):
- Distribution: hexagram frequency, trigram frequency, moving-line counts, phase-of-day.
- Cadence: `computeCadence`, `dayOrdinal`, `median`, gaps/idle.
- Diversity: entropy, concentration, expected-distinct/repeats.
- Structure: Hamming distance, structural echoes / locked pairs, transitions.
- Comparison helpers: `comparison`/lift/expected, formatting of comparison blocks.
- Time: `entryTimeKey`, `compareEntryTime`, `phaseOfHour`, `PHASE_MIN_TIMESTAMPED`.

Repo convention: ESM `.js` import specifiers in source; modules grouped under
`packages/core/src/journal/`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Guard test | `bun test packages/core/src/__tests__/journal-patterns.test.ts` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests (all) | `bun run test` | all pass |
| Build + smoke | `bun run build && bun run smoke` | `5 passed, 0 failed` |

## Scope

**In scope:**
- `packages/core/src/journal/patterns/*.ts` (create the concern modules).
- `packages/core/src/journal/patterns.ts` (becomes the orchestrator + barrel that re-exports the public surface).

**Out of scope (do NOT touch):**
- `packages/core/src/index.ts` — keep its `./journal/patterns.js` re-export working unchanged. If your approach would force changing it, you chose the wrong layout (keep `patterns.ts` as the entry).
- `journal-scene.ts` and any TUI code — separate follow-up.
- Any change to function logic, signatures, or output shape — this is a MOVE-only refactor. No "while I'm here" fixes.
- The `comparison`/expected math — moving it is fine; changing it is not.

## Git workflow

- Current branch; Conventional Commits, e.g. `refactor(core): split patterns.ts into concern modules`; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` via `git commit -F -`.
- Commit per concern-move (so a regression bisects to one move).

## Steps

Layout: keep `patterns.ts` as the public entry. Move each concern's pure helpers
into a sibling file under `journal/patterns/`, have `patterns.ts` import them,
and re-export anything that was part of the public surface. After ALL moves,
`patterns.ts` holds `computeJournalPatterns` (the orchestrator) plus re-exports.

### Step 1: Extract the comparison helpers (no public surface)

Move `comparison`/lift/expected helpers to `packages/core/src/journal/patterns/comparison.ts`.
Import them back into `patterns.ts`. These are internal — no re-export needed.

**Verify**: `bun test packages/core/src/__tests__/journal-patterns.test.ts` → all pass.

### Step 2: Extract cadence

Move `computeCadence`, `dayOrdinal`, `median`, and cadence-only helpers to
`patterns/cadence.ts`. `patterns.ts` imports `computeCadence`.

**Verify**: guard test → all pass.

### Step 3: Extract diversity

Move entropy/concentration/expected-distinct/repeats to `patterns/diversity.ts`.

**Verify**: guard test → all pass.

### Step 4: Extract distribution

Move hexagram/trigram/moving-line/phase-of-day frequency builders to
`patterns/distribution.ts`. Note: `phaseOfHour` and `PHASE_MIN_TIMESTAMPED` are
PUBLIC — re-export them from `patterns.ts`.

**Verify**: guard test → all pass.

### Step 5: Extract structure + time

Move Hamming distance, structural echoes, transitions to `patterns/structure.ts`.
Move `entryTimeKey`, `compareEntryTime` to `patterns/time.ts` — both are PUBLIC,
re-export from `patterns.ts`.

**Verify**: guard test → all pass.

### Step 6: Confirm the public surface is intact

`patterns.ts` now contains `computeJournalPatterns` + re-exports. Confirm every
name from "Current state" is still exported from `patterns.ts` (and thus from
`@iching/core`):

**Verify**:
- `bun run typecheck` → exit 0 (any missing re-export breaks a consumer here)
- `bun run test` → all pass
- `bun run build && bun run smoke` → `5 passed, 0 failed`
- `grep -n "export" packages/core/src/journal/patterns.ts` shows the same public names as before (compare against `git show 88d08aeb:packages/core/src/journal/patterns.ts | grep -n "export"`).

## Test plan

No new behavior, so the existing `journal-patterns.test.ts` is the guard — it
must stay green at every step. OPTIONALLY, now that concerns are separable, add
one focused unit test per new module that calls its functions directly with a
small fixture (e.g. `cadence.test.ts` asserting `computeCadence` on a 3-entry
fixture) — but only if it adds signal beyond the integration test; do not pad.

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun run test` exits 0 (the journal-patterns integration test unchanged and green)
- [ ] `bun run build && bun run smoke` → `5 passed, 0 failed`
- [ ] `packages/core/src/index.ts` is unchanged
- [ ] The public export names from `patterns.ts` match commit `88d08aeb` (diff the `export` lines)
- [ ] `packages/core/src/journal/patterns.ts` is materially smaller (orchestrator + re-exports); the concern modules exist under `patterns/`
- [ ] No function logic changed (a reviewer reading the diff sees moves + imports, not edits)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The guard test fails after a move and the cause isn't an obvious import/re-export slip — STOP; a logic change crept in.
- A move would require changing a function's signature or `index.ts` — STOP; the layout is wrong (keep `patterns.ts` as the entry barrel).
- You find yourself "improving" a function while moving it — STOP; that's a separate change, not this refactor.

## Maintenance notes

- The public surface is `patterns.ts`; new analyses go in the relevant concern module and, if public, get re-exported there.
- `journal-scene.ts` is the remaining god-module (higher risk, stateful) — a separate plan; the patterns-pane renderer is its natural first extraction, ideally after characterization tests for the scene exist.
- A reviewer should diff the `export` lines of `patterns.ts` against the pre-refactor commit to confirm the public API is byte-for-byte preserved.
