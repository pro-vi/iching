import type { ZaGuaEntry } from "../types.js";

/**
 * 雜卦傳 — Miscellaneous Notes on the Hexagrams.
 *
 * One of the Ten Wings of the I Ching. Pairs hexagrams contrastively,
 * one terse line per pair. Ancient classical Chinese text, public
 * domain.
 *
 * Source: ctext.org/book-of-changes/za-gua, cross-checked against
 * zh.wikisource.org/wiki/周易/雜卦. Punctuation is ctext editorial.
 *
 * Pair structure:
 * - 28 mirror-pairs (綜) + 4 polarity-pairs (錯, for the 8 self-mirror
 *   hexagrams 1/2, 27/28, 29/30, 61/62) cover 64 hexagrams in 32 pairs.
 * - 53 entries (not 32) because the famously disordered final stretch
 *   (大過, 姤, 漸, 頤, 既濟, 歸妹, 未濟, 夬) breaks the regular pairing —
 *   preserved as-is per recognized textual feature.
 * - One closing coda entry has an empty pair[] (no specific hex reference).
 */
export const ZA_GUA: ZaGuaEntry[] = [
  { index: 0, pair: [1, 2], names: ["乾", "坤"], text: "《乾》剛《坤》柔。" },
  { index: 1, pair: [8, 7], names: ["比", "師"], text: "《比》樂《師》憂。" },
  { index: 2, pair: [19, 20], names: ["臨", "觀"], text: "《臨》《觀》之義，或與或求。" },
  { index: 3, pair: [3], names: ["屯"], text: "《屯》見而不失其居。" },
  { index: 4, pair: [4], names: ["蒙"], text: "《蒙》雜而著。" },
  { index: 5, pair: [51, 52], names: ["震", "艮"], text: "《震》，起也。《艮》，止也。" },
  { index: 6, pair: [41, 42], names: ["損", "益"], text: "《損》《益》，盛衰之始也。" },
  { index: 7, pair: [26], names: ["大畜"], text: "《大畜》，時也。" },
  { index: 8, pair: [25], names: ["无妄"], text: "《无妄》，災也。" },
  { index: 9, pair: [45, 46], names: ["萃", "升"], text: "《萃》聚而《升》不來也。" },
  { index: 10, pair: [15, 16], names: ["謙", "豫"], text: "《謙》輕而《豫》怠也。" },
  { index: 11, pair: [21], names: ["噬嗑"], text: "《噬嗑》，食也。" },
  { index: 12, pair: [22], names: ["賁"], text: "《賁》，无色也。" },
  { index: 13, pair: [58, 57], names: ["兌", "巽"], text: "《兌》見而《巽》伏也。" },
  { index: 14, pair: [17], names: ["隨"], text: "《隨》，无故也。" },
  { index: 15, pair: [18], names: ["蠱"], text: "《蠱》則飭也。" },
  { index: 16, pair: [23], names: ["剝"], text: "《剝》，爛也。" },
  { index: 17, pair: [24], names: ["復"], text: "《復》，反也。" },
  { index: 18, pair: [35], names: ["晉"], text: "《晉》，晝也。" },
  { index: 19, pair: [36], names: ["明夷"], text: "《明夷》，誅也。" },
  { index: 20, pair: [48, 47], names: ["井", "困"], text: "《井》通而《困》相遇也。" },
  { index: 21, pair: [31], names: ["咸"], text: "《咸》，速也。" },
  { index: 22, pair: [32], names: ["恆"], text: "《恆》，久也。" },
  { index: 23, pair: [59], names: ["渙"], text: "《渙》，離也。" },
  { index: 24, pair: [60], names: ["節"], text: "《節》，止也。" },
  { index: 25, pair: [40], names: ["解"], text: "《解》，緩也。" },
  { index: 26, pair: [39], names: ["蹇"], text: "《蹇》，難也。" },
  { index: 27, pair: [38], names: ["睽"], text: "《睽》，外也。" },
  { index: 28, pair: [37], names: ["家人"], text: "《家人》，內也。" },
  { index: 29, pair: [12, 11], names: ["否", "泰"], text: "《否》《泰》，反其類也。" },
  { index: 30, pair: [34, 33], names: ["大壯", "遯"], text: "《大壯》則止，《遯》則退也。" },
  { index: 31, pair: [14], names: ["大有"], text: "《大有》，眾也。" },
  { index: 32, pair: [13], names: ["同人"], text: "《同人》，親也。" },
  { index: 33, pair: [49], names: ["革"], text: "《革》，去故也。" },
  { index: 34, pair: [50], names: ["鼎"], text: "《鼎》，取新也。" },
  { index: 35, pair: [62], names: ["小過"], text: "《小過》，過也。" },
  { index: 36, pair: [61], names: ["中孚"], text: "《中孚》，信也。" },
  { index: 37, pair: [55], names: ["豐"], text: "《豐》，多故也。" },
  { index: 38, pair: [56], names: ["旅"], text: "親寡《旅》也。" },
  { index: 39, pair: [30, 29], names: ["離", "坎"], text: "《離》上而《坎》下也。" },
  { index: 40, pair: [9], names: ["小畜"], text: "《小畜》，寡也。" },
  { index: 41, pair: [10], names: ["履"], text: "《履》，不處也。" },
  { index: 42, pair: [5], names: ["需"], text: "《需》，不進也。" },
  { index: 43, pair: [6], names: ["訟"], text: "《訟》，不親也。" },
  { index: 44, pair: [28], names: ["大過"], text: "《大過》，顛也。" },
  { index: 45, pair: [44], names: ["姤"], text: "《姤》，遇也，柔遇剛也。" },
  { index: 46, pair: [53], names: ["漸"], text: "《漸》，女歸待男行也。" },
  { index: 47, pair: [27], names: ["頤"], text: "《頤》，養正也。" },
  { index: 48, pair: [63], names: ["既濟"], text: "《既濟》，定也。" },
  { index: 49, pair: [54], names: ["歸妹"], text: "《歸妹》，女之終也。" },
  { index: 50, pair: [64], names: ["未濟"], text: "《未濟》，男之窮也。" },
  { index: 51, pair: [43], names: ["夬"], text: "《夬》，決也，剛決柔也。" },
  { index: 52, pair: [], names: [], text: "君子道長，小人道憂也。" },
];

export const ZA_GUA_META = {
  source: "https://ctext.org/book-of-changes/xu-gua and https://ctext.org/book-of-changes/za-gua",
  crossChecks: [
    "https://zh.wikisource.org/wiki/%E5%91%A8%E6%98%93/%E5%BA%8F%E5%8D%A6",
    "https://zh.wikisource.org/wiki/%E5%91%A8%E6%98%93/%E9%9B%9C%E5%8D%A6",
  ],
  license: "ancient classical Chinese text, public domain (Ten Wings of the I Ching, ~Han dynasty or earlier)",
  punctuationSource: "ctext editorial — uses 《》 quotation marks around hexagram names and modern Chinese commas/periods (， 。). Wikisource cross-check uses similar punctuation. The underlying characters match across both sources.",
} as const;

/**
 * Reverse index: hexagram number (1..64) → its 雜卦 entry.
 *
 * Each hexagram appears in exactly one ZA_GUA entry. For the 8 self-
 * mirror hexagrams (1, 2, 27, 28, 29, 30, 61, 62), the entry pairs them
 * with their polarity partner. For the disordered tail, the canonical
 * source-order pairing is preserved.
 *
 * Closing-coda entry (empty pair[]) contributes no index keys.
 */
export const ZA_GUA_BY_HEX: Record<number, ZaGuaEntry> = (() => {
  const idx: Record<number, ZaGuaEntry> = {};
  for (const entry of ZA_GUA) {
    for (const hex of entry.pair) {
      idx[hex] = entry;
    }
  }
  return idx;
})();
