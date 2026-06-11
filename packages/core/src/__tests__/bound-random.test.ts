// BoundRandomSource — intention/moment binding over local crypto entropy.
//
// Contract (docs/vision/entropy-sources-vision.md, "bound"):
// - chance stays primary: the same intention can NEVER force the same cast
// - intention/timestamp/nonce participate as salt, not as the sole seed
// - fully injected BindingContext is deterministic (testability, not a
//   user-facing replay path — that remains SeededRandomSource)

import { describe, test, expect } from "bun:test";
import { BoundRandomSource, type BindingContext } from "../random.js";
import { castHexagram } from "../casting/cast.js";

const FIXED_CONTEXT: BindingContext = {
  entropy: new Uint8Array(32).fill(7),
  timestamp: "2026-06-10T08:00:00.000Z",
  nonce: 0,
};

describe("BoundRandomSource — chance stays primary", () => {
  test("the same intention twice yields different casts (fresh crypto bytes dominate)", () => {
    // 6 lines × 3 bytes = 18 bytes per cast; 2^-144 collision odds make a
    // byte-stream match a test failure in practice, not flake.
    const a = new BoundRandomSource("will the harvest come?").nextBytes(18);
    const b = new BoundRandomSource("will the harvest come?").nextBytes(18);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  test("same intention + same timestamp + same nonce still differ (entropy is fresh)", () => {
    const ctx = { timestamp: "2026-06-10T08:00:00.000Z", nonce: 42 };
    const a = new BoundRandomSource("同問", ctx).nextBytes(18);
    const b = new BoundRandomSource("同問", ctx).nextBytes(18);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});

describe("BoundRandomSource — binding actually participates", () => {
  test("a fully injected context is reproducible", () => {
    const a = new BoundRandomSource("question", FIXED_CONTEXT).nextBytes(64);
    const b = new BoundRandomSource("question", FIXED_CONTEXT).nextBytes(64);
    expect(a).toEqual(b);
    const castA = castHexagram(new BoundRandomSource("question", FIXED_CONTEXT));
    const castB = castHexagram(new BoundRandomSource("question", FIXED_CONTEXT));
    expect(castA).toEqual(castB);
  });

  test("changing only the intention changes the stream", () => {
    const a = new BoundRandomSource("question A", FIXED_CONTEXT).nextBytes(18);
    const b = new BoundRandomSource("question B", FIXED_CONTEXT).nextBytes(18);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  test("changing only the timestamp changes the stream", () => {
    const a = new BoundRandomSource("q", FIXED_CONTEXT).nextBytes(18);
    const b = new BoundRandomSource("q", {
      ...FIXED_CONTEXT,
      timestamp: "2026-06-10T08:00:00.001Z",
    }).nextBytes(18);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  test("changing only the nonce changes the stream", () => {
    const a = new BoundRandomSource("q", FIXED_CONTEXT).nextBytes(18);
    const b = new BoundRandomSource("q", { ...FIXED_CONTEXT, nonce: 1 }).nextBytes(18);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  test("an empty intention is a valid salt (no intention to bind)", () => {
    const a = new BoundRandomSource("", FIXED_CONTEXT).nextBytes(18);
    const b = new BoundRandomSource("", FIXED_CONTEXT).nextBytes(18);
    expect(a).toEqual(b); // deterministic under full injection
    const c = new BoundRandomSource("x", FIXED_CONTEXT).nextBytes(18);
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
  });
});

describe("BoundRandomSource — DRBG stream behavior", () => {
  test("one big read equals many small reads (stream is position-stable)", () => {
    const whole = new BoundRandomSource("q", FIXED_CONTEXT).nextBytes(100);
    const chunked = new BoundRandomSource("q", FIXED_CONTEXT);
    const parts = [
      chunked.nextBytes(1),
      chunked.nextBytes(31), // crosses the first 32-byte SHA-256 block
      chunked.nextBytes(68),
    ];
    const joined = new Uint8Array(100);
    let off = 0;
    for (const p of parts) {
      joined.set(p, off);
      off += p.length;
    }
    expect(Buffer.from(joined).equals(Buffer.from(whole))).toBe(true);
  });

  test("distribution sanity: all four line values (6/7/8/9) are reachable", () => {
    const seen = new Set<number>();
    // 64 casts × 6 lines = 384 draws; P(missing any value) is negligible
    // (6 and 9 each appear w.p. 1/8 per line).
    for (let i = 0; i < 64 && seen.size < 4; i++) {
      const cast = castHexagram(new BoundRandomSource("distribution"));
      for (const line of cast.lines) seen.add(line.value);
    }
    expect([...seen].sort()).toEqual([6, 7, 8, 9]);
  });

  test("consecutive default-context sources differ even within one millisecond (process nonce)", () => {
    // Construct several sources back-to-back; even if the clock doesn't tick
    // and (hypothetically) the entropy bytes repeated, the per-process nonce
    // sequence guarantees distinct seeds. With real crypto bytes this can
    // only fail if two 32-byte randomBytes draws collide.
    const streams = Array.from({ length: 4 }, () =>
      Buffer.from(new BoundRandomSource("same moment").nextBytes(18)).toString("hex"),
    );
    expect(new Set(streams).size).toBe(streams.length);
  });
});
