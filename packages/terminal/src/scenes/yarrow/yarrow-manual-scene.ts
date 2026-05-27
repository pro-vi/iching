// YarrowManualScene — H4 hold-and-release manual yarrow.
//
// Six cuts, one per line. Each cut is a hold-release gesture: the user
// presses Space to start the drag, additional Spaces (or OS key-repeat
// while held) advance the cursor by one cell each; 250ms of silence after
// the last Space commits the cut at the current cursorK. The committed k
// is used as round 1's splitAt for that line; rounds 2-3 stay RNG.
//
// No position numbers are shown — the cursor IS the visual choice. After
// release, the round + fuse animation plays via the same beat pipeline as
// auto mode. After 6 lines, the cast is assembled and Space emits
// `yarrowCompleted`.

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
  drawDragCursor,
} from "./field-renderer.ts";
import { buildYarrowFullLineBeats } from "./yarrow-timeline.ts";

const LINES = 6;
const CURSOR_MIN = 1;
const CURSOR_MAX = 48;            // splitAt must be ≤ startCount - 1 = 48
const RELEASE_MS = 250;           // silence after last Space → commit

type Phase = "gathering" | "dragging" | "playing" | "complete";

export class YarrowManualScene implements Scene {
  private readonly model: YarrowModel;
  private readonly source: RandomSource;
  private readonly timing: YarrowTiming;
  private readonly detail: RitualDetail;

  private phase: Phase = "gathering";
  private lineIdx = 0;
  private cursorK = 0;
  private silenceMs = 0;
  private subRunner: TimelineRunner | null = null;
  private subElapsed = 0;

  constructor(motion: MotionPreset = "default", source?: RandomSource) {
    // Manual mode starts with an empty transcript; lines are appended as
    // the user cuts. commitCast() runs after the 6th line.
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
    if (this.phase === "dragging") {
      this.silenceMs += dt;
      if (this.silenceMs >= RELEASE_MS && this.cursorK > 0) {
        this.commitCut();
      }
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
    if (this.phase === "dragging") {
      const g = yarrowFieldGeometry(frame);
      drawDragCursor(frame, g.fieldRow, g.center, this.cursorK);
    }
    this.renderFooter(frame);
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };

    if (key.type === "escape") {
      if (this.phase === "dragging") {
        // Cancel drag, stay on same line.
        this.cursorK = 0;
        this.silenceMs = 0;
        this.phase = "gathering";
        return;
      }
      return { type: "home" };
    }

    if (key.type === "char" && key.char === "q") return { type: "home" };

    if (key.type !== "char" || key.char !== " ") return;

    switch (this.phase) {
      case "gathering":
        // First Space starts the drag at cursorK=1.
        this.phase = "dragging";
        this.cursorK = CURSOR_MIN;
        this.silenceMs = 0;
        break;
      case "dragging":
        // Subsequent Space advances cursor (saturates at CURSOR_MAX).
        this.cursorK = Math.min(CURSOR_MAX, this.cursorK + 1);
        this.silenceMs = 0;
        break;
      case "playing":
        // Ignore input while the round animates.
        break;
      case "complete":
        return { type: "yarrowCompleted", cast: this.model.requireCast() };
    }
  }

  /** Commit the current cursor's k as round 1's splitAt for this line. */
  private commitCut(): void {
    const k = Math.max(CURSOR_MIN, Math.min(CURSOR_MAX, this.cursorK));
    const result = castYarrowLine(this.source, { firstSplitAt: k });
    this.model.appendLine(result);

    // Build the line's full ritual: 3 rounds + fuse. No narration ever —
    // round captions would expose "Cut at k=..." numerically, contradicting
    // "hide the number, show the visual."
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
    this.cursorK = 0;
    this.silenceMs = 0;

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
      case "dragging":
        text = `Line ${this.lineIdx + 1}/6  ·  hold [space] to slide the cut · release to commit`;
        break;
      case "playing":
        text = `Line ${this.lineIdx + 1}/6  ·  counting…`;
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
  getCursorK(): number {
    return this.cursorK;
  }
}
