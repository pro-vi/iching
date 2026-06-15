// Guards the shared cast fixture builder (@iching/core/testing). Its whole job
// is to produce casts that are internally consistent (so they survive the
// store's read-time integrity check), so the tests assert exactly that.
import { describe, test, expect } from "bun:test";
import { castOf, lineOf } from "../testing.js";
import { assembleCast } from "../casting/cast.js";

describe("castOf", () => {
  test("a static cast OF a hexagram has that primary and no moving lines", () => {
    const c = castOf(63);
    expect(c.primary).toBe(63);
    expect(c.becoming).toBeNull();
    expect(c.changingPositions).toEqual([]);
  });

  test("{ becoming } flips exactly the differing lines so the becoming matches", () => {
    const c = castOf(3, { becoming: 8 }); // 屯 → 比 differ only at line 1
    expect(c.primary).toBe(3);
    expect(c.becoming).toBe(8);
    expect(c.changingPositions).toEqual([1]);

    const two = castOf(3, { becoming: 39 }); // 屯 → 蹇 differ at lines 1 and 3
    expect(two.becoming).toBe(39);
    expect(two.changingPositions).toEqual([1, 3]);
  });

  test("{ changing } marks those positions moving; the becoming is derived", () => {
    const c = castOf(3, { changing: [1, 3] });
    expect(c.primary).toBe(3);
    expect(c.changingPositions).toEqual([1, 3]);
    expect(c.becoming).not.toBeNull();
  });

  test("every produced cast is internally consistent (matches its own re-derivation)", () => {
    for (const c of [castOf(1), castOf(2), castOf(63), castOf(3, { becoming: 8 }), castOf(11, { changing: [2, 5] })]) {
      const redo = assembleCast(c.lines);
      expect(c.primary).toBe(redo.primary);
      expect(c.becoming).toBe(redo.becoming);
      expect(c.nuclear).toBe(redo.nuclear);
      expect(c.polarity).toBe(redo.polarity);
      expect(c.mirror).toBe(redo.mirror);
      expect(c.diagonal).toBe(redo.diagonal);
    }
  });

  test("lineOf maps value → isYang/isChanging", () => {
    expect(lineOf(6)).toEqual({ value: 6, isYang: false, isChanging: true });
    expect(lineOf(7)).toEqual({ value: 7, isYang: true, isChanging: false });
    expect(lineOf(8)).toEqual({ value: 8, isYang: false, isChanging: false });
    expect(lineOf(9)).toEqual({ value: 9, isYang: true, isChanging: true });
  });
});
