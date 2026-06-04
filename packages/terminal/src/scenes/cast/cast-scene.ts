// CastScene — main scene orchestrating the full casting ritual

import { type Cast, GUA } from "@iching/core";
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
import { hexColOffset } from "./layout-calc.ts";
import { getTheme } from "../../color/theme.ts";
import { SPLIT_ARROW } from "../../glyphs.ts";
import { stringWidth } from "../../layout/measure.ts";
import { createGlyphAnimator } from "../../glyph-anim/factory.ts";
import { autoGlyphSize } from "../../glyph-anim/auto-size.ts";
import { tr } from "../../i18n/messages.ts";
import type { DisplayLanguage } from "@iching/core";

export type CastGlyphInput = Omit<CastGlyphConfig, "glyphSize">;

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
    glyphConfig?: CastGlyphInput,
    termRows: number = 24,
    intention?: string,
    opts?: { skipLineDrawing?: boolean; language?: DisplayLanguage },
  ) {
    this.model = new CastModel(cast);
    this.model.intention = intention;
    this.termWidth = termWidth;
    // Auto-size glyph to fit the area below the hexagram. Glyph is rendered at
    // anchor+1 (anchor = floor(rows/2)+3), so vertical room is rows - anchor - 1.
    if (glyphConfig) {
      const primaryName = GUA[cast.primary - 1]?.n ?? "";
      const becomingName = cast.becoming ? GUA[cast.becoming - 1]?.n ?? "" : "";
      const maxChars = Math.max(
        1,
        [...primaryName].length,
        [...becomingName].length,
      );
      const anchor = Math.floor(termRows / 2) + 3;
      const availRows = Math.max(4, termRows - anchor - 1);
      this.glyphConfig = {
        ...glyphConfig,
        glyphSize: autoGlyphSize(availRows, termWidth, maxChars),
        language: opts?.language,
      };
    }
    const timing = getPreset(preset);
    const step = buildCastTimeline(cast, this.model, timing, termWidth, this.glyphConfig, opts);
    this.timeline = new TimelineRunner(step);
  }

  enter(_ctx: SceneContext): void {
    // Nothing special on enter
  }

  update(elapsed: number, _dt: number, _ctx: SceneContext): void {
    if (!this.complete) {
      this.complete = this.timeline.advance(elapsed, this.model);
    }
    if (this.model.glyphAnimator && !this.model.glyphAnimDone) {
      const done = this.model.glyphAnimator.update(elapsed);
      if (done) {
        this.model.glyphAnimDone = true;
      }
    }
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    const model = this.model;
    const lang = ctx.language ?? "en";
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

    // When large glyph is active: single centered glyph + title area
    // replaces the split left/right title layout
    const hasGlyph = model.primaryGlyphEntry && (model.glyphAnimator || model.glyphAnimDone);

    if (hasGlyph) {
      renderLargeGlyph(frame, model);
      // Single centered title for the focused hexagram (no split offset)
      renderTitle(frame, model, 0, lang);
    } else {
      // No glyph: use split title layout as before
      renderTitle(frame, model, leftOffset, lang);
      renderBecomingTitle(frame, model, isSplit ? rightOffset : 0, lang);
    }

    // Render intention (after reveal)
    if (model.intention && model.showPrompt) {
      renderIntention(frame, model.intention);
    }

    // Render prompt
    if (model.showPrompt) {
      renderPrompt(frame, model, lang);
    }
  }

  handleKey(key: KeyEvent, ctx: SceneContext): SceneSignal | void {
    // During animation, q cancels the cast and returns to the home menu.
    if (key.type === "char" && key.char === "q") {
      return { type: "home" };
    }

    // Exploration mode: arrow keys switch focus, scroll commentary
    if (this.model.explorationMode && key.type === "arrow") {
      if (key.direction === "left" && this.model.focusedHex === "becoming") {
        this.setFocusedHex("primary");
        return;
      }
      if (key.direction === "right" && this.model.focusedHex === "primary" && this.model.cast.becoming !== null) {
        this.setFocusedHex("becoming");
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
      if (kw) return { type: "openDetail", kw };
    }

    // Only handle prompt keys after prompt is shown
    if (this.model.showPrompt) {
      if (key.type === "enter") {
        // No-becoming casts skip exploration in the timeline — enter it now
        this.model.explorationMode = true;
        return;
      }
      if (key.type === "char" && key.char === "j") {
        return { type: "openJournal" };
      }
      if (key.type === "char" && key.char === "d") {
        return { type: "openDictionary" };
      }
    }

    // Ctrl-C
    if (key.type === "ctrl" && key.char === "c") {
      return { type: "exit" };
    }
  }

  /**
   * Switch focus to a hexagram — updates focusedHex, creates matching
   * glyph animator, resets scroll. Single method for all focus changes.
   */
  private setFocusedHex(hex: "primary" | "becoming"): void {
    this.model.focusedHex = hex;
    this.model.commentaryScrollOffset = 0;
    const entry = hex === "primary"
      ? this.model.primaryGlyphEntry
      : this.model.becomingGlyphEntry;
    if (entry && this.glyphConfig) {
      this.model.glyphAnimator = createGlyphAnimator(this.glyphConfig.glyphAnim, entry);
      this.model.glyphAnimDone = false;
    }
  }

  /**
   * Skip all animation and show the fully revealed state.
   * Uses TimelineRunner.fastForward() — single source of truth.
   * The timeline's call/tween steps execute instantly, waits are skipped.
   */
  /**
   * Skip to fully revealed state.
   * @param animate — if true, the focused glyph animates fresh (daily cast re-entry).
   *                  if false, everything is static (journal replay).
   */
  skipToComplete(animate = true): void {
    this.timeline.fastForward(this.model);
    this.complete = true;
    this.setFocusedHex("primary");
    if (!animate) {
      this.model.glyphAnimator = null;
      this.model.glyphAnimDone = true;
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
function renderPrompt(buf: CellBuffer, model: CastModel, language: DisplayLanguage): void {
  const t = getTheme();
  // Footer only shows contextual actions. j/d still work as silent shortcuts
  // to journal/dictionary — they live on the home menu, accessible via esc.
  const text = model.explorationMode
    ? (model.cast.becoming !== null
        ? `[←→] ${tr(language, "verb.switch")}  ·  [enter] ${tr(language, "verb.detail")}  ·  [esc] ${tr(language, "verb.back")}`
        : `[enter] ${tr(language, "verb.detail")}  ·  [esc] ${tr(language, "verb.back")}`)
    : `[enter] ${tr(language, "verb.explore")}  ·  [esc] ${tr(language, "verb.back")}`;
  const row = buf.height - 2;
  if (row < 0) return;
  const w = stringWidth(text);
  const col = Math.max(0, Math.floor((buf.width - w) / 2));
  buf.writeText(row, col, text, { fg: t.tertiary });
}

/** Render the user's intention at the top of the frame. */
function renderIntention(buf: CellBuffer, intention: string): void {
  const t = getTheme();
  const maxW = buf.width - 4;
  let text = intention;
  if (stringWidth(text) > maxW) {
    text = text.slice(0, maxW - 1) + "\u2026";
  }
  const col = Math.max(0, Math.floor((buf.width - stringWidth(text)) / 2));
  buf.writeText(0, col, text, { fg: t.tertiary, dim: true });
}
