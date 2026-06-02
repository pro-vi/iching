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

  test("English mode hides Chinese commentary and line blocks", () => {
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
    expect(text).not.toContain("亢龍");
  });
});
