import { describe, test, expect } from "bun:test";
import { GUA } from "../data/gua.js";
import { XU_GUA } from "../data/xugua.js";
import {
  LEGGE_XUGUA_EN,
  LEGGE_ZAGUA_EN,
  LEGGE_SHUOGUA_EN,
  LEGGE_META,
} from "../data/legge.js";

/**
 * U10 integrity tests — Legge backfill into GUA + XU_GUA, plus the
 * standalone LEGGE_*_EN exports for Wings translations that don't
 * have a clean 1:1 mapping into the zh data modules.
 */

describe("GUA — Legge backfill", () => {
  test("every hexagram has a populated .legge with judgment, image, lines", () => {
    for (let i = 0; i < 64; i++) {
      const entry = GUA[i]!;
      expect(entry.legge, `hex ${i + 1} (${entry.n}) .legge`).toBeDefined();
      expect(entry.legge!.leggeName.length).toBeGreaterThan(0);
      expect(entry.legge!.judgment.length).toBeGreaterThan(0);
      expect(entry.legge!.image.length).toBeGreaterThan(0);
      expect(entry.legge!.lines.length).toBeGreaterThanOrEqual(6);
    }
  });

  test("every hexagram has a populated gcEn (English of 卦辭)", () => {
    for (let i = 0; i < 64; i++) {
      const entry = GUA[i]!;
      expect(entry.gcEn, `hex ${i + 1} (${entry.n}) gcEn`).toBeDefined();
      expect(entry.gcEn!.length).toBeGreaterThan(0);
    }
  });

  test("hex 1 (Khien) Legge anchors — judgment, image, line 1", () => {
    const q = GUA[0]!;
    expect(q.legge!.leggeName).toContain("Khien");
    expect(q.legge!.judgment).toContain("great and originating");
    expect(q.legge!.image).toContain("Heaven, in its motion");
    expect(q.legge!.lines[0]).toContain("dragon lying hid");
    // U9 cleanup verified: the canonical Legge phrasing "The first line" /
    // "In the first ... line" — NOT the baharna "In the first NINE" form.
    expect(q.legge!.lines[0]).not.toMatch(/^In the first NINE/);
  });

  test("hex 1 (Khien) has 7 lines including the 用九 paragraph", () => {
    expect(GUA[0]!.legge!.lines).toHaveLength(7);
    expect(GUA[0]!.legge!.lines[6]).toContain("number nine");
  });

  test("hex 2 (Khwan) has 7 lines including the 用六 paragraph", () => {
    expect(GUA[1]!.legge!.lines).toHaveLength(7);
    expect(GUA[1]!.legge!.lines[6]).toContain("number six");
  });

  test("hexagrams 3..64 have exactly 6 lines", () => {
    for (let i = 2; i < 64; i++) {
      expect(GUA[i]!.legge!.lines.length, `hex ${i + 1}`).toBe(6);
    }
  });

  test("no Legge line starts with the rejected 'In the first/second/... NINE/SIX' baharna form", () => {
    const rejected = /^In the (first|second|third|fourth|fifth|sixth|topmost) (NINE|SIX)\b/;
    for (let i = 0; i < 64; i++) {
      for (const line of GUA[i]!.legge!.lines) {
        expect(line).not.toMatch(rejected);
      }
    }
  });
});

describe("XU_GUA — Legge textEn backfill", () => {
  test("every entry has populated textEn", () => {
    for (const entry of XU_GUA) {
      expect(entry.textEn, `hex ${entry.hexagram}`).toBeDefined();
      expect(entry.textEn!.length).toBeGreaterThan(0);
    }
  });

  test("no entry has fused-digit footnote artifacts (U9 cleanup invariant)", () => {
    // Patterns the U9 cleanup eliminated: word + digit + punctuation/word boundary.
    const lettersDigit = /[A-Z][a-z]+\d\b/;     // Kun1, Li4
    const parenDigit = /\)\d/;                  // (...)2
    const spaceDigitPunct = /\b[a-zA-Z]+ \d+[.,;:]/; // multitudes 3;
    const axeArtifact = /\baxe subjected\b/;
    for (const entry of XU_GUA) {
      const text = entry.textEn ?? "";
      expect(text).not.toMatch(lettersDigit);
      expect(text).not.toMatch(parenDigit);
      expect(text).not.toMatch(spaceDigitPunct);
      expect(text).not.toMatch(axeArtifact);
    }
  });
});

describe("LEGGE_XUGUA_EN — standalone Wings map", () => {
  test("has 64 entries keyed 1..64", () => {
    expect(Object.keys(LEGGE_XUGUA_EN)).toHaveLength(64);
    for (let h = 1; h <= 64; h++) {
      expect(LEGGE_XUGUA_EN[h], `hex ${h}`).toBeDefined();
      expect(LEGGE_XUGUA_EN[h]!.length).toBeGreaterThan(0);
    }
  });

  test("hex 1 entry parallels XU_GUA[0].textEn", () => {
    expect(LEGGE_XUGUA_EN[1]).toBe(XU_GUA[0]!.textEn!);
  });
});

describe("LEGGE_ZAGUA_EN — Legge's 46 rhymed couplets", () => {
  test("has 46 entries with pair[] + text", () => {
    expect(LEGGE_ZAGUA_EN).toHaveLength(46);
    for (const entry of LEGGE_ZAGUA_EN) {
      expect(Array.isArray(entry.pair)).toBe(true);
      expect(entry.text.length).toBeGreaterThan(0);
    }
  });

  test("opening couplet pairs Khien (1) + Khwan (2)", () => {
    expect(LEGGE_ZAGUA_EN[0]!.pair).toEqual([1, 2]);
    expect(LEGGE_ZAGUA_EN[0]!.text).toContain("Khien");
    expect(LEGGE_ZAGUA_EN[0]!.text).toContain("Khwan");
  });

  test("final entry is free of nav chrome (U9 blocker 3)", () => {
    const last = LEGGE_ZAGUA_EN[LEGGE_ZAGUA_EN.length - 1]!.text;
    expect(last).not.toMatch(/Previous|Contents|Return to|Baharna/);
  });
});

describe("LEGGE_SHUOGUA_EN — Legge's 22-paragraph Appendix V", () => {
  test("has 22 entries keyed 1..22", () => {
    expect(Object.keys(LEGGE_SHUOGUA_EN)).toHaveLength(22);
    for (let p = 1; p <= 22; p++) {
      expect(LEGGE_SHUOGUA_EN[p], `paragraph ${p}`).toBeDefined();
    }
  });

  test("paragraph 1 opens with the sages-and-divining-plant anchor", () => {
    expect(LEGGE_SHUOGUA_EN[1]).toContain("sages");
  });
});

describe("LEGGE_META", () => {
  test("documents source + public-domain license", () => {
    expect(LEGGE_META.source.length).toBeGreaterThan(0);
    expect(LEGGE_META.license).toMatch(/public domain/i);
  });
});
