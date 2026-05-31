/**
 * Commentary style keys (single-string fields on Hexagram):
 * - dx=大象傳, tu=彖傳, en=English image, te=English judgment
 * - w=Wilhelm-flavored synthesis (experimental, not direct quotes)
 * - st=synthetic structure (handled by a separate code path)
 *
 * The data-enrichment optional fields (`gc`, `legge`) are NOT in this union
 * for now — they remain direct-access only. Adding them to Style requires
 * updating the consumer sites that do `g[style]` indexing (those expect
 * defined values); that lockstep change is owned by U7 of the
 * data-enrichment plan.
 *
 * Per-line commentary fields are arrays (yao, yaoEn, yaoXiao, yaoXiaoEn) and
 * are NOT in this union — they're accessed as direct fields.
 */
export type Style = "dx" | "tu" | "en" | "te" | "w" | "st";

/**
 * Subset of Style that can be looked up directly on a Hexagram (i.e. excludes
 * "st", which is the synthetic "structure / trigrams" style handled by a
 * separate code path). Any random-quote selector should narrow to this.
 */
export type QuoteStyle = Exclude<Style, "st">;

/** Hexagram entry in GUA array */
export interface Hexagram {
  u: string; // Unicode symbol
  n: string; // Chinese name
  p: string; // Pinyin
  ename: string; // English name
  l: number[]; // Lines (6 elements, 0=yin 1=yang, bottom to top)
  dx: string; // 大象傳
  tu: string; // 彖傳
  en: string; // English image
  te: string; // English judgment
  w: string; // Inspired by Wilhelm — experimental, not direct quotes
  yao: string[]; // 爻辭 — 6 classical Chinese line texts (line 1 through 6)
  yaoEn: string[]; // 6 English line interpretations (line 1 through 6)

  /** 卦辭 — root Judgment text (canonical zh). Added in data-enrichment wave. */
  gc?: string;
  /** English of 卦辭 (Legge SBE vol. XVI, 1882). */
  gcEn?: string;
  /** 小象傳 — per-line Small Image commentary (canonical zh, 6 entries). */
  yaoXiao?: string[];
  /** English of 小象傳 (Legge SBE vol. XVI, 1882). */
  yaoXiaoEn?: string[];
  /** Full James Legge translation lineage. Populated by data-enrichment wave U10 (post-cleanup). */
  legge?: LeggeHexagram;
}

/**
 * James Legge translation of a single hexagram from Sacred Books of the East
 * vol. XVI (1882). Public domain. Wings translations live on XuGuaEntry,
 * ZaGuaEntry, ShuoguaChapter.
 */
export interface LeggeHexagram {
  /** Legge's romanization, e.g. "Khien", "Khwan". */
  leggeName: string;
  /** Thwan — the Judgment text. */
  judgment: string;
  /** Great Symbolism — the Image text. */
  image: string;
  /**
   * Per-line statements. Six entries for hex 3..64; seven for hex 1 & 2
   * (the canonical "use of the number nine/six" paragraph).
   */
  lines: string[];
}

/**
 * 說卦傳 structured catalogue per trigram.
 *
 * The named-field block (image, family, body, animal, direction, attribute,
 * extendedImages) is verbatim from 說卦 chapters 8–11. The optional fields
 * (season, cosmologicalRole, other) are editorial synthesis and must be
 * labeled as derived rather than canonical in the UI.
 */
export interface TrigramAssoc {
  /** Canonical image — 天 / 地 / 雷 / 風 / 水 / 火 / 山 / 澤. */
  image: string;
  /** Canonical family role — 父 / 母 / 長男 / 長女 / 中男 / 中女 / 少男 / 少女. */
  family: string;
  /** Canonical body part — 首 / 腹 / 足 / 股 / 耳 / 目 / 手 / 口. */
  body: string;
  /** Canonical animal — 馬 / 牛 / 龍 / 雞 / 豕 / 雉 / 狗 / 羊. */
  animal: string;
  /** Canonical direction (後天 later-heaven arrangement). */
  direction: string;
  /** Canonical attribute — 健 / 順 / 動 / 入 / 陷 / 麗 / 止 / 說. */
  attribute: string;
  /** Canonical extended images from 說卦 ch. 11 (varies per trigram — 乾 has 14, others fewer). */
  extendedImages: string[];
  /** Editorial: rough seasonal correlate. NOT canonical 說卦 — label as derived in UI. */
  season?: string;
  /** Editorial: cosmological role per the 帝出乎震 cycle. NOT canonical 說卦. */
  cosmologicalRole?: string;
  /** Editorial: additional notes. NOT canonical 說卦. */
  other?: string;
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
  /** 說卦傳 catalogue for this trigram. Populated by data-enrichment wave U4. */
  assoc?: TrigramAssoc;
}

/** Structure breakdown of a hexagram */
export interface Structure {
  upper: TrigramInfo;
  lower: TrigramInfo;
  becoming: { upper: TrigramInfo; lower: TrigramInfo } | null;
}

/**
 * 序卦傳 entry — narrative bridge explaining why this hexagram follows the
 * previous in King Wen order.
 */
export interface XuGuaEntry {
  /** King Wen number 1..64. */
  hexagram: number;
  /** zh name e.g. 屯. */
  name: string;
  /** Canonical zh text. */
  text: string;
  /** Legge's English (Appendix VI of SBE vol. XVI). Populated post-Legge-cleanup. */
  textEn?: string;
  /** Editorial note (e.g. 乾/坤 shared cosmological preamble, 咸 lower-jing preamble). */
  note?: string;
}

/**
 * 雜卦傳 entry — terse contrastive pairing of two hexagrams. The traditional
 * source pairs hexagrams via geometric mirror (with polarity fallback for the
 * 8 self-symmetric hexagrams). The famously disordered final stretch breaks
 * the regular pairing; entries in that range preserve source order rather
 * than being normalized.
 */
export interface ZaGuaEntry {
  /** Source-order index 0..52. */
  index: number;
  /** Hexagram numbers in the pair (0-2 entries; the disordered tail may collapse). */
  pair: number[];
  /** zh names matching `pair`. */
  names: string[];
  /** Canonical zh text. */
  text: string;
  /** Legge's English (Appendix VII of SBE vol. XVI). Populated post-Legge-cleanup. */
  textEn?: string;
}

/**
 * 說卦傳 chapter (the prose body). Separate from the structured
 * `TrigramAssoc` catalogue.
 */
export interface ShuoguaChapter {
  /** Chapter number 1..11. */
  n: number;
  /** Canonical zh text. */
  text: string;
  /** Legge's English (Appendix V of SBE vol. XVI). Populated post-Legge-cleanup. */
  textEn?: string;
}

/** Citation pointing into 說卦傳 for a derivation operation. */
export interface ShuoguaCitation {
  op: DerivedType;
  /** 說卦傳 chapter 1..11 that grounds this operation. */
  chapter: number;
}

/**
 * Text-bearing relations overlay computed from a Cast.
 *
 * Joins the numeric derivations (nuclear / polarity / mirror / diagonal /
 * becoming) with canonical text data from XU_GUA, ZA_GUA, and SHUOGUA. Pure
 * overlay built by `derivation/connections.ts`; does not mutate the Cast.
 */
export interface CastConnections {
  /** Sequence narrative from the previous hexagram. Absent for hex 1. */
  xuGua?: XuGuaEntry;
  /** Contrastive pair commentary. May be absent if the disordered tail leaves a gap. */
  zaGuaPair?: ZaGuaEntry;
  /** Textual authority per derivation operation. */
  shuoguaCitations: ShuoguaCitation[];
}

/** Cache structure for daily reading */
export interface DailyCache {
  date: string;
  cast: Cast;
  shown: boolean;
  structure: Structure;
  intention?: string;
}

/** History entry (one per line in JSONL) */
export interface HistoryEntry {
  date: string;
  cast: Cast;
  intention?: string;
  timestamp?: string;
}
