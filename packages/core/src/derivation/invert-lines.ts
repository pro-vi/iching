import type { Line } from "../types.js";

/** 錯 — invert every line's polarity (yang ↔ yin). The shared line-op behind the
 *  polarity (錯卦) and diagonal (錯+綜) derivations. */
export function invertLines(lines: Line[]): Line[] {
  return lines.map((l) => ({ ...l, isYang: !l.isYang }));
}
