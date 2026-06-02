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

// LEGGE_ZAGUA_BY_HEX reroutes the two documented anomalies (pair=[41] →
// hex 39, pair=[50,51] → hexes 49 + 50), so all 64 hexes now get a Legge couplet.
// Historically these were treated as a gap; the reroute closes it.

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

  test("LEGGE_ZAGUA_BY_HEX — covers all 64 hexes (anomalies rerouted)", () => {
    for (let h = 1; h <= 64; h++) {
      expect(LEGGE_ZAGUA_BY_HEX[h], `hex ${h}`).toBeDefined();
      expect(LEGGE_ZAGUA_BY_HEX[h]!.length).toBeGreaterThan(0);
    }
  });

  test("anomaly reroute — hex 39 carries Kien content, hex 49 + 50 carry Ko/Ting content", () => {
    // The pair=[41] couplet's content describes Kien (hex 39); rerouted.
    expect(LEGGE_ZAGUA_BY_HEX[39]).toMatch(/Kien/i);
    // The pair=[50,51] couplet's content describes Ko + Ting (hexes 49 + 50); rerouted.
    expect(LEGGE_ZAGUA_BY_HEX[49]).toMatch(/Ting.*Ko/);
    expect(LEGGE_ZAGUA_BY_HEX[50]).toBe(LEGGE_ZAGUA_BY_HEX[49]);
  });

  test("anomaly reroute — hex 41 + 51 keep their LEGITIMATE couplets (not overwritten)", () => {
    // Hex 41 should not carry the Kien text now that the anomaly is routed away.
    expect(LEGGE_ZAGUA_BY_HEX[41]).not.toMatch(/Kien/i);
    expect(LEGGE_ZAGUA_BY_HEX[41]).toMatch(/Sun and Yi/);
    // Hex 51 should not carry the Ko/Ting anomaly now that it is routed away.
    expect(LEGGE_ZAGUA_BY_HEX[51]).not.toBe(LEGGE_ZAGUA_BY_HEX[49]);
    expect(LEGGE_ZAGUA_BY_HEX[51]).toBe("Kan starts; Kan stops.");
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

  test("all 64 hexes produce a zaGuaPair with Legge textEn populated", () => {
    for (let h = 1; h <= 64; h++) {
      const conn = buildConnections({ primary: h });
      expect(conn.zaGuaPair?.text.length, `hex ${h} zh`).toBeGreaterThan(0);
      expect(conn.zaGuaPair?.textEn, `hex ${h} en`).toBeDefined();
      expect(conn.zaGuaPair!.textEn!.length).toBeGreaterThan(0);
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
