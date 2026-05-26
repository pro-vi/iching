// YarrowManualScene — interactive yarrow ritual.
//
// Mirrors TossScene's shape for the yarrow path: Space commits one round
// (gather → divide → take → count → tally → carry, then fuse on the 3rd
// round of each line). 18 atoms total (3 rounds × 6 lines). On completion
// Space emits `yarrowCompleted` and reading-flow hands the cast to
// CastScene for the shared reveal.

import {
  castYarrowHexagram,
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
import { type Step, seq } from "../../animation/timeline.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { YarrowModel } from "./model.ts";
import { renderYarrowField } from "./field-renderer.ts";
import {
  buildYarrowRoundBeats,
  buildYarrowFuseBeat,
} from "./yarrow-timeline.ts";

const TOTAL_ATOMS = 18; // 3 rounds × 6 lines

type Phase = "waiting" | "playing" | "complete";

export class YarrowManualScene implements Scene {
  private readonly model: YarrowModel;
  private readonly timing: YarrowTiming;
  private readonly detail: RitualDetail;
  private phase: Phase = "waiting";
  private atomIdx = 0;
  private subRunner: TimelineRunner | null = null;
  private subElapsed = 0;

  constructor(motion: MotionPreset = "default", source?: RandomSource) {
    // Cast is committed at construction, same as auto YarrowScene.
    this.model = new YarrowModel(
      castYarrowHexagram(source ?? new CryptoRandomSource()),
    );
    const resolved = getYarrowTiming(motion);
    this.timing = resolved.timing;
    this.detail = resolved.detail;
  }

  enter(_ctx: SceneContext): void {
    this.initStateForAtom(0);
  }

  update(_elapsed: number, dt: number, _ctx: SceneContext): void {
    if (this.phase !== "playing" || !this.subRunner) return;

    this.subElapsed += dt;
    const done = this.subRunner.advance(this.subElapsed, this.model);
    if (!done) return;

    this.atomIdx++;
    this.subRunner = null;
    this.subElapsed = 0;

    if (this.atomIdx >= TOTAL_ATOMS) {
      this.phase = "complete";
      this.model.activeLine = -1;
      this.model.hexagramComplete = true;
      this.model.caption = "";
      return;
    }

    this.phase = "waiting";
    this.initStateForAtom(this.atomIdx);
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    renderYarrowField(frame, this.model);
    this.renderFooter(frame);
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };
    if (key.type === "escape") return { type: "home" };
    if (key.type === "char" && key.char === "q") return { type: "home" };

    if (key.type !== "char" || key.char !== " ") return;

    if (this.phase === "complete") {
      return { type: "yarrowCompleted", cast: this.model.cast };
    }
    if (this.phase === "waiting") {
      this.startAtom();
    }
  }

  /** Build the next round's beats (+ fuse if 3rd round) and start advancing. */
  private startAtom(): void {
    const lineIdx = Math.floor(this.atomIdx / 3);
    const roundIdx = this.atomIdx % 3;
    // Narrate the very first round so the user learns the procedure; subsequent
    // rounds run silent the same way auto mode does after line 0.
    const narrating = this.atomIdx === 0;
    const teach = lineIdx === 0;
    const effectiveDetail: RitualDetail = teach ? "expanded" : this.detail;

    const beats: Step[] = buildYarrowRoundBeats(
      this.model,
      this.timing,
      effectiveDetail,
      lineIdx,
      roundIdx,
      { narrating },
    );
    if (roundIdx === 2) {
      beats.push(buildYarrowFuseBeat(this.model, this.timing, lineIdx));
    }

    this.subRunner = new TimelineRunner(seq(...beats));
    this.subElapsed = 0;
    this.phase = "playing";
  }

  /**
   * Set the model to a "ready to cut" pose for the given atom: pile gathered,
   * progresses zeroed, active indices updated. Renders identically to the
   * gather beat's start state so the wait is visually consistent.
   */
  private initStateForAtom(atomIdx: number): void {
    const lineIdx = Math.floor(atomIdx / 3);
    const roundIdx = atomIdx % 3;
    const round = this.model.transcript[lineIdx].rounds[roundIdx];
    this.model.activeLine = lineIdx;
    this.model.activeRound = roundIdx;
    this.model.beat = "gather";
    this.model.fieldCount = round.startCount;
    this.model.splitProgress = 0;
    this.model.takeOneProgress = 0;
    this.model.countProgress = 0;
    this.model.tallyProgress = 0;
    this.model.carryProgress = 0;
    this.model.caption = "";
  }

  private renderFooter(frame: CellBuffer): void {
    const t = getTheme();
    const row = frame.height - 2;
    if (row < 0) return;

    let text: string;
    if (this.phase === "complete") {
      text = "[space] receive the reading  ·  [esc] discard";
    } else {
      const lineIdx = Math.floor(this.atomIdx / 3);
      const roundIdx = this.atomIdx % 3;
      const label = `Line ${lineIdx + 1} · Round ${roundIdx + 1}`;
      text = this.phase === "playing"
        ? `${label}  ·  counting…`
        : `${label}  ·  [space] cut  ·  [esc] back`;
    }

    const col = Math.max(0, Math.floor((frame.width - stringWidth(text)) / 2));
    frame.writeText(row, col, text, { fg: t.tertiary });
  }

  /** Expose model for testing. */
  getModel(): YarrowModel {
    return this.model;
  }

  /** Current phase — exposed for testing. */
  getPhase(): Phase {
    return this.phase;
  }

  /** Current atom index (0–18) — exposed for testing. */
  getAtomIdx(): number {
    return this.atomIdx;
  }
}
