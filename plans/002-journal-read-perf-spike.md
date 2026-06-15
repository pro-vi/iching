# Plan 002: Benchmark the journal read path at scale and decide on the integrity-check cost

> **Executor instructions**: This is a SPIKE — its product is a measurement and
> a recorded decision, NOT a refactor. Do the benchmark, record the numbers,
> and only proceed to the optional Step 4 refactor if the numbers cross the
> stated budget. Honor the STOP conditions. When done, update this plan's row in
> `plans/README.md` with the measured numbers.
>
> **Drift check (run first)**: `git diff --stat 88d08aeb..HEAD -- packages/storage/src/json/cast-shape.ts packages/storage/src/json/jsonl-journal.ts`
> If either changed since this plan was written, re-read them before trusting the
> excerpts below.

## Status

- **Priority**: P3
- **Effort**: S (spike); the optional refactor in Step 4 is M
- **Risk**: LOW (spike adds a script + a doc; the optional refactor is gated)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `88d08aeb`, 2026-06-15

## Why this matters

The journal read path re-derives every cast to verify integrity. On every
FULL-stream read (`journal list` / `patterns` / `show`), `parseLine` →
`isCastShaped` → `assembleCast` reconstructs each entry's primary, becoming, and
four derived hexagrams from its lines and compares them to the stored values.
That integrity check is valuable (it rejects hand-edited/imported casts that
would render a false reading), but its cost grows with the journal. A prior
synthetic measurement put it at ~22ms for 10k entries and ~78ms for 50k —
acceptable today, but unmeasured past that, and the journal only grows. This
spike replaces the rough estimate with a real, repeatable number and a recorded
budget, so the decision to optimize (or not) rests on data, not vibes. The
`/perf` lens's rule applies to its own finding: anchor it with a measurement.

Important scope fact, already confirmed by reading the code: the per-shell-prompt
hook is NOT on this path. `JsonlJournalStore.latest()` (`jsonl-journal.ts:203`)
reads the file but walks backward and returns on the first valid line, so it
validates only the tail. This spike is about explicit, infrequent commands.

## Current state

- `packages/storage/src/json/jsonl-journal.ts:26` — `parseLine` validates each line via `isCastShaped`:
  ```ts
  if (!isCastShaped(record.cast)) return { type: "torn" };
  ```
  and `stream()` (line 129) calls `parseLine` for every line.
- `packages/storage/src/json/cast-shape.ts` — `isCastShaped` ends by reconstructing and comparing:
  ```ts
  const derived = assembleCast(cast.lines as Line[]);
  return (
    cast.primary === derived.primary &&
    cast.becoming === derived.becoming &&
    cast.nuclear === derived.nuclear &&
    cast.polarity === derived.polarity &&
    cast.mirror === derived.mirror &&
    cast.diagonal === derived.diagonal
  );
  ```
- `packages/core/src/casting/cast.ts:15` — `assembleCast(lines)` does `linesToBinary` + `nuclear` + `polarity` + `mirror` + `diagonal` per call.
- Build/bench precedent: standalone scripts live in `scripts/` and run with `bun scripts/<name>.ts` (see `scripts/smoke-test.ts`, `scripts/build.ts`). There is no existing benchmark script.
- A consistent cast for synthetic data is cheapest via `castHexagram(new SeededRandomSource(n))` (both exported from `@iching/core`) — every produced cast is internally consistent, so it streams back without being torn.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Run the bench | `bun scripts/bench-journal-read.ts` | prints a timing table, exit 0 |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun run test` | all pass (only if you do Step 4) |

## Scope

**In scope:**
- `scripts/bench-journal-read.ts` (create) — the benchmark harness.
- `plans/002-journal-read-perf-spike.md` (this file) — record the numbers + decision in the status row.
- ONLY IF Step 4 is triggered: `packages/storage/src/json/jsonl-journal.ts`, `packages/storage/src/json/cast-shape.ts`, and their tests.

**Out of scope (do NOT touch):**
- `assembleCast` and the derivation functions in `packages/core` — they are correct and used in production casting; do not "optimize" them here.
- The hook path (`apps/cli/src/hook/adapter.ts`) — not on this read path.

## Git workflow

- Current branch; Conventional Commits; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` via `git commit -F -`.
- Commit the bench script even if Step 4 is not triggered — a repeatable bench is the durable artifact.

## Steps

### Step 1: Write the benchmark harness

Create `scripts/bench-journal-read.ts`. It must, for each size in
`[1_000, 10_000, 50_000, 100_000]`:
1. Generate that many consistent casts via `castHexagram(new SeededRandomSource(i))` and write them as JSONL `HistoryEntry` lines to a temp file (use `node:os` tmpdir + `node:fs`), each `{ date, cast, timestamp }` with a synthetic date.
2. Construct a `JsonlJournalStore` over that file and time a full drain: `for await (const _ of store.stream()) {}`. Time it with `performance.now()` (NOT `Date.now()`), averaged over 3 runs after one warm-up run.
3. Print a row: `<N> entries: <ms> ms (<µs/entry>)`.
Clean up temp files at the end.

**Verify**: `bun scripts/bench-journal-read.ts` → prints four rows, exit 0.

### Step 2: Record the numbers

Write the measured table into this plan's status row in `plans/README.md`
(replace the placeholder there). Note the machine if it's not the dev machine.

### Step 3: Decide against the budget

Budget: **a full-stream command should stay under ~150ms at the realistic
ceiling.** Realistic ceiling = a committed daily user over a decade ≈ 4k
entries; an extreme power user ≈ 50k.

- If `stream()` at 50k is **under ~150ms** → verdict **Acceptable**. Record it,
  commit the bench script, and STOP. Do not do Step 4. (The prior estimate
  suggests this is the likely outcome.)
- If `stream()` at 50k is **over ~150ms**, or grows clearly super-linearly →
  proceed to Step 4.

### Step 4 (ONLY IF triggered): Split shape-validation from derivation-integrity

Goal: keep a cheap structural check on every read; make the expensive
reconstruct-and-compare opt-in.

1. In `cast-shape.ts`, split `isCastShaped` into two exports: `isCastShaped`
   (everything UP TO but NOT INCLUDING the `assembleCast` reconstruct — i.e.
   field ranges, line/value consistency, changingPositions-matches-lines) and a
   new `isCastDerivationConsistent(cast)` (the `assembleCast` compare).
2. In `jsonl-journal.ts`, `parseLine` keeps calling the cheap `isCastShaped`.
   Add an opt-in deep check used only where integrity matters most: the
   `doctor` command and the import path (if one exists). The hot read path no
   longer re-derives.
3. Preserve the existing test "a cast whose primary/becoming/derived disagree
   with its lines is torn" by moving its expectation behind the deep check (e.g.
   `doctor` flags it), and add a fast-path test that the cheap `isCastShaped`
   still rejects shape/line-consistency violations.

**Verify**: `bun run test` → all pass; `bun scripts/bench-journal-read.ts`
shows `stream()` at 50k now under budget.

## Test plan

- Spike-only (Steps 1–3): no new unit tests; the bench script IS the artifact.
- If Step 4 runs: keep every existing `cast-shape` / `jsonl-journal` test green;
  add a test that the cheap `isCastShaped` rejects a value/isYang mismatch and a
  changingPositions/lines mismatch (these stay on the fast path), and a test
  that `isCastDerivationConsistent` catches a primary/derived lie. Model after
  `packages/storage/src/__tests__/journal-store.test.ts`.

## Done criteria

- [ ] `scripts/bench-journal-read.ts` exists and runs (`bun scripts/bench-journal-read.ts` exits 0 with four rows)
- [ ] The measured table is recorded in `plans/README.md`
- [ ] A verdict (Acceptable / refactored) is recorded with the 50k number
- [ ] If Step 4 ran: `bun run test` exits 0 and the integrity behavior is preserved (via the deep check) — otherwise Step 4 was correctly skipped
- [ ] `plans/README.md` status row updated

## STOP conditions

- The bench shows wildly different numbers from the ~22ms/10k prior estimate (e.g. 10× higher) — stop and report; the discrepancy itself is the finding, and the cause (GC, I/O, a regression) should be understood before any refactor.
- Step 4 would require changing `assembleCast` or any `packages/core` derivation — out of scope; report instead.
- Removing the per-read reconstruct would leave NO path that catches a primary/derived lie — do not weaken the guarantee without relocating it (doctor/import). If you can't find a home for the deep check, STOP and report.

## Maintenance notes

- Re-run the bench after any change to `assembleCast`, `isCastShaped`, or the JSONL parse path.
- The decision recorded here is scale-relative: if journals routinely exceed the ceiling measured, revisit Step 4.
- The integrity guarantee (a stored cast can't lie about its hexagram) is the thing to protect across any optimization — speed is secondary to never rendering a false reading.
