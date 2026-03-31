// NoiseAnimator — cells flicker through random braille then settle to the real glyph
//
// Content cells settle over 800-2200ms, center-biased (center settles later).
// Empty cells clear quickly. Color ramp: dim noise -> bright settled.
// Total duration: ~2800ms.

import type { GlyphEntry } from "@iching/core";
import type { CellBuffer } from "../render/buffer.ts";
import type { GlyphAnimator } from "./types.ts";
import { TEMPLE_NIGHT } from "../color/themes/temple-night.ts";

const TOTAL_MS = 2800;
const SETTLE_MIN = 800;
const SETTLE_MAX = 2200;
const EMPTY_CLEAR_MS = 400;

// Braille block: U+2800..U+28FF (256 patterns)
const BRAILLE_BASE = 0x2800;
const BRAILLE_COUNT = 256;

function randomBraille(): string {
  return String.fromCharCode(BRAILLE_BASE + Math.floor(Math.random() * BRAILLE_COUNT));
}

function isEmpty(ch: string): boolean {
  return ch === "\u2800" || ch === " ";
}

/** Center-biased settle time: center cells settle later. */
function settleTime(r: number, c: number, rows: number, cols: number): number {
  const cy = rows / 2;
  const cx = cols / 2;
  const maxDist = Math.sqrt(cy * cy + cx * cx);
  const dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
  const t = 1 - dist / Math.max(maxDist, 1);
  const jitter = (Math.random() - 0.5) * 200;
  return SETTLE_MIN + t * (SETTLE_MAX - SETTLE_MIN) + jitter;
}

function lerpColor(a: string, b: string, t: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = clamp(ar + (br - ar) * t);
  const g = clamp(ag + (bg - ag) * t);
  const bv = clamp(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bv.toString(16).padStart(2, "0")}`;
}

interface CellMeta {
  settleAt: number;
  isContent: boolean;
  realChar: string;
}

export class NoiseAnimator implements GlyphAnimator {
  private readonly glyph: GlyphEntry;
  private cells: CellMeta[][] = [];
  private startTime = -1;
  private localMs = 0;

  constructor(glyph: GlyphEntry) {
    this.glyph = glyph;
    this.initCells();
  }

  private initCells(): void {
    this.cells = [];
    for (let r = 0; r < this.glyph.height; r++) {
      const row: CellMeta[] = [];
      const chars = [...(this.glyph.rows[r] ?? "")];
      for (let c = 0; c < this.glyph.width; c++) {
        const ch = chars[c] ?? " ";
        const isContent = !isEmpty(ch);
        row.push({
          settleAt: isContent
            ? settleTime(r, c, this.glyph.height, this.glyph.width)
            : EMPTY_CLEAR_MS * Math.random(),
          isContent,
          realChar: ch,
        });
      }
      this.cells.push(row);
    }
  }

  update(elapsed: number): boolean {
    if (this.startTime < 0) this.startTime = elapsed;
    this.localMs = elapsed - this.startTime;
    return this.localMs >= TOTAL_MS;
  }

  render(buf: CellBuffer, offsetR: number, offsetC: number): void {
    const t = this.localMs;
    for (let r = 0; r < this.glyph.height; r++) {
      for (let c = 0; c < this.glyph.width; c++) {
        const meta = this.cells[r][c];
        const settled = t >= meta.settleAt;

        let ch: string;
        let fg: string;

        if (settled) {
          ch = meta.realChar;
          fg = meta.isContent ? TEMPLE_NIGHT.bone : TEMPLE_NIGHT.ash;
        } else if (!meta.isContent) {
          const progress = t / Math.max(meta.settleAt, 1);
          if (progress > 0.7) {
            ch = " ";
            fg = TEMPLE_NIGHT.ash;
          } else {
            ch = randomBraille();
            fg = lerpColor(TEMPLE_NIGHT.ash, TEMPLE_NIGHT.stone, progress);
          }
        } else {
          const progress = t / meta.settleAt;
          ch = randomBraille();
          fg = lerpColor(TEMPLE_NIGHT.ash, TEMPLE_NIGHT.stone, progress);
        }

        buf.writeText(offsetR + r, offsetC + c, ch, { fg });
      }
    }
  }

  reset(): void {
    this.startTime = -1;
    this.localMs = 0;
    this.initCells();
  }
}
