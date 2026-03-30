/** Commentary style keys: dx=大象傳, tu=彖傳, en=English, te=彖英, w=Wilhelm (experimental) */
export type Style = "dx" | "tu" | "en" | "te" | "w" | "st";

/** Hexagram entry in GUA array */
export interface Hexagram {
  u: string; // Unicode symbol
  n: string; // Chinese name
  p: string; // Pinyin
  l: number[]; // Lines (6 elements, 0=yin 1=yang, bottom to top)
  dx: string; // 大象傳
  tu: string; // 彖傳
  en: string; // English image
  te: string; // English judgment
  w: string; // Inspired by Wilhelm — experimental, not direct quotes
}

/** Line value from 3-coin toss: 6=old yin, 7=young yang, 8=young yin, 9=old yang */
export type LineValue = 6 | 7 | 8 | 9;

/** Cast result for a single line */
export interface Line {
  value: LineValue;
  isYang: boolean;
  isChanging: boolean;
}

/** Full hexagram cast result */
export interface Cast {
  lines: Line[];
  primary: number;
  becoming: number | null;
  changingPositions: number[];
  nuclear: number;
  polarity: number;
  mirror: number;
  diagonal: number;
}

/**
 * Derived hexagram types:
 * - nuclear (互卦): hidden within
 * - polarity (錯卦): complementary opposite
 * - mirror (綜卦): opposite vantage
 * - becoming (之卦): where it's heading
 * - diagonal (對角卦): 錯+綜 combined — the furthest point
 */
export type DerivedType =
  | "nuclear"
  | "polarity"
  | "mirror"
  | "becoming"
  | "diagonal";

/** Trigram info for structure display */
export interface TrigramInfo {
  sym: string;
  n: string;
  img: string;
}

/** Structure breakdown of a hexagram */
export interface Structure {
  upper: TrigramInfo;
  lower: TrigramInfo;
  becoming: { upper: TrigramInfo; lower: TrigramInfo } | null;
}

/** Cache structure for daily reading */
export interface DailyCache {
  date: string;
  cast: Cast;
  shown: boolean;
  structure: Structure;
}

/** History entry (one per line in JSONL) */
export interface HistoryEntry {
  date: string;
  cast: Cast;
}
