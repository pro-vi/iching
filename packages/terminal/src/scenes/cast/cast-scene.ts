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
import { renderRightHexagram, renderRightMorph } from "./right-hex-renderer.ts";
import { buildCastTimeline } from "./timeline-builder.ts";
import { hexColOffset } from "./layout-calc.ts";
import { getTheme } from "../../color/theme.ts";
import { SPLIT_ARROW } from "../../glyphs.ts";
import { stringWidth } from "../../layout/measure.ts";

export class CastScene implements Scene {
  private model: CastModel;
  private timeline: TimelineRunner;
  private complete = false;

  constructor(cast: Cast, preset: MotionPreset = "default", termWidth: number = 80) {
    this.model = new CastModel(cast);
    const timing = getPreset(preset);
    const step = buildCastTimeline(cast, this.model, timing, termWidth);
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
    const isSplit = model.layout !== "centered";
    const leftOffset = hexColOffset(isSplit ? "left" : "center", model.splitProgress);
    const rightOffset = hexColOffset("right", model.splitProgress);

    // Render coins if active
    if (model.coinPhase !== "idle" && model.coinPhase !== "done" && model.activeLine >= 0) {
      const anchor = anchorRow(frame.height);
      const lineRow = anchor + LINE_ROW_OFFSETS[model.activeLine];
      const coinRow = lineRow + COIN_ROW_OFFSET;
      renderCoins(frame, model, coinRow);
    }

    // Render primary hexagram (left side when split)
    renderHexagram(frame, model, leftOffset);

    if (isSplit) {
      // Render right hexagram (becoming)
      renderRightHexagram(frame, model, rightOffset);

      // Render right morph animations
      renderRightMorph(frame, model, rightOffset);

      // Render arrow between hexagrams
      renderSplitArrow(frame, model);
    } else {
      // Centered morph (narrow terminal fallback)
      renderMorph(frame, model);
    }

    // Render primary title (left offset when split)
    renderTitle(frame, model, leftOffset);

    // Render becoming title (right offset when split, centered otherwise)
    renderBecomingTitle(frame, model, isSplit ? rightOffset : 0);

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
      if (key.type === "char" && key.char === "d") {
        return { goto: "dictionary" };
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

/** Render the ⇒ arrow between primary and becoming hexagrams. */
function renderSplitArrow(buf: CellBuffer, model: CastModel): void {
  if (model.splitProgress <= 0) return;

  const t = getTheme();
  const anchor = anchorRow(buf.height);
  // Vertical midpoint between upper and lower trigrams
  // Line 3 is at anchor + LINE_ROW_OFFSETS[2] = anchor - 5
  // Line 4 is at anchor + LINE_ROW_OFFSETS[3] = anchor - 8
  // Midpoint is between them (the trigram gap)
  const arrowRow = anchor + Math.floor((LINE_ROW_OFFSETS[2] + LINE_ROW_OFFSETS[3]) / 2);
  if (arrowRow < 0 || arrowRow >= buf.height) return;

  // Center horizontally between the two hexagrams
  const arrowW = stringWidth(SPLIT_ARROW);
  const col = Math.max(0, Math.floor((buf.width - arrowW) / 2));

  // Fade in with split progress
  const fg = model.splitProgress < 0.5 ? t.tertiary : t.secondary;
  buf.writeText(arrowRow, col, SPLIT_ARROW, { fg });
}

/** Render the prompt bar at the bottom of the hexagram area. */
function renderPrompt(buf: CellBuffer): void {
  const t = getTheme();
  const text = "[enter] reading   [j] journal   [d] dictionary   [q] quit";
  const row = buf.height - 2;
  if (row < 0) return;
  const w = stringWidth(text);
  const col = Math.max(0, Math.floor((buf.width - w) / 2));
  buf.writeText(row, col, text, { fg: t.tertiary });
}
