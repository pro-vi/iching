import { randomBytes } from "crypto";

/** Injectable random byte source — all randomness flows through this interface */
export interface RandomSource {
  nextBytes(count: number): Uint8Array;
}

/** Production implementation using Node/Bun crypto.randomBytes */
export class CryptoRandomSource implements RandomSource {
  nextBytes(count: number): Uint8Array {
    return new Uint8Array(randomBytes(count));
  }
}

/**
 * Deterministic PRNG from a seed number.
 * Uses xorshift128+ for fast, reproducible sequences.
 */
export class SeededRandomSource implements RandomSource {
  private s0: number;
  private s1: number;

  constructor(seed: number) {
    // Initialize state from seed using splitmix-like mixing
    this.s0 = seed | 0;
    this.s1 = (seed * 2654435761) | 0;
    if (this.s0 === 0 && this.s1 === 0) {
      this.s0 = 1;
    }
  }

  private next(): number {
    let s1 = this.s0;
    const s0 = this.s1;
    this.s0 = s0;
    s1 ^= s1 << 23;
    s1 ^= s1 >>> 17;
    s1 ^= s0;
    s1 ^= s0 >>> 26;
    this.s1 = s1;
    return (this.s0 + this.s1) >>> 0;
  }

  nextBytes(count: number): Uint8Array {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      bytes[i] = this.next() & 0xff;
    }
    return bytes;
  }
}

/** Replays a fixed byte array — useful for exact test scenarios */
export class TapeRandomSource implements RandomSource {
  private offset = 0;

  constructor(private readonly tape: Uint8Array) {}

  nextBytes(count: number): Uint8Array {
    if (this.offset + count > this.tape.length) {
      throw new Error(
        `TapeRandomSource exhausted: requested ${count} bytes at offset ${this.offset}, tape length ${this.tape.length}`,
      );
    }
    const slice = this.tape.slice(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  }
}
