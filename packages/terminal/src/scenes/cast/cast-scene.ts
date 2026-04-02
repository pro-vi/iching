// CastScene — main scene orchestrating the full casting ritual

import { type Cast, type GlyphSize, GUA } from "@iching/core";
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
import { buildCastTimeline, type CastGlyphConfig } from "./timeline-builder.ts";
import { renderLargeGlyph } from "./glyph-renderer.ts";
import { hexColOffset, canSplit } from "./layout-calc.ts";
import { getTheme } from "../../color/theme.ts";
import { SPLIT_ARROW } from "../../glyphs.ts";
import { stringWidth } from "../../layout/measure.ts";
import { createGlyphAnimator } from "../../glyph-anim/factory.ts";
import { composeGlyph } from "../../glyph-anim/compose.ts";

export class CastScene implements Scene {
  private model: CastModel;
  private timeline: TimelineRunner;
  private complete = false;
  private glyphConfig?: CastGlyphConfig;
  private termWidth: number;

  constructor(
    cast: Cast,
    preset: MotionPreset = "default",
    termWidth: number = 80,
    glyphConfig?: CastGlyphConfig,
    termRows: number = 24,
  ) {
    this.model = new CastModel(cast);
    this.termWidth = termWidth;
    // Auto-size glyph to fit terminal height
    if (glyphConfig) {
      this.glyphConfig = {
        ...glyphConfig,
        glyphSize: autoGlyphSize(termRows, glyphConfig.glyphSize),
      };
    }
    const timing = getPreset(preset);
    const step = buildCastTimeline(cast, this.model, timing, termWidth, this.glyphConfig);
    this.timeline = new TimelineRunner(step);
  }

  enter(_ctx: SceneContext): void {
    // Nothing special on enter
  }

  update(elapsed: number, _dt: number, _ctx: SceneContext): void {
    this.complete = this.timeline.advance(elapsed, this.model);
    if (this.model.glyphAnimator && !this.model.glyphAnimDone) {
      this.model.glyphAnimator.update(elapsed);
    }
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

    // Render large glyph
    renderLargeGlyph(frame, model);

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

    // Exploration mode: arrow keys switch focus, scroll commentary
    if (this.model.explorationMode && key.type === "arrow") {
      if (key.direction === "left" && this.model.focusedHex === "becoming") {
        this.model.focusedHex = "primary";
        this.model.commentaryScrollOffset = 0;
        if (this.model.primaryGlyphEntry && this.glyphConfig) {
          this.model.glyphAnimator = createGlyphAnimator(
            this.glyphConfig.glyphAnim,
            this.model.primaryGlyphEntry,
          );
          this.model.glyphAnimDone = false;
        }
        return;
      }
      if (key.direction === "right" && this.model.focusedHex === "primary" && this.model.cast.becoming !== null) {
        this.model.focusedHex = "becoming";
        this.model.commentaryScrollOffset = 0;
        if (this.model.becomingGlyphEntry && this.glyphConfig) {
          this.model.glyphAnimator = createGlyphAnimator(
            this.glyphConfig.glyphAnim,
            this.model.becomingGlyphEntry,
          );
          this.model.glyphAnimDone = false;
        }
        return;
      }
      if (key.direction === "up") {
        this.model.commentaryScrollOffset = Math.max(0, this.model.commentaryScrollOffset - 1);
        return;
      }
      if (key.direction === "down") {
        this.model.commentaryScrollOffset++;
        return;
      }
    }

    // Enter in exploration mode opens dictionary for focused hex
    if (this.model.explorationMode && key.type === "enter") {
      const kw =
        this.model.focusedHex === "primary"
          ? this.model.cast.primary
          : this.model.cast.becoming;
      if (kw) return { goto: `detail:${kw}` };
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

  /**
   * Skip all animation and show the fully revealed state.
   * Used when re-entering today's cast from the home menu.
   */
  skipToComplete(): void {
    const model = this.model;
    const cast = model.cast;

    // All lines settled
    for (let i = 0; i < 6; i++) {
      model.lines[i].progress = 1;
      model.lines[i].settled = true;
      if (cast.lines[i].isChanging) {
        model.lines[i].markerVisible = true;
      }
    }

    model.coinPhase = "done";
    model.hexagramComplete = true;
    model.glowProgress = 0;
    model.titleProgress = 1;
    model.showPrompt = true;

    // Primary glyph
    if (this.glyphConfig) {
      const glyph = composeGlyph(GUA[cast.primary - 1].n, this.glyphConfig.glyphFont, this.glyphConfig.glyphSize);
      if (glyph) {
        model.primaryGlyphEntry = glyph;
        model.glyphAnimDone = true;
      }
    }

    // Becoming
    if (cast.becoming !== null) {
      model.becomingTitleProgress = 1;
      model.explorationMode = true;

      if (this.glyphConfig) {
        const glyph = composeGlyph(GUA[cast.becoming - 1].n, this.glyphConfig.glyphFont, this.glyphConfig.glyphSize);
        if (glyph) {
          model.becomingGlyphEntry = glyph;
        }
      }

      // Wide layout: set split state
      if (canSplit(this.termWidth)) {
        model.layout = "side-by-side";
        model.splitProgress = 1;
        model.rightHexMorphComplete = true;
        for (let i = 0; i < model.rightHexMorphProgress.length; i++) {
          model.rightHexMorphProgress[i] = 1;
        }
      } else {
        // Narrow: in-place morph complete
        for (const pos of cast.changingPositions) {
          model.lines[pos - 1].morphComplete = true;
          model.lines[pos - 1].morphProgress = 1;
        }
      }
    }

    // Mark timeline complete
    this.complete = true;
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

/**
 * Auto-select glyph size based on terminal height.
 * 64 for tall (>=40 rows), 48 for medium (>=30), 32 for short (<30).
 * Returns the smaller of userSize and the terminal-appropriate maximum.
 */
function autoGlyphSize(termRows: number, userSize: GlyphSize): GlyphSize {
  if (termRows >= 40) return userSize;
  if (termRows >= 30) return Math.min(userSize, 48) as GlyphSize;
  return 32;
}
