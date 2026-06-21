// parseSeed — the shared --seed guard. The invalid path (stderr + exit 1) is
// pinned by subprocess tests in cast.test.ts and main-mode-routing.test.ts;
// here we pin the valid-path parsing the TUI and cast command both rely on.

import { describe, test, expect } from "bun:test";
import { parseSeed } from "../util/parse-seed.ts";

describe("parseSeed (valid paths)", () => {
  test("undefined stays undefined (no --seed given)", () => {
    expect(parseSeed(undefined)).toBeUndefined();
  });

  test("numeric strings parse to numbers", () => {
    expect(parseSeed("42")).toBe(42);
    expect(parseSeed("-7")).toBe(-7);
    expect(parseSeed("3.5")).toBe(3.5);
  });

  test('"0" is a real seed, not a falsy skip', () => {
    // The old inline TUI check (`opts.seed ? … : undefined`) silently
    // dropped --seed 0 back to crypto entropy; the cast command kept it.
    expect(parseSeed("0")).toBe(0);
  });
});
