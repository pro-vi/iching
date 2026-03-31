// DotsAnimator — braille dots fill in one at a time per cell
//
// Scan order: left-to-right, top-to-bottom with slight randomness.
// Cells brighten as more dots appear.
// Total duration: ~3000ms.

import type { GlyphEntry } from "@iching/core";
import type { CellBuffer } from "../render/buffer.ts";
import type { GlyphAnimator } from "./types.ts";
import { TEMPLE_NIGHT } from "../color/themes/temple-night.ts";

const TOTAL_MS = 3000;

// Braille dot positions: each braille char is a 2x4 grid encoded in 8 bits.
// Bit layout: dot1=0x01, dot2=0x02, dot3=0x04, dot4=0x08,
//             dot5=0x10, dot6=0x20, dot7=0x40, dot8=0x80
const DOT_BITS = [0x01, 0x02, 0x04, 0x40, 0x08, 0x10, 0x20, 0x80];

function isEmpty(ch: string): boolean {
  return ch === "\u2800" || ch === " ";
}

/** Get the braille dot pattern (0-255) from a braille character. */
function brailleValue(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x2800 && code <= 0x28ff) return code - 0x2800;
  return 0;
}

/** Convert a dot pattern back to a braille character. */
function toBraille(pattern: number): string {
  return String.fromCharCode(0x2800 + (pattern & 0xff));
}

/** Count the number of set bits. */
function popcount(v: number): number {
  let n = 0;
  while (v) { n += v & 1; v >>= 1; }
  return n;
}

/** Get an ordered list of set dot indices for a braille pattern. */
function getDots(pattern: number): number[] {
  const dots: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (pattern & DOT_BITS[i]) dots.push(i);
  }
  return dots;
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
  isContent: boolean;
  realChar: string;
  pattern: number;
  dots: number[];     // ordered dot indices
  totalDots: number;
  /** Time (ms) when this cell starts revealing dots. */
  startAt: number;
  /** Time (ms) per dot for this cell. */
  dotInterval: number;
}

export class DotsAnimator implements GlyphAnimator {
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
    const totalCells = this.glyph.height * this.glyph.width;
    // Stagger: each cell starts at a different time based on scan order
    const staggerWindow = TOTAL_MS * 0.6; // first 60% is stagger window
    const fillWindow = TOTAL_MS * 0.4;    // each cell has 40% to fill its dots

    let idx = 0;
    for (let r = 0; r < this.glyph.height; r++) {
      const row: CellMeta[] = [];
      const chars = [...(this.glyph.rows[r] ?? "")];
      for (let c = 0; c < this.glyph.width; c++) {
        const ch = chars[c] ?? " ";
        const isContent = !isEmpty(ch);
        const pattern = brailleValue(ch);
        const dots = getDots(pattern);
        const jitter = (Math.random() - 0.5) * (staggerWindow / totalCells) * 2;
        const startAt = isContent
          ? (idx / Math.max(totalCells - 1, 1)) * staggerWindow + jitter
          : 0;
        row.push({
          isContent,
          realChar: ch,
          pattern,
          dots,
          totalDots: dots.length,
          startAt: Math.max(0, startAt),
          dotInterval: dots.length > 0 ? fillWindow / dots.length : 0,
        });
        idx++;
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

        if (!meta.isContent) {
          // Empty cells: just write empty braille
          buf.writeText(offsetR + r, offsetC + c, "\u2800", { fg: TEMPLE_NIGHT.ash });
          continue;
        }

        const cellT = t - meta.startAt;
        if (cellT <= 0) {
          // Not started yet
          buf.writeText(offsetR + r, offsetC + c, "\u2800", { fg: TEMPLE_NIGHT.ash });
          continue;
        }

        // How many dots are visible?
        const dotsVisible = meta.dotInterval > 0
          ? Math.min(meta.totalDots, Math.floor(cellT / meta.dotInterval) + 1)
          : meta.totalDots;

        // Build partial pattern
        let partial = 0;
        for (let d = 0; d < dotsVisible; d++) {
          partial |= DOT_BITS[meta.dots[d]];
        }

        const ch = toBraille(partial);
        const progress = dotsVisible / Math.max(meta.totalDots, 1);
        const fg = lerpColor(TEMPLE_NIGHT.ash, TEMPLE_NIGHT.bone, progress);

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
