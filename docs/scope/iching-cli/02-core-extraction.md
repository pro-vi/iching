# 02: Core Domain Extraction

## Summary

Extract all pure domain logic from the existing 1190-line `iching.ts` into `packages/core`. This includes types, casting logic, derivation functions, hexagram identification, the 64-hexagram catalog, trigram data, and text formatters. All code must be pure — no I/O, no ANSI, no `process`, no `Bun.*` APIs. Verified by an exhaustive 4096-state test suite.

## Design

### Module structure

```
packages/core/src/
├─ index.ts                 # public API re-exports
├─ types.ts                 # LineValue, Line, Cast, Hexagram, TrigramInfo, Structure, DerivedType
├─ random.ts                # RandomSource interface + CryptoRandomSource
├─ casting/
│  ├─ coins.ts              # castLine(source) → Line
│  ├─ cast.ts               # castHexagram(source) → Cast
│  └─ binary.ts             # linesToBinary(lines) → number
├─ derivation/
│  ├─ nuclear.ts            # nuclear(lines) → KW number
│  ├─ polarity.ts           # polarity(lines) → KW number
│  ├─ mirror.ts             # mirror(lines) → KW number
│  ├─ diagonal.ts           # diagonal(lines) → KW number
│  └─ locked-pairs.ts       # isLockedPair(cast) → boolean
├─ identify/
│  ├─ lookup.ts             # BINARY_TO_KW table, hexagramByBinary(), hexagramByKW()
│  └─ structure.ts          # buildStructure(cast) → Structure, trigramIndex()
├─ data/
│  ├─ gua.ts                # GUA: Hexagram[] (64 entries, kept as TS const)
│  └─ trigrams.ts           # TRIGRAMS: TrigramInfo[] (8 entries)
├─ format/
│  ├─ reading.ts            # formatReading(cast, style, structure) → string
│  └─ derived.ts            # formatDerived(cast, type) → string | null
└─ service/
   └─ display-select.ts     # selectDisplay(cast, shown) → DisplayChoice | null
```

### Key design decisions

**RandomSource injection:**
```typescript
interface RandomSource {
  nextBytes(count: number): Uint8Array;
}

// Production
function createCryptoRandomSource(): RandomSource {
  return { nextBytes: (n) => crypto.randomBytes(n) };
}

// Tests — deterministic
function createSeededRandomSource(seed: number): RandomSource { ... }

// Tests — exact replay
function createTapeRandomSource(bytes: Uint8Array): RandomSource { ... }
```

**GUA data stays as TS const** — no JSON migration. The existing `Hexagram` type keeps its shape (u/n/p/l + dx/tu/en/te/w). Commentary fields stay on the same type; splitting creates unnecessary indirection for 64 records.

**Display selection** — the probability cascade from `main()` (4% per style, 2.5% per derived type) moves to `selectDisplay()` as a pure function that takes a `RandomSource`.

### Binary encoding scheme

```
Line index:   0  1  2  3  4  5
Trigram:      [lower ]  [upper ]
Bit:          1  2  4   8  16  32

binary = Σ(isYang[i] << i) for i=0..5
KW_number = BINARY_TO_KW[binary]
hexagram = GUA[KW_number - 1]
```

## Scope

### Files

- All files listed in module structure above
- `packages/core/src/__tests__/casting.test.ts`
- `packages/core/src/__tests__/derivation.test.ts`
- `packages/core/src/__tests__/exhaustive-4096.test.ts`
- `packages/core/src/__tests__/lookup.test.ts`
- `packages/core/src/__tests__/format.test.ts`

### Acceptance criteria

- [ ] All types exported: LineValue, Line, Cast, Hexagram, TrigramInfo, Structure, DerivedType, RandomSource
- [ ] `castLine(source)` produces Line with correct value/isYang/isChanging for all 4 outcomes (6/7/8/9)
- [ ] `castHexagram(source)` returns complete Cast with primary, becoming, changingPositions, and all 4 derivations
- [ ] `linesToBinary()` correctly encodes 6 lines → 0-63 integer
- [ ] `BINARY_TO_KW` maps all 64 binary values to valid King Wen numbers 1-64
- [ ] `GUA` array has exactly 64 entries, each with u/n/p/l/dx/tu/en/te/w fields
- [ ] `GUA[kw-1].l` matches the binary encoding for all 64 hexagrams (existing --verify logic)
- [ ] **Exhaustive 4096-state test**: for all 4^6 = 4096 possible line value combinations:
  - Primary hexagram correctly identified
  - Becoming hexagram correctly computed (or null if no changing lines)
  - Nuclear derivation correct
  - Polarity derivation correct
  - Mirror derivation correct
  - Diagonal derivation correct
- [ ] `nuclear()` extracts lines [1,2,3] and [2,3,4] as overlapping trigrams
- [ ] `polarity()` inverts all lines
- [ ] `mirror()` reverses line order
- [ ] `diagonal()` = polarity + mirror combined
- [ ] `isLockedPair()` returns true only for the 4 known pairs
- [ ] `formatReading()` produces plain text with hexagram symbol, name, pinyin, commentary
- [ ] `formatDerived()` produces labeled derived hexagram text
- [ ] `selectDisplay()` returns correct distribution given controlled RandomSource
- [ ] Zero imports from node:fs, node:tty, process, Bun.* — pure domain only
- [ ] All functions work with injected RandomSource (no direct crypto.randomBytes calls)

### Dependencies

- Depends on [01-monorepo-scaffold](01-monorepo-scaffold.md)

### Estimate

~1,100 LOC (source) + ~500 LOC (tests)
