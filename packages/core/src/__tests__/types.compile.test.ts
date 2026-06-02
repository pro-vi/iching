import { describe, test, expect } from "bun:test";
import type {
  Hexagram,
  TrigramInfo,
  XuGuaEntry,
  ZaGuaEntry,
  ShuoguaChapter,
  ShuoguaCitation,
  CastConnections,
  Style,
  QuoteStyle,
} from "../types.js";

/**
 * Type-only test for the data-enrichment extensions.
 *
 * The real guard is `bun run typecheck`; the `expect` calls below just confirm
 * the file ran and the literals match what the type system enforces.
 */

describe("types — data enrichment extensions", () => {
  test("legacy Hexagram literal compiles with no new fields", () => {
    const legacy: Hexagram = {
      u: "X",
      n: "X",
      p: "X",
      ename: "X",
      l: [1, 1, 1, 1, 1, 1],
      dx: "X",
      tu: "X",
      en: "X",
      te: "X",
      w: "X",
      yao: ["", "", "", "", "", ""],
      yaoEn: ["", "", "", "", "", ""],
    };
    expect(legacy.gc).toBeUndefined();
    expect(legacy.gcEn).toBeUndefined();
    expect(legacy.yaoXiao).toBeUndefined();
    expect(legacy.yaoXiaoEn).toBeUndefined();
    expect(legacy.legge).toBeUndefined();
  });

  test("Hexagram literal with every new optional field compiles", () => {
    const enriched: Hexagram = {
      u: "X",
      n: "X",
      p: "X",
      ename: "X",
      l: [1, 1, 1, 1, 1, 1],
      dx: "X",
      tu: "X",
      en: "X",
      te: "X",
      w: "X",
      yao: ["", "", "", "", "", ""],
      yaoEn: ["", "", "", "", "", ""],
      gc: "X",
      gcEn: "X",
      yaoXiao: ["", "", "", "", "", ""],
      yaoXiaoEn: ["", "", "", "", "", ""],
      legge: {
        leggeName: "X",
        judgment: "X",
        image: "X",
        lines: ["", "", "", "", "", "", ""],
      },
    };
    expect(enriched.gc).toBe("X");
    expect(enriched.legge?.lines).toHaveLength(7);
  });

  test("TrigramInfo with assoc compiles", () => {
    const t: TrigramInfo = {
      sym: "X",
      n: "X",
      img: "X",
      assoc: {
        image: "X",
        family: "X",
        body: "X",
        animal: "X",
        direction: "X",
        attribute: "X",
        extendedImages: ["X"],
      },
    };
    expect(t.assoc?.extendedImages).toHaveLength(1);
  });

  test("TrigramInfo with optional editorial assoc fields compiles", () => {
    const t: TrigramInfo = {
      sym: "X",
      n: "X",
      img: "X",
      assoc: {
        image: "X",
        family: "X",
        body: "X",
        animal: "X",
        direction: "X",
        attribute: "X",
        extendedImages: [],
        season: "X",
        cosmologicalRole: "X",
        other: "X",
      },
    };
    expect(t.assoc?.season).toBe("X");
  });

  test("XuGuaEntry, ZaGuaEntry, ShuoguaChapter shapes compile", () => {
    const xu: XuGuaEntry = { hexagram: 3, name: "X", text: "X" };
    const za: ZaGuaEntry = { index: 0, pair: [1, 2], names: ["X", "X"], text: "X" };
    const ch: ShuoguaChapter = { n: 1, text: "X" };
    expect(xu.text.length).toBeGreaterThan(0);
    expect(za.pair).toHaveLength(2);
    expect(ch.n).toBe(1);
  });

  test("XuGuaEntry and ZaGuaEntry support optional textEn (Legge)", () => {
    const xu: XuGuaEntry = { hexagram: 1, name: "X", text: "X", textEn: "X", note: "X" };
    const za: ZaGuaEntry = { index: 0, pair: [1, 2], names: ["X", "X"], text: "X", textEn: "X" };
    expect(xu.textEn).toBe("X");
    expect(za.textEn).toBe("X");
  });

  test("ShuoguaCitation typed against DerivedType", () => {
    const citation: ShuoguaCitation = { op: "nuclear", chapter: 3 };
    expect(citation.op).toBe("nuclear");
    expect(citation.chapter).toBe(3);
  });

  test("CastConnections has required citations + optional pair fields", () => {
    const conn: CastConnections = {
      shuoguaCitations: [
        { op: "nuclear", chapter: 3 },
        { op: "polarity", chapter: 2 },
      ],
    };
    expect(conn.shuoguaCitations).toHaveLength(2);
    expect(conn.xuGua).toBeUndefined();
    expect(conn.zaGuaPair).toBeUndefined();
  });

  test("Style union unchanged from baseline; QuoteStyle still excludes st", () => {
    // Style and QuoteStyle are unchanged by U1. Extension to include the new
    // optional `gc` field as a Style key is deferred to U7 (lockstep with the
    // CLI consumer sites). For U1 the new optional fields are direct-access
    // only.
    const styles: Style[] = ["dx", "tu", "en", "te", "w", "st"];
    const quoteStyles: QuoteStyle[] = ["dx", "tu", "en", "te", "w"];
    expect(styles).toHaveLength(6);
    expect(quoteStyles).toHaveLength(5);
    // QuoteStyle must not include "st" (enforced by Exclude<Style, "st">).
    const isStInQuoteStyle: "st" extends QuoteStyle ? true : false = false;
    expect(isStInQuoteStyle).toBe(false);
  });
});
