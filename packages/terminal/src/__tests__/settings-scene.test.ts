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
    entropy: "crypto",
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

describe("SettingsScene layout", () => {
  // Regression (review P3): at short heights the 7th row (Cast Mode) was pushed
  // under the bottom-anchored footer and edited blind. The scene now scrolls a
  // window of settings so the focused row stays visible above the footer.
  test("focused last row stays visible (and editable) at h=20", () => {
    const scene = makeScene("en");
    const ctx = makeCtx(80, 20);
    for (let i = 0; i < 6; i++) scene.handleKey({ type: "arrow", direction: "down" }, ctx); // focus Cast Mode
    const buf = CellBuffer.create(80, 20);
    scene.render(buf, ctx);
    const rows = bufferText(buf).split("\n");
    const footerSepRow = 20 - 3;
    const labelRow = rows.findIndex((l) => l.includes("Cast Mode"));
    expect(labelRow).toBeGreaterThanOrEqual(0); // focused row rendered…
    expect(labelRow + 1).toBeLessThan(footerSepRow); // …above the footer separator…
    expect(rows[labelRow + 1]).toContain("[auto]"); // …options visible, not blind
  });

  test("renders all 8 rows without scrolling at h=24", () => {
    const scene = makeScene("en");
    const ctx = makeCtx(80, 24);
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctx);
    const text = bufferText(buf);
    for (const label of ["Theme", "Language", "Taijitu", "Font", "Cast Method", "Cast Mode", "Entropy"]) {
      expect(text).toContain(label);
    }
  });
});

describe("SettingsScene entropy row", () => {
  test("defaults to crypto and round-trips through getValues", () => {
    const scene = makeScene("en");
    expect(scene.getValues().entropy).toBe("crypto");
  });

  test("left/right toggles entropy crypto ↔ bound", () => {
    const scene = makeScene("en");
    const ctx = makeCtx();
    for (let i = 0; i < 7; i++) scene.handleKey({ type: "arrow", direction: "down" }, ctx); // focus Entropy
    scene.handleKey({ type: "arrow", direction: "right" }, ctx);
    expect(scene.getValues().entropy).toBe("bound");
    scene.handleKey({ type: "arrow", direction: "right" }, ctx);
    expect(scene.getValues().entropy).toBe("crypto"); // wraps back
  });

  test("an initial bound value is preserved", () => {
    const scene = new SettingsScene({
      theme: "bone",
      language: "en",
      taijituStyle: "dots",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      castMethod: "coin",
      castMode: "auto",
      entropy: "bound",
    });
    expect(scene.getValues().entropy).toBe("bound");
  });

  test("zh chips render the ratified labels (繫於心念 / 系于心念)", () => {
    const scene = new SettingsScene({
      theme: "bone",
      language: "zh-Hant",
      taijituStyle: "dots",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      castMethod: "coin",
      castMode: "auto",
      entropy: "bound",
    });
    const ctx = makeCtx(100, 30);
    const buf = CellBuffer.create(100, 30);
    scene.render(buf, ctx);
    const text = bufferText(buf);
    expect(text).toContain("隨機源");
    expect(text).toContain("繫於心念");
  });
});

describe("SettingsScene getValues — identity-bound, not positional", () => {
  // Contract (plan U2 amendment): field↔row mapping goes through the row KEY.
  // Pre-refactor, getValues() read this.rows[0]…this.rows[6] positionally, so
  // reordering rows silently swapped persisted values. White-box: shuffle the
  // private rows array and assert the mapping still holds.
  test("reversing row order does not swap persisted values", () => {
    const scene = makeScene("zh-Hant");
    const before = scene.getValues();
    (scene as unknown as { rows: unknown[] }).rows.reverse();
    expect(scene.getValues()).toEqual(before);
  });

  test("selections made after a reorder land on the right field", () => {
    const scene = makeScene("en");
    (scene as unknown as { rows: unknown[] }).rows.reverse();
    // After reversal, focused row 0 is Entropy (was Theme). Toggle it.
    const ctx = makeCtx();
    scene.handleKey({ type: "arrow", direction: "right" }, ctx);
    const vals = scene.getValues();
    expect(vals.entropy).toBe("bound"); // the toggled row's field moved…
    expect(vals.theme).toBe("bone"); // …and theme (old position 0) did not.
  });
});
