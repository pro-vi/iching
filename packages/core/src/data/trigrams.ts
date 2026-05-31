import type { Style, DerivedType, TrigramInfo } from "../types.js";
import { TRIGRAM_ASSOC } from "./shuogua.js";

export const TRIGRAMS: TrigramInfo[] = [
  { n: "坤", img: "earth", sym: "☷", assoc: TRIGRAM_ASSOC["坤"] }, // 0: 000
  { n: "震", img: "thunder", sym: "☳", assoc: TRIGRAM_ASSOC["震"] }, // 1: 001
  { n: "坎", img: "water", sym: "☵", assoc: TRIGRAM_ASSOC["坎"] }, // 2: 010
  { n: "兌", img: "lake", sym: "☱", assoc: TRIGRAM_ASSOC["兌"] }, // 3: 011
  { n: "艮", img: "mountain", sym: "☶", assoc: TRIGRAM_ASSOC["艮"] }, // 4: 100
  { n: "離", img: "fire", sym: "☲", assoc: TRIGRAM_ASSOC["離"] }, // 5: 101
  { n: "巽", img: "wind", sym: "☴", assoc: TRIGRAM_ASSOC["巽"] }, // 6: 110
  { n: "乾", img: "heaven", sym: "☰", assoc: TRIGRAM_ASSOC["乾"] }, // 7: 111
];

export const STYLES: Style[] = ["dx", "tu", "en", "te", "w", "st", "gc"];
// QUOTE_STYLES intentionally excludes "gc" — 卦辭 (root oracle) is not a
// random-quotable commentary lineage. See types.ts Style for rationale.
export const QUOTE_STYLES: Style[] = ["dx", "tu", "en", "te", "w"];

export const DERIVED_LABELS: Record<DerivedType, string> = {
  nuclear: "互卦 (hidden within)",
  polarity: "錯卦 (polarity)",
  mirror: "綜卦 (mirror)",
  becoming: "之卦 (becoming)",
  diagonal: "對角卦 (diagonal)",
};

/** 来知德 framework labels — Chinese variants (50% chance) */
export const DERIVED_LABELS_CN: Record<DerivedType, string> = {
  nuclear: "互卦 (潜藏轨迹)",
  polarity: "錯卦 (矛盾调和)",
  mirror: "綜卦 (表里)",
  becoming: "之卦 (所往)",
  diagonal: "對角卦 (極反)",
};

/**
 * Short English glosses for the structured 說卦 trigram catalogue.
 *
 * Project-authored — NOT from Legge, NOT from Wilhelm/Baynes, NOT
 * derivable from any canonical English translation. These are short
 * single-word labels chosen by the project to surface the canonical zh
 * fields to English-only readers in UI displays.
 *
 * UI MUST label these as "project gloss" (or equivalent) wherever they
 * render — they are not canonical 說卦 content. The canonical zh fields
 * always remain the source of truth; these are a convenience layer.
 *
 * Excludes `extendedImages` (no terse English equivalent for a 14-item
 * polysemous catalogue — render in zh per the U6 cast surface).
 */
export interface TrigramAssocGloss {
  family: string;
  body: string;
  animal: string;
  direction: string;
  attribute: string;
}

export const TRIGRAM_ASSOC_GLOSS_EN: Record<string, TrigramAssocGloss> = {
  "乾": { family: "father", body: "head", animal: "horse", direction: "northwest", attribute: "strength" },
  "坤": { family: "mother", body: "belly", animal: "ox", direction: "southwest", attribute: "yielding" },
  "震": { family: "eldest son", body: "foot", animal: "dragon", direction: "east", attribute: "movement" },
  "巽": { family: "eldest daughter", body: "thigh", animal: "rooster", direction: "southeast", attribute: "penetration" },
  "坎": { family: "middle son", body: "ear", animal: "pig", direction: "north", attribute: "danger" },
  "離": { family: "middle daughter", body: "eye", animal: "pheasant", direction: "south", attribute: "clinging" },
  "艮": { family: "youngest son", body: "hand", animal: "dog", direction: "northeast", attribute: "stillness" },
  "兌": { family: "youngest daughter", body: "mouth", animal: "sheep", direction: "west", attribute: "joy" },
};
