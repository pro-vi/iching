// YarrowModel — mutable animation state for the yarrow stalk ritual.
//
// The transcript and cast are locked at construction; the timeline only ever
// writes to the live progress fields below. The animation is a pure replay.

import type { Cast, YarrowCast, YarrowLineResult } from "@iching/core";
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
  /** The full ritual transcript — never mutated after construction. */
  readonly transcript: YarrowLineResult[];
  /** The assembled hexagram — never mutated after construction. */
  readonly cast: Cast;

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

  constructor(yarrow: YarrowCast) {
    this.transcript = yarrow.transcript;
    this.cast = yarrow.cast;

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

  /** The transcript round currently animating, or null at the ritual edges. */
  currentRound(): YarrowLineResult["rounds"][number] | null {
    if (this.activeLine < 0 || this.activeLine > 5) return null;
    return this.transcript[this.activeLine].rounds[this.activeRound] ?? null;
  }
}
