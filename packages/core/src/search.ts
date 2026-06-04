// Search hexagrams by Chinese name, pinyin, English name, or KW number

import type { Hexagram } from "./types.js";
import { GUA } from "./data/gua.js";
import { toSimplified } from "./i18n/simplify.js";

/** Strip diacritics from a string for accent-insensitive matching */
function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface ScoredMatch {
  kw: number;
  gua: Hexagram;
  score: number; // lower is better
}

/**
 * Search all 64 hexagrams by query string.
 * Matches against: Chinese name (n), pinyin (p), English name (ename), KW number.
 * Returns results sorted by relevance (exact > prefix > includes).
 */
export function searchHexagrams(query: string): Hexagram[] {
  const q = normalize(query.trim());
  if (q.length === 0) return [...GUA];

  const matches: ScoredMatch[] = [];

  for (let i = 0; i < GUA.length; i++) {
    const gua = GUA[i];
    const kw = i + 1;
    const kwStr = String(kw);
    const chinese = gua.n.toLowerCase();
    // Also match the Simplified rendering of the name: in zh-Hans mode the
    // dictionary displays toSimplified(gua.n) (e.g. 兑), so a user types the
    // simplified form they see — which would never match the Traditional gua.n.
    const chineseSimp = toSimplified(gua.n).toLowerCase();
    const pinyin = normalize(gua.p);
    const english = normalize(gua.ename);

    let bestScore = Infinity;

    // Exact match (score 0)
    if (chinese === q || chineseSimp === q || pinyin === q || english === q || kwStr === q) {
      bestScore = 0;
    }
    // Prefix match (score 1)
    else if (
      chinese.startsWith(q) ||
      chineseSimp.startsWith(q) ||
      pinyin.startsWith(q) ||
      english.startsWith(q) ||
      kwStr.startsWith(q)
    ) {
      bestScore = 1;
    }
    // Contains match (score 2)
    else if (
      chinese.includes(q) ||
      chineseSimp.includes(q) ||
      pinyin.includes(q) ||
      english.includes(q)
    ) {
      bestScore = 2;
    }

    if (bestScore < Infinity) {
      matches.push({ kw, gua, score: bestScore });
    }
  }

  // Sort by score (best first), then by KW number for stability
  matches.sort((a, b) => a.score - b.score || a.kw - b.kw);
  return matches.map((m) => m.gua);
}
