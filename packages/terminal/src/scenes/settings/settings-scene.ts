// SettingsScene — configure theme, glyph animation, font, cast mode

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { GlyphAnimator, GlyphAnimStyle } from "../../glyph-anim/types.ts";
import type { DisplayLanguage, GlyphFont, GlyphSize } from "@iching/core";
import type { TaijituStyle } from "../home/taijitu-render.ts";
import { renderTaijitu } from "../home/taijitu-render.ts";
import { createGlyphAnimator } from "../../glyph-anim/factory.ts";
import { composeGlyph } from "../../glyph-anim/compose.ts";
import { autoGlyphSize } from "../../glyph-anim/auto-size.ts";
import { getTheme, setTheme, THEME_NAMES, type ThemeName } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { type CoinState, INITIAL_VY, stepCoin, coinFrame } from "../toss/coin-physics.ts";
import { renderCoinSet, CoinAutoPreview } from "../cast/coin-renderer.ts";
import { renderYarrowFieldStrip, drawApertureCursor } from "../yarrow/field-renderer.ts";
import { YarrowAutoPreview, YarrowManualPreview } from "../yarrow/yarrow-previews.ts";
import { LINE_WIDTH } from "../../glyphs.ts";
import { tr, type MessageKey } from "../../i18n/messages.ts";
import { optionLabel } from "../../i18n/option-labels.ts";
import { windowFor } from "../../widgets/scroll.ts";

// ── Setting definitions ──────────────────────────────────────────────

const ANIM_OPTIONS: GlyphAnimStyle[] = ["dots", "noise", "radial", "sand"];
const FONT_OPTIONS: GlyphFont[] = ["kaiti", "libian", "heiti"];
const LANGUAGE_OPTIONS: DisplayLanguage[] = ["en", "zh-Hant", "zh-Hans"];
const LANGUAGE_LABELS: Record<DisplayLanguage, string> = {
  en: "EN",
  "zh-Hans": "简",
  "zh-Hant": "繁",
};
const TAIJITU_OPTIONS: TaijituStyle[] = ["dots", "dense"];
const CAST_METHOD_OPTIONS = ["coin", "yarrow"] as const;
const CAST_MODE_OPTIONS = ["auto", "manual"] as const;

interface SettingRow {
  /** Stable message-catalog key; the visible label is localized at render time. */
  key: MessageKey;
  /**
   * Canonical option tokens — what getValues()/persistence sees. The displayed
   * chip text is derived per-render via chipLabel(); labels are never stored on
   * the row, so they can never round-trip into config.
   */
  values: readonly string[];
  selected: number;
}

/**
 * Display label for an option chip. The Language row uses endonym badges
 * (EN/繁/简) that are deliberately invariant across display languages; every
 * other row resolves through the option-label catalog and falls back to the
 * canonical token when no label is ratified (e.g. theme names, deferred).
 */
function chipLabel(lang: DisplayLanguage, key: MessageKey, value: string): string {
  if (key === "settings.language") {
    for (const l of LANGUAGE_OPTIONS) if (l === value) return LANGUAGE_LABELS[l];
    return value;
  }
  return optionLabel(lang, key, value);
}

export interface SettingsValues {
  theme: ThemeName;
  language: DisplayLanguage;
  glyphAnim: GlyphAnimStyle;
  glyphFont: GlyphFont;
  taijituStyle: TaijituStyle;
  castMethod: "coin" | "yarrow";
  castMode: "auto" | "manual";
}

// ── Preview constants ─────────────────────────────────────────────────

const PREVIEW_CHAR = "乾";
const COIN_PAUSE_SECS = 0.8;

/**
 * Vertical placement of the yarrow bar inside the preview pane.
 * The live scene anchors stalks at the bottom because hexagram lines
 * stack above them. The preview has no lines to accumulate, so the
 * bottom-anchor reads as "floor-stuck" against the section separator.
 * Center the bar+count pair vertically, matching coin auto's coinRow
 * formula (`startRow + floor(availRows / 2)`) so the two previews
 * share a visual midline.
 */
function yarrowFieldOffset(availRows: number): number {
  return Math.max(1, Math.floor(availRows / 2));
}

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
  private coinAuto: CoinAutoPreview | null = null;
  // cast-yarrow / cast-yarrow-manual preview — parallel to coinAuto above.
  private yarrowAuto: YarrowAutoPreview | null = null;
  private yarrowManual: YarrowManualPreview | null = null;

  constructor(initial: SettingsValues) {
    this.values = { ...initial };
    this.rows = [
      { key: "settings.theme",          values: THEME_NAMES,         selected: Math.max(0, THEME_NAMES.indexOf(initial.theme)) },
      { key: "settings.language",       values: LANGUAGE_OPTIONS,    selected: Math.max(0, LANGUAGE_OPTIONS.indexOf(initial.language)) },
      { key: "settings.taijitu",        values: TAIJITU_OPTIONS,     selected: Math.max(0, TAIJITU_OPTIONS.indexOf(initial.taijituStyle)) },
      { key: "settings.glyphAnimation", values: ANIM_OPTIONS,        selected: Math.max(0, ANIM_OPTIONS.indexOf(initial.glyphAnim)) },
      { key: "settings.font",           values: FONT_OPTIONS,        selected: Math.max(0, FONT_OPTIONS.indexOf(initial.glyphFont)) },
      { key: "settings.castMethod",     values: CAST_METHOD_OPTIONS, selected: Math.max(0, CAST_METHOD_OPTIONS.indexOf(initial.castMethod)) },
      { key: "settings.castMode",       values: CAST_MODE_OPTIONS,   selected: Math.max(0, CAST_MODE_OPTIONS.indexOf(initial.castMode)) },
    ];
    this.previewKind = this.previewKindForKey(this.rows[0]?.key);
  }

  /**
   * Current selections as canonical tokens. Field↔row mapping is by row KEY,
   * not row position — reordering or inserting rows cannot silently swap
   * persisted values. selectedValue() finds the row that owns the key and
   * narrows its selected token back to the field's union without casts; an
   * unknown value falls back to the field default.
   */
  getValues(): SettingsValues {
    return {
      theme: this.selectedValue(THEME_NAMES, "settings.theme", "bone"),
      language: this.selectedValue(LANGUAGE_OPTIONS, "settings.language", "en"),
      taijituStyle: this.selectedValue(TAIJITU_OPTIONS, "settings.taijitu", "dots"),
      glyphAnim: this.selectedValue(ANIM_OPTIONS, "settings.glyphAnimation", "dots"),
      glyphFont: this.selectedValue(FONT_OPTIONS, "settings.font", "kaiti"),
      castMethod: this.selectedValue(CAST_METHOD_OPTIONS, "settings.castMethod", "coin"),
      castMode: this.selectedValue(CAST_MODE_OPTIONS, "settings.castMode", "auto"),
    };
  }

  private selectedValue<T extends string>(allowed: readonly T[], key: MessageKey, fallback: T): T {
    const row = this.rows.find((r) => r.key === key);
    const raw = row ? row.values[row.selected] : undefined;
    return allowed.find((v) => v === raw) ?? fallback;
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
        this.coinAuto?.step(dt);
        break;

      case "cast-yarrow":
        this.yarrowAuto?.step(dt);
        break;

      case "cast-yarrow-manual":
        this.yarrowManual?.step(dt);
        break;
    }
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const t = getTheme();
    const cx = Math.floor(frame.width / 2);
    let row = 2;

    // Title. Localize from the LIVE selection (getValues), not the saved
    // snapshot (this.values, refreshed only on Escape) — so moving the Language
    // row with ←/→ re-localizes the scene immediately, matching how Theme already
    // previews live via onOptionChanged.
    const lang = this.getValues().language;
    const title = tr(lang, "settings.title");
    frame.writeText(row, cx - Math.floor(stringWidth(title) / 2), title, { fg: t.primary, bold: true });
    row += 1;

    // Separator
    const sep = "─".repeat(Math.min(48, frame.width - 4));
    const sepCol = cx - Math.floor(stringWidth(sep) / 2);
    frame.writeText(row, sepCol, sep, { fg: t.border });
    row += 2;

    // Setting rows
    const left = Math.max(2, cx - 24);

    // Adaptive spacing: wide layout is 3 rows per setting (label + options +
    // gap), compact is 2. When even compact can't fit every row above the
    // footer (very short terminals, e.g. h<22 with 7 settings), scroll a window
    // of settings so the FOCUSED row is always visible — otherwise the last rows
    // render under the bottom-anchored footer and the user edits a setting blind.
    const compact = frame.height < this.rows.length * 3 + 7;
    const interRowGap = compact ? 1 : 2;
    // Label-to-label row delta: the label row, then the options row, then the
    // inter-row gap → 1 + interRowGap (the options row is the "+1").
    const rowsPerSetting = 1 + interRowGap;

    // Footer is anchored to the bottom; settings + preview share the space above.
    const footerRow = frame.height - 2;
    const footerSepRow = footerRow - 1;

    const settingsStartRow = row;
    const availSettingRows = footerSepRow - settingsStartRow;
    const maxVisible = Math.max(1, Math.floor(availSettingRows / rowsPerSetting));
    // Window that keeps the focused row in view, scrolling no more than needed.
    const { start: scrollStart, end: scrollEnd } = windowFor(
      this.focusedRow,
      maxVisible,
      this.rows.length,
    );

    for (let i = scrollStart; i < scrollEnd; i++) {
      const setting = this.rows[i];
      const focused = i === this.focusedRow;

      // Edge hint when more settings exist above/below the visible window.
      const hint =
        i === scrollStart && scrollStart > 0 ? "  ↑"
        : i === scrollEnd - 1 && scrollEnd < this.rows.length ? "  ↓"
        : "";

      frame.writeText(row, left, tr(lang, setting.key) + hint, {
        fg: focused ? t.primary : t.secondary,
        bold: focused,
      });
      row += 1;

      const prefix = focused ? "> " : "  ";
      frame.writeText(row, left, prefix, { fg: t.tertiary });

      let col = left + stringWidth(prefix);
      for (let j = 0; j < setting.values.length; j++) {
        const opt = chipLabel(lang, setting.key, setting.values[j] ?? "");
        const sel = j === setting.selected;
        if (sel) {
          const text = `[${opt}]`;
          frame.writeText(row, col, text, { fg: focused ? t.accent : t.primary, bold: focused });
          col += stringWidth(text);
        } else {
          frame.writeText(row, col, opt, { fg: t.tertiary });
          col += stringWidth(opt);
        }
        if (j < setting.values.length - 1) col += 2;
      }

      row += interRowGap;
    }

    const footer = `[↑↓] ${tr(lang, "verb.setting")}  ·  [←→] ${tr(lang, "verb.option")}  ·  [esc] ${tr(lang, "verb.saveBack")}`;

    const sectionSepRow = row;
    const previewLabelRow = row + 2;
    const previewContentRow = previewLabelRow + 1;
    const previewAvailRows = footerSepRow - previewContentRow;
    const MIN_PREVIEW_ROWS = 4;

    if (previewAvailRows >= MIN_PREVIEW_ROWS) {
      frame.writeText(sectionSepRow, sepCol, sep, { fg: t.border });
      frame.writeText(previewLabelRow, left, tr(lang, "settings.preview"), { fg: t.secondary });
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
        if (!this.coinAuto) this.coinAuto = new CoinAutoPreview();
        const coinRow = startRow + Math.floor(availRows / 2);
        const coinCenterCol = Math.floor((frame.width - LINE_WIDTH) / 2) + Math.floor(LINE_WIDTH / 2);
        renderCoinSet(frame, coinCenterCol, coinRow, this.coinAuto.phase, this.coinAuto.progress, this.coinAuto.results);
        break;
      }

      case "cast-yarrow": {
        if (!this.yarrowAuto) this.yarrowAuto = new YarrowAutoPreview();
        const fieldRow = startRow + yarrowFieldOffset(availRows);
        renderYarrowFieldStrip(frame, this.yarrowAuto.model, fieldRow, vals.language);
        break;
      }

      case "cast-yarrow-manual": {
        if (!this.yarrowManual) this.yarrowManual = new YarrowManualPreview();
        const fieldRow = startRow + yarrowFieldOffset(availRows);
        renderYarrowFieldStrip(frame, this.yarrowManual.model, fieldRow, vals.language);
        // Aperture overlay only during sweep/snap — during play the runner
        // mutates the bar, and the aperture would smear over the action.
        if (this.yarrowManual.phase !== "playing") {
          drawApertureCursor(
            frame, fieldRow, Math.floor(frame.width / 2),
            this.yarrowManual.apertureLeft,
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
          r.selected = (r.selected - 1 + r.values.length) % r.values.length;
          this.onOptionChanged();
          break;
        }
        case "right": {
          const r = this.rows[this.focusedRow];
          r.selected = (r.selected + 1) % r.values.length;
          this.onOptionChanged();
          break;
        }
      }
    }

    if (key.type === "enter" && this.previewKind === "glyph") {
      this.startPreview();
    }
  }

  private previewKindForKey(key: MessageKey | undefined): PreviewKind {
    if (key === "settings.taijitu") return "taijitu";
    if (key === "settings.castMethod" || key === "settings.castMode") {
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
    this.coinAuto = null;
    this.yarrowAuto = null;
    this.yarrowManual = null;
  }

  private onFocusChanged(): void {
    const key = this.rows[this.focusedRow]?.key;
    this.resetCastPreview();
    this.previewActive = false;
    this.previewKind = this.previewKindForKey(key);
    if (key === "settings.glyphAnimation" || key === "settings.font") this.startPreview();
  }

  private onOptionChanged(): void {
    const vals = this.getValues();
    setTheme(vals.theme);
    const key = this.rows[this.focusedRow]?.key;
    if (key === "settings.glyphAnimation" || key === "settings.font") {
      this.startPreview();
    } else if (key === "settings.castMethod" || key === "settings.castMode") {
      this.resetCastPreview();
      this.previewKind = this.previewKindForKey(key);
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
