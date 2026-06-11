// DetailScene — full hexagram reference view

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { DisplayLanguage, GlyphFont } from "@iching/core";
import { toSimplified } from "@iching/core";
import type { GlyphAnimStyle } from "../../glyph-anim/types.ts";
import { composeGlyph } from "../../glyph-anim/compose.ts";
import { createGlyphAnimator } from "../../glyph-anim/factory.ts";
import { autoGlyphSize } from "../../glyph-anim/auto-size.ts";
import { DetailModel } from "./detail-model.ts";
import { renderDetail, buildContentLines } from "./detail-renderer.ts";

export interface DetailGlyphConfig {
  glyphAnim: GlyphAnimStyle;
  glyphFont: GlyphFont;
}

const FOOTER_ROWS = 2;

export class DetailScene implements Scene {
  private model: DetailModel;
  private glyphConfig?: DetailGlyphConfig;
  private language: DisplayLanguage;

  constructor(
    kw: number,
    glyphConfig?: DetailGlyphConfig,
    language: DisplayLanguage = "en",
    changedPositions?: number[],
  ) {
    this.model = new DetailModel(kw, changedPositions);
    this.glyphConfig = glyphConfig;
    this.language = language;
  }

  enter(ctx: SceneContext): void {
    this.model.viewportHeight = ctx.rows - FOOTER_ROWS;

    // Create glyph animator on entry (skip if already completed from prior visit)
    if (this.glyphConfig && !this.model.glyphAnimDone) {
      // zh-Hans composes the glyph from the Simplified name so it matches the
      // Simplified header text (e.g. 兑 above "兑 Duì"), not the Traditional 兌.
      const name = this.language === "zh-Hans"
        ? toSimplified(this.model.detail.gua.n)
        : this.model.detail.gua.n;
      const charCount = Math.max(1, [...name].length);
      const size = autoGlyphSize(ctx.rows - FOOTER_ROWS, ctx.cols, charCount);
      const glyph = composeGlyph(
        name,
        this.glyphConfig.glyphFont,
        size,
      );
      if (glyph) {
        this.model.glyphEntry = glyph;
        this.model.glyphAnimator = createGlyphAnimator(
          this.glyphConfig.glyphAnim,
          glyph,
        );
      }
    }

    // Pre-compute content height so scroll bounds work before first render
    this.model.contentHeight = buildContentLines(this.model, ctx.cols, {
      language: this.language,
    }).length;
  }

  update(elapsed: number, _dt: number, _ctx: SceneContext): void {
    // Drive glyph animator
    if (this.model.glyphAnimator && !this.model.glyphAnimDone) {
      const done = this.model.glyphAnimator.update(elapsed);
      if (done) {
        this.model.glyphAnimDone = true;
      }
    }
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    renderDetail(frame, this.model, ctx, { language: this.language });
  }

  resize(_cols: number, rows: number): void {
    this.model.viewportHeight = rows - FOOTER_ROWS;
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    // q pops one router level (or exits the router if at the bottom → returns home).
    if (key.type === "char" && key.char === "q") {
      return { type: "back" };
    }
    if (key.type === "ctrl" && key.char === "c") {
      return { type: "exit" };
    }

    // Back
    if (key.type === "escape" || key.type === "backspace") {
      return { type: "back" };
    }

    // Tab — toggle focus
    if (key.type === "tab") {
      this.model.focus =
        this.model.focus === "content" ? "derived" : "content";
      return;
    }

    // Arrow keys
    if (key.type === "arrow") {
      if (key.direction === "up") {
        if (this.model.focus === "derived") {
          this.model.derivedUp();
        } else {
          this.model.scrollUp();
        }
        return;
      }
      if (key.direction === "down") {
        if (this.model.focus === "derived") {
          this.model.derivedDown();
        } else {
          this.model.scrollDown();
        }
        return;
      }
    }

    // Page up/down
    if (key.type === "page") {
      if (key.direction === "up") this.model.pageUp();
      if (key.direction === "down") this.model.pageDown();
      return;
    }

    // Home/End
    if (key.type === "home") {
      this.model.scrollOffset = 0;
      return;
    }
    if (key.type === "end") {
      this.model.scrollOffset = Math.max(
        0,
        this.model.contentHeight - this.model.viewportHeight,
      );
      return;
    }

    // Enter — navigate to derived hexagram
    if (key.type === "enter" && this.model.focus === "derived") {
      const kw = this.model.selectedDerivedKW();
      return { type: "openDetail", kw };
    }
  }

  /** Expose model for testing */
  getModel(): DetailModel {
    return this.model;
  }

  /** Set history info (called by entry point after querying journal) */
  setHistory(castCount: number, lastCastDate: string | null): void {
    this.model.castCount = castCount;
    this.model.lastCastDate = lastCastDate;
  }
}
