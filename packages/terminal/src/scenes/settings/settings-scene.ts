// SettingsScene — configure theme, glyph animation, font, size

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { GlyphAnimator, GlyphAnimStyle } from "../../glyph-anim/types.ts";
import type { GlyphFont, GlyphSize } from "@iching/core";
import { LARGE_GLYPHS } from "@iching/core";
import { createGlyphAnimator } from "../../glyph-anim/factory.ts";
import { getTheme, setTheme, THEME_NAMES, type ThemeName } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";

// ── Setting definitions ──────────────────────────────────────────────

const ANIM_OPTIONS: GlyphAnimStyle[] = ["noise", "dots", "radial", "sand"];
const FONT_OPTIONS: GlyphFont[] = ["kaiti", "libian", "heiti"];
const SIZE_OPTIONS: GlyphSize[] = [64, 48, 32];

interface SettingRow {
  label: string;
  options: string[];
  selected: number;
}

export interface SettingsValues {
  theme: ThemeName;
  glyphAnim: GlyphAnimStyle;
  glyphFont: GlyphFont;
  glyphSize: GlyphSize;
}

// ── Preview glyph ────────────────────────────────────────────────────

const PREVIEW_CHAR = "乾";

// ── Scene ────────────────────────────────────────────────────────────

export class SettingsScene implements Scene {
  private focusedRow = 0;
  private rows: SettingRow[];
  private previewAnimator: GlyphAnimator | null = null;
  private previewActive = false;
  private values: SettingsValues;

  constructor(initial: SettingsValues) {
    this.values = { ...initial };
    this.rows = [
      { label: "Theme",           options: [...THEME_NAMES],             selected: Math.max(0, THEME_NAMES.indexOf(initial.theme)) },
      { label: "Glyph Animation", options: [...ANIM_OPTIONS],            selected: Math.max(0, ANIM_OPTIONS.indexOf(initial.glyphAnim)) },
      { label: "Font",            options: [...FONT_OPTIONS],            selected: Math.max(0, FONT_OPTIONS.indexOf(initial.glyphFont)) },
      { label: "Glyph Size",      options: SIZE_OPTIONS.map(String),     selected: Math.max(0, SIZE_OPTIONS.indexOf(initial.glyphSize)) },
    ];
  }

  getValues(): SettingsValues {
    return {
      theme: THEME_NAMES[this.rows[0].selected] ?? "temple-night",
      glyphAnim: ANIM_OPTIONS[this.rows[1].selected] ?? "noise",
      glyphFont: FONT_OPTIONS[this.rows[2].selected] ?? "kaiti",
      glyphSize: SIZE_OPTIONS[this.rows[3].selected] ?? 64,
    };
  }

  enter(_ctx: SceneContext): void {}

  update(elapsed: number, _dt: number, _ctx: SceneContext): void {
    if (this.previewActive && this.previewAnimator) {
      if (this.previewAnimator.update(elapsed)) {
        this.previewActive = false;
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

      // Label
      frame.writeText(row, left, setting.label, {
        fg: focused ? t.primary : t.secondary,
        bold: focused,
      });
      row += 1;

      // Options
      const prefix = focused ? "> " : "  ";
      frame.writeText(row, left, prefix, { fg: t.tertiary });

      let col = left + stringWidth(prefix);
      for (let j = 0; j < setting.options.length; j++) {
        const opt = setting.options[j];
        const sel = j === setting.selected;

        if (sel) {
          const text = `[${opt}]`;
          frame.writeText(row, col, text, {
            fg: focused ? t.accent : t.primary,
            bold: focused,
          });
          col += stringWidth(text);
        } else {
          frame.writeText(row, col, opt, { fg: t.tertiary });
          col += stringWidth(opt);
        }

        if (j < setting.options.length - 1) {
          col += 2;
        }
      }

      row += 2;
    }

    // Separator
    frame.writeText(row, sepCol, sep, { fg: t.border });
    row += 2;

    // Preview
    frame.writeText(row, left, "Preview:", { fg: t.secondary });
    row += 1;

    const vals = this.getValues();
    const glyphData = LARGE_GLYPHS[PREVIEW_CHAR]?.[vals.glyphFont]?.[vals.glyphSize];

    if (glyphData) {
      const previewCol = cx - Math.floor(glyphData.width / 2);
      if (this.previewActive && this.previewAnimator) {
        this.previewAnimator.render(frame, row, previewCol);
      } else {
        for (let r = 0; r < glyphData.height; r++) {
          const chars = [...(glyphData.rows[r] ?? "")];
          for (let c = 0; c < chars.length; c++) {
            const ch = chars[c];
            if (ch === "\u2800" || ch === " ") continue;
            frame.writeText(row + r, previewCol + c, ch, { fg: t.primary });
          }
        }
      }
    }

    // Footer
    const footerRow = frame.height - 2;
    const footer = "↑↓ setting  ←→ option  esc save & back";
    frame.writeText(footerRow - 1, sepCol, sep, { fg: t.border });
    frame.writeText(footerRow, cx - Math.floor(stringWidth(footer) / 2), footer, { fg: t.tertiary });
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "escape") {
      this.values = this.getValues();
      return { goto: "home" };
    }
    if (key.type === "ctrl" && key.char === "c") return "exit";

    if (key.type === "arrow") {
      switch (key.direction) {
        case "up":
          this.focusedRow = (this.focusedRow - 1 + this.rows.length) % this.rows.length;
          break;
        case "down":
          this.focusedRow = (this.focusedRow + 1) % this.rows.length;
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

    if (key.type === "enter") {
      this.startPreview();
    }
  }

  private onOptionChanged(): void {
    // Apply theme change immediately so the settings screen itself updates
    const vals = this.getValues();
    setTheme(vals.theme);
    this.startPreview();
  }

  private startPreview(): void {
    const vals = this.getValues();
    const glyphData = LARGE_GLYPHS[PREVIEW_CHAR]?.[vals.glyphFont]?.[vals.glyphSize];
    if (!glyphData) return;
    this.previewAnimator = createGlyphAnimator(vals.glyphAnim, glyphData);
    this.previewActive = true;
  }
}
