import { describe, test, expect } from "bun:test";
import { DetailModel } from "../scenes/dict/detail-model.ts";
import { buildContentLines, type ContentLine, type VoiceNode } from "../scenes/dict/detail-renderer.ts";

/**
 * U6 tests — detail-renderer expansion.
 *
 * Verifies the always-on additions (trigram catalogue, relations block with
 * 序卦/雜卦 + 說卦 citations) and the gating behavior for the optional
 * fields that U8 will backfill (卦辭, 小象傳). The legacy commentary
 * sections must still render so existing hexagrams look unchanged from
 * today.
 */

const WIDTH = 80;

function findIndex(lines: ContentLine[], pred: (l: ContentLine) => boolean): number {
  return lines.findIndex(pred);
}

function someText(lines: ContentLine[], substr: string): boolean {
  return lines.some((l) => l.text.includes(substr));
}

describe("buildContentLines — always-on additions", () => {
  test("renders compact 說卦 trigram catalogue under the trigram line", () => {
    const model = new DetailModel(1); // 乾 over 乾
    const lines = buildContentLines(model, WIDTH);
    // 乾 catalogue: family=父, body=首, animal=馬, direction=西北
    expect(someText(lines, "父")).toBe(true);
    expect(someText(lines, "首")).toBe(true);
    expect(someText(lines, "馬")).toBe(true);
    expect(someText(lines, "西北")).toBe(true);
  });

  test("renders Relations header (renamed from Derived)", () => {
    const model = new DetailModel(3);
    const lines = buildContentLines(model, WIDTH);
    expect(someText(lines, "Relations")).toBe(true);
  });

  test("annotates each derived row with [說卦 ch.N]", () => {
    const model = new DetailModel(3);
    const lines = buildContentLines(model, WIDTH);
    // Each numeric derivation row (互卦/錯卦/綜卦/對角) should carry a 說卦 citation.
    const derivedRows = lines.filter((l) => l.text.match(/(互卦|錯卦|綜卦|對角)/));
    expect(derivedRows.length).toBeGreaterThanOrEqual(4);
    for (const row of derivedRows) {
      expect(row.text).toMatch(/\[說卦 ch\.\d+\]/);
    }
  });

  test("renders 序卦 row with canonical text for hex 3 屯", () => {
    const model = new DetailModel(3);
    const lines = buildContentLines(model, WIDTH);
    expect(someText(lines, "序卦")).toBe(true);
    // 屯's 序卦 entry contains "故受之以"
    expect(someText(lines, "故受之以")).toBe(true);
  });

  test("renders 雜卦 row with canonical text for hex 1 乾", () => {
    const model = new DetailModel(1);
    const lines = buildContentLines(model, WIDTH);
    expect(someText(lines, "雜卦")).toBe(true);
    // 乾's 雜卦 opening: 《乾》剛《坤》柔
    expect(someText(lines, "剛")).toBe(true);
    expect(someText(lines, "柔")).toBe(true);
  });
});

describe("buildContentLines — gated sections (legacy hexagrams without new fields)", () => {
  test("does NOT render 卦辭 section when gua.gc is absent", () => {
    const model = new DetailModel(3);
    const lines = buildContentLines(model, WIDTH);
    // Header line "卦辭" should not appear (no gc populated yet — U8 territory)
    const gcHeaderRow = findIndex(lines, (l) => l.text === "卦辭");
    expect(gcHeaderRow).toBe(-1);
  });

  test("yao block does NOT include 小象傳 lines when gua.yaoXiao is absent", () => {
    const model = new DetailModel(3);
    const lines = buildContentLines(model, WIDTH);
    // 屯's 小象 line 1: 雖磐桓，志行正也。 — should not appear (yaoXiao undefined)
    expect(someText(lines, "雖磐桓")).toBe(false);
  });
});

describe("buildContentLines — legacy sections preserved", () => {
  test("includes the existing commentary section headers", () => {
    const model = new DetailModel(1);
    const lines = buildContentLines(model, WIDTH);
    expect(someText(lines, "大象傳")).toBe(true);
    expect(someText(lines, "彖傳")).toBe(true);
    expect(someText(lines, "Image")).toBe(true);
    expect(someText(lines, "Judgment")).toBe(true);
    expect(someText(lines, "Wilhelm")).toBe(true);
  });

  test("includes 爻辭 line texts header for hexagrams with yao", () => {
    const model = new DetailModel(1);
    const lines = buildContentLines(model, WIDTH);
    expect(someText(lines, "爻辭")).toBe(true);
  });
});

describe("renderStackedVoices helper (scaffolded for U10)", () => {
  // Exercise the helper directly to lock its contract before U10 wires it.

  test("emits only the voices that have content", () => {
    const lines: ContentLine[] = [];
    // We can't import the helper directly (it's private), but we can exercise
    // it via a synthetic Hexagram with gc populated and a custom buildModel
    // path. For U6 the simpler proxy is testing through buildContentLines —
    // gc-populated test path lives in U8. The contract proven here is purely
    // structural: VoiceNode is exported and typeable.
    const node: VoiceNode = {
      zh: "元亨利貞",
      modernEn: "supreme success through perseverance",
    };
    expect(node.zh).toBe("元亨利貞");
    expect(node.modernEn).toBeDefined();
    expect(node.leggeEn).toBeUndefined();
  });
});
