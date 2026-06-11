// Width measurement for emoji / zero-width characters — these go through the
// hardcoded isWideChar/isZeroWidthChar tables, which is exactly the path the
// Node fallback (npx) takes, so Bun and Node measure identically.

import { describe, test, expect } from "bun:test";
import { stringWidth } from "../layout/measure.ts";

describe("stringWidth — emoji and symbols", () => {
  test("common emoji measure 2 columns", () => {
    expect(stringWidth("\u{1f600}")).toBe(2); // 😀
    expect(stringWidth("\u{1f327}")).toBe(2); // 🌧
    expect(stringWidth("\u{1f680}")).toBe(2); // 🚀
    expect(stringWidth("\u{1f9d8}")).toBe(2); // 🧘
    expect(stringWidth("\u{1fab7}")).toBe(2); // 🪷 lotus
  });

  test("wide BMP emoji measure 2 columns", () => {
    expect(stringWidth("⌛")).toBe(2); // ⌛ hourglass
    expect(stringWidth("⭐")).toBe(2); // ⭐
    expect(stringWidth("✨")).toBe(2); // ✨
    expect(stringWidth("☔")).toBe(2); // ☔
  });

  test("mixed emoji + CJK + ascii", () => {
    expect(stringWidth("hi \u{1f600} 世界")).toBe(2 + 1 + 2 + 1 + 4);
  });
});

describe("stringWidth — zero-width characters", () => {
  test("VS16 and ZWJ measure 0 columns", () => {
    expect(stringWidth("️")).toBe(0); // variation selector 16
    expect(stringWidth("‍")).toBe(0); // zero-width joiner
  });

  test("emoji + VS16 measures as the emoji alone", () => {
    expect(stringWidth("⭐️")).toBe(2); // ⭐ + VS16
  });

  test("ZWJ family sequence counts component glyphs only", () => {
    // 👨‍👩‍👧 = 1F468 ZWJ 1F469 ZWJ 1F467 — three wide glyphs, joiners free
    expect(stringWidth("\u{1f468}‍\u{1f469}‍\u{1f467}")).toBe(6);
  });

  test("combining marks measure 0 columns", () => {
    expect(stringWidth("é")).toBe(1); // e + combining acute
  });
});

describe("stringWidth — CJK regression", () => {
  test("hexagram symbols stay width 2", () => {
    expect(stringWidth("䷀")).toBe(2); // ䷀
  });

  test("CJK radicals supplement measures 2", () => {
    expect(stringWidth("⺀")).toBe(2); // ⺀
  });
});
