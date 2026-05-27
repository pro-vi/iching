// YarrowScene — the guided yarrow stalk ritual.
//
// Runs the precomputed transcript as a timeline replay, with pace control
// (pause / speed / beat-step / skip). On completion it emits `yarrowCompleted`;
// reading-flow hands the cast to CastScene for the shared reveal phase.

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
import { TimelineRunner } from "../../animation/runner.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { YarrowModel } from "./model.ts";
import { buildYarrowTimeline } from "./yarrow-timeline.ts";
import { renderYarrowField } from "./field-renderer.ts";

const SPEEDS = [1, 2, 4];

export class YarrowScene implements Scene {
  private readonly model: YarrowModel;
  private readonly timeline: TimelineRunner;
  private readonly beatOffsets: number[];
  /** Scene-controlled clock — pace control modulates how fast this advances. */
  private virtualElapsed = 0;
  private complete = false;

  constructor(motion: MotionPreset = "default", source?: RandomSource) {
    // The cast is committed once, here — the moment the ritual begins.
    this.model = new YarrowModel(castYarrowHexagram(source ?? new CryptoRandomSource()));
    const { timing, detail } = getYarrowTiming(motion);
    const built = buildYarrowTimeline(this.model, timing, detail);
    this.timeline = new TimelineRunner(built.timeline);
    this.beatOffsets = built.beatOffsets;
  }

  update(_elapsed: number, dt: number, _ctx: SceneContext): void {
    if (this.complete) return;
    if (!this.model.paused) {
      this.virtualElapsed += dt * this.model.speed;
    }
    this.complete = this.timeline.advance(this.virtualElapsed, this.model);
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    renderYarrowField(frame, this.model);
    this.renderFooter(frame);
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };
    if (key.type === "escape") return { type: "home" };
    if (key.type === "char" && key.char === "q") return { type: "home" };

    // Once the figure stands, space receives the reading.
    if (this.model.hexagramComplete) {
      if (key.type === "char" && key.char === " ") {
        return { type: "yarrowCompleted", cast: this.model.requireCast() };
      }
      return;
    }

    // Ritual in progress — pace control.
    if (key.type === "char" && key.char === " ") {
      this.model.paused = !this.model.paused;
    } else if (key.type === "char" && key.char === "s") {
      this.skipToComplete();
    } else if (key.type === "char" && key.char === "f") {
      const next = (SPEEDS.indexOf(this.model.speed) + 1) % SPEEDS.length;
      this.model.speed = SPEEDS[next];
    } else if (key.type === "arrow" && key.direction === "right") {
      this.stepToNextBeat();
    }
  }

  /** Jump the virtual clock to the next beat boundary. */
  private stepToNextBeat(): void {
    const next = this.beatOffsets.find((o) => o > this.virtualElapsed + 1);
    this.virtualElapsed = next ?? this.timeline.duration;
    this.complete = this.timeline.advance(this.virtualElapsed, this.model);
  }

  /** Skip the ritual — land directly on the finished figure. */
  skipToComplete(): void {
    this.timeline.fastForward(this.model);
    this.virtualElapsed = this.timeline.duration;
    this.complete = true;
  }

  private renderFooter(frame: CellBuffer): void {
    const t = getTheme();
    const row = frame.height - 2;
    if (row < 0) return;

    let text: string;
    if (this.model.hexagramComplete) {
      text = "[space] receive the reading  ·  [esc] discard";
    } else if (this.model.paused) {
      text = "[space] resume  ·  [→] step  ·  [s] skip  ·  [esc] back";
    } else {
      const speed = this.model.speed > 1 ? `  ·  ${this.model.speed}×` : "";
      text = `[space] pause  ·  [f] speed  ·  [s] skip  ·  [esc] back${speed}`;
    }

    const col = Math.max(0, Math.floor((frame.width - stringWidth(text)) / 2));
    frame.writeText(row, col, text, { fg: t.tertiary });
  }

  /** Expose model for testing. */
  getModel(): YarrowModel {
    return this.model;
  }

  /** Expose timeline for testing. */
  getTimeline(): TimelineRunner {
    return this.timeline;
  }
}
