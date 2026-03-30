import type { Cast } from "../types.js";

/** 错综同象 — Locked pairs where mirror === polarity (only 4 pairs: 泰/否, 隨/蠱, 漸/歸妹, 既濟/未濟) */
export function isLockedPair(cast: Cast): boolean {
  return cast.mirror === cast.polarity;
}
