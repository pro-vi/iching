import { describe, expect, test } from "bun:test";
import { DetailModel } from "../scenes/dict/detail-model.ts";
import { buildContentLines } from "../scenes/dict/detail-renderer.ts";

function textFor(language: "zh-Hans" | "zh-Hant" | "en", kw = 1): string {
  return buildContentLines(new DetailModel(kw), 100, { language })
    .map((line) => line.text)
    .join("\n");
}

describe("DetailRenderer language policy", () => {
  test("traditional Chinese mode hides English commentary and line translations", () => {
    const text = textFor("zh-Hant");
    expect(text).toContain("大象傳");
    expect(text).toContain("彖傳");
    expect(text).toContain("爻辭");
    expect(text).not.toContain("Image");
    expect(text).not.toContain("Judgment");
    expect(text).not.toContain("Wilhelm");
    expect(text).not.toContain("Line Texts");
  });

  test("simplified Chinese mode converts visible Chinese text and hides English", () => {
    const text = textFor("zh-Hans");
    expect(text).toContain("大象传");
    expect(text).toContain("爻辞");
    expect(text).toContain("龙");
    expect(text).not.toContain("大象傳");
    expect(text).not.toContain("Line Texts");
  });

  test("English mode hides Chinese wing-commentary blocks", () => {
    const text = textFor("en");
    expect(text).toContain("The Creative");
    expect(text).toContain("Image");
    expect(text).toContain("Judgment");
    expect(text).toContain("Wilhelm");
    expect(text).toContain("Line Texts");
    expect(text).toContain("Line 6");
    expect(text).not.toContain("大象傳");
    expect(text).not.toContain("彖傳");
    expect(text).not.toContain("爻辭");
    // The translated wing texts stay English-only…
    expect(text).not.toContain("天行健");
    expect(text).not.toContain("大哉乾元");
    // …but the canonical 卦辭 and 小象傳 are quoted dim as classical anchors
    // (received text is never paraphrased — it is shown as itself).
    expect(text).toContain("元亨，利貞。");
    expect(text).toContain("亢龍有悔，盈不可久也。");
  });
});

describe("DetailRenderer oracle texts", () => {
  test("the 卦辭 section comes before the wing commentary", () => {
    const lines = buildContentLines(new DetailModel(1), 100, { language: "zh-Hant" })
      .map((line) => line.text);
    const judgmentIdx = lines.indexOf("卦辭");
    const dxIdx = lines.indexOf("大象傳");
    expect(judgmentIdx).toBeGreaterThan(-1);
    expect(dxIdx).toBeGreaterThan(judgmentIdx);
    // The judgment text itself follows the label
    expect(lines[judgmentIdx + 1]).toContain("元亨，利貞。");
  });

  test("en mode shows Legge judgment with the classical text beneath", () => {
    const lines = buildContentLines(new DetailModel(1), 100, { language: "en" });
    const idx = lines.findIndex((l) => l.text === "Judgment");
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx + 1].text).toContain("Khien (represents)");
    expect(lines[idx + 2].text).toContain("元亨，利貞。");
    expect(lines[idx + 2].dim).toBe(true);
  });

  test("彖傳 translation is no longer mislabeled as the Judgment", () => {
    const text = textFor("en");
    expect(text).toContain("Tuan (Commentary on the Decision)");
  });

  test("each line's 小象 renders dim beneath its 爻辭", () => {
    const lines = buildContentLines(new DetailModel(1), 100, { language: "zh-Hant" });
    const yaoIdx = lines.findIndex((l) => l.text.includes("初九：潛龍勿用。"));
    expect(yaoIdx).toBeGreaterThan(-1);
    expect(lines[yaoIdx + 1].text).toContain("潛龍勿用，陽在下也。");
    expect(lines[yaoIdx + 1].dim).toBe(true);
  });

  test("zh-Hans converts 卦辭 and 小象 via the audited table", () => {
    const text = textFor("zh-Hans", 2);
    expect(text).toContain("卦辞");
    expect(text).toContain("元亨，利牝马之贞"); // 馬→马, 貞→贞
    expect(text).toContain("驯致其道"); // 馴→驯 (supplement entry)
  });
});

describe("DetailRenderer cast context", () => {
  test("changed positions mark diagram lines and emphasize their texts", () => {
    const model = new DetailModel(1, [2, 5]);
    const lines = buildContentLines(model, 100, { language: "en" });
    const text = lines.map((l) => l.text).join("\n");
    // Diagram gutter markers (hexagram 1: all yang → ○ marker)
    expect(text).toContain("○");
    // Line headers carry the marker
    expect(text).toContain("Line 2 ○");
    expect(text).toContain("Line 5 ○");
    expect(text).not.toContain("Line 3 ○");
  });

  test("no markers when browsing without cast context", () => {
    const lines = buildContentLines(new DetailModel(1), 100, { language: "en" });
    const text = lines.map((l) => l.text).join("\n");
    expect(text).not.toContain("○");
    expect(text).not.toContain("×");
  });
});
