# Durable Recovery

**Core principle.** The journal (`history.jsonl`) is the durable, append-only
**source of truth** for readings. The daily cache (`daily-cache.json`) and a
reflection note's `ref` are *lossy mirrors / pointers* into it. Every surface
that shows "today's reading", "a day's reading", or attaches a note must agree
with the journal — and must keep working when the mirror is missing, stale, or
corrupt.

This note names the three invariants that keep those surfaces consistent, the
sites each governs, and the test/code that anchors it. It exists because the
same class of bug recurred one site at a time (a cache-only `today`, a bare-date
note ref, a time-key-only list sort): fix the *invariant*, not the instance.

When you touch any read/recovery path, check it against the relevant section
below before merging.

---

## INV-1 — Durable source

> Any surface presenting *today's reading* (or *a day's reading*) resolves it
> from the journal when the daily cache is absent, stale, or quarantined. The
> cache is a fast mirror, never the source of truth.

**Why it bites.** A successful journal append can outlive its cache write — the
cache may never be written, may hold yesterday's reading after a midnight
rollover, or may have been quarantined as corrupt — while `history.jsonl` still
holds today's cast. A cache-only reader then claims "no reading yet" (or hides
the reopen affordance) over a real reading.

**The one resolver.** `apps/cli/src/util/today-cache.ts` → `resolveTodayReading(cacheStore, journal, today)`:
cache-first, journal-fallback (`journal.latest()`), rebuilding the display
`structure` from the recovered cast and marking it `shown`. Best-effort: a
blocked data dir resolves to `null` (the caller's calm "no reading yet" state),
never a crash. **Every pure "today" reader must use this resolver**, not read
the cache directly.

| Site | Status | Notes |
|---|---|---|
| TUI home `[t]` + `openToday` (`apps/cli/src/main.ts`) | ✅ uses `resolveTodayReading` | affordance survives a cache loss |
| `iching today` (`apps/cli/src/commands/today.ts`) | ✅ uses `resolveTodayReading` | plain + `--json` |
| Hook (`apps/cli/src/hook/adapter.ts`) | ✅ reference reconciler | a *read-modify-write*, not a pure read: it distinguishes cache-hit / journal-recovery / fresh-cast because each has different persistence (recovery must NOT re-append a duplicate, then re-writes the cache). Keeps its own branching by design; shares the principle, not the helper. |

On a successful journal recovery the resolver **re-warms the cache** (writes the
rebuilt record back, best-effort) so the next read — the home loop every
iteration, or `iching today` from a shell greeting on every prompt — hits the
mirror instead of re-scanning the journal.

**Documented exception — seeded casts.** A `--seed` cast (deterministic replay /
sandbox) writes the daily cache (`shown:true`, `rng.source:"seed"`) but
deliberately SKIPS the journal append (`apps/cli/src/app/reading-flow.ts`:
`if (!usedSeed)` guards only the journal write) — a reproducible replay must not
pollute the durable record of genuine castings. So a seeded reading is the day's
*cache* but is **not** journal-recoverable: lose the cache and
`resolveTodayReading` correctly reports "no reading yet" rather than resurrecting
a synthetic cast. The journal stays the source of truth for *real* readings;
seeded casts are intentionally ephemeral.

**Anchor.** `apps/cli/src/__tests__/today-cache.test.ts` (resolver unit: cache
hit / stale / missing / journal recovery / journal-not-today / read failure /
cache re-warm), `apps/cli/src/__tests__/today-command.test.ts` (end-to-end
recovery, plain + `--json`), and the hook's journal-recovery path in
`apps/cli/src/__tests__/` hook tests.

---

## INV-2 — Precise reference

> A reflection note's `ref` uniquely identifies the exact reading it annotates,
> and every reader resolves that `ref` to the same reading the writer intended —
> across CLI and TUI.

**Why it bites.** Legacy timestamp-less readings on one day share a date key. A
note saved with the bare date resolves — in the TUI's `loadEntriesWithNotes` —
to the day's *last-appended* cast, so the note surfaces on a different reading
than the writer chose.

**The contract.** `packages/storage/src/journal-query.ts`:
- `entryNoteRef(entry)` — the durable pointer: the timestamp, or for a legacy
  reading a content key `date#primary.becoming.changing`. **Every note writer
  uses this.**
- `loadEntriesWithNotes` (TUI) indexes entries by `entryNoteRef` (+ a bare-date
  key for pre-content-ref notes, which still land on the day's last cast).
- `noteMatchesEntry` (CLI `journal show`) matches the precise ref OR the bare
  `timestamp ?? date`, so old plain-date notes keep attaching.

| Site | Status |
|---|---|
| TUI note write (`apps/cli/src/app/scene-factories.ts`) | ✅ `entryNoteRef(entry)` |
| CLI `note --date` / `note` (`apps/cli/src/commands/journal.ts`) | ✅ `entryNoteRef(target)` |

**Scope — the guarantee is for app-written notes.** Every note the app writes
carries a precise ref (`entryNoteRef`: timestamp, or a content key for a legacy
timestamp-less reading), so it resolves identically in both readers. A *legacy /
hand-edited BARE-DATE* ref (which the app never emits) is the one residual edge:
on a multi-reading timestamp-less day the TUI's `loadEntriesWithNotes` attaches it
to the day's LAST-appended cast, while the CLI's `journal show <date>` matches it
against the comparator-MAX cast it displays — different readings. Bounded and
accepted: the app produces no bare-date refs, so this only affects manually-edited
`notes.jsonl`. (To close it fully, `loadEntriesWithNotes`'s bare-date fallback
would select the `compareEntryTime`-max for the date instead of the last-appended.)

**Anchor.** `packages/storage/src/__tests__/journal-query.test.ts` (distinct
refs by content; resolution), and the legacy-multi-reading test in
`apps/cli/src/__tests__/journal-command.test.ts` (asserts the written ref is the
precise content key and `loadEntriesWithNotes` attaches it to the
comparator-selected cast, not the last-appended one).

---

## INV-3 — Consistent recency

> All surfaces selecting *newest* / *a day's reading* order by the same
> comparator (`compareEntryTime`), so they agree on a tied instant.

**Why it bites.** Two same-day undated readings share an `entryTimeKey`. A
time-key-only sort breaks the tie by append order (stable sort); the patterns
pane breaks it by cast content. The list's top row and the pane's ◉ recency
accent then disagree on "the most recent".

**The comparator.** `packages/core/src/journal/patterns/time.ts` →
`compareEntryTime` (time-key, then cast content). Exported from `@iching/core`.

| Site | Status |
|---|---|
| TUI journal list sort (`packages/terminal/src/scenes/journal/journal-scene.ts`) | ✅ `compareEntryTime` |
| `journal list` sort; `journal show <date>`; `note --date` (`apps/cli/src/commands/journal.ts`) | ✅ `compareEntryTime` |
| Patterns pane recency / transitions / drift (`packages/core/src/journal/patterns.ts`) | ✅ `compareEntryTime` |
| `store.latest()` (`journal show latest`, `note`, hook + `today` recovery) | ⚠️ **accepted-risk**: a tail-read (last *appended* entry), NOT the `compareEntryTime`-max. The app always appends in cast order, so for app-written journals the two coincide; they diverge only on an externally reordered/imported journal. Documented at `packages/storage/src/journal-store.ts` (`latest()`); the cheap tail-read is kept deliberately. |

**Anchor.** The tied-instant cross-surface test in
`packages/terminal/src/__tests__/journal-scene.test.ts` (list top row == pane
recency), and `packages/core/src/__tests__/journal-patterns.test.ts`.

---

## Reviewer checklist

- **Reading the daily cache?** Don't treat it as the source — go through
  `resolveTodayReading`, or justify why this path is exempt (INV-1).
- **Writing a reflection note?** Use `entryNoteRef(entry)` for the `ref`, never
  a bare date (INV-2).
- **Selecting "newest" / "a day's reading"?** Use `compareEntryTime`; if you
  reach for `store.latest()`, confirm append-order semantics are what you want
  and note the accepted-risk (INV-3).
- **New read surface?** Add it to the table in the matching section, with its
  anchor test.
