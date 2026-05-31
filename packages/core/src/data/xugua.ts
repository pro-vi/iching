import type { XuGuaEntry } from "../types.js";

/**
 * 序卦傳 — Sequence of the Hexagrams.
 *
 * One of the Ten Wings of the I Ching. Explains why each hexagram
 * follows the previous in King Wen order. Ancient classical Chinese
 * text, public domain.
 *
 * Source: ctext.org/book-of-changes/xu-gua, cross-checked against
 * zh.wikisource.org/wiki/周易/序卦. Punctuation is ctext editorial.
 *
 * Editorial notes preserved:
 * - Hex 1 (乾) and 2 (坤) share the opening cosmological preamble
 *   «有天地，然後萬物生焉» — 序卦 has no explicit standalone line for either.
 * - Hex 30 (離) merges two adjacent ctext cells (the 坎 transition +
 *   the close-of-上經 line).
 * - Hex 31 (咸) is assigned the lower-jing cosmological preamble.
 */
export const XU_GUA: XuGuaEntry[] = [
  { hexagram: 1, name: "乾", text: "有天地，然後萬物生焉。", note: "序卦 has no explicit standalone line for 乾 in this canonical source; the opening cosmological premise («有天地，然後萬物生焉。») introduces heaven-earth as the implicit ground from which all hexagrams unfold. Shared with 坤." },
  { hexagram: 2, name: "坤", text: "有天地，然後萬物生焉。", note: "Shares the upper-jing cosmological preamble with 乾. The first explicitly-introduced hexagram in 序卦 is 屯." },
  { hexagram: 3, name: "屯", text: "盈天地之間者唯萬物，故受之以《屯》。" },
  { hexagram: 4, name: "蒙", text: "《屯》者，盈也。屯者，物之始生也。物生必蒙，故受之以《蒙》。" },
  { hexagram: 5, name: "需", text: "《蒙》者，蒙也，物之稺也。物稺不可不養也，故受之以《需》。" },
  { hexagram: 6, name: "訟", text: "《需》者，飲食之道也。飲食必有訟，故受之以《訟》。" },
  { hexagram: 7, name: "師", text: "訟必有眾起，故受之以《師》。" },
  { hexagram: 8, name: "比", text: "《師》者，眾也。眾必有所比，故受之以《比》。" },
  { hexagram: 9, name: "小畜", text: "《比》者，比也。比必有所畜，故受之以《小畜》。" },
  { hexagram: 10, name: "履", text: "物畜然後有禮，故受之以《履》。" },
  { hexagram: 11, name: "泰", text: "履而泰然後安，故受之以《泰》。" },
  { hexagram: 12, name: "否", text: "《泰》者，通也。物不可以終通，故受之以《否》。" },
  { hexagram: 13, name: "同人", text: "物不可以終否，故受之以《同人》。" },
  { hexagram: 14, name: "大有", text: "與人同者，物必歸焉，故受之以《大有》。" },
  { hexagram: 15, name: "謙", text: "有大者不可以盈，故受之以《謙》。" },
  { hexagram: 16, name: "豫", text: "有大而能謙必豫，故受之以《豫》。" },
  { hexagram: 17, name: "隨", text: "豫必有隨，故受之以《隨》。" },
  { hexagram: 18, name: "蠱", text: "以喜隨人者必有事，故受之以《蠱》。" },
  { hexagram: 19, name: "臨", text: "《蠱》者，事也。有事而後可大，故受之以《臨》。" },
  { hexagram: 20, name: "觀", text: "《臨》者，大也。物大然後可觀，故受之以《觀》。" },
  { hexagram: 21, name: "噬嗑", text: "可觀而後有所合，故受之以《噬嗑》。" },
  { hexagram: 22, name: "賁", text: "嗑者，合也。物不可以苟合而已，故受之以《賁》。" },
  { hexagram: 23, name: "剝", text: "《賁》者，飾也。致飾然後亨則盡矣，故受之以《剝》。" },
  { hexagram: 24, name: "復", text: "《剝》者，剝也。物不可以終盡剝，窮上反下，故受之以《復》。" },
  { hexagram: 25, name: "无妄", text: "復則不妄矣，故受之以《无妄》。" },
  { hexagram: 26, name: "大畜", text: "有无妄，然後可畜，故受之以《大畜》。" },
  { hexagram: 27, name: "頤", text: "物畜然後可養，故受之以《頤》。" },
  { hexagram: 28, name: "大過", text: "《頤》者，養也。不養則不可動，故受之以《大過》。" },
  { hexagram: 29, name: "坎", text: "物不可以終過，故受之以《坎》。" },
  { hexagram: 30, name: "離", text: "《坎》者，陷也。陷必有所麗，故受之以《離》。《離》者，麗也。", note: "ctext records «《離》者，麗也。» as a separate trailing cell closing 上經; merged here." },
  { hexagram: 31, name: "咸", text: "有天地然後有萬物，有萬物然後有男女，有男女然後有夫婦，有夫婦然後有父子，有父子然後有君臣，有君臣然後有上下，有上下然後禮義有所錯。", note: "下經 cosmological preamble. 序卦 introduces 咸 implicitly via the heaven-earth / husband-wife passage rather than via «故受之以咸»." },
  { hexagram: 32, name: "恆", text: "夫婦之道不可以不久也，故受之以《恆》。" },
  { hexagram: 33, name: "遯", text: "《恆》者，久也。物不可以久居其所，故受之以《遯》。" },
  { hexagram: 34, name: "大壯", text: "《遯》者，退也。物不可以終遯，故受之以《大壯》。" },
  { hexagram: 35, name: "晉", text: "物不可以終壯，故受之以《晉》。" },
  { hexagram: 36, name: "明夷", text: "《晉》者，進也。進必有所傷，故受之以《明夷》。" },
  { hexagram: 37, name: "家人", text: "夷者，傷也。傷於外者必反於家，故受之以《家人》。" },
  { hexagram: 38, name: "睽", text: "家道窮必乖，故受之以《睽》。" },
  { hexagram: 39, name: "蹇", text: "《睽》者，乖也。乖必有難，故受之以《蹇》。" },
  { hexagram: 40, name: "解", text: "《蹇》者，難也。物不可以終難，故受之以《解》。" },
  { hexagram: 41, name: "損", text: "《解》者，緩也。緩必有所失，故受之以《損》。" },
  { hexagram: 42, name: "益", text: "損而不已必益，故受之以《益》。" },
  { hexagram: 43, name: "夬", text: "益而不已必決，故受之以《夬》。" },
  { hexagram: 44, name: "姤", text: "《夬》者，決也。決必有遇，故受之以《姤》。" },
  { hexagram: 45, name: "萃", text: "《姤》者，遇也。物相遇而後聚，故受之以《萃》。" },
  { hexagram: 46, name: "升", text: "《萃》者，聚也。聚而上者謂之升，故受之以《升》。" },
  { hexagram: 47, name: "困", text: "升而不已必困，故受之以《困》。" },
  { hexagram: 48, name: "井", text: "困乎上者必反下，故受之以《井》。" },
  { hexagram: 49, name: "革", text: "井道不可不革，故受之以《革》。" },
  { hexagram: 50, name: "鼎", text: "革物者莫若鼎，故受之以《鼎》。" },
  { hexagram: 51, name: "震", text: "主器者莫若長子，故受之以《震》。" },
  { hexagram: 52, name: "艮", text: "《震》者，動也。物不可以終動，止之，故受之以《艮》。" },
  { hexagram: 53, name: "漸", text: "《艮》者，止也。物不可以終止，故受之以《漸》。" },
  { hexagram: 54, name: "歸妹", text: "漸者，進也。進必有所歸，故受之以《歸妹》。" },
  { hexagram: 55, name: "豐", text: "得其所歸者必大，故受之以《豐》。" },
  { hexagram: 56, name: "旅", text: "《豐》者，大也。窮大者必失其居，故受之以《旅》。" },
  { hexagram: 57, name: "巽", text: "旅而无所容，故受之以《巽》。" },
  { hexagram: 58, name: "兌", text: "《巽》者，入也。入而後說之，故受之以《兌》。" },
  { hexagram: 59, name: "渙", text: "《兌》者，說也。說而後散之，故受之以《渙》。" },
  { hexagram: 60, name: "節", text: "《渙》者，離也。物不可以終離，故受之以《節》。" },
  { hexagram: 61, name: "中孚", text: "節而信之，故受之以《中孚》。" },
  { hexagram: 62, name: "小過", text: "有其信者必行之，故受之以《小過》。" },
  { hexagram: 63, name: "既濟", text: "有過物者必濟，故受之以《既濟》。" },
  { hexagram: 64, name: "未濟", text: "物不可窮也，故受之以《未濟》，終焉。" },
];

export const XU_GUA_META = {
  source: "https://ctext.org/book-of-changes/xu-gua and https://ctext.org/book-of-changes/za-gua",
  crossChecks: [
    "https://zh.wikisource.org/wiki/%E5%91%A8%E6%98%93/%E5%BA%8F%E5%8D%A6",
    "https://zh.wikisource.org/wiki/%E5%91%A8%E6%98%93/%E9%9B%9C%E5%8D%A6",
  ],
  license: "ancient classical Chinese text, public domain (Ten Wings of the I Ching, ~Han dynasty or earlier)",
  punctuationSource: "ctext editorial — uses 《》 quotation marks around hexagram names and modern Chinese commas/periods (， 。). Wikisource cross-check uses similar punctuation. The underlying characters match across both sources.",
} as const;
