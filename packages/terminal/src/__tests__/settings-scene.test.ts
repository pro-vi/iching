import { describe, expect, test } from "bun:test";
import { SettingsScene } from "../scenes/settings/settings-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";

function makeCtx(cols = 80, rows = 24): SceneContext {
  return { cols, rows, done: false, colorSupport: "none" };
}

function makeScene(language: "zh-Hans" | "zh-Hant" | "en" = "en"): SettingsScene {
  return new SettingsScene({
    theme: "bone",
    language,
    taijituStyle: "dots",
    glyphAnim: "dots",
    glyphFont: "kaiti",
    castMethod: "coin",
    castMode: "auto",
  });
}

function bufferText(buf: CellBuffer): string {
  return Array.from({ length: buf.height }, (_, row) =>
    buf.getRow(row).map((cell) => cell.char).join(""),
  ).join("\n");
}

describe("SettingsScene language", () => {
  test("preserves the initial language value", () => {
    const scene = makeScene("en");
    expect(scene.getValues().language).toBe("en");
  });

  test("renders compact language choices", () => {
    const scene = makeScene();
    const ctx = makeCtx();
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const text = bufferText(buf);
    expect(text).toContain("Language");
    expect(text).toContain("[EN]  繁  简");
  });

  test("left/right changes the language row", () => {
    const scene = makeScene("zh-Hant");
    const ctx = makeCtx();
    scene.handleKey({ type: "arrow", direction: "down" }, ctx);
    scene.handleKey({ type: "arrow", direction: "right" }, ctx);
    expect(scene.getValues().language).toBe("zh-Hans");
  });
});
