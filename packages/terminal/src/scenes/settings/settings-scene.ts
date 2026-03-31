// SettingsScene — configure glyph animation, font, size, and motion preset

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { GlyphAnimator, GlyphAnimStyle } from "../../glyph-anim/types.ts";
import type { GlyphFont, GlyphSize } from "@iching/core";
import type { MotionPreset } from "../../animation/presets.ts";
import { LARGE_GLYPHS } from "@iching/core";
import { createGlyphAnimator } from "../../glyph-anim/factory.ts";
import { TEMPLE_NIGHT } from "../../color/themes/temple-night.ts";
import { stringWidth } from "../../layout/measure.ts";

// ── Setting definitions ──────────────────────────────────────────────

const ANIM_OPTIONS: GlyphAnimStyle[] = ["noise", "dots", "radial", "sand"];
const FONT_OPTIONS: GlyphFont[] = ["kaiti", "libian", "heiti"];
const SIZE_OPTIONS: GlyphSize[] = [64, 48, 32];
const MOTION_OPTIONS: MotionPreset[] = ["default", "brisk", "deep", "reduced"];

interface SettingRow<T> {
  label: string;
  options: T[];
  selected: number;
}

export interface SettingsValues {
  glyphAnim: GlyphAnimStyle;
  glyphFont: GlyphFont;
  glyphSize: GlyphSize;
  motion: MotionPreset;
}

// ── Preview glyph (乾 "qian" — the first hexagram) ────────────────

const PREVIEW_CHAR = "乾";

// ── Scene ────────────────────────────────────────────────────────────

export class SettingsScene implements Scene {
  private focusedRow = 0;
  private rows: SettingRow<string>[];
  private previewAnimator: GlyphAnimator | null = null;
  private previewActive = false;
  private values: SettingsValues;

  constructor(initial: SettingsValues) {
    this.values = { ...initial };
    this.rows = [
      { label: "Glyph Animation", options: [...ANIM_OPTIONS], selected: ANIM_OPTIONS.indexOf(initial.glyphAnim) },
      { label: "Font",            options: [...FONT_OPTIONS],  selected: FONT_OPTIONS.indexOf(initial.glyphFont) },
      { label: "Glyph Size",      options: SIZE_OPTIONS.map(String), selected: SIZE_OPTIONS.indexOf(initial.glyphSize) },
      { label: "Motion Preset",   options: [...MOTION_OPTIONS], selected: MOTION_OPTIONS.indexOf(initial.motion) },
    ];
    // Fix any -1 indices from missing defaults
    for (const row of this.rows) {
      if (row.selected < 0) row.selected = 0;
    }
  }

  /** Get current settings values. */
  getValues(): SettingsValues {
    return {
      glyphAnim: ANIM_OPTIONS[this.rows[0].selected],
      glyphFont: FONT_OPTIONS[this.rows[1].selected],
      glyphSize: SIZE_OPTIONS[this.rows[2].selected],
      motion: MOTION_OPTIONS[this.rows[3].selected],
    };
  }

  enter(_ctx: SceneContext): void {}

  update(elapsed: number, _dt: number, _ctx: SceneContext): void {
    if (this.previewActive && this.previewAnimator) {
      const done = this.previewAnimator.update(elapsed);
      if (done) {
        this.previewActive = false;
      }
    }
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const cx = Math.floor(frame.width / 2);
    let row = 2;

    // ── Title ──
    const title = "Settings";
    const titleCol = cx - Math.floor(stringWidth(title) / 2);
    frame.writeText(row, titleCol, title, { fg: TEMPLE_NIGHT.bone, bold: true });
    row += 1;

    // Separator
    const sep = "\u2500".repeat(Math.min(48, frame.width - 4));
    const sepCol = cx - Math.floor(stringWidth(sep) / 2);
    frame.writeText(row, sepCol, sep, { fg: TEMPLE_NIGHT.ash, dim: true });
    row += 2;

    // ── Setting rows ──
    const leftMargin = Math.max(2, cx - 24);

    for (let i = 0; i < this.rows.length; i++) {
      const setting = this.rows[i];
      const isFocused = i === this.focusedRow;

      // Label
      const labelFg = isFocused ? TEMPLE_NIGHT.bone : TEMPLE_NIGHT.stone;
      frame.writeText(row, leftMargin, setting.label, { fg: labelFg, bold: isFocused });
      row += 1;

      // Options line
      const prefix = isFocused ? "> " : "  ";
      frame.writeText(row, leftMargin, prefix, { fg: TEMPLE_NIGHT.ash });

      let col = leftMargin + stringWidth(prefix);
      for (let j = 0; j < setting.options.length; j++) {
        const opt = setting.options[j];
        const isSelected = j === setting.selected;

        if (isSelected) {
          const bracketedOpt = `[${opt}]`;
          const fg = isFocused ? TEMPLE_NIGHT.bone : TEMPLE_NIGHT.stone;
          frame.writeText(row, col, bracketedOpt, { fg, bold: isFocused });
          col += stringWidth(bracketedOpt);
        } else {
          const fg = TEMPLE_NIGHT.ash;
          frame.writeText(row, col, opt, { fg });
          col += stringWidth(opt);
        }

        // Space between options
        if (j < setting.options.length - 1) {
          frame.writeText(row, col, "  ", { fg: TEMPLE_NIGHT.ash });
          col += 2;
        }
      }

      row += 2;
    }

    // ── Separator before preview ──
    frame.writeText(row, sepCol, sep, { fg: TEMPLE_NIGHT.ash, dim: true });
    row += 2;

    // ── Preview label ──
    frame.writeText(row, leftMargin, "Preview:", { fg: TEMPLE_NIGHT.stone });
    row += 1;

    // ── Preview area ──
    const vals = this.getValues();
    const glyphData = LARGE_GLYPHS[PREVIEW_CHAR]?.[vals.glyphFont]?.[vals.glyphSize];

    if (glyphData) {
      const previewCol = cx - Math.floor(glyphData.width / 2);
      if (this.previewActive && this.previewAnimator) {
        this.previewAnimator.render(frame, row, previewCol);
      } else {
        // Static glyph display
        for (let r = 0; r < glyphData.height; r++) {
          const chars = [...(glyphData.rows[r] ?? "")];
          for (let c = 0; c < chars.length; c++) {
            const ch = chars[c];
            const fg = ch === "\u2800" || ch === " " ? TEMPLE_NIGHT.ash : TEMPLE_NIGHT.stone;
            frame.writeText(row + r, previewCol + c, ch, { fg });
          }
        }
      }
      row += glyphData.height + 1;
    } else {
      frame.writeText(row, leftMargin, "(no glyph data)", { fg: TEMPLE_NIGHT.ash, dim: true });
      row += 2;
    }

    // ── Footer ──
    const footerRow = frame.height - 2;
    const footer = "\u2191\u2193 setting  \u2190\u2192 option  enter preview  esc back";
    const footerCol = cx - Math.floor(stringWidth(footer) / 2);
    // Separator above footer
    frame.writeText(footerRow - 1, sepCol, sep, { fg: TEMPLE_NIGHT.ash, dim: true });
    frame.writeText(footerRow, footerCol, footer, { fg: TEMPLE_NIGHT.ash, dim: true });
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
          const row = this.rows[this.focusedRow];
          row.selected = (row.selected - 1 + row.options.length) % row.options.length;
          // Stop any running preview when options change
          this.previewActive = false;
          this.previewAnimator = null;
          break;
        }
        case "right": {
          const row = this.rows[this.focusedRow];
          row.selected = (row.selected + 1) % row.options.length;
          this.previewActive = false;
          this.previewAnimator = null;
          break;
        }
      }
    }

    if (key.type === "enter") {
      this.startPreview();
    }
  }

  private startPreview(): void {
    const vals = this.getValues();
    const glyphData = LARGE_GLYPHS[PREVIEW_CHAR]?.[vals.glyphFont]?.[vals.glyphSize];
    if (!glyphData) return;

    this.previewAnimator = createGlyphAnimator(vals.glyphAnim, glyphData);
    this.previewActive = true;
  }
}
