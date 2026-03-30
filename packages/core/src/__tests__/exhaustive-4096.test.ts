import { describe, test, expect } from "bun:test";
import { linesToBinary } from "../casting/binary.js";
import { nuclear } from "../derivation/nuclear.js";
import { polarity } from "../derivation/polarity.js";
import { mirror } from "../derivation/mirror.js";
import { diagonal } from "../derivation/diagonal.js";
import { BINARY_TO_KW } from "../identify/lookup.js";
import { GUA } from "../data/gua.js";
import type { Line, LineValue } from "../types.js";

describe("exhaustive 4096 states", () => {
  const VALUES: LineValue[] = [6, 7, 8, 9];

  test("all 4^6 = 4096 possible line value combinations produce valid results", () => {
    for (let i = 0; i < 4096; i++) {
      // Decode index i into 6 line values (base-4 digits)
      const lineValues: LineValue[] = [];
      let n = i;
      for (let j = 0; j < 6; j++) {
        lineValues.push(VALUES[n % 4]);
        n = Math.floor(n / 4);
      }

      // Build Lines from values
      const lines: Line[] = lineValues.map((v) => ({
        value: v,
        isYang: v === 7 || v === 9,
        isChanging: v === 6 || v === 9,
      }));

      // Primary hexagram
      const primaryBinary = linesToBinary(lines);
      const primary = BINARY_TO_KW[primaryBinary];
      expect(primary).toBeGreaterThanOrEqual(1);
      expect(primary).toBeLessThanOrEqual(64);

      // Verify GUA[primary-1].l matches binary encoding
      const g = GUA[primary - 1];
      const lower = g.l[0] + g.l[1] * 2 + g.l[2] * 4;
      const upper = g.l[3] + g.l[4] * 2 + g.l[5] * 4;
      const expectedBinary = lower + upper * 8;
      expect(primaryBinary).toBe(expectedBinary);

      // Becoming hexagram
      const hasChanging = lines.some((l) => l.isChanging);
      if (hasChanging) {
        const becomingLines = lines.map((l) => ({
          ...l,
          isYang: l.isChanging ? !l.isYang : l.isYang,
        }));
        const becomingBinary = linesToBinary(becomingLines);
        const becoming = BINARY_TO_KW[becomingBinary];
        expect(becoming).toBeGreaterThanOrEqual(1);
        expect(becoming).toBeLessThanOrEqual(64);
      }
      // If no changing lines, becoming should be null (not computed here, tested in castHexagram)

      // Nuclear derivation
      const nuclearKW = nuclear(lines);
      expect(nuclearKW).toBeGreaterThanOrEqual(1);
      expect(nuclearKW).toBeLessThanOrEqual(64);

      // Polarity derivation
      const polarityKW = polarity(lines);
      expect(polarityKW).toBeGreaterThanOrEqual(1);
      expect(polarityKW).toBeLessThanOrEqual(64);

      // Mirror derivation
      const mirrorKW = mirror(lines);
      expect(mirrorKW).toBeGreaterThanOrEqual(1);
      expect(mirrorKW).toBeLessThanOrEqual(64);

      // Diagonal derivation
      const diagonalKW = diagonal(lines);
      expect(diagonalKW).toBeGreaterThanOrEqual(1);
      expect(diagonalKW).toBeLessThanOrEqual(64);

      // Diagonal should equal polarity of mirror (錯+綜)
      const mirroredLines = [...lines].reverse();
      const polarityOfMirror = polarity(mirroredLines);
      expect(diagonalKW).toBe(polarityOfMirror);
    }
  });
});
