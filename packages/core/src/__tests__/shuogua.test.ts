import { describe, test, expect } from "bun:test";
import type { DerivedType } from "../types.js";
import {
  SHUO_GUA,
  SHUOGUA_DERIVATION_CONTEXT,
  TRIGRAM_ASSOC,
  SHUO_GUA_META,
} from "../data/shuogua.js";
import { buildConnections } from "../derivation/connections.js";

/**
 * U3 integrity tests — 說卦傳 data module.
 *
 * Verifies the 11-chapter canonical body, the 8-trigram structured
 * catalogue, and the verification anchors documented in the source JSON's
 * `_meta.verificationAnchors`. The canonical fields are required by the
 * type; the editorial fields (season, cosmologicalRole, other) are flagged
 * as derived in the type and labeled non-canonical in the UI.
 */

const TRIGRAM_KEYS = ["乾", "坤", "震", "巽", "坎", "離", "艮", "兌"];

describe("SHUO_GUA chapters", () => {
  test("has exactly 11 chapters (standard 王弼 / 孔穎達 division)", () => {
    expect(SHUO_GUA.chapters).toHaveLength(11);
  });

  test("chapter numbers are sequential 1..11", () => {
    SHUO_GUA.chapters.forEach((ch, i) => {
      expect(ch.n).toBe(i + 1);
    });
  });

  test("every chapter has non-empty text", () => {
    for (const ch of SHUO_GUA.chapters) {
      expect(ch.text.length).toBeGreaterThan(0);
    }
  });

  test("every chapter has a project-authored modern English translation", () => {
    for (const ch of SHUO_GUA.chapters) {
      expect(ch.modernEn, `ch ${ch.n}`).toBeDefined();
      expect(ch.modernEn!.length, `ch ${ch.n}`).toBeGreaterThan(20);
    }
  });

  test("verification anchor — ch5 directional cycle (帝出乎震…)", () => {
    const ch5 = SHUO_GUA.chapters[4]!;
    expect(ch5.text).toContain("帝出乎震");
    expect(ch5.text).toContain("齊乎巽");
    expect(ch5.text).toContain("成言乎艮");
  });

  test("verification anchor — ch8 animal associations", () => {
    const ch8 = SHUO_GUA.chapters[7]!;
    expect(ch8.text).toContain("乾為馬");
    expect(ch8.text).toContain("坤為牛");
    expect(ch8.text).toContain("艮為狗");
    expect(ch8.text).toContain("兌為羊");
  });

  test("verification anchor — ch11 extended trigram catalogue", () => {
    const ch11 = SHUO_GUA.chapters[10]!;
    expect(ch11.text).toContain("乾為天");
    expect(ch11.text).toContain("為圜");
    expect(ch11.text).toContain("坤為地");
    expect(ch11.text).toContain("為母");
  });
});

describe("SHUOGUA_DERIVATION_CONTEXT", () => {
  const DERIVED_TYPES: DerivedType[] = [
    "nuclear",
    "polarity",
    "mirror",
    "becoming",
    "diagonal",
  ];

  test("covers every DerivedType with a non-empty relevance note", () => {
    expect(Object.keys(SHUOGUA_DERIVATION_CONTEXT).sort()).toEqual([...DERIVED_TYPES].sort());
    for (const op of DERIVED_TYPES) {
      const context = SHUOGUA_DERIVATION_CONTEXT[op];
      expect(context.chapter).toBeGreaterThanOrEqual(1);
      expect(context.chapter).toBeLessThanOrEqual(11);
      expect(context.title.length).toBeGreaterThan(0);
      expect(context.relevance.length).toBeGreaterThan(40);
    }
  });

  test("context chapter numbers match buildConnections citations", () => {
    const citations = buildConnections({ primary: 1 }).shuoguaCitations;
    for (const citation of citations) {
      expect(SHUOGUA_DERIVATION_CONTEXT[citation.op].chapter).toBe(citation.chapter);
    }
  });
});

describe("TRIGRAM_ASSOC", () => {
  test("has 8 entries keyed by canonical trigram zh char", () => {
    expect(Object.keys(TRIGRAM_ASSOC).sort()).toEqual([...TRIGRAM_KEYS].sort());
  });

  test("every trigram has all 7 canonical fields populated", () => {
    for (const k of TRIGRAM_KEYS) {
      const assoc = TRIGRAM_ASSOC[k];
      expect(assoc).toBeDefined();
      expect(assoc!.image.length).toBeGreaterThan(0);
      expect(assoc!.family.length).toBeGreaterThan(0);
      expect(assoc!.body.length).toBeGreaterThan(0);
      expect(assoc!.animal.length).toBeGreaterThan(0);
      expect(assoc!.direction.length).toBeGreaterThan(0);
      expect(assoc!.attribute.length).toBeGreaterThan(0);
      expect(assoc!.extendedImages.length).toBeGreaterThan(0);
    }
  });

  test("乾 canonical fields match canon", () => {
    const q = TRIGRAM_ASSOC["乾"]!;
    expect(q.image).toBe("天");
    expect(q.family).toBe("父");
    expect(q.body).toBe("首");
    expect(q.animal).toBe("馬");
    expect(q.direction).toBe("西北");
    expect(q.attribute).toBe("健");
    // ch.11 catalogue for 乾 has 14 extended images
    expect(q.extendedImages).toHaveLength(14);
  });

  test("坤 canonical fields match canon", () => {
    const k = TRIGRAM_ASSOC["坤"]!;
    expect(k.image).toBe("地");
    expect(k.family).toBe("母");
    expect(k.body).toBe("腹");
    expect(k.animal).toBe("牛");
    expect(k.direction).toBe("西南");
    expect(k.attribute).toBe("順");
  });

  test("animal column matches 說卦 ch.8 exact list", () => {
    expect(TRIGRAM_ASSOC["乾"]!.animal).toBe("馬");
    expect(TRIGRAM_ASSOC["坤"]!.animal).toBe("牛");
    expect(TRIGRAM_ASSOC["震"]!.animal).toBe("龍");
    expect(TRIGRAM_ASSOC["巽"]!.animal).toBe("雞");
    expect(TRIGRAM_ASSOC["坎"]!.animal).toBe("豕");
    expect(TRIGRAM_ASSOC["離"]!.animal).toBe("雉");
    expect(TRIGRAM_ASSOC["艮"]!.animal).toBe("狗");
    expect(TRIGRAM_ASSOC["兌"]!.animal).toBe("羊");
  });

  test("family column matches the 索 indexing scheme (父母三男三女)", () => {
    expect(TRIGRAM_ASSOC["乾"]!.family).toBe("父");
    expect(TRIGRAM_ASSOC["坤"]!.family).toBe("母");
    expect(TRIGRAM_ASSOC["震"]!.family).toBe("長男");
    expect(TRIGRAM_ASSOC["巽"]!.family).toBe("長女");
    expect(TRIGRAM_ASSOC["坎"]!.family).toBe("中男");
    expect(TRIGRAM_ASSOC["離"]!.family).toBe("中女");
    expect(TRIGRAM_ASSOC["艮"]!.family).toBe("少男");
    expect(TRIGRAM_ASSOC["兌"]!.family).toBe("少女");
  });

  test("body column matches 說卦 ch.9 list", () => {
    expect(TRIGRAM_ASSOC["乾"]!.body).toBe("首");
    expect(TRIGRAM_ASSOC["坤"]!.body).toBe("腹");
    expect(TRIGRAM_ASSOC["震"]!.body).toBe("足");
    expect(TRIGRAM_ASSOC["巽"]!.body).toBe("股");
    expect(TRIGRAM_ASSOC["坎"]!.body).toBe("耳");
    expect(TRIGRAM_ASSOC["離"]!.body).toBe("目");
    expect(TRIGRAM_ASSOC["艮"]!.body).toBe("手");
    expect(TRIGRAM_ASSOC["兌"]!.body).toBe("口");
  });

  test("attribute column matches 說卦 ch.7 (健順動入陷麗止說)", () => {
    expect(TRIGRAM_ASSOC["乾"]!.attribute).toBe("健");
    expect(TRIGRAM_ASSOC["坤"]!.attribute).toBe("順");
    expect(TRIGRAM_ASSOC["震"]!.attribute).toBe("動");
    expect(TRIGRAM_ASSOC["巽"]!.attribute).toBe("入");
    expect(TRIGRAM_ASSOC["坎"]!.attribute).toBe("陷");
    expect(TRIGRAM_ASSOC["離"]!.attribute).toBe("麗");
    expect(TRIGRAM_ASSOC["艮"]!.attribute).toBe("止");
    expect(TRIGRAM_ASSOC["兌"]!.attribute).toBe("說");
  });

  test("editorial fields populated where the source provides them", () => {
    // The JSON warn flagged season/cosmologicalRole/other as editorial
    // synthesis with English glosses in parens. Spot-check 乾 has all three.
    expect(TRIGRAM_ASSOC["乾"]!.season).toBeDefined();
    expect(TRIGRAM_ASSOC["乾"]!.cosmologicalRole).toBeDefined();
    expect(TRIGRAM_ASSOC["乾"]!.other).toBeDefined();
  });
});

describe("SHUO_GUA_META", () => {
  test("carries provenance + chapter count", () => {
    expect(SHUO_GUA_META.source).toMatch(/ctext\.org/);
    expect(SHUO_GUA_META.crossChecks.length).toBeGreaterThan(0);
    expect(SHUO_GUA_META.license).toMatch(/public domain/);
    expect(SHUO_GUA_META.chapterCount).toBe(11);
  });
});
