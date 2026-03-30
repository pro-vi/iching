import { describe, test, expect } from "bun:test";
import { castLine } from "../casting/coins.js";
import { castHexagram } from "../casting/cast.js";
import { linesToBinary } from "../casting/binary.js";
import { TapeRandomSource, SeededRandomSource } from "../random.js";
import type { Line } from "../types.js";

describe("castLine", () => {
  // Coin logic: each byte's LSB determines heads(1→3) or tails(0→2)
  // sum of 3 coins → LineValue

  test("produces value 6 (old yin) — all tails (0+0+0 → 2+2+2=6)", () => {
    // bytes with LSB=0: 0x00, 0x00, 0x00
    const source = new TapeRandomSource(new Uint8Array([0x00, 0x00, 0x00]));
    const line = castLine(source);
    expect(line.value).toBe(6);
    expect(line.isYang).toBe(false);
    expect(line.isChanging).toBe(true);
  });

  test("produces value 7 (young yang) — one heads (1+0+0 → 3+2+2=7)", () => {
    // bytes with LSB: 1, 0, 0
    const source = new TapeRandomSource(new Uint8Array([0x01, 0x00, 0x00]));
    const line = castLine(source);
    expect(line.value).toBe(7);
    expect(line.isYang).toBe(true);
    expect(line.isChanging).toBe(false);
  });

  test("produces value 8 (young yin) — two heads (1+1+0 → 3+3+2=8)", () => {
    // bytes with LSB: 1, 1, 0
    const source = new TapeRandomSource(new Uint8Array([0x01, 0x01, 0x00]));
    const line = castLine(source);
    expect(line.value).toBe(8);
    expect(line.isYang).toBe(false);
    expect(line.isChanging).toBe(false);
  });

  test("produces value 9 (old yang) — all heads (1+1+1 → 3+3+3=9)", () => {
    // bytes with LSB=1: 0x01, 0x01, 0x01
    const source = new TapeRandomSource(new Uint8Array([0x01, 0x01, 0x01]));
    const line = castLine(source);
    expect(line.value).toBe(9);
    expect(line.isYang).toBe(true);
    expect(line.isChanging).toBe(true);
  });
});

describe("castHexagram", () => {
  test("produces complete Cast with seeded source", () => {
    const source = new SeededRandomSource(42);
    const cast = castHexagram(source);

    expect(cast.lines).toHaveLength(6);
    expect(cast.primary).toBeGreaterThanOrEqual(1);
    expect(cast.primary).toBeLessThanOrEqual(64);

    // Becoming is either null or valid KW
    if (cast.becoming !== null) {
      expect(cast.becoming).toBeGreaterThanOrEqual(1);
      expect(cast.becoming).toBeLessThanOrEqual(64);
      expect(cast.changingPositions.length).toBeGreaterThan(0);
    } else {
      expect(cast.changingPositions).toHaveLength(0);
    }

    // Derivations all valid
    expect(cast.nuclear).toBeGreaterThanOrEqual(1);
    expect(cast.nuclear).toBeLessThanOrEqual(64);
    expect(cast.polarity).toBeGreaterThanOrEqual(1);
    expect(cast.polarity).toBeLessThanOrEqual(64);
    expect(cast.mirror).toBeGreaterThanOrEqual(1);
    expect(cast.mirror).toBeLessThanOrEqual(64);
    expect(cast.diagonal).toBeGreaterThanOrEqual(1);
    expect(cast.diagonal).toBeLessThanOrEqual(64);
  });

  test("cast with all stable lines has no becoming", () => {
    // 6 lines of value 7 (young yang): each needs bytes [0x01, 0x00, 0x00]
    const tape = new Uint8Array(18);
    for (let i = 0; i < 6; i++) {
      tape[i * 3] = 0x01; // LSB=1
      tape[i * 3 + 1] = 0x00; // LSB=0
      tape[i * 3 + 2] = 0x00; // LSB=0
    }
    const source = new TapeRandomSource(tape);
    const cast = castHexagram(source);

    // All young yang = all yang, no changing
    expect(cast.becoming).toBeNull();
    expect(cast.changingPositions).toHaveLength(0);
    expect(cast.primary).toBe(1); // All yang = 乾 (KW 1)
  });
});

describe("linesToBinary", () => {
  test("all yin = 0", () => {
    const lines: Line[] = Array.from({ length: 6 }, () => ({
      value: 8 as const,
      isYang: false,
      isChanging: false,
    }));
    expect(linesToBinary(lines)).toBe(0);
  });

  test("all yang = 63", () => {
    const lines: Line[] = Array.from({ length: 6 }, () => ({
      value: 7 as const,
      isYang: true,
      isChanging: false,
    }));
    expect(linesToBinary(lines)).toBe(63);
  });

  test("only bottom line yang = 1", () => {
    const lines: Line[] = Array.from({ length: 6 }, (_, i) => ({
      value: (i === 0 ? 7 : 8) as 7 | 8,
      isYang: i === 0,
      isChanging: false,
    }));
    expect(linesToBinary(lines)).toBe(1);
  });

  test("only top line yang = 32", () => {
    const lines: Line[] = Array.from({ length: 6 }, (_, i) => ({
      value: (i === 5 ? 7 : 8) as 7 | 8,
      isYang: i === 5,
      isChanging: false,
    }));
    expect(linesToBinary(lines)).toBe(32);
  });

  test("alternating yang/yin from bottom = 0b010101 = 21", () => {
    const lines: Line[] = Array.from({ length: 6 }, (_, i) => ({
      value: (i % 2 === 0 ? 7 : 8) as 7 | 8,
      isYang: i % 2 === 0,
      isChanging: false,
    }));
    expect(linesToBinary(lines)).toBe(0b010101); // 21
  });
});
