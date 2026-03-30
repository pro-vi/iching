// CastScene — main scene orchestrating the full casting ritual

import type { Cast } from "@iching/core";
import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { MotionPreset } from "../../animation/presets.ts";
import { getPreset } from "../../animation/presets.ts";
import { TimelineRunner } from "../../animation/runner.ts";
import { CastModel } from "./model.ts";
import { renderCoins } from "./coin-renderer.ts";
import { renderHexagram, anchorRow, LINE_ROW_OFFSETS, COIN_ROW_OFFSET } from "./hexagram-renderer.ts";
import { renderTitle, renderBecomingTitle } from "./reveal-renderer.ts";
import { renderMorph } from "./morph-renderer.ts";
import { buildCastTimeline } from "./timeline-builder.ts";
import { TEMPLE_NIGHT } from "../../color/themes/temple-night.ts";
import { stringWidth } from "../../layout/measure.ts";

export class CastScene implements Scene {
  private model: CastModel;
  private timeline: TimelineRunner;
  private complete = false;

  constructor(cast: Cast, preset: MotionPreset = "default") {
    this.model = new CastModel(cast);
    const timing = getPreset(preset);
    const step = buildCastTimeline(cast, this.model, timing);
    this.timeline = new TimelineRunner(step);
  }

  enter(_ctx: SceneContext): void {
    // Nothing special on enter
  }

  update(elapsed: number, _dt: number, _ctx: SceneContext): void {
    this.complete = this.timeline.advance(elapsed, this.model);
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const model = this.model;

    // Render coins if active
    if (model.coinPhase !== "idle" && model.coinPhase !== "done" && model.activeLine >= 0) {
      const anchor = anchorRow(frame.height);
      const lineRow = anchor + LINE_ROW_OFFSETS[model.activeLine];
      const coinRow = lineRow + COIN_ROW_OFFSET;
      renderCoins(frame, model, coinRow);
    }

    // Render hexagram lines
    renderHexagram(frame, model);

    // Render morph animations
    renderMorph(frame, model);

    // Render title
    renderTitle(frame, model);

    // Render becoming title
    renderBecomingTitle(frame, model);

    // Render prompt
    if (model.showPrompt) {
      renderPrompt(frame);
    }
  }

  handleKey(key: KeyEvent, ctx: SceneContext): SceneSignal | void {
    // During animation, q always exits
    if (key.type === "char" && key.char === "q") {
      return "exit";
    }

    // Only handle prompt keys after prompt is shown
    if (this.model.showPrompt) {
      if (key.type === "enter") {
        return { goto: "reading" };
      }
      if (key.type === "char" && key.char === "j") {
        return { goto: "journal" };
      }
    }

    // Ctrl-C
    if (key.type === "ctrl" && key.char === "c") {
      return "exit";
    }
  }

  /** Expose model for testing. */
  getModel(): CastModel {
    return this.model;
  }

  /** Expose timeline for testing. */
  getTimeline(): TimelineRunner {
    return this.timeline;
  }
}

/** Render the prompt bar at the bottom of the hexagram area. */
function renderPrompt(buf: CellBuffer): void {
  const text = "[enter] open reading   [j] journal   [q] quit";
  const row = buf.height - 2;
  if (row < 0) return;
  const w = stringWidth(text);
  const col = Math.max(0, Math.floor((buf.width - w) / 2));
  buf.writeText(row, col, text, { fg: TEMPLE_NIGHT.ash });
}
