import { describe, test, expect } from "bun:test";
import { GUA } from "../data/gua.js";

/**
 * U8 integrity tests — 卦辭 + 小象傳 backfill into gua.ts.
 *
 * Verifies that every hexagram now carries a non-empty `gc` (root oracle
 * text) and a 6-entry `yaoXiao` (per-line Small Image commentary), spot-
 * checks canonical anchors, and proves the 无 → 無 normalization
 * preserved the canonical hex-25 name 无妄.
 */

describe("GUA — 卦辭 (gc) coverage", () => {
  test("every hexagram has a non-empty gc", () => {
    for (let i = 0; i < 64; i++) {
      const entry = GUA[i]!;
      expect(entry.gc, `hex ${i + 1} (${entry.n}) gc`).toBeDefined();
      expect(entry.gc!.length).toBeGreaterThan(0);
    }
  });

  test("hex 1 (乾) gc carries the canonical 元亨，利貞", () => {
    expect(GUA[0]!.gc).toContain("元亨");
    expect(GUA[0]!.gc).toContain("利貞");
  });

  test("hex 3 (屯) gc carries the canonical pattern", () => {
    expect(GUA[2]!.gc).toContain("元亨");
    expect(GUA[2]!.gc).toContain("利貞");
  });

  test("hex 25 (无妄) entry — hexagram name preserved as 无妄, gc carries oracle text", () => {
    // Hex 25's name uses 无 (not 無) — canonical 周易 spelling. Backfill
    // must not have normalized it. The gc text itself is the oracle and
    // doesn't necessarily mention the hex name inline.
    expect(GUA[24]!.n).toBe("无妄");
    expect(GUA[24]!.gc).toBeDefined();
    expect(GUA[24]!.gc!.length).toBeGreaterThan(0);
  });
});

describe("GUA — 小象傳 (yaoXiao) coverage", () => {
  test("every hexagram has a yaoXiao array of exactly 6 non-empty strings", () => {
    for (let i = 0; i < 64; i++) {
      const entry = GUA[i]!;
      expect(entry.yaoXiao, `hex ${i + 1} (${entry.n}) yaoXiao`).toBeDefined();
      expect(entry.yaoXiao!).toHaveLength(6);
      for (let line = 0; line < 6; line++) {
        expect(entry.yaoXiao![line]!.length, `hex ${i + 1} line ${line + 1}`).toBeGreaterThan(0);
      }
    }
  });

  test("hex 1 (乾) line 1 小象: 潛龍勿用，陽在下也", () => {
    const xiao = GUA[0]!.yaoXiao![0]!;
    expect(xiao).toContain("潛龍勿用");
    expect(xiao).toContain("陽在下也");
  });

  test("hex 3 (屯) line 1 小象 carries 雖磐桓 + 志行正也", () => {
    const xiao = GUA[2]!.yaoXiao![0]!;
    expect(xiao).toContain("雖磐桓");
    expect(xiao).toContain("志行正也");
  });
});

describe("GUA — existing fields untouched by U8 backfill", () => {
  test("hex 1 (乾) legacy fields unchanged", () => {
    const q = GUA[0]!;
    expect(q.u).toBe("䷀");
    expect(q.n).toBe("乾");
    expect(q.p).toBe("Qián");
    expect(q.ename).toBe("The Creative");
    expect(q.l).toEqual([1, 1, 1, 1, 1, 1]);
    expect(q.dx).toContain("天行健");
    expect(q.yao).toHaveLength(6);
    expect(q.yaoEn).toHaveLength(6);
  });

  test("hex 64 (未濟) is the final entry with legacy + new fields", () => {
    const wj = GUA[63]!;
    expect(wj.n).toBe("未濟");
    expect(wj.gc).toBeDefined();
    expect(wj.yaoXiao).toHaveLength(6);
    expect(wj.yao).toHaveLength(6);
  });
});

describe("GUA — encoding normalization", () => {
  test("no stray 无 in any gc or yaoXiao outside the 无妄 hex-25 name", () => {
    const offenders: string[] = [];
    for (let i = 0; i < 64; i++) {
      const entry = GUA[i]!;
      const texts = [entry.gc ?? "", ...(entry.yaoXiao ?? [])];
      for (let t = 0; t < texts.length; t++) {
        const matches = [...texts[t]!.matchAll(/无./g)];
        for (const m of matches) {
          if (m[0] !== "无妄") {
            offenders.push(`hex ${i + 1} ${t === 0 ? "gc" : `yaoXiao[${t - 1}]`}: ${m[0]}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
