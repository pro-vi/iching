import type { RandomSource } from "../random.js";
import type { Cast, Style, Structure } from "../types.js";
import { formatReading } from "../format/reading.js";
import { formatDerived } from "../format/derived.js";

/** Display choice result — null means show nothing */
export type DisplayChoice = string | null;

/**
 * selectDisplay — the probability cascade from main().
 *
 * If `shown` is false (first prompt of day), returns the full reading with "dx" style.
 * Otherwise, uses RandomSource to probabilistically select a display:
 *   4% each: dx, tu, en, te, w, st styles
 *   2.5% each: nuclear, polarity, mirror, becoming, diagonal derived types
 *   ~63.5%: null (no display)
 */
export function selectDisplay(
  cast: Cast,
  structure: Structure,
  shown: boolean,
  source: RandomSource,
): DisplayChoice {
  if (!shown) {
    return formatReading(cast, "dx", structure);
  }

  const r = source.nextBytes(1)[0] / 256;

  if (r < 0.04) return formatReading(cast, "dx", structure);
  if (r < 0.08) return formatReading(cast, "tu", structure);
  if (r < 0.12) return formatReading(cast, "en", structure);
  if (r < 0.16) return formatReading(cast, "te", structure);
  if (r < 0.2) return formatReading(cast, "w", structure);
  if (r < 0.24) return formatReading(cast, "st", structure);
  if (r < 0.265) return formatDerived(cast, "nuclear", source);
  if (r < 0.29) return formatDerived(cast, "polarity", source);
  if (r < 0.315) return formatDerived(cast, "mirror", source);
  if (r < 0.34) {
    const t = formatDerived(cast, "becoming", source);
    if (t) return t;
    return null;
  }
  if (r < 0.365) return formatDerived(cast, "diagonal", source);

  return null;
}
