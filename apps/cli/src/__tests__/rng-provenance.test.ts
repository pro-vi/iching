// rngProvenanceFor — the shared seed/bound/crypto provenance rule recorded by
// both the CLI `cast` command and the interactive reading flow. The full input
// table, so a future drift in either surface (or the helper) is caught here.

import { describe, test, expect } from "bun:test";
import { rngProvenanceFor } from "../util/rng-provenance.js";

describe("rngProvenanceFor", () => {
  test("an explicit seed is its own deterministic path — and wins over bound", () => {
    expect(rngProvenanceFor({ seeded: true, bound: false })).toEqual({
      source: "seed",
      intentionBound: false,
    });
    expect(rngProvenanceFor({ seeded: true, bound: true, boundText: "x" })).toEqual({
      source: "seed",
      intentionBound: false,
    });
  });

  test("bound is intentionBound only when it actually carried text", () => {
    expect(rngProvenanceFor({ seeded: false, bound: true, boundText: "a question" })).toEqual({
      source: "bound",
      intentionBound: true,
    });
    expect(rngProvenanceFor({ seeded: false, bound: true, boundText: "" })).toEqual({
      source: "bound",
      intentionBound: false,
    });
    expect(rngProvenanceFor({ seeded: false, bound: true, boundText: undefined })).toEqual({
      source: "bound",
      intentionBound: false,
    });
    expect(rngProvenanceFor({ seeded: false, bound: true })).toEqual({
      source: "bound",
      intentionBound: false,
    });
  });

  test("neither seed nor bound is plain crypto (text without bound is ignored)", () => {
    expect(rngProvenanceFor({ seeded: false, bound: false })).toEqual({
      source: "crypto",
      intentionBound: false,
    });
    expect(rngProvenanceFor({ seeded: false, bound: false, boundText: "ignored" })).toEqual({
      source: "crypto",
      intentionBound: false,
    });
  });
});
