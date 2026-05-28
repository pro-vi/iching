// SettingsScene — configure theme, glyph animation, font, cast mode

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { GlyphAnimator, GlyphAnimStyle } from "../../glyph-anim/types.ts";
import type { GlyphFont, GlyphSize } from "@iching/core";
import type { TaijituStyle } from "../home/taijitu-render.ts";
import { renderTaijitu } from "../home/taijitu-render.ts";
import { createGlyphAnimator } from "../../glyph-anim/factory.ts";
import { composeGlyph } from "../../glyph-anim/compose.ts";
import { autoGlyphSize } from "../../glyph-anim/auto-size.ts";
import { getTheme, setTheme, THEME_NAMES, type ThemeName } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { type CoinState, INITIAL_VY, stepCoin, coinFrame } from "../toss/coin-physics.ts";
import { renderCoinSet, CoinAnim } from "../cast/coin-renderer.ts";
import { renderYarrowFieldStrip } from "../yarrow/field-renderer.ts";
import { YarrowModel } from "../yarrow/model.ts";
import { buildYarrowRoundBeats } from "../yarrow/yarrow-timeline.ts";
import { getYarrowTiming } from "../../animation/yarrow-presets.ts";
import { seq } from "../../animation/timeline.ts";
import { TimelineRunner } from "../../animation/runner.ts";
import { castYarrowHexagram, SeededRandomSource } from "@iching/core";
import { LINE_WIDTH } from "../../glyphs.ts";

// ── Setting definitions ──────────────────────────────────────────────

const ANIM_OPTIONS: GlyphAnimStyle[] = ["dots", "noise", "radial", "sand"];
const FONT_OPTIONS: GlyphFont[] = ["kaiti", "libian", "heiti"];
const TAIJITU_OPTIONS: TaijituStyle[] = ["dots", "dense"];
const CAST_METHOD_OPTIONS = ["coin", "yarrow"] as const;
const CAST_MODE_OPTIONS = ["auto", "manual"] as const;

interface SettingRow {
  label: string;
  options: string[];
  selected: number;
}

export interface SettingsValues {
  theme: ThemeName;
  glyphAnim: GlyphAnimStyle;
  glyphFont: GlyphFont;
  taijituStyle: TaijituStyle;
  castMethod: "coin" | "yarrow";
  castMode: "auto" | "manual";
}

// ── Preview constants ─────────────────────────────────────────────────

const PREVIEW_CHAR = "乾";
const COIN_PAUSE_SECS = 0.8;
const YARROW_PREVIEW_SEED = 42;           // round 0 split 24|25 — balanced
const YARROW_AUTO_GAP_MS = 800;           // quiet hold between auto loop iterations
const YARROW_MANUAL_WAIT_MS = 1200;       // synthetic "ready to cut" pose

type PreviewKind =
  | "glyph"
  | "taijitu"
  | "cast-manual"
  | "cast-auto"
  | "cast-yarrow"
  | "cast-yarrow-manual";

// ── Scene ────────────────────────────────────────────────────────────

export class SettingsScene implements Scene {
  private focusedRow = 0;
  private rows: SettingRow[];
  private values: SettingsValues;
  private elapsed = 0;
  private previewSize: GlyphSize = 64;

  // Preview state — kind determines which branch is active
  private previewKind: PreviewKind;
  // glyph preview
  private previewAnimator: GlyphAnimator | null = null;
  private previewActive = false;
  // cast-manual preview
  private previewCoins: CoinState[] = [];
  private coinPauseTimer = 0;
  // cast-auto preview
  private coinAnim: CoinAnim | null = null;
  // cast-yarrow / cast-yarrow-manual preview
  private yarrowPreviewKind: "auto" | "manual" | null = null;
  private yarrowModel: YarrowModel | null = null;
  private yarrowRunner: TimelineRunner | null = null;
  private yarrowElapsed = 0;
  private yarrowManualWaiting = false;
  private yarrowManualWaitTimer = 0;

  constructor(initial: SettingsValues) {
    this.values = { ...initial };
    this.rows = [
      { label: "Theme",           options: [...THEME_NAMES],         selected: Math.max(0, THEME_NAMES.indexOf(initial.theme)) },
      { label: "Taijitu",         options: [...TAIJITU_OPTIONS],     selected: Math.max(0, TAIJITU_OPTIONS.indexOf(initial.taijituStyle)) },
      { label: "Glyph Animation", options: [...ANIM_OPTIONS],        selected: Math.max(0, ANIM_OPTIONS.indexOf(initial.glyphAnim)) },
      { label: "Font",            options: [...FONT_OPTIONS],        selected: Math.max(0, FONT_OPTIONS.indexOf(initial.glyphFont)) },
      { label: "Cast Method",     options: [...CAST_METHOD_OPTIONS], selected: Math.max(0, CAST_METHOD_OPTIONS.indexOf(initial.castMethod)) },
      { label: "Cast Mode",       options: [...CAST_MODE_OPTIONS],   selected: Math.max(0, CAST_MODE_OPTIONS.indexOf(initial.castMode)) },
    ];
    this.previewKind = this.previewKindForLabel(this.rows[0]?.label);
  }

  getValues(): SettingsValues {
    return {
      theme: THEME_NAMES[this.rows[0].selected] ?? "bone",
      taijituStyle: TAIJITU_OPTIONS[this.rows[1].selected] ?? "dots",
      glyphAnim: ANIM_OPTIONS[this.rows[2].selected] ?? "dots",
      glyphFont: FONT_OPTIONS[this.rows[3].selected] ?? "kaiti",
      castMethod: CAST_METHOD_OPTIONS[this.rows[4].selected] ?? "coin",
      castMode: CAST_MODE_OPTIONS[this.rows[5].selected] ?? "auto",
    };
  }

  enter(_ctx: SceneContext): void {}

  update(elapsed: number, dt: number, _ctx: SceneContext): void {
    this.elapsed = elapsed;
    const dtSec = dt / 1000;

    switch (this.previewKind) {
      case "glyph":
        if (this.previewActive && this.previewAnimator) {
          if (this.previewAnimator.update(elapsed)) this.previewActive = false;
        }
        break;

      case "taijitu":
        // driven by this.elapsed in renderPreview — no per-frame state needed
        break;

      case "cast-manual": {
        const coin = this.previewCoins[0];
        if (coin) {
          if (coin.phase === "settled") {
            this.coinPauseTimer += dtSec;
            if (this.coinPauseTimer >= COIN_PAUSE_SECS) {
              coin.y = coin.landY - 8;
              coin.vy = INITIAL_VY + (Math.random() - 0.5) * 4;
              coin.flipAngle = 0;
              coin.result = Math.random() < 0.5;
              coin.phase = "flying";
              coin.bounces = 0;
              coin.spinRate = 0;
              this.coinPauseTimer = 0;
            }
          } else {
            stepCoin(coin, dt);
          }
        }
        break;
      }

      case "cast-auto":
        this.coinAnim?.step(dt);
        break;

      case "cast-yarrow":
      case "cast-yarrow-manual": {
        const kind = this.previewKind === "cast-yarrow-manual" ? "manual" : "auto";
        this.ensureYarrowPreview(kind);
        if (!this.yarrowRunner || !this.yarrowModel) break;

        if (kind === "manual" && this.yarrowManualWaiting) {
          this.yarrowManualWaitTimer += dt;
          if (this.yarrowManualWaitTimer >= YARROW_MANUAL_WAIT_MS) {
            // Synthetic cut — kick off the round.
            this.yarrowManualWaiting = false;
            this.yarrowManualWaitTimer = 0;
            this.yarrowRunner.reset();
            this.yarrowElapsed = 0;
          }
          break; // hold the gather pose
        }

        this.yarrowElapsed += dt;
        const done = this.yarrowRunner.advance(this.yarrowElapsed, this.yarrowModel);
        if (!done) break;

        if (kind === "auto") {
          // Hold the carry-end pose briefly, then reset to a clean gather
          // and loop. `done` stays true past completion, so we wait for the
          // elapsed counter to cross duration + gap before resetting.
          if (this.yarrowElapsed >= this.yarrowRunner.duration + YARROW_AUTO_GAP_MS) {
            this.yarrowModel?.resetActiveLine(0, this.yarrowModel.transcript[0].rounds[0].startCount);
            this.yarrowRunner.reset();
            this.yarrowElapsed = 0;
          }
        } else {
          // Manual: return to the waiting pose. Reset state FIRST so the
          // gather frame is clean — otherwise the post-carry centered bar
          // sits visible under the hint until the next cut.
          this.yarrowModel?.resetActiveLine(0, this.yarrowModel.transcript[0].rounds[0].startCount);
          this.yarrowManualWaiting = true;
          this.yarrowManualWaitTimer = 0;
        }
        break;
      }
    }
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const t = getTheme();
    const cx = Math.floor(frame.width / 2);
    let row = 2;

    // Title
    const title = "Settings";
    frame.writeText(row, cx - Math.floor(stringWidth(title) / 2), title, { fg: t.primary, bold: true });
    row += 1;

    // Separator
    const sep = "─".repeat(Math.min(48, frame.width - 4));
    const sepCol = cx - Math.floor(stringWidth(sep) / 2);
    frame.writeText(row, sepCol, sep, { fg: t.border });
    row += 2;

    // Setting rows
    const left = Math.max(2, cx - 24);

    for (let i = 0; i < this.rows.length; i++) {
      const setting = this.rows[i];
      const focused = i === this.focusedRow;

      frame.writeText(row, left, setting.label, {
        fg: focused ? t.primary : t.secondary,
        bold: focused,
      });
      row += 1;

      const prefix = focused ? "> " : "  ";
      frame.writeText(row, left, prefix, { fg: t.tertiary });

      let col = left + stringWidth(prefix);
      for (let j = 0; j < setting.options.length; j++) {
        const opt = setting.options[j];
        const sel = j === setting.selected;
        if (sel) {
          const text = `[${opt}]`;
          frame.writeText(row, col, text, { fg: focused ? t.accent : t.primary, bold: focused });
          col += stringWidth(text);
        } else {
          frame.writeText(row, col, opt, { fg: t.tertiary });
          col += stringWidth(opt);
        }
        if (j < setting.options.length - 1) col += 2;
      }

      row += 2;
    }

    // Footer is anchored to the bottom; preview lives in whatever space is left.
    const footerRow = frame.height - 2;
    const footerSepRow = footerRow - 1;
    const footer = "[↑↓] setting  ·  [←→] option  ·  [esc] save & back";

    const sectionSepRow = row;
    const previewLabelRow = row + 2;
    const previewContentRow = previewLabelRow + 1;
    const previewAvailRows = footerSepRow - previewContentRow;
    const MIN_PREVIEW_ROWS = 4;

    if (previewAvailRows >= MIN_PREVIEW_ROWS) {
      frame.writeText(sectionSepRow, sepCol, sep, { fg: t.border });
      frame.writeText(previewLabelRow, left, "Preview:", { fg: t.secondary });
      this.renderPreview(frame, cx, previewContentRow, previewAvailRows);
    }

    // Footer
    frame.writeText(footerSepRow, sepCol, sep, { fg: t.border });
    frame.writeText(footerRow, cx - Math.floor(stringWidth(footer) / 2), footer, { fg: t.tertiary });
  }

  private renderPreview(
    frame: CellBuffer,
    cx: number,
    startRow: number,
    availRows: number,
  ): void {
    const t = getTheme();
    const vals = this.getValues();

    switch (this.previewKind) {
      case "glyph": {
        this.previewSize = autoGlyphSize(availRows, frame.width - 4, 1);
        const glyphData = composeGlyph(PREVIEW_CHAR, vals.glyphFont, this.previewSize);
        if (!glyphData) break;
        const previewCol = cx - Math.floor(glyphData.width / 2);
        if (this.previewActive && this.previewAnimator) {
          this.previewAnimator.render(frame, startRow, previewCol);
        } else {
          for (let r = 0; r < glyphData.height; r++) {
            const chars = [...(glyphData.rows[r] ?? "")];
            for (let c = 0; c < chars.length; c++) {
              const ch = chars[c];
              if (ch === "⠀" || ch === " ") continue;
              frame.writeText(startRow + r, previewCol + c, ch, { fg: t.primary });
            }
          }
        }
        break;
      }

      case "taijitu": {
        const maxFromHeight = Math.floor((availRows - 2) / 2);
        const maxFromWidth = Math.floor((frame.width - 4) / 4);
        const radius = Math.min(maxFromHeight, maxFromWidth);
        // renderTaijitu bails below 4; skip if we can't afford even that
        if (radius < 4) break;
        renderTaijitu(frame, cx, startRow + radius + 1, radius, this.elapsed * 0.0004, vals.taijituStyle);
        break;
      }

      case "cast-manual": {
        if (this.previewCoins.length === 0) {
          const landY = startRow + Math.floor(availRows * 0.7);
          this.previewCoins = [{
            x: cx, y: landY - 8, vx: 0, vy: INITIAL_VY,
            flipAngle: 0, result: Math.random() < 0.5,
            phase: "flying", bounces: 0, landY, spinRate: 0, spinDecay: 0.9,
          }];
          this.coinPauseTimer = 0;
        }
        const coin = this.previewCoins[0]!;
        const coinRow = Math.round(coin.y);
        if (coinRow >= startRow && coinRow < startRow + availRows) {
          frame.writeText(coinRow, cx, coinFrame(coin), { fg: t.primary, bold: coin.phase === "settled" });
        }
        break;
      }

      case "cast-auto": {
        if (!this.coinAnim) this.coinAnim = new CoinAnim();
        const coinRow = startRow + Math.floor(availRows / 2);
        const coinCenterCol = Math.floor((frame.width - LINE_WIDTH) / 2) + Math.floor(LINE_WIDTH / 2);
        renderCoinSet(frame, coinCenterCol, coinRow, this.coinAnim.phase, this.coinAnim.progress, this.coinAnim.results);
        break;
      }

      case "cast-yarrow":
      case "cast-yarrow-manual": {
        if (!this.yarrowModel) break;
        const isManual = this.previewKind === "cast-yarrow-manual";
        // Reserve bottom rows so the count caption (`fieldRow + 1`) and
        // the manual hint don't collide. Auto needs 2 rows from the bottom;
        // manual needs 3 (bar + caption + hint). The takeOne flyer arcs UP
        // ~4 rows and `drawStalk` silently clips out-of-frame writes.
        const reserved = isManual ? 3 : 2;
        const fieldRow = startRow + Math.max(1, availRows - reserved);
        renderYarrowFieldStrip(frame, this.yarrowModel, fieldRow);
        if (isManual && availRows >= 5) {
          const hint = this.yarrowManualWaiting ? "[space] cut" : "counting…";
          const hintRow = startRow + availRows - 1;
          frame.writeText(
            hintRow,
            cx - Math.floor(stringWidth(hint) / 2),
            hint,
            { fg: t.tertiary },
          );
        }
        break;
      }
    }
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "escape") {
      this.values = this.getValues();
      return { type: "home" };
    }
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };

    if (key.type === "arrow") {
      switch (key.direction) {
        case "up":
          this.focusedRow = (this.focusedRow - 1 + this.rows.length) % this.rows.length;
          this.onFocusChanged();
          break;
        case "down":
          this.focusedRow = (this.focusedRow + 1) % this.rows.length;
          this.onFocusChanged();
          break;
        case "left": {
          const r = this.rows[this.focusedRow];
          r.selected = (r.selected - 1 + r.options.length) % r.options.length;
          this.onOptionChanged();
          break;
        }
        case "right": {
          const r = this.rows[this.focusedRow];
          r.selected = (r.selected + 1) % r.options.length;
          this.onOptionChanged();
          break;
        }
      }
    }

    if (key.type === "enter" && this.previewKind === "glyph") {
      this.startPreview();
    }
  }

  private previewKindForLabel(label: string | undefined): PreviewKind {
    if (label === "Taijitu") return "taijitu";
    if (label === "Cast Method" || label === "Cast Mode") {
      const { castMethod, castMode } = this.getValues();
      if (castMethod === "yarrow") {
        return castMode === "manual" ? "cast-yarrow-manual" : "cast-yarrow";
      }
      return castMode === "manual" ? "cast-manual" : "cast-auto";
    }
    return "glyph"; // Theme, Glyph Animation, Font
  }

  private resetCastPreview(): void {
    this.previewCoins = [];
    this.coinPauseTimer = 0;
    this.coinAnim = null;
    this.disposeYarrowPreview();
  }

  /** Build (or rebuild) the yarrow preview state for the requested kind. */
  private ensureYarrowPreview(kind: "auto" | "manual"): void {
    if (this.yarrowPreviewKind === kind && this.yarrowModel && this.yarrowRunner) return;
    this.disposeYarrowPreview();

    const yarrow = castYarrowHexagram(new SeededRandomSource(YARROW_PREVIEW_SEED));
    this.yarrowModel = new YarrowModel(yarrow);

    // Always animate line 0 / round 0 — pedagogically clearest. No captions
    // in the preview: chrome isn't drawn, so a caption write would land in
    // a row we don't own.
    const { timing } = getYarrowTiming("default");
    const round0 = this.yarrowModel.transcript[0].rounds[0];
    const beats = buildYarrowRoundBeats(
      this.yarrowModel,
      timing,
      "expanded",
      0,
      0,
      round0,
      { narrating: false },
    );
    this.yarrowRunner = new TimelineRunner(seq(...beats));
    this.yarrowElapsed = 0;
    this.yarrowPreviewKind = kind;

    if (kind === "manual") {
      // Manual starts in the "ready to cut" pose, like YarrowManualScene
      // after enter().
      this.yarrowModel?.resetActiveLine(0, this.yarrowModel.transcript[0].rounds[0].startCount);
      this.yarrowManualWaiting = true;
      this.yarrowManualWaitTimer = 0;
    } else {
      this.yarrowManualWaiting = false;
      this.yarrowManualWaitTimer = 0;
    }
  }


  private disposeYarrowPreview(): void {
    this.yarrowModel = null;
    this.yarrowRunner = null;
    this.yarrowElapsed = 0;
    this.yarrowPreviewKind = null;
    this.yarrowManualWaiting = false;
    this.yarrowManualWaitTimer = 0;
  }

  private onFocusChanged(): void {
    const label = this.rows[this.focusedRow]?.label;
    this.resetCastPreview();
    this.previewActive = false;
    this.previewKind = this.previewKindForLabel(label);
    if (label === "Glyph Animation" || label === "Font") this.startPreview();
  }

  private onOptionChanged(): void {
    const vals = this.getValues();
    setTheme(vals.theme);
    const label = this.rows[this.focusedRow]?.label;
    if (label === "Glyph Animation" || label === "Font") {
      this.startPreview();
    } else if (label === "Cast Method" || label === "Cast Mode") {
      this.resetCastPreview();
      this.previewKind = this.previewKindForLabel(label);
    }
  }

  private startPreview(): void {
    const vals = this.getValues();
    const glyphData = composeGlyph(PREVIEW_CHAR, vals.glyphFont, this.previewSize);
    if (!glyphData) return;
    this.previewAnimator = createGlyphAnimator(vals.glyphAnim, glyphData);
    this.previewActive = true;
  }
}
