// YarrowAutoPreview / YarrowManualPreview — settings-scene cast previews.
//
// Same shape as cast/coin-renderer.ts's CoinAutoPreview: each preview owns
// its own model + runner + state, exposes a public `step(dt)`, and surfaces
// the bits the caller needs to render (model for both; apertureLeft + phase
// for manual's aperture overlay).

import {
  castYarrowHexagram,
  castYarrowRound,
  CryptoRandomSource,
  SeededRandomSource,
  type YarrowRound,
} from "@iching/core";
import { TimelineRunner } from "../../animation/runner.ts";
import { seq } from "../../animation/timeline.ts";
import { getYarrowTiming } from "../../animation/yarrow-presets.ts";
import { bounceAperture } from "./field-renderer.ts";
import { YarrowModel } from "./model.ts";
import { buildYarrowRoundBeats } from "./yarrow-timeline.ts";

// ── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_SEED = 42;                   // round-0 split 24|25 — balanced
const AUTO_GAP_MS = 800;                   // quiet hold between auto loop iterations
const SWEEP_INTERVAL_MS = 150;             // ms per cell of aperture travel
const SWEEP_MIN_MS = 1800;                 // shortest sweep before snap
const SWEEP_MAX_MS = 3600;                 // longest sweep before snap
const SNAP_HOLD_MS = 500;                  // frozen aperture between snap and play
const APERTURE_WIDTH = 4;
const STALKS = 49;
const APERTURE_MAX = STALKS - APERTURE_WIDTH;

// ── Shared setup ─────────────────────────────────────────────────────────────

function newRoundRunner(model: YarrowModel, round: YarrowRound): TimelineRunner {
  const { timing } = getYarrowTiming("default");
  // Always animate line 0 / round 0 — pedagogically clearest. No captions:
  // chrome isn't drawn around the preview strip, so any caption write would
  // land in a row we don't own.
  const beats = buildYarrowRoundBeats(model, timing, "expanded", 0, 0, round, { narrating: false });
  return new TimelineRunner(seq(...beats));
}

// ── Auto preview ─────────────────────────────────────────────────────────────

export class YarrowAutoPreview {
  readonly model: YarrowModel;
  private runner: TimelineRunner;
  private elapsed = 0;

  constructor() {
    this.model = new YarrowModel(castYarrowHexagram(new SeededRandomSource(PREVIEW_SEED)));
    this.runner = newRoundRunner(this.model, this.model.transcript[0].rounds[0]);
  }

  step(dt: number): void {
    this.elapsed += dt;
    const done = this.runner.advance(this.elapsed, this.model);
    if (!done) return;
    if (this.elapsed >= this.runner.duration + AUTO_GAP_MS) {
      this.model.resetActiveLine(0, STALKS);
      this.runner.reset();
      this.elapsed = 0;
    }
  }
}

// ── Manual preview ───────────────────────────────────────────────────────────

export type ManualPreviewPhase = "sweeping" | "snapping" | "playing";

export class YarrowManualPreview {
  readonly model: YarrowModel;
  phase: ManualPreviewPhase = "sweeping";
  apertureLeft = 1;

  private runner: TimelineRunner;
  private elapsed = 0;
  private sweepDir: 1 | -1 = 1;
  private sweepAccumMs = 0;
  private sweepBudgetMs = 0;
  private snapHoldMs = 0;

  constructor() {
    this.model = new YarrowModel(castYarrowHexagram(new SeededRandomSource(PREVIEW_SEED)));
    this.runner = newRoundRunner(this.model, this.model.transcript[0].rounds[0]);
    this.model.resetActiveLine(0, STALKS);
    this.resetSweepState();
  }

  step(dt: number): void {
    switch (this.phase) {
      case "sweeping":
        this.sweepAccumMs += dt;
        while (this.sweepAccumMs >= SWEEP_INTERVAL_MS) {
          this.sweepAccumMs -= SWEEP_INTERVAL_MS;
          this.advanceAperture();
        }
        this.sweepBudgetMs -= dt;
        if (this.sweepBudgetMs <= 0) {
          this.phase = "snapping";
          this.snapHoldMs = 0;
        }
        return;
      case "snapping":
        this.snapHoldMs += dt;
        if (this.snapHoldMs >= SNAP_HOLD_MS) this.commitCut();
        return;
      case "playing": {
        this.elapsed += dt;
        const done = this.runner.advance(this.elapsed, this.model);
        if (!done) return;
        if (this.elapsed >= this.runner.duration + AUTO_GAP_MS) {
          this.model.resetActiveLine(0, STALKS);
          this.resetSweepState();
        }
        return;
      }
    }
  }

  /** Pick a uniform-random k inside the current aperture, build a fresh
   *  round, hand it to a new runner — so the played math matches the cut. */
  private commitCut(): void {
    const left = Math.max(1, Math.min(APERTURE_MAX, this.apertureLeft));
    const k = left + Math.floor(Math.random() * APERTURE_WIDTH);
    const round = castYarrowRound(new CryptoRandomSource(), STALKS, { splitAt: k });
    this.model.transcript[0].rounds[0] = round;
    this.model.resetActiveLine(0, STALKS);
    this.runner = newRoundRunner(this.model, round);
    this.elapsed = 0;
    this.phase = "playing";
  }

  private resetSweepState(): void {
    this.phase = "sweeping";
    this.apertureLeft = 1;
    this.sweepDir = 1;
    this.sweepAccumMs = 0;
    this.snapHoldMs = 0;
    this.sweepBudgetMs = SWEEP_MIN_MS + Math.random() * (SWEEP_MAX_MS - SWEEP_MIN_MS);
  }

  private advanceAperture(): void {
    [this.apertureLeft, this.sweepDir] = bounceAperture(
      this.apertureLeft, this.sweepDir, 1, APERTURE_MAX,
    );
  }
}
