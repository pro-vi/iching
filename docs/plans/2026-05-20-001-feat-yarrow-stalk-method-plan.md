---
title: Yarrow Stalk Casting Method
type: feat
status: completed
date: 2026-05-20
origin: docs/vision/yarrow-ritual-vision.md
---

# Yarrow Stalk Casting Method — Implementation Blueprint

Implements the design in [Yarrow Ritual Vision](../vision/yarrow-ritual-vision.md):
a faithful 49-stalk casting method rendered as a braille-field ritual, joining
the existing cast flow as a third method alongside coin auto/manual.

## Requirements Traceability

Derived from the vision doc; units cite these R-IDs.

- **R1** — Faithful 49-stalk simulation producing the asymmetric distribution (1/16 : 5/16 : 7/16 : 3/16), validated empirically.
- **R2** — An immutable ritual transcript drives the animation as a pure replay.
- **R3** — Braille-field terminal vocabulary: a stalk is a dot, a four is a dot-column, a cell is two fours.
- **R4** — Seven-beat round choreography (gather/divide/takeOne/count/tally/carry) plus the `fuse` move where the remainder becomes the line.
- **R5** — Two-axis pacing: `MotionPreset` (motion) and `RitualDetail` (count granularity); no non-`reduced` mode hides the counting.
- **R6** — Teach-once-then-compress; pace control (play/pause, speed, beat-step).
- **R7** — Reveal bridge; hand the finished `Cast` to `CastScene` with `skipLineDrawing`.
- **R8** — Cast-method configuration and menu/settings integration.

## Architecture Decision

**Approach:** Mirror the coin-cast architecture exactly. A pure-core simulation
in `@iching/core` emits an immutable transcript plus a `Cast`. A new
`YarrowScene` in `@iching/terminal` — modeled structurally on `TossScene` — owns
the ritual animation and the six line draws, composed entirely with the existing
timeline DSL (`seq`/`par`/`wait`/`call`/`tween`). On completion it emits a
`yarrowCompleted` `SceneSignal` carrying the `Cast`; `reading-flow.ts` routes it
into `CastScene` with `skipLineDrawing: true` — the identical handoff the manual
toss path already uses. Pacing is two separated axes: the existing `MotionPreset`
(motion) and a new internal `RitualDetail` (count granularity), with one public
knob (`motion`) mapping to both.

**Rationale:** Consistency criterion. `TossScene → tossCompleted → reading-flow →
CastScene{skipLineDrawing}` is a working precedent for exactly this shape — an
interactive scene that draws its own six lines, then hands a `Cast` to the shared
reveal. `reading-flow.ts:1-7` documents the extension contract verbatim. Nothing
about the existing flow needs to change structurally.

**Trade-offs:** `YarrowScene` is timeline-DSL-driven (deterministic choreography
replayed from a precomputed transcript) rather than frame-stepped physics like
`TossScene` — a deliberate divergence because yarrow has no physics, and it buys
`fastForward`/`skipToComplete` for free. We accept a new `YarrowTiming` /
`RitualDetail` surface in the animation package rather than overloading
`RitualTiming`, whose coin-specific fields do not apply.

## High-Level Technical Design

Directional only — for review, not implementation specification.

```
buildYarrowTimeline(transcript, model, timing, detail)
  → { timeline: Step, beatOffsets: number[] }

timeline = seq(
  for each of 6 lineResults:
    seq(
      for each of 3 rounds:
        seq( gather, divide, takeOne,
             count(  par(countLeft, countRight)  ),   // granularity = effectiveDetail
             tally, carry ),
      fuse(line),                       // remainder rises into the hexagram line
      lineIndex === 2 ? trigramBeat : ∅ // preserve the existing after-line-3 pause
    ),
  revealBridgeBeat                      // hold the finished figure before handoff
)

effectiveDetail(lineIndex, detail) = lineIndex === 0 ? "expanded" : detail
                                     // teach-once: first line always full
```

`beatOffsets` are cumulative beat-end timestamps (from `stepDuration`), enabling
beat-accurate stepping in pace control without DSL changes.

## Implementation Units

### U1. Core yarrow simulation

- **Goal:** Faithful 49-stalk casting in `@iching/core` producing a `Cast` plus an immutable transcript.
- **Requirements:** R1, R2
- **Dependencies:** None
- **Files:**
  - Create: `packages/core/src/casting/yarrow.ts`
  - Modify: `packages/core/src/casting/cast.ts` (extract a shared `assembleCast(lines)` from `castHexagram`)
  - Modify: `packages/core/src/index.ts` (export the new function and types)
  - Test: `packages/core/src/casting/yarrow.test.ts`
- **Approach:** `castYarrowHexagram(source: RandomSource)` returns `{ cast, transcript }`. Per round: draw `splitAt ∈ [1, N-1]` from `source`, do the mod-4 counts (remainder 0 → 4), compute `setAside` and `remaining`. Three rounds per line; `line.value = remaining / 4`. Extract the lines→`Cast` derivation currently inline in `castHexagram` into `assembleCast(lines)` and call it from both functions — no duplicated nuclear/polarity/mirror/diagonal logic.
- **Patterns to follow:** `packages/core/src/casting/coins.ts:8` — `castLine` shape and `Line` construction; `packages/core/src/casting/cast.ts` — `castHexagram` derivation to extract; `packages/core/src/random.ts:4` — `RandomSource` interface.
- **Test scenarios:**
  - *Happy path:* `castYarrowHexagram(seeded)` → valid `Cast` (6 lines, `primary` 1-64) and a 6-entry transcript, each with 3 rounds.
  - *Distribution:* sample ≥100k lines; assert line-value frequencies converge to 1/16 : 5/16 : 7/16 : 3/16 within tolerance.
  - *Invariants:* round 1 `setAside ∈ {5,9}`; rounds 2-3 `setAside ∈ {4,8}`; `remaining === startCount - setAside`; final `remaining ∈ {24,28,32,36}` and `line.value === remaining/4`.
  - *Edge case:* `splitAt` always within `[1, N-1]` — no empty heap at any round.
  - *Determinism:* same `SeededRandomSource` seed → byte-identical transcript.
- **Verification:** Casting produces a correct `Cast`; the distribution test passes; the transcript is self-consistent (`remaining` chain holds across all 18 rounds). Invariant: the transcript is a complete function of the `RandomSource` draws and nothing else.

### U2. RitualDetail axis and yarrow timing presets

- **Goal:** Define the second pacing axis and per-preset timing for the ritual.
- **Requirements:** R5
- **Dependencies:** None
- **Files:**
  - Create: `packages/terminal/src/animation/yarrow-presets.ts`
  - Modify: `packages/terminal/src/index.ts` (export new types/helper)
  - Test: `packages/terminal/src/animation/yarrow-presets.test.ts`
- **Approach:** Define `RitualDetail = "expanded" | "summarized" | "stepped"` and a `YarrowTiming` interface (beat durations: gather/divide/takeOne/count-sweep/tally/carry/fuse, round gap, line settle). `getYarrowTiming(motion: MotionPreset)` returns `{ timing, detail }` — the motion→detail mapping lives here: `deep → expanded`, `default → summarized`, `brisk → stepped`, `reduced → stepped` with near-zero motion durations. One public knob (`motion`); the two axes stay separated internally per the vision doc.
- **Patterns to follow:** `packages/terminal/src/animation/presets.ts:3` — `RitualTiming` interface and the `PRESETS` record / `getPreset` shape.
- **Test scenarios:**
  - *Happy path:* `getYarrowTiming(p)` returns a populated `YarrowTiming` and a `RitualDetail` for each of the four presets.
  - *Edge case:* `reduced` yields near-zero motion durations (reduced motion, not reduced meaning — `stepped` detail still present).
- **Verification:** Each `MotionPreset` resolves to a coherent `(timing, detail)` pair; the deep→expanded … reduced→stepped mapping holds.

### U3. YarrowModel animation state

- **Goal:** A mutable model holding the transcript plus live ritual state.
- **Requirements:** R2, R4
- **Dependencies:** U1
- **Files:**
  - Create: `packages/terminal/src/scenes/yarrow/model.ts`
  - Test: `packages/terminal/src/scenes/yarrow/model.test.ts`
- **Approach:** `YarrowModel` holds the immutable transcript, the derived `Cast`, six `LineAnimState` (reuse the `cast/model.ts` type), and live ritual fields: active line/round index, current beat, the live left/right heap counts, `splitAt`, tray contents, fuse progress, `caption`, and pace state (paused, speed). Constructor seeds the field at 49 and the hexagram empty.
- **Patterns to follow:** `packages/terminal/src/scenes/cast/model.ts:18` — `CastModel` field layout and constructor pattern; reuse `LineAnimState` from `cast/model.ts:6`.
- **Test scenarios:**
  - *Happy path:* constructed from a transcript → active line 0, round 0, field count 49, all lines unsettled.
  - *Edge case:* transcript with all six lines changing → model still initializes; `cast` reference intact.
- **Verification:** The model exposes every field the renderer and timeline need; the transcript reference is read-only. Invariant: the transcript is never mutated after construction — the animation only writes to live state.

### U4. Braille field renderer

- **Goal:** Render the braille field, gap, tray, fuse, and the hexagram lines.
- **Requirements:** R3, R4
- **Dependencies:** U3
- **Files:**
  - Create: `packages/terminal/src/scenes/yarrow/field-renderer.ts`
  - Test: `packages/terminal/src/scenes/yarrow/field-renderer.test.ts`
- **Approach:** Draw the field as a contiguous braille strand whose width tracks the live count; render the `divide` gap, the parked `takeOne` dot, spent dots dimmed to `tertiary` and the remainder ramped to `accent`, and the tray clump. The `fuse` draws the hexagram line via the existing `renderLine`. Hexagram lines anchor with `anchorRow` / `LINE_ROW_OFFSETS`; the field occupies a band below. Narrow-terminal fallback: shorter strand or stacked field rather than overflow.
- **Patterns to follow:** `packages/terminal/src/scenes/cast/line-renderer.ts:20` — `renderLine`; `packages/terminal/src/scenes/cast/hexagram-renderer.ts:10,36` — `LINE_ROW_OFFSETS`, `anchorRow`; `packages/terminal/src/render/buffer.ts` — `writeText`; large-glyph code for braille-cell construction.
- **Test scenarios:**
  - *Happy path:* given a model mid-`count`, the buffer shows spent dots dimmed and the remainder in `accent`.
  - *Edge case:* full field (49) and minimal field (24) both render without overflow at 80 cols.
  - *Edge case:* width below the fallback threshold → fallback layout, no buffer overrun.
  - *Integration:* `fuse` state renders a completed hexagram line identical to what `renderLine` produces for that value.
- **Verification:** Every ritual state renders legibly within an 80×24 buffer and degrades gracefully when narrow; color carries live/spent/remainder.

### U5. Yarrow timeline builder

- **Goal:** Compose the full 18-round ritual from the transcript using the DSL.
- **Requirements:** R4, R5, R6
- **Dependencies:** U1, U2, U3
- **Files:**
  - Create: `packages/terminal/src/scenes/yarrow/yarrow-timeline.ts`
  - Test: `packages/terminal/src/scenes/yarrow/yarrow-timeline.test.ts`
- **Approach:** `buildYarrowTimeline(transcript, model, timing, detail)` returns `{ timeline, beatOffsets }`. Per the High-Level sketch: `seq` of 6 lines, each `seq` of 3 rounds, each round a `seq` of the seven beats with the two heap counts in `par`; a `fuse` beat after round 3; the existing after-line-3 trigram pause preserved; a closing reveal-bridge beat. `RitualDetail` switches the `count` beat — `expanded` peels groups one at a time, `summarized` sweeps batches, `stepped` is static before/after. Teach-once: line index 0 always uses `expanded` regardless of `detail`. `beatOffsets` accumulates beat-end timestamps via `stepDuration`.
- **Patterns to follow:** `packages/terminal/src/scenes/cast/timeline-builder.ts` — `buildCastTimeline`, `castOneLine`, the `par` stagger pattern, `buildMorphWave` stagger; `packages/terminal/src/animation/timeline.ts` — `seq`/`par`/`wait`/`call`/`tween`/`stepDuration`.
- **Test scenarios:**
  - *Happy path:* timeline duration > 0; `fastForward` lands the model with all six lines settled and values matching the transcript.
  - *Edge case:* `expanded` / `summarized` / `stepped` produce strictly different total durations; `reduced` timing is shortest.
  - *Edge case:* line 0 uses `expanded` even when `detail = "stepped"` (teach-once).
  - *Edge case:* `beatOffsets` is monotonically increasing; its length equals the total beat count.
  - *Integration:* advancing to each `beatOffsets[i]` leaves the model at a coherent beat boundary.
- **Verification:** The timeline replays the transcript exactly; `fastForward` is a faithful end-state; `beatOffsets` supports beat-accurate stepping.

### U6. YarrowScene

- **Goal:** The interactive scene — runs the ritual, handles pace control, emits the cast.
- **Requirements:** R6, R7
- **Dependencies:** U3, U4, U5
- **Files:**
  - Create: `packages/terminal/src/scenes/yarrow/yarrow-scene.ts`
  - Modify: `packages/terminal/src/scene/types.ts` (add `yarrowCompleted` to `SceneSignal`)
  - Modify: `packages/terminal/src/index.ts` (export `YarrowScene`)
  - Test: `packages/terminal/src/scenes/yarrow/yarrow-scene.test.ts`
- **Approach:** Implements `Scene`. On `enter`, call `castYarrowHexagram(new CryptoRandomSource())`, build the model and timeline. `update` advances a `TimelineRunner` by an elapsed value the scene controls — pace control modulates that: `space` toggles play/pause; while paused, advance to the next `beatOffsets` entry; a key cycles speed (1×/2×/4×). On completion emit `{ type: "yarrowCompleted", cast }`; `esc`/`q` before completion → `home` with no cast (mirror `TossScene`'s early-quit). Add a `skipToComplete` via `timeline.fastForward`. The closing reveal-bridge beat holds the finished figure before the signal fires.
- **Patterns to follow:** `packages/terminal/src/scenes/toss/toss-scene.ts` — `Scene` lifecycle, early-quit handling, `tossCompleted` emission; `packages/terminal/src/scenes/cast/cast-scene.ts:72,222` — `TimelineRunner` advance and `skipToComplete`.
- **Test scenarios:**
  - *Happy path:* run to completion → emits `yarrowCompleted` with a `Cast` equal to the transcript's derived cast.
  - *Edge case:* `esc` before completion → `home` signal, no cast emitted.
  - *Edge case:* pause halts model advance; resume continues; speed cycle changes advance rate.
  - *Error path:* `Ctrl+C` → `exit` signal at any point.
  - *Integration:* `skipToComplete` lands the same final model state as a full natural run.
- **Verification:** The scene produces a correct cast, honors pace control, and quits cleanly. Invariant: the cast is generated exactly once, at `enter` — the "moment of commitment".

### U7. Cast-flow and configuration wiring

- **Goal:** Make yarrow a selectable casting method end to end.
- **Requirements:** R7, R8
- **Dependencies:** U1, U6
- **Files:**
  - Modify: `apps/cli/src/app/reading-flow.ts` (add `{ type: "yarrow" }` `ReadingSource`; dispatch in the Obtain phase; `skipLineDrawing` for yarrow)
  - Modify: `apps/cli/src/main.ts` (`startCast` switch learns `castMode === "yarrow"`)
  - Modify: `apps/cli/src/commands/config.ts` (`castMode` schema gains `yarrow`)
  - Modify: `packages/storage/src/types.ts` (`castMode` union gains `"yarrow"`)
  - Modify: the settings scene (offer `yarrow` as a `castMode` value)
  - Test: `apps/cli/src/app/reading-flow.test.ts` (or the nearest existing flow test)
- **Approach:** Add `{ type: "yarrow" }` to `ReadingSource`. In the Obtain phase, branch alongside `manual`: construct `YarrowScene`, run it, require `yarrowCompleted` (else return `{ shouldExit: false }`, mirroring the toss early-quit guard at `reading-flow.ts:92`). Set `skipLineDrawing` for yarrow exactly as for manual — `const skipLineDrawing = isManual || isYarrow`. Extend `castMode` to `"auto" | "manual" | "yarrow"`; `main.ts` `startCast` selects the yarrow source when `castMode === "yarrow"`. The Persist phase needs no change (yarrow is unseeded, non-replay → journals and caches like manual).
- **Patterns to follow:** `apps/cli/src/app/reading-flow.ts:41,88-102,128-137` — the `ReadingSource` union, the Obtain branch, the `skipLineDrawing` handoff; the existing `castMode` schema entry in `config.ts`.
- **Test scenarios:**
  - *Happy path:* a `{ type: "yarrow" }` reading runs `YarrowScene`, persists to journal + cache, hands the cast to `CastScene` with `skipLineDrawing: true`.
  - *Edge case:* user quits `YarrowScene` early → flow returns `{ shouldExit: false }`, nothing persisted.
  - *Edge case:* `config set castMode yarrow` is accepted; `config get` reflects it.
  - *Integration:* `startCast` with saved `castMode === "yarrow"` reaches the yarrow ritual; `auto` and `manual` paths are unaffected.
- **Verification:** Yarrow is selectable via config and the settings menu; a yarrow cast persists and reveals identically to a coin cast from the reveal phase onward.

## Scope Boundaries

- No seeded/deterministic yarrow — `--seed` stays coin-`auto` only.
- No separate user-facing `RitualDetail` setting — it is derived from `motion`.
- No `castMode` → `castMethod` rename.
- No transcript persistence to the journal or JSON output.
- `bound` / `embodied` / `quantum-remote` entropy modes are out of scope (separate vision).

### Deferred to Follow-Up Work

- `castMode` → `castMethod` rename, and a possible method/pacing setting split: a separate PR, once a third method or that split is actually needed.
- Ritual-transcript provenance in the journal and `--json` output: future iteration, tracked as an open question in the vision doc.
- Switching `TossScene.buildCast` to the new core `assembleCast` helper: tangential cleanup, separate PR.

## System-Wide Impact

- **Interaction graph:** new `SceneSignal` variant `yarrowCompleted`, consumed only by `reading-flow.ts`. Any exhaustive `switch (signal.type)` over `SceneSignal` will fail typecheck until it handles the new case — treat the typecheck error as the checklist of call sites to update.
- **Error propagation:** `YarrowScene` can be abandoned before the ritual completes (like quitting the toss before six lines); the Obtain phase must guard on `yarrowCompleted` and return `{ shouldExit: false }` on anything else, so no partial cast reaches Persist.
- **State lifecycle risks:** none new — the transcript is locked at scene `enter`; persistence fires only after a complete `Cast`, through the unchanged shared Persist phase.
- **API surface parity:** every `castMode` consumer must learn `yarrow` — `storage/types.ts`, `config.ts` schema, `main.ts` `startCast`, and the settings scene. U7 covers all four.
- **Unchanged invariants:** the coin `auto` and `manual` paths, the post-cast reveal phase (glow/glyph/morph/exploration), and the Persist/cache logic are explicitly unchanged — yarrow reuses them as-is.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A uniform `splitAt` may not yield the exact textbook distribution | U1's distribution test is the gate; if it deviates, the fix is the split-point model, not the animation |
| Braille rendering varies by terminal font | Already accepted — large-glyph rendering uses braille; U4 adds a narrow-width fallback |
| Many moving cells stress the diff renderer | U4/U5 animate bundles and dot-columns, not per-dot sprites |
| 18 near-identical rounds feel monotonous | Teach-once-then-compress, pace control, and the visibly shrinking field (U5/U6) |
| Total runtime too long for daily use | Two-axis pacing — `MotionPreset` × `RitualDetail` (U2/U5) |
