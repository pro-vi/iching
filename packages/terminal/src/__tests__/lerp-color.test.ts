import { describe, test, expect } from "bun:test";
import { lerpColor } from "../color/lerp.ts";

describe("lerpColor", () => {
  test("t=0 returns the start color", () => {
    expect(lerpColor("#102030", "#FFFFFF", 0)).toBe("#102030");
  });

  test("t=1 returns the end color", () => {
    expect(lerpColor("#102030", "#FFFFFF", 1)).toBe("#ffffff");
  });

  test("midpoint mixes each channel independently", () => {
    expect(lerpColor("#102030", "#304050", 0.5)).toBe("#203040");
  });

  test("black to white midpoint is mid gray", () => {
    expect(lerpColor("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  test("t below 0 clamps to the start color", () => {
    expect(lerpColor("#102030", "#FFFFFF", -2)).toBe("#102030");
  });

  test("t above 1 clamps to the end color", () => {
    expect(lerpColor("#102030", "#FFFFFF", 3)).toBe("#ffffff");
  });

  test("output is always a 7-char hex color", () => {
    for (const t of [0, 0.1, 0.33, 0.5, 0.77, 1]) {
      expect(lerpColor("#0A0A0F", "#E0E0E0", t)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
