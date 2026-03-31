// GlyphAnimator — interface for frame-by-frame glyph reveal animations

import type { CellBuffer } from "../render/buffer.ts";

/** A stateful animator that integrates with the Scene render loop. */
export interface GlyphAnimator {
  /** Advance animation state. Returns true when the animation is complete. */
  update(elapsed: number): boolean;
  /** Render current frame into the buffer at the given offset. */
  render(buf: CellBuffer, offsetR: number, offsetC: number): void;
  /** Reset the animator to its initial state. */
  reset(): void;
}

/** Available glyph animation styles. */
export type GlyphAnimStyle = "noise" | "dots" | "radial" | "sand";
