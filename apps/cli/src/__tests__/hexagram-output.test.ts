// hexagram command output — oracle texts in JSON and plain formats

import { describe, test, expect } from "bun:test";
import { GUA } from "@iching/core";
import { hexagramToJson } from "../output/json.js";
import { formatHexagramPlain } from "../output/plain.js";

describe("hexagramToJson", () => {
  test("includes ename, judgment, and all six line texts with 小象", () => {
    const hex = GUA[0];
    const json = hexagramToJson(1, hex);

    expect(json.ename).toBe("The Creative");
    expect(json.judgment).toEqual({ gc: hex.gc, gcEn: hex.gcEn });

    const lineTexts = json.lineTexts as Array<Record<string, unknown>>;
    expect(lineTexts).toHaveLength(6);
    expect(lineTexts[0]).toEqual({
      position: 1,
      yao: hex.yao[0],
      yaoEn: hex.yaoEn[0],
      yaoXiao: hex.yaoXiao[0],
    });
    expect(lineTexts[5].position).toBe(6);
  });

  test("extra is present for hexagrams 1-2 and null elsewhere", () => {
    expect((hexagramToJson(1, GUA[0]).extra as Record<string, unknown>).name).toBe("用九");
    expect((hexagramToJson(2, GUA[1]).extra as Record<string, unknown>).name).toBe("用六");
    expect(hexagramToJson(3, GUA[2]).extra).toBeNull();
  });

  test("existing commentary block is unchanged", () => {
    const hex = GUA[20];
    const json = hexagramToJson(21, hex);
    expect(json.commentary).toEqual({
      dx: hex.dx,
      tu: hex.tu,
      en: hex.en,
      te: hex.te,
      w: hex.w,
    });
  });
});

describe("formatHexagramPlain", () => {
  test("all-styles output shows the judgment first", () => {
    const hex = GUA[0];
    const text = formatHexagramPlain(1, hex);
    expect(text).toContain(`Judgment (gc): ${hex.gc}`);
    expect(text).toContain(`Judgment (gcEn): ${hex.gcEn}`);
    // 卦辭 precedes the wing commentary
    expect(text.indexOf("Judgment (gc):")).toBeLessThan(text.indexOf("大象 (dx):"));
  });

  test("single-style output stays style-only (no judgment block)", () => {
    const hex = GUA[0];
    const text = formatHexagramPlain(1, hex, "dx");
    expect(text).toContain(hex.dx);
    expect(text).not.toContain("Judgment (gc):");
  });
});
