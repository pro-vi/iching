import { describe, test, expect } from "bun:test";
import { STYLES, QUOTE_STYLES, type Hexagram } from "@iching/core";
import { VALID_STYLES } from "../commands/hexagram.js";
import { hexagramToJson } from "../output/json.js";

/**
 * U7 parity test — Style union, hardcoded enumeration lockstep.
 *
 * The four lists below MUST agree on the shape of the Style universe so
 * future additions can't drift between them.
 *
 *   Style (type)   — types.ts
 *   STYLES (array) — data/trigrams.ts (must match Style at runtime)
 *   QUOTE_STYLES   — data/trigrams.ts (Style minus "st" minus "gc")
 *   VALID_STYLES   — apps/cli/src/commands/hexagram.ts (Style minus "st")
 *
 * "gc" is in Style and VALID_STYLES but intentionally NOT in QUOTE_STYLES:
 * 卦辭 is the root oracle, not a random-quotable commentary lineage.
 */

describe("Style union — parity across hardcoded lists", () => {
  test("STYLES carries the full Style union (7 keys after U7)", () => {
    expect(STYLES.sort()).toEqual(["dx", "en", "gc", "st", "te", "tu", "w"]);
  });

  test("QUOTE_STYLES is STYLES minus \"st\" minus \"gc\" (5 quote-able lineages)", () => {
    const expected = STYLES.filter((s) => s !== "st" && s !== "gc").sort();
    expect(QUOTE_STYLES.sort()).toEqual(expected);
    expect(QUOTE_STYLES).not.toContain("gc");
    expect(QUOTE_STYLES).not.toContain("st");
  });

  test("VALID_STYLES (CLI) is STYLES minus \"st\" — includes gc for explicit lookup", () => {
    const expected = STYLES.filter((s) => s !== "st").sort();
    expect([...VALID_STYLES].sort()).toEqual(expected);
    expect(VALID_STYLES).toContain("gc");
    expect(VALID_STYLES).not.toContain("st");
  });
});

describe("hexagramToJson — conditional gc emission", () => {
  function makeHex(overrides: Partial<Hexagram> = {}): Hexagram {
    return {
      u: "X",
      n: "X",
      p: "X",
      ename: "X",
      l: [1, 1, 1, 1, 1, 1],
      dx: "dx",
      tu: "tu",
      en: "en",
      te: "te",
      w: "w",
      yao: ["", "", "", "", "", ""],
      yaoEn: ["", "", "", "", "", ""],
      ...overrides,
    };
  }

  test("legacy hexagram (no gc populated) — gc key absent from commentary", () => {
    const json = hexagramToJson(1, makeHex()) as {
      commentary: Record<string, unknown>;
    };
    expect("gc" in json.commentary).toBe(false);
    expect(json.commentary).toMatchObject({
      dx: "dx",
      tu: "tu",
      en: "en",
      te: "te",
      w: "w",
    });
  });

  test("hexagram with gc populated — gc key present in commentary", () => {
    const json = hexagramToJson(1, makeHex({ gc: "元亨利貞" })) as {
      commentary: Record<string, unknown>;
    };
    expect(json.commentary.gc).toBe("元亨利貞");
  });
});
