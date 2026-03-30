// layout-calc.ts — pure layout math for side-by-side hexagram comparison

export const MIN_SPLIT_WIDTH = 50;
export const SPLIT_OFFSET = 10;
export const ARROW_GAP = 5;

/** Can the terminal accommodate the side-by-side layout? */
export function canSplit(bufWidth: number): boolean {
  return bufWidth >= MIN_SPLIT_WIDTH;
}

/**
 * Returns the x-offset from natural center for left/right/center positions.
 *
 * @param side - Which hexagram position
 * @param splitProgress - 0 (centered) to 1 (fully split)
 * @returns Column offset from center (negative = left, positive = right)
 */
export function hexColOffset(
  side: "left" | "right" | "center",
  splitProgress: number,
): number {
  if (side === "center") return 0;
  const offset = Math.round(SPLIT_OFFSET * splitProgress);
  return side === "left" ? -offset : offset;
}
