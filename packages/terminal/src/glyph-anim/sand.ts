// SandAnimator — each non-empty cell is a particle falling from above
//
// Particles start scattered above the glyph with random braille, then land
// at their target position showing the real character. EaseOutQuad for landing.
// Total duration: ~3500ms.

import type { GlyphEntry } from "@iching/core";
import type { CellBuffer } from "../render/buffer.ts";
import type { GlyphAnimator } from "./types.ts";
import { getTheme } from "../color/theme.ts";
import { lerpColor } from "../color/lerp.ts";

/** Total run time (ms) at durationScale 1. */
export const SAND_TOTAL_MS = 3500;

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
  /** Motion-preset time dilation: <1 plays the same animation faster. */
  private readonly durationScale: number;
  private particles: Particle[] = [];
  private startTime = -1;
  private localMs = 0;

  constructor(glyph: GlyphEntry, durationScale: number = 1) {
    this.glyph = glyph;
    this.durationScale = Math.max(0.05, durationScale);
    this.initParticles();
  }

  private initParticles(): void {
    this.particles = [];
    const staggerWindow = SAND_TOTAL_MS * 0.4; // first 40% is stagger
    const fallBase = SAND_TOTAL_MS * 0.45;     // base fall duration
    const fallJitter = SAND_TOTAL_MS * 0.15;   // jitter on fall duration

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
    this.localMs = (elapsed - this.startTime) / this.durationScale;
    return this.localMs >= SAND_TOTAL_MS;
  }

  render(buf: CellBuffer, offsetR: number, offsetC: number): void {
    const th = getTheme();
    const t = this.localMs;

    // First, render empty braille for all positions (background)
    for (let r = 0; r < this.glyph.height; r++) {
      for (let c = 0; c < this.glyph.width; c++) {
        buf.writeText(offsetR + r, offsetC + c, "\u2800", { fg: th.tertiary });
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
        const fg = lerpColor(th.secondary, th.primary, (fallProgress - 0.95) / 0.05);
        buf.writeText(offsetR + p.targetR, offsetC + p.targetC, p.realChar, { fg });
      } else if (fallProgress >= 0.75) {
        // Near target — transition to real character
        const fg = lerpColor(th.tertiary, th.secondary, (fallProgress - 0.75) / 0.2);
        buf.writeText(offsetR + drawR, offsetC + drawC, p.realChar, { fg });
      } else {
        // In flight — random sparse braille
        const fg = lerpColor(th.tertiary, th.secondary, fallProgress);
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
