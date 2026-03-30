import { describe, test, expect } from "bun:test";
import { linear, easeIn, easeOut, easeInOut } from "../animation/easing.ts";

describe("easing", () => {
  describe("linear", () => {
    test("f(0) = 0", () => {
      expect(linear(0)).toBe(0);
    });

    test("f(0.5) = 0.5", () => {
      expect(linear(0.5)).toBe(0.5);
    });

    test("f(1) = 1", () => {
      expect(linear(1)).toBe(1);
    });
  });

  describe("easeIn", () => {
    test("f(0) = 0", () => {
      expect(easeIn(0)).toBe(0);
    });

    test("f(1) = 1", () => {
      expect(easeIn(1)).toBe(1);
    });

    test("f(0.5) < 0.5 (accelerating)", () => {
      expect(easeIn(0.5)).toBeLessThan(0.5);
    });
  });

  describe("easeOut", () => {
    test("f(0) = 0", () => {
      expect(easeOut(0)).toBe(0);
    });

    test("f(1) = 1", () => {
      expect(easeOut(1)).toBe(1);
    });

    test("f(0.5) > 0.5 (decelerating)", () => {
      expect(easeOut(0.5)).toBeGreaterThan(0.5);
    });
  });

  describe("easeInOut", () => {
    test("f(0) = 0", () => {
      expect(easeInOut(0)).toBe(0);
    });

    test("f(1) = 1", () => {
      expect(easeInOut(1)).toBe(1);
    });

    test("symmetric around 0.5", () => {
      expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
    });

    test("f(0.25) < 0.25 (accelerating in first half)", () => {
      expect(easeInOut(0.25)).toBeLessThan(0.25);
    });

    test("f(0.75) > 0.75 (decelerating in second half)", () => {
      expect(easeInOut(0.75)).toBeGreaterThan(0.75);
    });

    test("symmetry: f(t) + f(1-t) = 1", () => {
      for (const t of [0.1, 0.2, 0.3, 0.4]) {
        expect(easeInOut(t) + easeInOut(1 - t)).toBeCloseTo(1, 10);
      }
    });
  });
});
