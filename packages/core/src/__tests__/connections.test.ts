import { describe, test, expect } from "bun:test";
import { connections } from "../derivation/connections.js";
import { ZA_GUA_BY_HEX } from "../data/zagua.js";
import { mirror } from "../derivation/mirror.js";
import { polarity } from "../derivation/polarity.js";
import { hexagramByKW } from "../identify/lookup.js";
import { buildHexagramDetail } from "../detail.js";
import type { Line } from "../types.js";

/**
 * U5 tests — connections overlay + HexagramDetail aggregation.
 *
 * The orbit-integrity tests are the satisfying adversarial check:
 * for every non-tail hexagram with a 2-element 雜卦 pair, the pair must
 * contain the geometric partner (mirror, with polarity fallback for the
 * 8 self-mirror hexagrams). The famously disordered final 8 are
 * whitelisted — the canon's own irregularity, not a pull bug.
 */

const DISORDERED_TAIL = new Set([27, 28, 43, 44, 53, 54, 63, 64]);

function linesOf(kw: number): Line[] {
  const hex = hexagramByKW(kw);
  return hex.l.map((v) => ({
    value: v === 1 ? (7 as const) : (8 as const),
    isYang: v === 1,
    isChanging: false,
  }));
}

describe("connections — text overlay for a cast", () => {
  test("returns 5 shuoguaCitations covering all DerivedType ops", () => {
    const conn = connections({ primary: 3 });
    expect(conn.shuoguaCitations).toHaveLength(5);
    const ops = conn.shuoguaCitations.map((c) => c.op).sort();
    expect(ops).toEqual(["becoming", "diagonal", "mirror", "nuclear", "polarity"]);
  });

  test("shuoguaCitations chapter numbers are valid 1..11", () => {
    const conn = connections({ primary: 3 });
    for (const c of conn.shuoguaCitations) {
      expect(c.chapter).toBeGreaterThanOrEqual(1);
      expect(c.chapter).toBeLessThanOrEqual(11);
    }
  });

  test("hex 3 (屯) — xuGua carries canonical sequence transition", () => {
    const conn = connections({ primary: 3 });
    expect(conn.xuGua).toBeDefined();
    expect(conn.xuGua!.hexagram).toBe(3);
    expect(conn.xuGua!.name).toBe("屯");
    expect(conn.xuGua!.text).toContain("故受之以");
  });

  test("hex 1 (乾) — xuGua present with shared cosmological preamble note", () => {
    const conn = connections({ primary: 1 });
    expect(conn.xuGua).toBeDefined();
    expect(conn.xuGua!.name).toBe("乾");
    expect(conn.xuGua!.text).toContain("有天地，然後萬物生焉");
    expect(conn.xuGua!.note).toBeDefined();
  });

  test("hex 1 + hex 2 share the opening cosmological preamble", () => {
    const conn1 = connections({ primary: 1 });
    const conn2 = connections({ primary: 2 });
    expect(conn1.xuGua!.text).toBe(conn2.xuGua!.text);
  });

  test("hex 1 (乾) — zaGuaPair has both 乾 and 坤 (canonical opening pair)", () => {
    const conn = connections({ primary: 1 });
    expect(conn.zaGuaPair).toBeDefined();
    expect(conn.zaGuaPair!.pair).toEqual([1, 2]);
    expect(conn.zaGuaPair!.text).toContain("剛");
    expect(conn.zaGuaPair!.text).toContain("柔");
  });

  test("hex 29 (坎) + hex 30 (離) — entries present (self-mirror pair)", () => {
    const conn29 = connections({ primary: 29 });
    const conn30 = connections({ primary: 30 });
    expect(conn29.zaGuaPair).toBeDefined();
    expect(conn30.zaGuaPair).toBeDefined();
    // Their entries reference 29 / 30 somewhere in the pair[] arrays.
    const both = new Set([
      ...conn29.zaGuaPair!.pair,
      ...conn30.zaGuaPair!.pair,
    ]);
    expect(both.has(29)).toBe(true);
    expect(both.has(30)).toBe(true);
  });

  test("returns fresh shuoguaCitations array per call (no shared mutable state)", () => {
    const a = connections({ primary: 3 });
    const b = connections({ primary: 3 });
    expect(a.shuoguaCitations).not.toBe(b.shuoguaCitations);
    expect(a.shuoguaCitations).toEqual(b.shuoguaCitations);
  });

  test("xuGua and zaGuaPair populated for all valid hex 1..64", () => {
    for (let h = 1; h <= 64; h++) {
      const conn = connections({ primary: h });
      expect(conn.xuGua).toBeDefined();
      expect(conn.zaGuaPair).toBeDefined();
    }
  });
});

describe("orbit-integrity invariant (adversarial)", () => {
  test("every non-tail hex with a 2-element pair contains its geometric partner", () => {
    for (let h = 1; h <= 64; h++) {
      if (DISORDERED_TAIL.has(h)) continue;
      const entry = ZA_GUA_BY_HEX[h];
      expect(entry).toBeDefined();
      if (entry!.pair.length !== 2) continue;

      const lines = linesOf(h);
      const m = mirror(lines);
      const partner = m !== h ? m : polarity(lines);

      // The pair contains the geometric partner.
      expect(entry!.pair).toContain(partner);
    }
  });

  test("disordered-tail hexagrams have entries even though the invariant is suspended", () => {
    for (const h of DISORDERED_TAIL) {
      const entry = ZA_GUA_BY_HEX[h];
      expect(entry).toBeDefined();
      expect(entry!.pair).toContain(h);
    }
  });

  test("for every hex 1..64, ZA_GUA_BY_HEX resolves to an entry containing that hex", () => {
    for (let h = 1; h <= 64; h++) {
      const entry = ZA_GUA_BY_HEX[h];
      expect(entry).toBeDefined();
      expect(entry!.pair).toContain(h);
    }
  });
});

describe("HexagramDetail integration", () => {
  test("buildHexagramDetail embeds the connections overlay", () => {
    const detail = buildHexagramDetail(3);
    expect(detail.connections).toBeDefined();
    expect(detail.connections.xuGua?.name).toBe("屯");
    expect(detail.connections.zaGuaPair).toBeDefined();
    expect(detail.connections.shuoguaCitations).toHaveLength(5);
  });

  test("existing HexagramDetail fields are unchanged by U5", () => {
    const detail = buildHexagramDetail(1);
    expect(detail.kw).toBe(1);
    expect(detail.gua.n).toBe("乾");
    expect(detail.structure.upper.n).toBe("乾");
    expect(detail.structure.lower.n).toBe("乾");
    expect(detail.nuclear.kw).toBe(1);
    expect(detail.polarity.kw).toBe(2);
    expect(detail.mirror.kw).toBe(1);
    expect(detail.diagonal.kw).toBe(2);
    expect(typeof detail.isLocked).toBe("boolean");
  });
});
