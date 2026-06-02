import { describe, test, expect } from "bun:test";
import { TRIGRAMS, TRIGRAM_ASSOC_GLOSS_EN } from "../data/trigrams.js";
import { TRIGRAM_ASSOC } from "../data/shuogua.js";

/**
 * U4 integrity tests — TrigramInfo enrichment + project-authored English
 * glosses. Validates that:
 *   - every TrigramInfo carries the canonical 說卦 catalogue via .assoc
 *   - TRIGRAM_ASSOC_GLOSS_EN parallels the 8 trigrams with the 5 expected fields
 *   - editorial English does not contaminate canonical zh
 */

const ZH_NAMES = ["坤", "震", "坎", "兌", "艮", "離", "巽", "乾"]; // in TRIGRAMS order

describe("TRIGRAMS — TrigramInfo enrichment with assoc", () => {
  test("has 8 entries in canonical binary order", () => {
    expect(TRIGRAMS).toHaveLength(8);
    TRIGRAMS.forEach((t, i) => {
      expect(t.n).toBe(ZH_NAMES[i]);
    });
  });

  test("every TrigramInfo carries .assoc pointing into TRIGRAM_ASSOC", () => {
    for (const trigram of TRIGRAMS) {
      expect(trigram.assoc).toBeDefined();
      // Same reference — the wiring is by identity, not a copy.
      expect(trigram.assoc).toBe(TRIGRAM_ASSOC[trigram.n]!);
    }
  });

  test("each TrigramInfo.assoc has all canonical fields populated", () => {
    for (const trigram of TRIGRAMS) {
      const assoc = trigram.assoc!;
      expect(assoc.image.length).toBeGreaterThan(0);
      expect(assoc.family.length).toBeGreaterThan(0);
      expect(assoc.body.length).toBeGreaterThan(0);
      expect(assoc.animal.length).toBeGreaterThan(0);
      expect(assoc.direction.length).toBeGreaterThan(0);
      expect(assoc.attribute.length).toBeGreaterThan(0);
      expect(assoc.extendedImages.length).toBeGreaterThan(0);
    }
  });

  test("existing TrigramInfo fields (sym, n, img) are unchanged", () => {
    // Lock the legacy contract — adding .assoc must not silently shift
    // the other fields. These exact values are the pre-U4 baseline.
    expect(TRIGRAMS[0]).toMatchObject({ n: "坤", img: "earth", sym: "☷" });
    expect(TRIGRAMS[7]).toMatchObject({ n: "乾", img: "heaven", sym: "☰" });
  });
});

describe("TRIGRAM_ASSOC_GLOSS_EN — project-authored English glosses", () => {
  const TRIGRAM_KEYS = ["乾", "坤", "震", "巽", "坎", "離", "艮", "兌"];
  const EN_FIELDS = ["family", "body", "animal", "direction", "attribute"] as const;

  test("has 8 entries keyed by trigram zh char", () => {
    expect(Object.keys(TRIGRAM_ASSOC_GLOSS_EN).sort()).toEqual([...TRIGRAM_KEYS].sort());
  });

  test("every entry has all 5 required English fields", () => {
    for (const k of TRIGRAM_KEYS) {
      const en = TRIGRAM_ASSOC_GLOSS_EN[k]!;
      for (const field of EN_FIELDS) {
        expect(en[field]).toBeDefined();
        expect(en[field].length).toBeGreaterThan(0);
      }
    }
  });

  test("no entry carries extendedImages (project policy — render zh only)", () => {
    for (const k of TRIGRAM_KEYS) {
      const en = TRIGRAM_ASSOC_GLOSS_EN[k] as unknown as Record<string, unknown>;
      expect(en.extendedImages).toBeUndefined();
    }
  });

  test("project family glosses follow the eldest/middle/youngest scheme", () => {
    expect(TRIGRAM_ASSOC_GLOSS_EN["乾"]!.family).toBe("father");
    expect(TRIGRAM_ASSOC_GLOSS_EN["坤"]!.family).toBe("mother");
    expect(TRIGRAM_ASSOC_GLOSS_EN["震"]!.family).toBe("eldest son");
    expect(TRIGRAM_ASSOC_GLOSS_EN["巽"]!.family).toBe("eldest daughter");
    expect(TRIGRAM_ASSOC_GLOSS_EN["坎"]!.family).toBe("middle son");
    expect(TRIGRAM_ASSOC_GLOSS_EN["離"]!.family).toBe("middle daughter");
    expect(TRIGRAM_ASSOC_GLOSS_EN["艮"]!.family).toBe("youngest son");
    expect(TRIGRAM_ASSOC_GLOSS_EN["兌"]!.family).toBe("youngest daughter");
  });

  test("project glosses use ASCII-only single-word labels (no canonical zh leak)", () => {
    // Defense against accidentally pasting a zh character into the en gloss.
    const asciiOnly = /^[\x20-\x7E]+$/;
    for (const k of Object.keys(TRIGRAM_ASSOC_GLOSS_EN)) {
      const en = TRIGRAM_ASSOC_GLOSS_EN[k]!;
      for (const field of EN_FIELDS) {
        expect(en[field]).toMatch(asciiOnly);
      }
    }
  });
});
