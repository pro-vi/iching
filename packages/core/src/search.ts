// Search hexagrams by Chinese name, pinyin, English name, KW number, or trigrams

import type { Hexagram } from "./types.js";
import { GUA } from "./data/gua.js";
import { foldForSearch } from "./text-fold.js";
import { TRIGRAMS } from "./data/trigrams.js";
import { trigramIndices } from "./identify/structure.js";
import { BINARY_TO_KW } from "./identify/lookup.js";
import { toSimplified } from "./i18n/simplify.js";

/** Strip diacritics from a string for accent-insensitive matching */

// ---------------------------------------------------------------------------
// Trigram vocabulary — how practitioners actually name the eight trigrams.
// Indexed by trigram binary value (matching TRIGRAMS order: 坤0…乾7).
// ---------------------------------------------------------------------------

/** Pinyin of the trigram names (坤 kūn … 乾 qián), diacritics stripped. */
const TRIGRAM_PINYIN: string[] = ["kun", "zhen", "kan", "dui", "gen", "li", "xun", "qian"];

/** The classical image character (坤→地 … 乾→天) — how compound hexagram
 * names are spoken (山風蠱 = mountain over wind). */
const TRIGRAM_IMAGE_CN: string[] = ["地", "雷", "水", "澤", "山", "火", "風", "天"];

/** Does the folded token equal `text` in either Chinese script — Traditional or its
 *  Simplified form? Lowercased so a Latin token can't slip past on case. */
function matchesEitherScript(token: string, text: string): boolean {
  return token === text.toLowerCase() || token === toSimplified(text).toLowerCase();
}

/**
 * Resolve a single normalized token to a trigram index (0-7), or null.
 * Accepted forms per trigram: English image word ("fire"), Unicode symbol
 * (☲), Chinese name (離 / Simplified 离), name pinyin ("li"), and the
 * classical image character (火 — Traditional or Simplified).
 */
function resolveTrigramToken(token: string): number | null {
  for (let i = 0; i < TRIGRAMS.length; i++) {
    const t = TRIGRAMS[i];
    if (
      token === t.img ||
      token === t.sym ||
      matchesEitherScript(token, t.n) ||
      token === TRIGRAM_PINYIN[i] ||
      matchesEitherScript(token, TRIGRAM_IMAGE_CN[i])
    ) {
      return i;
    }
  }
  return null;
}

/**
 * Parse a trigram-pair query into { upper, lower } trigram indices, or null.
 * Pair grammar (upper trigram named first, as in the classical compound names):
 *   - "X over Y"  — English connective: "fire over water", "li over dui"
 *   - two single-character tokens, optionally spaced: "山風", "☲☱", "艮 巽"
 * Each side accepts every single-token form resolveTrigramToken knows.
 */
function parseTrigramPair(q: string): { upper: number; lower: number } | null {
  const over = q.match(/^(.+?)\s+over\s+(.+)$/);
  if (over) {
    const upper = resolveTrigramToken(over[1].trim());
    const lower = resolveTrigramToken(over[2].trim());
    if (upper !== null && lower !== null) return { upper, lower };
    return null;
  }
  // Two adjacent single-character tokens (Chinese chars or trigram symbols)
  const compact = [...q.replace(/\s+/g, "")];
  if (compact.length === 2) {
    const upper = resolveTrigramToken(compact[0]);
    const lower = resolveTrigramToken(compact[1]);
    if (upper !== null && lower !== null) return { upper, lower };
  }
  return null;
}

export interface ScoredHexagram {
  kw: number;
  gua: Hexagram;
  /**
   * Relevance, lower is better: 0 exact (name / pinyin / ename / number /
   * trigram-pair) · 1 prefix · 2 contains · 3 single-trigram family. Exposed so
   * a caller that needs ONE answer (the CLI hexagram/dict resolver) can treat a
   * unique score-0 hit as definitive even when weaker family matches coexist.
   */
  score: number;
}

/**
 * Search all 64 hexagrams by query string.
 * Matches against: Chinese name (n), pinyin (p), English name (ename), KW number,
 * and trigram structure.
 *
 * Trigram grammar (resolved via the trigram table, scored after name matches):
 *   - a single trigram token ("fire", "離", "离", "☵", "gen", "山") matches every
 *     hexagram whose upper OR lower trigram is that trigram (score 3);
 *   - a pair — "X over Y" / "山風" / "☲☱" / "li over dui" — names one hexagram
 *     by structure (upper first) and matches it exactly (score 0).
 *
 * Returns results sorted by relevance (exact > prefix > includes > trigram),
 * each WITH its score. `searchHexagrams` drops the scores for callers (the
 * terminal dict-browse filter) that just want the ranked list.
 */
export function searchHexagramsScored(query: string): ScoredHexagram[] {
  const q = foldForSearch(query.trim());
  if (q.length === 0) return GUA.map((gua, i) => ({ kw: i + 1, gua, score: 0 }));

  // Trigram resolution — a pair pins one KW number; a single token marks a family.
  const pair = parseTrigramPair(q);
  const pairKW = pair !== null ? BINARY_TO_KW[pair.lower + pair.upper * 8] : null;
  const singleTrigram = resolveTrigramToken(q);

  const matches: ScoredHexagram[] = [];

  for (let i = 0; i < GUA.length; i++) {
    const gua = GUA[i];
    const kw = i + 1;
    const kwStr = String(kw);
    const chinese = gua.n.toLowerCase();
    // Also match the Simplified rendering of the name: in zh-Hans mode the
    // dictionary displays toSimplified(gua.n) (e.g. 兑), so a user types the
    // simplified form they see — which would never match the Traditional gua.n.
    const chineseSimp = toSimplified(gua.n).toLowerCase();
    const pinyin = foldForSearch(gua.p);
    const english = foldForSearch(gua.ename);

    let bestScore = Infinity;

    // Trigram pair — the query names this hexagram by structure (score 0)
    if (kw === pairKW) {
      bestScore = 0;
    }
    // Exact match (score 0)
    if (chinese === q || chineseSimp === q || pinyin === q || english === q || kwStr === q) {
      bestScore = 0;
    }
    // Prefix match (score 1)
    else if (
      bestScore > 1 &&
      (chinese.startsWith(q) ||
        chineseSimp.startsWith(q) ||
        pinyin.startsWith(q) ||
        english.startsWith(q) ||
        kwStr.startsWith(q))
    ) {
      bestScore = 1;
    }
    // Contains match (score 2)
    else if (
      bestScore > 2 &&
      (chinese.includes(q) ||
        chineseSimp.includes(q) ||
        pinyin.includes(q) ||
        english.includes(q))
    ) {
      bestScore = 2;
    }

    // Single trigram token — upper or lower trigram membership (score 3)
    if (bestScore > 3 && singleTrigram !== null) {
      const { lower, upper } = trigramIndices(gua.l);
      if (lower === singleTrigram || upper === singleTrigram) {
        bestScore = 3;
      }
    }

    if (bestScore < Infinity) {
      matches.push({ kw, gua, score: bestScore });
    }
  }

  // Sort by score (best first), then by KW number for stability
  matches.sort((a, b) => a.score - b.score || a.kw - b.kw);
  return matches;
}

/** Search hexagrams, dropping the scores — the ranked list only. */
export function searchHexagrams(query: string): Hexagram[] {
  return searchHexagramsScored(query).map((m) => m.gua);
}
