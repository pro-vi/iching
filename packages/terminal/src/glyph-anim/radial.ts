// RadialAnimator — expanding circle from center of mass reveals the glyph
//
// Cells inside the radius are visible; edge cells have a brightness gradient.
// Total duration: ~2400ms.

import type { GlyphEntry } from "@iching/core";
import type { CellBuffer } from "../render/buffer.ts";
import { GlyphAnimatorBase } from "./animator-base.ts";
import { isEmpty } from "./braille.ts";
import { getTheme } from "../color/theme.ts";
import { lerpColor } from "../color/lerp.ts";
import { easeOut } from "../animation/easing.ts";

/** Total run time (ms) at durationScale 1. */
export const RADIAL_TOTAL_MS = 2400;
const EDGE_WIDTH = 2.5; // cells of gradient at the expanding edge

export class RadialAnimator extends GlyphAnimatorBase {
  private centerR: number;
  private centerC: number;
  private maxRadius: number;

  constructor(glyph: GlyphEntry, durationScale: number = 1) {
    super(glyph, durationScale, RADIAL_TOTAL_MS);

    // Compute center of mass from non-empty cells
    let sumR = 0, sumC = 0, count = 0;
    for (let r = 0; r < glyph.height; r++) {
      const chars = [...(glyph.rows[r] ?? "")];
      for (let c = 0; c < glyph.width; c++) {
        if (!isEmpty(chars[c] ?? " ")) {
          sumR += r;
          sumC += c;
          count++;
        }
      }
    }
    this.centerR = count > 0 ? sumR / count : glyph.height / 2;
    this.centerC = count > 0 ? sumC / count : glyph.width / 2;

    // Max distance from center to any corner
    this.maxRadius = Math.max(
      Math.sqrt((0 - this.centerR) ** 2 + (0 - this.centerC) ** 2),
      Math.sqrt((0 - this.centerR) ** 2 + (glyph.width - this.centerC) ** 2),
      Math.sqrt((glyph.height - this.centerR) ** 2 + (0 - this.centerC) ** 2),
      Math.sqrt((glyph.height - this.centerR) ** 2 + (glyph.width - this.centerC) ** 2),
    );
  }

  render(buf: CellBuffer, offsetR: number, offsetC: number): void {
    const t = getTheme();
    const progress = Math.min(1, this.localMs / RADIAL_TOTAL_MS);
    const easedProgress = easeOut(progress);
    // Expand radius slightly past max so the edge gradient fully clears
    const currentRadius = easedProgress * (this.maxRadius + EDGE_WIDTH);

    for (let r = 0; r < this.glyph.height; r++) {
      const chars = [...(this.glyph.rows[r] ?? "")];
      for (let c = 0; c < this.glyph.width; c++) {
        const ch = chars[c] ?? " ";
        const dist = Math.sqrt((r - this.centerR) ** 2 + (c - this.centerC) ** 2);

        if (dist > currentRadius) {
          // Outside reveal circle: invisible
          buf.writeText(offsetR + r, offsetC + c, " ", { fg: t.tertiary });
        } else if (dist > currentRadius - EDGE_WIDTH) {
          // Edge zone: brightness gradient
          const edgeT = 1 - (dist - (currentRadius - EDGE_WIDTH)) / EDGE_WIDTH;
          if (isEmpty(ch)) {
            buf.writeText(offsetR + r, offsetC + c, "\u2800", { fg: t.tertiary, dim: true });
          } else {
            const fg = lerpColor(t.tertiary, t.primary, edgeT);
            buf.writeText(offsetR + r, offsetC + c, ch, { fg });
          }
        } else {
          // Fully inside: show real glyph
          const fg = isEmpty(ch) ? t.tertiary : t.primary;
          buf.writeText(offsetR + r, offsetC + c, ch, { fg });
        }
      }
    }
  }

  reset(): void {
    this.resetClock();
  }
}
