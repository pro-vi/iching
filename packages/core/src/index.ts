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
export { castHexagram } from "./casting/cast.js";
export { linesToBinary } from "./casting/binary.js";

// Derivation
export { nuclear } from "./derivation/nuclear.js";
export { polarity } from "./derivation/polarity.js";
export { mirror } from "./derivation/mirror.js";
export { diagonal } from "./derivation/diagonal.js";
export { isLockedPair } from "./derivation/locked-pairs.js";

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
} from "./data/trigrams.js";

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
