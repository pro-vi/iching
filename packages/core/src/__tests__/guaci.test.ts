// Coverage + spot checks for the canonical oracle texts injected by
// scripts/inject-guaci.ts: gc (卦辭), gcEn (Legge judgment), yaoXiao (小象傳),
// and the 用九/用六 extras on hexagrams 1-2.

import { describe, test, expect } from "bun:test";
import { GUA } from "../data/gua.js";
import { toSimplified, SIMPLIFIED_MAP, SIMPLIFIED_EXCEPTIONS } from "../i18n/simplify.js";

describe("GUA judgment texts (卦辭)", () => {
  test("all 64 hexagrams have non-empty gc and gcEn", () => {
    for (let kw = 1; kw <= 64; kw++) {
      const g = GUA[kw - 1];
      expect(g.gc.length).toBeGreaterThan(0);
      expect(g.gcEn.length).toBeGreaterThan(0);
    }
  });

  test("all 64 hexagrams have exactly 6 yaoXiao entries, all non-empty", () => {
    for (let kw = 1; kw <= 64; kw++) {
      const g = GUA[kw - 1];
      expect(g.yaoXiao).toHaveLength(6);
      for (const x of g.yaoXiao) {
        expect(x.length).toBeGreaterThan(0);
      }
    }
  });

  test("hexagram 1 (乾) exact strings", () => {
    const g = GUA[0];
    expect(g.gc).toBe("元亨，利貞。");
    expect(g.gcEn).toBe(
      "Khien (represents) what is great and originating, penetrating, advantageous, correct and firm.",
    );
    expect(g.yaoXiao[0]).toBe("潛龍勿用，陽在下也。");
    expect(g.yaoXiao[5]).toBe("亢龍有悔，盈不可久也。");
  });

  test("hexagram 2 (坤) exact strings", () => {
    const g = GUA[1];
    expect(g.gc).toBe(
      "元亨，利牝馬之貞。君子有攸往，先迷後得主，利西南得朋，東北喪朋。安貞，吉。",
    );
    expect(g.yaoXiao[4]).toBe("黃裳元吉，文在中也。");
  });

  test("hexagram 63 (既濟) exact gc", () => {
    expect(GUA[62].gc).toBe("亨，小利貞，初吉終亂。");
  });

  test("hexagram 64 (未濟) exact gc + gcEn prefix", () => {
    expect(GUA[63].gc).toBe("亨，小狐汔濟，濡其尾，無攸利。");
    expect(GUA[63].gcEn.startsWith("Wei Zi intimates progress and success")).toBe(true);
  });

  test("用九/用六 extras exist exactly on hexagrams 1 and 2", () => {
    expect(GUA[0].extra).toEqual({
      name: "用九",
      text: "見群龍無首，吉。",
      textEn: expect.stringContaining("the use of the number nine"),
    });
    expect(GUA[1].extra).toEqual({
      name: "用六",
      text: "利永貞。",
      textEn: expect.stringContaining("the use of the number six"),
    });
    expect(GUA.filter((g) => g.extra).length).toBe(2);
  });
});

describe("gc/yaoXiao zh-Hans conversion coverage", () => {
  test("every Traditional char in the new texts is mapped, identity, or a listed exception", () => {
    // The audited map covers the rendered corpus. New texts (gc/yaoXiao/extra)
    // must not silently leak unconverted Traditional characters: each char with
    // a distinct simplified form must be in SIMPLIFIED_MAP; deliberate
    // retentions live in SIMPLIFIED_EXCEPTIONS. This test pins the supplement
    // entries added for the 卦辭/小象傳 corpus.
    expect(toSimplified("馴致其道")).toBe("驯致其道"); // hex 2 小象
    expect(toSimplified("以貴下賤")).toBe("以贵下贱"); // hex 3 小象
    expect(toSimplified("再三瀆，瀆則不告")).toBe("再三渎，渎则不告"); // hex 4 卦辭
    expect(toSimplified("其辯明也")).toBe("其辩明也"); // hex 6 小象
    expect(toSimplified("見群龍無首")).toBe("见群龙无首"); // 用九
    // Ext-B retention: 繘 stays Traditional (hex 48 卦辭)
    expect(toSimplified("汔至亦未繘井")).toBe("汔至亦未繘井");
    expect(SIMPLIFIED_EXCEPTIONS).toContain("繘");
  });

  test("乾 canonical exception is never converted in judgment texts", () => {
    expect(toSimplified(GUA[0].yaoXiao[2])).toContain("乾乾");
    expect(SIMPLIFIED_MAP["乾"]).toBeUndefined();
  });
});

describe("SEQUENCE (序卦傳/雜卦傳)", () => {
  test("all 64 entries have non-empty xu/za/zaEn", async () => {
    const { SEQUENCE } = await import("../data/sequence.js");
    expect(SEQUENCE).toHaveLength(64);
    for (const e of SEQUENCE) {
      expect(e.xu.length).toBeGreaterThan(0);
      expect(e.za.length).toBeGreaterThan(0);
      expect(e.zaEn.length).toBeGreaterThan(0);
    }
  });

  test("spot checks: 屯 sequence, 乾坤 epigram, Legge pair fixups", async () => {
    const { SEQUENCE } = await import("../data/sequence.js");
    expect(SEQUENCE[2].xu).toBe("盈天地之間者唯萬物，故受之以《屯》。");
    expect(SEQUENCE[0].za).toBe("《乾》剛《坤》柔。");
    expect(SEQUENCE[1].za).toBe("《乾》剛《坤》柔。");
    // legge-cleaned mis-tagged these pairs; the generator corrects them
    expect(SEQUENCE[38].zaEn).toContain("Kien their home"); // 39 蹇
    expect(SEQUENCE[48].zaEn).toContain("left by Ko"); // 49 革
    expect(SEQUENCE[63].xu).toContain("終焉"); // 未濟 closes the sequence
  });

  test("sequence texts convert cleanly to zh-Hans", async () => {
    const { SEQUENCE } = await import("../data/sequence.js");
    expect(toSimplified(SEQUENCE[2].xu)).toBe("盈天地之间者唯万物，故受之以《屯》。");
    // 蒙雜而著 — 著 (zhù, manifest) deliberately stays 著 in Simplified
    expect(toSimplified(SEQUENCE[3].za)).toBe("《蒙》杂而著。");
  });
});
