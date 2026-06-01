// @iching/core — pure domain logic
// No I/O, no ANSI, no fs, no process

// Types
export type {
  Style,
  Hexagram,
  LineValue,
  Line,
  Cast,
  DerivedType,
  TrigramInfo,
  Structure,
  DailyCache,
  HistoryEntry,
  // Data-enrichment additions (U1 — defined here, exported now for U2+ consumers)
  LeggeHexagram,
  TrigramAssoc,
  XuGuaEntry,
  ZaGuaEntry,
  ShuoguaChapter,
  ShuoguaCitation,
  CastConnections,
} from "./types.js";

// RandomSource
export type { RandomSource } from "./random.js";
export {
  CryptoRandomSource,
  SeededRandomSource,
  TapeRandomSource,
} from "./random.js";

// Casting
export { castLine } from "./casting/coins.js";
export { castHexagram, assembleCast } from "./casting/cast.js";
export { linesToBinary } from "./casting/binary.js";
export { castYarrowHexagram, castYarrowLine, castYarrowRound, lineFromValue, toLineValue } from "./casting/yarrow.js";
export type { YarrowRound, YarrowLineResult, YarrowCast } from "./casting/yarrow.js";

// Derivation
export { nuclear } from "./derivation/nuclear.js";
export { polarity } from "./derivation/polarity.js";
export { mirror } from "./derivation/mirror.js";
export { diagonal } from "./derivation/diagonal.js";
export { isLockedPair } from "./derivation/locked-pairs.js";
export { buildConnections } from "./derivation/connections.js";

// Identify
export { BINARY_TO_KW, hexagramByBinary, hexagramByKW } from "./identify/lookup.js";
export {
  trigramIndex,
  getStructure,
  buildStructure,
  formatTrigrams,
} from "./identify/structure.js";

// Data
export { GUA } from "./data/gua.js";
export {
  TRIGRAMS,
  STYLES,
  QUOTE_STYLES,
  DERIVED_LABELS,
  DERIVED_LABELS_CN,
  TRIGRAM_ASSOC_GLOSS_EN,
  type TrigramAssocGloss,
} from "./data/trigrams.js";
export { LARGE_GLYPHS, type GlyphFont, type GlyphSize, type GlyphEntry } from "./data/large-glyphs.js";
export { XU_GUA, XU_GUA_META } from "./data/xugua.js";
export { ZA_GUA, ZA_GUA_META, ZA_GUA_BY_HEX } from "./data/zagua.js";
export {
  SHUO_GUA,
  TRIGRAM_ASSOC,
  SHUO_GUA_META,
} from "./data/shuogua.js";
export {
  LEGGE_XUGUA_EN,
  LEGGE_ZAGUA_EN,
  LEGGE_ZAGUA_BY_HEX,
  LEGGE_SHUOGUA_EN,
  LEGGE_META,
} from "./data/legge.js";

// Format
export { formatReading, getRandomQuoteStyle } from "./format/reading.js";
export { formatDerived } from "./format/derived.js";

// Search
export { searchHexagrams } from "./search.js";

// Detail
export { type HexagramDetail, buildHexagramDetail } from "./detail.js";

// Service
export { selectDisplay } from "./service/display-select.js";
export type { DisplayChoice } from "./service/display-select.js";
