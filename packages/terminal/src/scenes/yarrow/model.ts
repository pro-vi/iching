// YarrowModel — mutable animation state for the yarrow stalk ritual.
//
// Auto mode (full transcript known at construction) passes a `YarrowCast`
// to the constructor and never mutates the transcript. Manual mode (H4
// 6-cut hold-release) passes `null`, then calls `appendLine(result)` after
// each user gesture, finally `commitCast()` once all 6 lines have landed.
// The animation timeline only ever writes to the live progress fields.

import { assembleCast, type Cast, type YarrowCast, type YarrowLineResult } from "@iching/core";
import type { LineAnimState } from "../cast/model.ts";

/** The beat currently animating within a round (or the line/ritual edges). */
export type YarrowBeat =
  | "idle"
  | "gather"
  | "divide"
  | "takeOne"
  | "count"
  | "tally"
  | "carry"
  | "fuse"
  | "done";

export class YarrowModel {
  /** Ritual transcript — grows incrementally in manual mode; locked in auto. */
  transcript: YarrowLineResult[];
  /** Assembled hexagram — null until `commitCast()` runs (or set at construction in auto). */
  cast: Cast | null;

  /** Per-line drawing state for the hexagram figure. */
  lines: LineAnimState[];

  /** Line being cast (0-5); -1 before the ritual starts and once it is done. */
  activeLine: number;
  /** Round within the active line (0-2). */
  activeRound: number;
  /** Beat currently animating. */
  beat: YarrowBeat;

  /** Live working-pile size, drawn as the braille field. */
  fieldCount: number;
  /** Gap-opening progress for the `divide` beat (0-1). */
  splitProgress: number;
  /** Lift progress for the `takeOne` beat (0-1). */
  takeOneProgress: number;
  /** Sweep progress for the `count` beat (0-1). */
  countProgress: number;
  /** Reveal progress for the `tally` beat (0-1). */
  tallyProgress: number;
  /** Re-cohere progress for the `carry` beat (0-1). */
  carryProgress: number;

  /** Subtitle caption — shown during the teach-once first line, then cleared. */
  caption: string;
  /** True once all six lines and the reveal bridge have completed. */
  hexagramComplete: boolean;

  /** Pace control — paused playback. */
  paused: boolean;
  /** Pace control — playback speed multiplier (1, 2, or 4). */
  speed: number;

  constructor(yarrow: YarrowCast | null) {
    this.transcript = yarrow ? yarrow.transcript : [];
    this.cast = yarrow ? yarrow.cast : null;

    this.lines = Array.from({ length: 6 }, () => ({
      progress: 0,
      settled: false,
      glowing: false,
      glowProgress: 0,
      markerVisible: false,
      morphProgress: 0,
      morphComplete: false,
    }));

    this.activeLine = -1;
    this.activeRound = 0;
    this.beat = "idle";

    this.fieldCount = 49;
    this.splitProgress = 0;
    this.takeOneProgress = 0;
    this.countProgress = 0;
    this.tallyProgress = 0;
    this.carryProgress = 0;

    this.caption = "";
    this.hexagramComplete = false;

    this.paused = false;
    this.speed = 1;
  }

  /** The transcript round currently animating, or null at the ritual edges
   *  or in manual mode when the active line hasn't been appended yet. */
  currentRound(): YarrowLineResult["rounds"][number] | null {
    if (this.activeLine < 0 || this.activeLine > 5) return null;
    return this.transcript[this.activeLine]?.rounds[this.activeRound] ?? null;
  }

  /**
   * Reset all per-round progress and pose for a fresh line at lineIdx.
   * Called between lines in H4 manual mode and by the settings preview
   * when looping the round-0 demo.
   */
  resetActiveLine(lineIdx: number, fieldCount: number = 49): void {
    this.activeLine = lineIdx;
    this.activeRound = 0;
    this.beat = "gather";
    this.fieldCount = fieldCount;
    this.splitProgress = 0;
    this.takeOneProgress = 0;
    this.countProgress = 0;
    this.tallyProgress = 0;
    this.carryProgress = 0;
    this.caption = "";
  }

  /** Manual mode: append a freshly-cast line to the transcript. */
  appendLine(result: YarrowLineResult): void {
    if (this.transcript.length >= 6) {
      throw new Error("appendLine: transcript already complete (6 lines)");
    }
    this.transcript.push(result);
  }

  /** Manual mode: assemble the cast from the 6-line transcript. */
  commitCast(): void {
    if (this.transcript.length !== 6) {
      throw new Error(`commitCast: requires 6 lines, have ${this.transcript.length}`);
    }
    this.cast = assembleCast(this.transcript.map((r) => r.line));
  }

  /** Asserting accessor — use at emit sites and in tests that assume the
   *  cast is set. Throws if neither construction-with-YarrowCast nor
   *  commitCast() has run yet. */
  requireCast(): Cast {
    if (this.cast === null) {
      throw new Error("requireCast: cast not yet committed");
    }
    return this.cast;
  }
}
