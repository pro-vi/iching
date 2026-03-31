// SandAnimator — each non-empty cell is a particle falling from above
//
// Particles start scattered above the glyph with random braille, then land
// at their target position showing the real character. EaseOutQuad for landing.
// Total duration: ~3500ms.

import type { GlyphEntry } from "@iching/core";
import type { CellBuffer } from "../render/buffer.ts";
import type { GlyphAnimator } from "./types.ts";
import { TEMPLE_NIGHT } from "../color/themes/temple-night.ts";

const TOTAL_MS = 3500;

// Braille block for random in-flight appearance
const BRAILLE_BASE = 0x2800;
const BRAILLE_COUNT = 256;

function randomBraille(): string {
  // Use sparse patterns (few dots) for in-flight look
  const sparse = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
                  0x03, 0x05, 0x09, 0x11, 0x41, 0x21, 0x44, 0x22];
  return String.fromCharCode(BRAILLE_BASE + sparse[Math.floor(Math.random() * sparse.length)]);
}

function isEmpty(ch: string): boolean {
  return ch === "\u2800" || ch === " ";
}

/** Quadratic ease-out. */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
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

interface Particle {
  targetR: number;
  targetC: number;
  realChar: string;
  /** Row offset above glyph where particle starts (negative = above). */
  startOffsetR: number;
  /** Column offset jitter at start. */
  startOffsetC: number;
  /** Time (ms) when this particle begins falling. */
  launchAt: number;
  /** Duration of the fall (ms). */
  fallDuration: number;
}

export class SandAnimator implements GlyphAnimator {
  private readonly glyph: GlyphEntry;
  private particles: Particle[] = [];
  private startTime = -1;
  private localMs = 0;

  constructor(glyph: GlyphEntry) {
    this.glyph = glyph;
    this.initParticles();
  }

  private initParticles(): void {
    this.particles = [];
    const staggerWindow = TOTAL_MS * 0.4; // first 40% is stagger
    const fallBase = TOTAL_MS * 0.45;     // base fall duration
    const fallJitter = TOTAL_MS * 0.15;   // jitter on fall duration

    // Collect content cells
    const contentCells: { r: number; c: number; ch: string }[] = [];
    for (let r = 0; r < this.glyph.height; r++) {
      const chars = [...(this.glyph.rows[r] ?? "")];
      for (let c = 0; c < this.glyph.width; c++) {
        const ch = chars[c] ?? " ";
        if (!isEmpty(ch)) {
          contentCells.push({ r, c, ch });
        }
      }
    }

    // Shuffle for random stagger order
    for (let i = contentCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [contentCells[i], contentCells[j]] = [contentCells[j], contentCells[i]];
    }

    for (let i = 0; i < contentCells.length; i++) {
      const { r, c, ch } = contentCells[i];
      const launchAt = (i / Math.max(contentCells.length - 1, 1)) * staggerWindow;
      this.particles.push({
        targetR: r,
        targetC: c,
        realChar: ch,
        startOffsetR: -(this.glyph.height + 2 + Math.random() * 6),
        startOffsetC: (Math.random() - 0.5) * 4,
        launchAt,
        fallDuration: fallBase + (Math.random() - 0.5) * fallJitter,
      });
    }
  }

  update(elapsed: number): boolean {
    if (this.startTime < 0) this.startTime = elapsed;
    this.localMs = elapsed - this.startTime;
    return this.localMs >= TOTAL_MS;
  }

  render(buf: CellBuffer, offsetR: number, offsetC: number): void {
    const t = this.localMs;

    // First, render empty braille for all positions (background)
    for (let r = 0; r < this.glyph.height; r++) {
      for (let c = 0; c < this.glyph.width; c++) {
        buf.writeText(offsetR + r, offsetC + c, "\u2800", { fg: TEMPLE_NIGHT.ash });
      }
    }

    // Render each particle
    for (const p of this.particles) {
      const particleT = t - p.launchAt;
      if (particleT <= 0) continue; // not launched yet

      const fallProgress = Math.min(1, particleT / p.fallDuration);
      const easedProgress = easeOutQuad(fallProgress);

      // Interpolate position
      const currentR = p.targetR + p.startOffsetR * (1 - easedProgress);
      const currentC = p.targetC + p.startOffsetC * (1 - easedProgress);

      const drawR = Math.round(currentR);
      const drawC = Math.round(currentC);

      // Only draw if within the glyph bounds (roughly)
      if (drawR < -2 || drawR >= this.glyph.height + 2) continue;
      if (drawC < 0 || drawC >= this.glyph.width) continue;

      if (fallProgress >= 0.95) {
        // Landed — show real character at target
        const fg = lerpColor(TEMPLE_NIGHT.stone, TEMPLE_NIGHT.bone, (fallProgress - 0.95) / 0.05);
        buf.writeText(offsetR + p.targetR, offsetC + p.targetC, p.realChar, { fg });
      } else if (fallProgress >= 0.75) {
        // Near target — transition to real character
        const fg = lerpColor(TEMPLE_NIGHT.ash, TEMPLE_NIGHT.stone, (fallProgress - 0.75) / 0.2);
        buf.writeText(offsetR + drawR, offsetC + drawC, p.realChar, { fg });
      } else {
        // In flight — random sparse braille
        const fg = lerpColor(TEMPLE_NIGHT.ash, TEMPLE_NIGHT.stone, fallProgress);
        buf.writeText(offsetR + drawR, offsetC + drawC, randomBraille(), { fg });
      }
    }
  }

  reset(): void {
    this.startTime = -1;
    this.localMs = 0;
    this.initParticles();
  }
}
