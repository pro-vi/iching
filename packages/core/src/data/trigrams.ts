import type { Style, DerivedType, TrigramInfo } from "../types.js";

export const TRIGRAMS: TrigramInfo[] = [
  { n: "坤", img: "earth", sym: "☷" }, // 0: 000
  { n: "震", img: "thunder", sym: "☳" }, // 1: 001
  { n: "坎", img: "water", sym: "☵" }, // 2: 010
  { n: "兌", img: "lake", sym: "☱" }, // 3: 011
  { n: "艮", img: "mountain", sym: "☶" }, // 4: 100
  { n: "離", img: "fire", sym: "☲" }, // 5: 101
  { n: "巽", img: "wind", sym: "☴" }, // 6: 110
  { n: "乾", img: "heaven", sym: "☰" }, // 7: 111
];

export const STYLES: Style[] = ["dx", "tu", "en", "te", "w", "st"];
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
