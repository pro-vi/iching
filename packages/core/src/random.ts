import { createHash, randomBytes } from "crypto";

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
 * Test-injectable binding context for BoundRandomSource. Production callers
 * pass nothing; every field defaults to the live value (fresh crypto bytes,
 * the current ISO timestamp, a per-process sequence number).
 */
export interface BindingContext {
  entropy?: Uint8Array;
  timestamp?: string;
  nonce?: number;
}

// Per-process sequence so two casts inside the same millisecond still seed
// differently even before the fresh crypto bytes are considered.
let processNonce = 0;

/**
 * Live casting source that binds the cast to its moment of consultation.
 *
 * Seed = SHA-256 over (32 fresh crypto bytes ‖ intention utf-8 ‖ ISO
 * timestamp ‖ process nonce), each field length-prefixed so no two field
 * layouts can collide. Cast bytes are expanded from the seed by a
 * hash-counter DRBG: block_i = SHA-256(seed ‖ i).
 *
 * Chance stays primary: the fresh crypto bytes guarantee that the same
 * intention can NEVER force the same cast. The intention and moment
 * participate as salt — context mixed into chance, not a hash oracle.
 * Deterministic replay remains SeededRandomSource's separate path.
 */
export class BoundRandomSource implements RandomSource {
  private readonly seed: Uint8Array;
  private counter = 0;
  private block: Uint8Array = new Uint8Array(0);
  private offset = 0;

  constructor(intention: string, context: BindingContext = {}) {
    const fields: Uint8Array[] = [
      context.entropy ?? new Uint8Array(randomBytes(32)),
      new TextEncoder().encode(intention),
      new TextEncoder().encode(context.timestamp ?? new Date().toISOString()),
      new TextEncoder().encode(String(context.nonce ?? processNonce++)),
    ];
    const hash = createHash("sha256");
    for (const field of fields) {
      const len = new Uint8Array(4);
      new DataView(len.buffer).setUint32(0, field.length);
      hash.update(len);
      hash.update(field);
    }
    this.seed = new Uint8Array(hash.digest());
  }

  nextBytes(count: number): Uint8Array {
    const out = new Uint8Array(count);
    let filled = 0;
    while (filled < count) {
      if (this.offset >= this.block.length) {
        const ctr = new Uint8Array(4);
        new DataView(ctr.buffer).setUint32(0, this.counter++);
        this.block = new Uint8Array(
          createHash("sha256").update(this.seed).update(ctr).digest(),
        );
        this.offset = 0;
      }
      const take = Math.min(count - filled, this.block.length - this.offset);
      out.set(this.block.subarray(this.offset, this.offset + take), filled);
      this.offset += take;
      filled += take;
    }
    return out;
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
