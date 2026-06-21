// Shared lifecycle for the glyph reveal animators (noise, dots, radial, sand).
//
// Every animator holds the glyph and a duration-scaled clock (localMs since the
// first frame), and reports done from update() when that clock passes its total
// run time. Only the total and the per-frame drawing differ, so those live in
// the subclasses; everything else is here.

import type { CellBuffer } from "../render/buffer.ts";
import type { GlyphEntry } from "@iching/core";
import { type GlyphAnimator, MIN_DURATION_SCALE } from "./types.ts";

export abstract class GlyphAnimatorBase implements GlyphAnimator {
  protected readonly glyph: GlyphEntry;
  /** Motion-preset time dilation: <1 plays the same animation faster. */
  protected readonly durationScale: number;
  protected startTime = -1;
  protected localMs = 0;
  private readonly totalMs: number;

  constructor(glyph: GlyphEntry, durationScale: number, totalMs: number) {
    this.glyph = glyph;
    this.durationScale = Math.max(MIN_DURATION_SCALE, durationScale);
    this.totalMs = totalMs;
  }

  update(elapsed: number): boolean {
    if (this.startTime < 0) this.startTime = elapsed;
    this.localMs = (elapsed - this.startTime) / this.durationScale;
    return this.localMs >= this.totalMs;
  }

  /** Return the clock to its pre-first-frame state — the shared half of reset();
   *  animators that precompute data re-seed it after calling this. */
  protected resetClock(): void {
    this.startTime = -1;
    this.localMs = 0;
  }

  abstract render(buf: CellBuffer, offsetR: number, offsetC: number): void;
  abstract reset(): void;
}
