// CastScene — main scene orchestrating the full casting ritual

import { type Cast, GUA, toSimplified } from "@iching/core";
import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { MotionPreset } from "../../animation/presets.ts";
import { getPreset } from "../../animation/presets.ts";
import { TimelineRunner } from "../../animation/runner.ts";
import { CastModel } from "./model.ts";
import { renderCoins } from "./coin-renderer.ts";
import { renderHexagram, anchorRow, LINE_ROW_OFFSETS, COIN_ROW_OFFSET } from "./hexagram-renderer.ts";
import { renderTitle, renderBecomingTitle, glyphDisplayMode } from "./reveal-renderer.ts";
import { renderReadingPanel } from "./reading-renderer.ts";
import { readingPanelRows, readingPanelWidth } from "./reading-lines.ts";
import { renderMorph } from "./morph-renderer.ts";
import { renderRightHexagram, renderRightMorph } from "./right-hex-renderer.ts";
import { buildCastTimeline, type CastGlyphConfig } from "./timeline-builder.ts";
import { renderLargeGlyph } from "./glyph-renderer.ts";
import { hexColOffset, canSplit, glyphRevealMode, glyphTitleLineCount } from "./layout-calc.ts";
import { getTheme } from "../../color/theme.ts";
import { SPLIT_ARROW } from "../../glyphs.ts";
import { stringWidth } from "../../layout/measure.ts";
import { createGlyphAnimator } from "../../glyph-anim/factory.ts";
import { composeGlyph } from "../../glyph-anim/compose.ts";
import { tr } from "../../i18n/messages.ts";
import type { DisplayLanguage, GlyphSize } from "@iching/core";

export type CastGlyphInput = Omit<CastGlyphConfig, "glyphSize">;

/** Reveal pace multipliers cycled by f — same ladder as the yarrow ritual. */
const PACE_SPEEDS = [1, 2, 4];

export class CastScene implements Scene {
  private model: CastModel;
  private timeline: TimelineRunner;
  private complete = false;
  private glyphConfig?: CastGlyphConfig;
  private termWidth: number;
  // Scene-controlled clock — pace control (pause/speed) modulates how fast
  // this advances relative to the loop's elapsed time.
  private virtualElapsed = 0;
  private lastElapsed = 0;
  // Motion-preset time dilation for glyph reveals on focus changes (0 = static).
  private glyphAnimScale = 1;
  // Where esc/q land. Standalone casts unwind to the home menu; a journal
  // replay emits `back` so the router pops to the original journal list
  // (cursor and search intact) instead of leaving the journal entirely.
  private exitSignal: "home" | "back";

  constructor(
    cast: Cast,
    preset: MotionPreset = "default",
    termWidth: number = 80,
    glyphConfig?: CastGlyphInput,
    termRows: number = 24,
    intention?: string,
    opts?: {
      skipLineDrawing?: boolean;
      language?: DisplayLanguage;
      exitSignal?: "home" | "back";
    },
  ) {
    this.model = new CastModel(cast);
    this.model.intention = intention;
    this.termWidth = termWidth;
    this.exitSignal = opts?.exitSignal ?? "home";
    // Size the glyph against the settled-reveal budget: the reading panel's
    // rows are reserved first (the oracle texts are the heart of the reading;
    // the glyph is ornament). Prefer the largest size that keeps the normal
    // layout (glyph + title + texts), fall back to compact (title yields),
    // and omit the glyph entirely when even compact cannot host the texts.
    if (glyphConfig) {
      const language = opts?.language ?? "en";
      const anchor = anchorRow(termRows);
      const willSplit = cast.becoming !== null && canSplit(termWidth);
      const titleLines = glyphTitleLineCount(willSplit, language === "en");
      const panelRows = readingPanelRows(cast, language, readingPanelWidth(termWidth));
      const primaryName = GUA[cast.primary - 1]?.n ?? "";
      const becomingName = cast.becoming ? GUA[cast.becoming - 1]?.n ?? "" : "";
      // zh-Hans composes Simplified glyphs — measure what will be drawn.
      const names = [primaryName, becomingName]
        .filter((n) => n.length > 0)
        .map((n) => (language === "zh-Hans" ? toSimplified(n) : n));
      let fitted: GlyphSize | null = null;
      outer: for (const wantMode of ["normal", "compact"] as const) {
        for (const size of [64, 48, 32] as const) {
          const entries = names.map((n) => composeGlyph(n, glyphConfig.glyphFont, size));
          if (entries.some((e) => e === null)) continue;
          const glyphHeight = Math.max(...entries.map((e) => e!.height));
          const glyphWidth = Math.max(...entries.map((e) => e!.width));
          if (glyphWidth > termWidth) continue;
          if (glyphRevealMode(termRows, anchor, glyphHeight, titleLines, panelRows) === wantMode) {
            fitted = size;
            break outer;
          }
        }
      }
      if (fitted !== null) {
        this.glyphConfig = {
          ...glyphConfig,
          glyphSize: fitted,
          language: opts?.language,
        };
      }
    }
    const timing = getPreset(preset);
    this.glyphAnimScale = timing.glyphAnimScale;
    const step = buildCastTimeline(cast, this.model, timing, termWidth, this.glyphConfig, opts);
    this.timeline = new TimelineRunner(step);
  }

  enter(_ctx: SceneContext): void {
    // Nothing special on enter
  }

  update(elapsed: number, _dt: number, _ctx: SceneContext): void {
    // Advance the virtual clock from the loop's elapsed time, honoring
    // pause/speed. At speed 1 unpaused this tracks `elapsed` exactly.
    const delta = Math.max(0, elapsed - this.lastElapsed);
    this.lastElapsed = elapsed;
    if (!this.model.paused) {
      this.virtualElapsed += delta * this.model.speed;
    }
    if (!this.complete) {
      this.complete = this.timeline.advance(this.virtualElapsed, this.model);
    }
    if (this.model.glyphAnimator && !this.model.glyphAnimDone) {
      const done = this.model.glyphAnimator.update(this.virtualElapsed);
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
    // replaces the split left/right title layout. The glyph yields ("none")
    // when the reading texts need its rows — the split titles return then.
    const hasGlyph =
      model.primaryGlyphEntry &&
      (model.glyphAnimator || model.glyphAnimDone) &&
      glyphDisplayMode(frame, model, lang) !== "none";

    if (hasGlyph) {
      renderLargeGlyph(frame, model, lang);
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

    // Reading panel + prompt once the reveal settles; pace hints before.
    if (model.showPrompt) {
      renderReadingPanel(frame, model, lang);
      renderPrompt(frame, model, lang);
    } else {
      renderPaceFooter(frame, model, lang);
    }
  }

  handleKey(key: KeyEvent, ctx: SceneContext): SceneSignal | void {
    // During animation, q cancels the cast and leaves the scene.
    if (key.type === "char" && key.char === "q") {
      return { type: this.exitSignal };
    }

    // Esc leaves from any phase — matching toss/yarrow semantics (the footer
    // advertises it; it must work). The destination is the constructor's
    // exitSignal: home for standalone casts, back for journal replays.
    if (key.type === "escape") {
      return { type: this.exitSignal };
    }

    // Reveal in progress — pace control (mirrors the yarrow ritual).
    if (!this.model.showPrompt) {
      if (key.type === "char" && key.char === " ") {
        this.model.paused = !this.model.paused;
        return;
      }
      if (key.type === "char" && key.char === "s") {
        this.model.paused = false;
        this.skipToComplete();
        return;
      }
      if (key.type === "char" && key.char === "f") {
        const next = (PACE_SPEEDS.indexOf(this.model.speed) + 1) % PACE_SPEEDS.length;
        this.model.speed = PACE_SPEEDS[next];
        return;
      }
    }

    // Exploration mode: left/right arrows switch focus
    if (this.model.explorationMode && key.type === "arrow") {
      if (key.direction === "left" && this.model.focusedHex === "becoming") {
        this.setFocusedHex("primary");
        return;
      }
      if (key.direction === "right" && this.model.focusedHex === "primary" && this.model.cast.becoming !== null) {
        this.setFocusedHex("becoming");
        return;
      }
    }

    // Enter in exploration mode opens dictionary for focused hex.
    // Primary detail carries the cast's changing positions so the detail
    // view can mark the moving lines; the becoming's line texts are not
    // read classically, so it opens without cast context.
    if (this.model.explorationMode && key.type === "enter") {
      const primaryFocused = this.model.focusedHex === "primary";
      const kw = primaryFocused
        ? this.model.cast.primary
        : this.model.cast.becoming;
      if (kw) {
        return primaryFocused && this.model.cast.changingPositions.length > 0
          ? { type: "openDetail", kw, changedPositions: [...this.model.cast.changingPositions] }
          : { type: "openDetail", kw };
      }
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
   * glyph animator. Single method for all focus changes.
   */
  private setFocusedHex(hex: "primary" | "becoming"): void {
    this.model.focusedHex = hex;
    const entry = hex === "primary"
      ? this.model.primaryGlyphEntry
      : this.model.becomingGlyphEntry;
    if (entry && this.glyphConfig) {
      if (this.glyphAnimScale > 0) {
        this.model.glyphAnimator = createGlyphAnimator(
          this.glyphConfig.glyphAnim,
          entry,
          this.glyphAnimScale,
        );
        this.model.glyphAnimDone = false;
      } else {
        // Reduced motion: no animation — show the settled glyph immediately.
        this.model.glyphAnimator = null;
        this.model.glyphAnimDone = true;
      }
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

/** Render the pace-control hints while the reveal is still unfolding. */
function renderPaceFooter(buf: CellBuffer, model: CastModel, language: DisplayLanguage): void {
  const t = getTheme();
  const speed = model.speed > 1 ? `  ·  ${model.speed}×` : "";
  const text = model.paused
    ? `[space] ${tr(language, "verb.resume")}  ·  [s] ${tr(language, "verb.skip")}  ·  [esc] ${tr(language, "verb.back")}`
    : `[space] ${tr(language, "verb.pause")}  ·  [f] ${tr(language, "verb.speed")}  ·  [s] ${tr(language, "verb.skip")}  ·  [esc] ${tr(language, "verb.back")}${speed}`;
  const row = buf.height - 2;
  if (row < 0) return;
  const w = stringWidth(text);
  const col = Math.max(0, Math.floor((buf.width - w) / 2));
  buf.writeText(row, col, text, { fg: t.tertiary, dim: true });
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
