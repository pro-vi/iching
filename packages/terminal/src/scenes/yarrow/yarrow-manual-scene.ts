// YarrowManualScene — H6 sweep-and-snap manual yarrow.
//
// Six cuts, one per line. Each cut is a sweeping-aperture gesture: a 4-stalk
// wide highlight scans across the pile (bouncing L↔R); the user presses
// Space to snap-commit the aperture's current position. The system then
// picks a uniform-random k from the 4 stalks under the aperture and uses
// it as round 1's splitAt for that line; rounds 2-3 stay RNG.
//
// The 4-stalk width is load-bearing: every consecutive 4-stalk window
// contains exactly one k where k % 4 === 0 (round-1 setAside = 9) and
// three where it isn't (setAside = 5). So the user authors WHERE to cut
// (which region of the bundle), but the system preserves the textbook
// 1:3 ratio at the modulo level. "I cut around here," not "I picked 24."

import {
  castYarrowLine,
  CryptoRandomSource,
  type RandomSource,
} from "@iching/core";
import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { MotionPreset } from "../../animation/presets.ts";
import { getYarrowTiming } from "../../animation/yarrow-presets.ts";
import type { YarrowTiming, RitualDetail } from "../../animation/yarrow-presets.ts";
import { TimelineRunner } from "../../animation/runner.ts";
import { seq } from "../../animation/timeline.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { YarrowModel } from "./model.ts";
import {
  renderYarrowField,
  yarrowFieldGeometry,
  drawApertureCursor,
} from "./field-renderer.ts";
import { buildYarrowFullLineBeats } from "./yarrow-timeline.ts";

const LINES = 6;
const APERTURE_WIDTH = 4;
const APERTURE_MIN = 1;                  // leftmost apertureLeft
const APERTURE_MAX = 48 - APERTURE_WIDTH + 1; // = 45; covers k ∈ [45, 48]
const SWEEP_INTERVAL_MS = 150;           // ms per cell of aperture travel
const SNAP_HOLD_MS = 250;                // brief beat after snap before round plays

type Phase = "gathering" | "sweeping" | "snapping" | "playing" | "complete";
type SweepDir = 1 | -1;

export class YarrowManualScene implements Scene {
  private readonly model: YarrowModel;
  private readonly source: RandomSource;
  private readonly timing: YarrowTiming;
  private readonly detail: RitualDetail;

  private phase: Phase = "gathering";
  private lineIdx = 0;
  private apertureLeft = APERTURE_MIN;
  private sweepDir: SweepDir = 1;
  private sweepAccumMs = 0;
  private snapHoldMs = 0;
  private committedK = 0;                // for tests / provenance
  private subRunner: TimelineRunner | null = null;
  private subElapsed = 0;

  constructor(motion: MotionPreset = "default", source?: RandomSource) {
    this.model = new YarrowModel(null);
    this.source = source ?? new CryptoRandomSource();
    const resolved = getYarrowTiming(motion);
    this.timing = resolved.timing;
    this.detail = resolved.detail;
  }

  enter(_ctx: SceneContext): void {
    this.model.resetActiveLine(this.lineIdx);
  }

  update(_elapsed: number, dt: number, _ctx: SceneContext): void {
    if (this.phase === "sweeping") {
      this.sweepAccumMs += dt;
      while (this.sweepAccumMs >= SWEEP_INTERVAL_MS) {
        this.sweepAccumMs -= SWEEP_INTERVAL_MS;
        this.advanceAperture();
      }
      return;
    }
    if (this.phase === "snapping") {
      this.snapHoldMs += dt;
      if (this.snapHoldMs >= SNAP_HOLD_MS) this.commitCut();
      return;
    }
    if (this.phase === "playing" && this.subRunner) {
      this.subElapsed += dt;
      const done = this.subRunner.advance(this.subElapsed, this.model);
      if (done) this.advanceToNextLine();
    }
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    renderYarrowField(frame, this.model);
    if (this.phase === "sweeping" || this.phase === "snapping") {
      const g = yarrowFieldGeometry(frame);
      drawApertureCursor(frame, g.fieldRow, g.center, this.apertureLeft, APERTURE_WIDTH);
    }
    this.renderFooter(frame);
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };

    if (key.type === "escape") {
      if (this.phase === "sweeping" || this.phase === "snapping") {
        // Cancel back to gathering for the same line.
        this.resetSweepState();
        this.phase = "gathering";
        return;
      }
      return { type: "home" };
    }

    if (key.type === "char" && key.char === "q") return { type: "home" };
    if (key.type !== "char" || key.char !== " ") return;

    switch (this.phase) {
      case "gathering":
        // Start the sweep at the left edge, moving right.
        this.apertureLeft = APERTURE_MIN;
        this.sweepDir = 1;
        this.sweepAccumMs = 0;
        this.phase = "sweeping";
        break;
      case "sweeping":
        // Snap the cut. Aperture freezes; SNAP_HOLD_MS later the round plays.
        this.snapHoldMs = 0;
        this.phase = "snapping";
        break;
      case "snapping":
        // Ignore — the snap is already committed and timing out.
        break;
      case "playing":
        // Ignore — animation in progress.
        break;
      case "complete":
        return { type: "yarrowCompleted", cast: this.model.requireCast() };
    }
  }

  /** Bounce-sweep — advance one cell, flip direction at edges. */
  private advanceAperture(): void {
    if (this.sweepDir === 1) {
      if (this.apertureLeft >= APERTURE_MAX) {
        this.sweepDir = -1;
        this.apertureLeft = Math.max(APERTURE_MIN, this.apertureLeft - 1);
      } else {
        this.apertureLeft++;
      }
    } else {
      if (this.apertureLeft <= APERTURE_MIN) {
        this.sweepDir = 1;
        this.apertureLeft = Math.min(APERTURE_MAX, this.apertureLeft + 1);
      } else {
        this.apertureLeft--;
      }
    }
  }

  /**
   * Snap is over — pick a uniform-random k inside the aperture and commit
   * the line. RNG picks from {apertureLeft, +1, +2, +3}; each window
   * contains exactly one k % 4 === 0 and three not, preserving the 1:3
   * setAside distribution at round 1.
   */
  private commitCut(): void {
    // Math.floor(Math.random() * 4) — uniform 0..3 → k offset
    // Use the seeded source if available for deterministic recordings.
    const byte = this.source.nextBytes(1)[0];
    const offset = byte % APERTURE_WIDTH;
    const k = this.apertureLeft + offset;
    this.committedK = k;

    const result = castYarrowLine(this.source, { firstSplitAt: k });
    this.model.appendLine(result);

    const beats = buildYarrowFullLineBeats(
      this.model, this.timing, this.detail, this.lineIdx, { narrating: false },
    );
    this.subRunner = new TimelineRunner(seq(...beats));
    this.subElapsed = 0;
    this.phase = "playing";
  }

  private advanceToNextLine(): void {
    this.lineIdx++;
    this.subRunner = null;
    this.subElapsed = 0;
    this.resetSweepState();

    if (this.lineIdx >= LINES) {
      this.model.commitCast();
      this.phase = "complete";
      this.model.activeLine = -1;
      this.model.hexagramComplete = true;
      this.model.caption = "";
      return;
    }

    this.phase = "gathering";
    this.model.resetActiveLine(this.lineIdx);
  }

  private resetSweepState(): void {
    this.apertureLeft = APERTURE_MIN;
    this.sweepDir = 1;
    this.sweepAccumMs = 0;
    this.snapHoldMs = 0;
  }

  private renderFooter(frame: CellBuffer): void {
    const t = getTheme();
    const row = frame.height - 2;
    if (row < 0) return;

    let text: string;
    switch (this.phase) {
      case "complete":
        text = "[space] receive the reading  ·  [esc] discard";
        break;
      case "gathering":
        text = `Line ${this.lineIdx + 1}/6  ·  press [space] to begin cutting  ·  [esc] back`;
        break;
      case "sweeping":
        text = `Line ${this.lineIdx + 1}/6  ·  press [space] to cut`;
        break;
      case "snapping":
        text = `Line ${this.lineIdx + 1}/6  ·  cut around here`;
        break;
      case "playing":
        text = `Line ${this.lineIdx + 1}/6`;
        break;
    }

    const col = Math.max(0, Math.floor((frame.width - stringWidth(text)) / 2));
    frame.writeText(row, col, text, { fg: t.tertiary });
  }

  // ── Test accessors ───────────────────────────────────────────────────────

  getModel(): YarrowModel {
    return this.model;
  }
  getPhase(): Phase {
    return this.phase;
  }
  getLineIdx(): number {
    return this.lineIdx;
  }
  getApertureLeft(): number {
    return this.apertureLeft;
  }
  getCommittedK(): number {
    return this.committedK;
  }
}
