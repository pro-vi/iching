import { describe, test, expect } from "bun:test";
import { GUA } from "../data/gua.js";
import { XU_GUA } from "../data/xugua.js";
import { ZA_GUA_BY_HEX } from "../data/zagua.js";
import { LEGGE_ZAGUA_BY_HEX } from "../data/legge.js";
import { buildConnections } from "../derivation/connections.js";

/**
 * Data-coverage invariants — the "enrichment outran wiring" guard.
 *
 * After multi-wave enrichment (U1–U11 + the post-/code-review cluster),
 * every optional field declared on the type surface should either:
 *   (a) be populated for all 64 hexagrams, OR
 *   (b) carry a documented exception this test pins explicitly.
 *
 * The risk this test catches: a future wave adds a field, declares it on
 * the type, gates a renderer branch on it — but never backfills the data.
 * The branch goes silently dead. This test would fail.
 */

const DOCUMENTED_ZAGUA_GAPS = new Set([39, 49]);

describe("Hexagram-level field coverage", () => {
  test("gc — all 64 hexagrams populated (root oracle, U8)", () => {
    const missing = GUA.map((g, i) => (g.gc ? null : i + 1)).filter(Boolean);
    expect(missing).toEqual([]);
  });

  test("gcEn — all 64 hexagrams populated (English of 卦辭, U10)", () => {
    const missing = GUA.map((g, i) => (g.gcEn ? null : i + 1)).filter(Boolean);
    expect(missing).toEqual([]);
  });

  test("gcEn === legge.judgment for all 64 (single source of truth invariant)", () => {
    // Both fields carry the same Legge text. This test pins their equality
    // so a future edit that touches only one silently diverges → caught.
    for (let i = 0; i < 64; i++) {
      expect(GUA[i]!.gcEn).toBe(GUA[i]!.legge!.judgment);
    }
  });

  test("yaoXiao — all 64 populated with exactly 6 entries (per-line 小象, U8)", () => {
    for (let i = 0; i < 64; i++) {
      expect(GUA[i]!.yaoXiao, `hex ${i + 1}`).toBeDefined();
      expect(GUA[i]!.yaoXiao!).toHaveLength(6);
    }
  });

  test("yaoXiaoEn — DOCUMENTED GAP: zero populated", () => {
    // Legge does not translate the per-line 小象傳 (his Appendix II isn't
    // in our pull). The renderer surfaces 小象 in zh only — there is no
    // yaoXiaoEn branch. If this test starts failing because some hexagram
    // gained yaoXiaoEn, decide whether the field should be backfilled for
    // all 64 or removed from the type.
    const populated = GUA.filter((g) => g.yaoXiaoEn).length;
    expect(populated).toBe(0);
  });

  test("legge — all 64 hexagrams populated (U10)", () => {
    const missing = GUA.map((g, i) => (g.legge ? null : i + 1)).filter(Boolean);
    expect(missing).toEqual([]);
  });

  test("legge.lines — hex 1 & 2 have 7 entries (用九/用六); hex 3..64 have 6", () => {
    expect(GUA[0]!.legge!.lines).toHaveLength(7);
    expect(GUA[1]!.legge!.lines).toHaveLength(7);
    for (let i = 2; i < 64; i++) {
      expect(GUA[i]!.legge!.lines.length, `hex ${i + 1}`).toBe(6);
    }
  });
});

describe("Wings textEn coverage", () => {
  test("XU_GUA — all 64 entries have textEn (序卦 English from Legge, U10)", () => {
    const missing = XU_GUA.map((e) => (e.textEn ? null : e.hexagram)).filter(Boolean);
    expect(missing).toEqual([]);
  });

  test("ZA_GUA — all 64 hexes covered by ZA_GUA_BY_HEX with non-empty zh", () => {
    for (let h = 1; h <= 64; h++) {
      const entry = ZA_GUA_BY_HEX[h];
      expect(entry, `hex ${h}`).toBeDefined();
      expect(entry!.text.length).toBeGreaterThan(0);
    }
  });

  test("LEGGE_ZAGUA_BY_HEX — covers 62 hexes (gap on 39 + 49 per Legge typography)", () => {
    const covered = Array.from({ length: 64 }, (_, i) => i + 1).filter(
      (h) => LEGGE_ZAGUA_BY_HEX[h] !== undefined,
    );
    const uncovered = Array.from({ length: 64 }, (_, i) => i + 1).filter(
      (h) => LEGGE_ZAGUA_BY_HEX[h] === undefined,
    );
    expect(covered).toHaveLength(62);
    expect(new Set(uncovered)).toEqual(DOCUMENTED_ZAGUA_GAPS);
  });
});

describe("Consumer-completeness — buildConnections surfaces what the renderer reads", () => {
  test("every hex 1..64 produces a CastConnections with populated xuGua + zaGuaPair", () => {
    for (let h = 1; h <= 64; h++) {
      const conn = buildConnections({ primary: h });
      expect(conn.xuGua, `hex ${h} xuGua`).toBeDefined();
      expect(conn.zaGuaPair, `hex ${h} zaGuaPair`).toBeDefined();
    }
  });

  test("62 of 64 hexes produce a zaGuaPair with Legge textEn populated", () => {
    let withEn = 0;
    let withoutEn = 0;
    for (let h = 1; h <= 64; h++) {
      const conn = buildConnections({ primary: h });
      if (conn.zaGuaPair?.textEn) {
        withEn++;
      } else {
        withoutEn++;
      }
    }
    expect(withEn).toBe(62);
    expect(withoutEn).toBe(2);
  });

  test("hex 39 + hex 49 zaGuaPair carries zh text but no Legge English (documented gap)", () => {
    for (const h of DOCUMENTED_ZAGUA_GAPS) {
      const conn = buildConnections({ primary: h });
      expect(conn.zaGuaPair?.text.length).toBeGreaterThan(0);
      expect(conn.zaGuaPair?.textEn).toBeUndefined();
    }
  });

  test("hex 1 + hex 2 xuGua share the cosmological preamble (NOT absent)", () => {
    // The earlier CastConnections.xuGua doc said "Absent for hex 1" — that
    // was wrong; the preamble is attributed to both. This test pins the
    // corrected contract.
    const c1 = buildConnections({ primary: 1 });
    const c2 = buildConnections({ primary: 2 });
    expect(c1.xuGua).toBeDefined();
    expect(c2.xuGua).toBeDefined();
    expect(c1.xuGua!.text).toBe(c2.xuGua!.text);
    expect(c1.xuGua!.text).toContain("有天地，然後萬物生焉");
  });
});
