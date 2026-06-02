---
title: Data Enrichment — Canonical Wings + Legge
type: feat
status: active
date: 2026-05-30
origin: data-acquisition/complementary-mapping.md
---

# Data Enrichment — Canonical Wings + Legge

Second-wave canonical-text addition to the I Ching app data layer. Adds five canonical Chinese text layers (卦辭, 小象傳, 說卦傳, 序卦傳, 雜卦傳) and one English translation lineage (James Legge, SBE vol. XVI, 1882), all public domain. Extends the `Hexagram` and `TrigramInfo` types with optional fields, adds a text-bearing relations overlay (`connections`) on top of the existing pure-numeric derivations, and expands the detail renderer to surface the new layers.

## Architecture Decision

**Approach:** *Pure derivations + connections overlay + flat optional Hexagram fields.*

1. **Existing `derivation/*.ts` modules stay pure** — signature `(lines: Line[]) => number`. No mutation, no I/O, no text bundling. They remain the structural / numeric layer.
2. **New `derivation/connections.ts` overlay** — signature `(cast: Cast) => CastConnections`. Takes a computed `Cast` and produces a text-bearing overlay carrying `xuGua` (sequence narrative), `zaGuaPair` (contrast pair with text), and `shuoguaCitations` (chapter references per derivation type). This is *not* a derivation in the existing sense — it's a join between derived KW numbers and canonical text data.
3. **All new `Hexagram` fields are flat and optional** — `gc?`, `gcEn?`, `yaoXiao?[6]`, `yaoXiaoEn?[6]`, `legge?: LeggeHexagram`. Matches the existing flat 11-field shape in `packages/core/src/types.ts:11-25`; preserves backward compatibility with every existing consumer (no required-field churn).
4. **`TrigramInfo` extended with `assoc?: TrigramAssoc`** — the structured 說卦 catalogue lives next to its existing carrier in `packages/core/src/data/trigrams.ts`, populated from `data/shuogua.ts#TRIGRAM_ASSOC`. Canonical zh stays in `shuogua.ts`; project-authored English glosses live in `trigrams.ts` (clearly labeled non-canonical).
5. **Stacked-voice rendering is voice-driven, content-gated** — each text node carries `{ zh, modernEn?, wilhelmEn?, leggeEn? }`; the renderer iterates voices and skips rows with no content. No special-cased branching per text type. Wings naturally render zh + Legge only (no Wilhelm voice exists for Wings); cast text renders all three when populated.

**Rationale:** Decided by the **Consistency** criterion. The existing repo pattern is: pure-function derivations (`derivation/*.ts:6` all share `(lines: Line[]) => number`), flat `Hexagram` interface (`types.ts:11-25` — zero nesting), named-const data modules (`data/gua.ts:4`, `data/trigrams.ts:3`), all-required fields with optional add-ons via `?:` (precedent: `DailyCache.intention?` at `types.ts:84`). This approach extends each pattern in its own direction without breaking any of them. The "fold 序卦/雜卦 into a unified `relations.ts`" reframe is implemented at the *render* layer (UI groups numeric derivations + text-bearing connections under one "relations" block) — not at the data layer, which keeps separation of concerns.

**Trade-offs accepted:**
- Two distinct data shapes in the relations block at render time (numeric derivation badges + text-bearing connection rows). Renderer handles the visual unification.
- New `Style` union grows (`gc`, `yaoXiao`) — touches every hardcoded `STYLES` / `VALID_STYLES` list in lockstep (3 sites). Mitigated by U7 batching all updates in one commit.
- Legge ships *after* a dedicated cleanup re-pull. The integration unit (U10) depends on the cleanup workflow (U9) completing first.

## High-Level Technical Design

### Composition Matrix — Hexagram model shape change

Hexagram changes from a single 5-field commentary model to a composed canonical-text model. Surfaces that observe Hexagram must handle every combination.

**Old scalar assumption:** "the commentary fields are `dx/tu/en/te/w`." Lives in: `commands/hexagram.ts:7` (`VALID_STYLES`), `data/trigrams.ts:14-15` (`STYLES`/`QUOTE_STYLES`), `format/reading.ts:31` (`g[style]` dynamic access), `output/json.ts:65-70` (enumeration), `output/plain.ts:64-68` (5-line emission), `scenes/dict/detail-renderer.ts:78-93` (sections array of 5 entries).

**New composed model members:**

| Member | Carrier | Provenance | Optional? | Languages |
|---|---|---|---|---|
| `dx`, `tu` | `Hexagram` | canonical zh — existing | required (legacy) | zh only |
| `en`, `te` | `Hexagram` | anonymous modern English — existing | required (legacy) | en only |
| `w` | `Hexagram` | Wilhelm-flavored synthesis — existing | required (legacy) | en only |
| `yao`, `yaoEn` | `Hexagram` | canonical zh + modern en — existing | required (legacy) | zh + en |
| **`gc`, `gcEn`** | `Hexagram` (NEW) | canonical zh 卦辭 + Legge en | optional | zh + en |
| **`yaoXiao`, `yaoXiaoEn`** | `Hexagram` (NEW) | canonical zh 小象傳 + Legge en | optional | zh + en |
| **`legge`** | `Hexagram.legge?` | Legge 1882, post-cleanup only | optional | en only |
| **`assoc`** | `TrigramInfo.assoc?` | canonical zh 說卦 + project-authored en gloss | optional | zh + en (gloss) |
| **connections** | `CastConnections` overlay (NOT Hexagram) | join over XU_GUA, ZA_GUA, SHUOGUA | always-built but rows may be empty | zh + en (where Legge ships) |

**Priority lattice (when a surface must pick ONE):**
1. zh canonical (always present once shipped).
2. Legge en (when shipped post-cleanup).
3. Wilhelm-flavored en (`w`, existing).
4. Modern anonymous en (`en`/`te`/`yaoEn`).

The stacked-voice renderer does NOT pick — it iterates all populated voices in this order. Only single-voice surfaces (CLI `--style` flag) pick.

**Ownership boundary:**
- `packages/core/src/data/*.ts` — owns canonical text + structured catalogues.
- `packages/core/src/derivation/connections.ts` — owns the overlay join (Cast → CastConnections).
- `packages/core/src/detail.ts` — owns aggregation (`HexagramDetail` carries Hexagram + derivations + connections).
- `packages/terminal/src/scenes/dict/detail-renderer.ts` — owns visual composition / stacking.
- `apps/cli/src/output/{json,plain}.ts` — owns serialization parity.

**Composition test matrix (named tests; lock in U6 and U11):**

| Mixed case | Expected visible contract | Test name |
|---|---|---|
| Hexagram with no new fields populated (current state) | output identical to today's; no empty sections rendered | `detail-renderer renders legacy 5-field hexagram unchanged` |
| Hexagram with gc, yaoXiao populated but no legge | new canonical sections appear; voice stack shows zh + (modern/Wilhelm) only | `detail-renderer renders new zh canon without legge` |
| Hexagram with everything (incl. legge) | three-voice stack on Judgment, Image, every changing line | `detail-renderer renders full three-voice stack` |
| Cast where 雜卦 pair degenerates via polarity (hex 1, 27, 29, 61) | zaGuaPair row shows polarity-fallback partner; xuGua row shows previous in King Wen | `connections handles polarity-fallback hexagrams` |
| 雜卦 entry from the disordered final 8 | row renders the canonical disordered pairing; no orbit-integrity warning surfaced to user | `connections renders disordered-tail entries faithfully` |
| CLI `--style gc` for hexagram lacking gc population | typed error / fallback to existing field, NOT undefined access | `cli hexagram --style gc errors cleanly when absent` |

### Layer diagram (directional)

```
              ┌──────────────────────────────────────────┐
              │ packages/terminal/src/scenes/dict        │
              │   detail-renderer.ts (sections stack)    │  ← U6
              │   detail-model.ts (links + connections)  │
              └────────────────┬─────────────────────────┘
                               │ reads
              ┌────────────────▼─────────────────────────┐
              │ packages/core/src                        │
              │   detail.ts  (HexagramDetail aggregator) │  ← U5
              │     ├── nuclear / polarity / mirror /     │
              │     │   diagonal / locked-pairs (PURE)   │  unchanged
              │     └── connections.ts (overlay)         │  ← U5 new
              └────────────────┬─────────────────────────┘
                               │ joins
        ┌──────────────────────┼──────────────────────────────┐
        ▼                      ▼                              ▼
 ┌──────────────┐    ┌────────────────────┐         ┌─────────────────┐
 │ data/gua.ts  │    │ data/xugua.ts      │  ← U2   │ data/shuogua.ts │  ← U3
 │   GUA        │    │ data/zagua.ts      │  ← U2   │   SHUOGUA        │
 │   + gc?      │    │   XU_GUA           │         │   TRIGRAM_ASSOC  │
 │   + gcEn?    │    │   ZA_GUA           │         └─────────────────┘
 │   + yaoXiao? │    │   ZA_GUA_BY_HEX    │
 │   + legge?   │    └────────────────────┘
 └──────────────┘                                   ┌─────────────────┐
                                                    │ data/legge.ts   │  ← U10
                                                    │   LEGGE          │
                                                    │   LEGGE_*_EN     │
                                                    └─────────────────┘
```

## Implementation Units

### U1. Type extensions — types.ts

- **Goal:** Land all new TypeScript types as optional extensions. Compiles green; no field populated yet.
- **Requirements:** Foundation for every subsequent unit.
- **Dependencies:** None.
- **Files:**
  - Modify: `packages/core/src/types.ts`
  - Test: `packages/core/src/__tests__/types.compile.test.ts` (new, type-only test)
- **Approach:** Add to `Hexagram` (lines 11-25 region): `gc?`, `gcEn?`, `yaoXiao?: string[]`, `yaoXiaoEn?: string[]`, `legge?: LeggeHexagram`. Add new interfaces `LeggeHexagram`, `TrigramAssoc`, `XuGuaEntry`, `ZaGuaEntry`, `ShuoguaChapter`, `ShuoguaCitation`, `CastConnections`. Extend `TrigramInfo` (line 65) with `assoc?: TrigramAssoc`. Extend `Style` union to `"dx" | "tu" | "en" | "te" | "w" | "st" | "gc" | "yaoXiao"`; update `QuoteStyle` derivation. Keep everything flat (no nested fields on Hexagram).
- **Patterns to follow:** `types.ts:84` (`DailyCache.intention?`) — optional-field convention; `types.ts:65-69` (`TrigramInfo`) — interface shape.
- **Test scenarios:**
  - *Happy path:* a Hexagram literal with no new fields type-checks against the new interface.
  - *Edge case:* a Hexagram literal that populates every new optional field type-checks.
  - *Negative:* a Hexagram literal missing `dx` still fails compilation (proves the legacy required fields stay required).
- **Verification:** `bun run typecheck` passes; all existing 64 entries in `gua.ts` still type-check unchanged.

### U2. 序卦 + 雜卦 data modules

- **Goal:** Promote the verified `data-acquisition/xugua-zagua.json` (3/3 verdicts) into permanent data modules.
- **Requirements:** Source data for the connections overlay (U5).
- **Dependencies:** U1.
- **Files:**
  - Create: `packages/core/src/data/xugua.ts`
  - Create: `packages/core/src/data/zagua.ts`
  - Modify: `packages/core/src/index.ts` (re-export the new constants)
  - Test: `packages/core/src/__tests__/xugua-zagua.test.ts`
- **Approach:** Read `data-acquisition/xugua-zagua.json` and transcribe verbatim into:
  - `xugua.ts`: `export const XU_GUA: XuGuaEntry[]` (64 entries; preserve the editorial notes on 乾/坤 shared preamble, 離 merge, 咸 lower-jing preamble that are documented in the JSON's `_meta`).
  - `zagua.ts`: `export const ZA_GUA: ZaGuaEntry[]` (53 entries) + `export const ZA_GUA_BY_HEX: Record<number, ZaGuaEntry>` (reverse index — many-to-one because the disordered tail collapses several hexagrams into single entries).
  - Both modules also export the `_meta` block as a sibling const so source attribution lives next to the data.
- **Patterns to follow:** `data/gua.ts:4` (named const array shape); `data/trigrams.ts:3` (multiple exports per data file).
- **Test scenarios:**
  - *Happy path:* `XU_GUA.length === 64`; every entry has a non-empty `text`.
  - *Coverage:* all 64 hex numbers appear in some `ZA_GUA[*].pair` array (set-equality with `range(1,65)`).
  - *Disordered tail preserved:* the entries the JSON `_meta.notes` flags as disordered are present in source order — assert specific indices match the JSON.
  - *Editorial notes carried:* the `note` field on XU_GUA entries for hex 1, 2, 30, 31 matches the JSON.
- **Verification:** `ZA_GUA_BY_HEX[3].pair` resolves to a 2-element array containing 3 and 4 (屯/蒙 pair, the canonical first ordered pair).

### U3. 說卦 data module

- **Goal:** Promote the verified `data-acquisition/shuogua.json` (3/3 verdicts) into a permanent data module.
- **Requirements:** Source for trigram catalogue (U4) and derivation citations (U5).
- **Dependencies:** U1.
- **Files:**
  - Create: `packages/core/src/data/shuogua.ts`
  - Modify: `packages/core/src/index.ts`
  - Test: `packages/core/src/__tests__/shuogua.test.ts`
- **Approach:** Transcribe `shuogua.json`'s `chapters[]` (11 entries) and `trigramAssociations` (8-trigram keyed map) into:
  - `export const SHUOGUA: { chapters: ShuoguaChapter[] }` — canonical zh, verbatim.
  - `export const TRIGRAM_ASSOC: Record<string, TrigramAssoc>` — keyed by trigram zh name (乾/坤/震/巽/坎/離/艮/兌), structured fields as canonical, plus a `note?` field on the editorial sub-fields (season, cosmologicalRole, other) explicitly typed as derived rather than canonical to honor the verifier warn.
- **Patterns to follow:** `data/large-glyphs.ts:9-19` (typed Record with explicit nested shape).
- **Test scenarios:**
  - *Happy path:* `SHUOGUA.chapters.length === 11`; every chapter has non-empty text.
  - *Coverage:* `Object.keys(TRIGRAM_ASSOC).length === 8`; each entry has `image`, `family`, `body`, `animal`, `direction`, `attribute`, `extendedImages`.
  - *Canon vs editorial:* `TRIGRAM_ASSOC.qian.image` is zh single char (`'天'`); `season` and `cosmologicalRole` are flagged in the type as project-derived not canonical.
  - *Verification anchor:* chapter 11 text contains the animal-association line; chapter 5 contains the directional cycle.
- **Verification:** `TRIGRAM_ASSOC['乾'].extendedImages` has 14 entries (the 說卦 ch. 11 catalogue for 乾).

### U4. TrigramInfo enrichment + editorial English glosses

- **Goal:** Wire `TRIGRAM_ASSOC` into each `TrigramInfo` so consumers can read trigram catalogue without reaching into `shuogua.ts`. Add project-authored English glosses for the structured fields.
- **Requirements:** Trigram catalogue surfacing in detail renderer (U6).
- **Dependencies:** U3.
- **Files:**
  - Modify: `packages/core/src/data/trigrams.ts`
  - Test: `packages/core/src/__tests__/trigrams.test.ts` (new)
- **Approach:** In `trigrams.ts:3-12`, populate each of the 8 `TrigramInfo` entries with `assoc` referencing the corresponding `TRIGRAM_ASSOC[zhName]`. Add a sibling export `TRIGRAM_ASSOC_EN: Record<string, Partial<TrigramAssoc>>` carrying short project-authored English glosses for `family` ("father"/"mother"/...), `body` ("head"/"belly"/...), `animal` ("horse"/"ox"/...), `direction` ("northwest"/"southwest"/...), and `attribute` ("strength"/"yielding"/...). Document at top of file: "TRIGRAM_ASSOC_EN is project-authored — not from Legge or any canonical source. Labeled non-canonical in UI."
- **Patterns to follow:** `data/trigrams.ts:17-23` (existing `DERIVED_LABELS` Record convention).
- **Test scenarios:**
  - *Happy path:* `TRIGRAMS[7].assoc?.extendedImages` (乾 entry) has 14 items.
  - *Edge case:* `TRIGRAM_ASSOC_EN` has all 8 keys; every entry has non-empty `family`, `body`, `animal`, `direction`, `attribute` strings.
  - *Negative:* `TRIGRAM_ASSOC_EN` does NOT have an `extendedImages` field (those stay zh-only — too many for short glosses).
- **Verification:** Reading `TRIGRAMS[7]` returns the full canonical 乾 catalogue (zh) plus a side-loadable English gloss map.

### U5. connections.ts overlay + HexagramDetail aggregation

- **Goal:** Add the `connections(cast: Cast): CastConnections` overlay that joins derived KW numbers with canonical text data. Aggregate it into `HexagramDetail`.
- **Requirements:** Source for the relations block in the renderer (U6).
- **Dependencies:** U2, U3.
- **Files:**
  - Create: `packages/core/src/derivation/connections.ts`
  - Modify: `packages/core/src/detail.ts`
  - Modify: `packages/core/src/index.ts`
  - Test: `packages/core/src/__tests__/connections.test.ts` (new)
- **Approach:** `connections(cast)` returns `CastConnections { xuGua, zaGuaPair, shuoguaCitations }`. `xuGua` is `XU_GUA[cast.primary - 1]`. `zaGuaPair` is `ZA_GUA_BY_HEX[cast.primary]` (which is the entry containing the pair partner; many-to-one for the disordered tail is fine — typed accordingly). `shuoguaCitations` is a static `DERIVATION_CITATIONS` map (`{ nuclear: 3, polarity: 2, mirror: 6, diagonal: 6, becoming: 7 }`) wrapped per cast. Pure function; no I/O. Modify `detail.ts:37-40` aggregator to also call `connections(cast)` and embed the result in `HexagramDetail`.
- **Patterns to follow:** `derivation/nuclear.ts:6` (pure function signature); `detail.ts:37-40` (aggregation pattern).
- **Test scenarios:**
  - *Happy path:* `connections({ primary: 3 })` returns `xuGua` for hex 3 屯 with the canonical "盈天地之間者…" text; `zaGuaPair` includes hex 4 蒙.
  - *Edge — first hex:* `connections({ primary: 1 })`: `xuGua` for hex 1 returns the editorial note about shared cosmological preamble (no "previous" hex exists); test does not crash.
  - *Edge — polarity-fallback hex:* `connections({ primary: 29 })`: `zaGuaPair` resolves to hex 30 (離, via the disordered tail or canonical entry); pair returned is the polarity-fallback partner.
  - *Edge — disordered tail hex:* `connections({ primary: 60 })`: `zaGuaPair` returns the canonical disordered entry; no warning surfaced (silent preservation).
  - *Cross-check (adversarial):* for every hex 1..64, compute mirror-or-polarity geometrically; assert the `zaGuaPair.pair` array contains the geometrically-derived partner for all *non-tail* entries. The famously disordered tail is whitelisted by index — disagreement on whitelisted indices is expected; disagreement elsewhere is a regression. Lock invariant: `iff hex ∉ DISORDERED_TAIL: geometricPair(hex) ∈ zaGuaPair(hex).pair`.
- **Verification:** All 64 hexagrams produce a `CastConnections` that loads non-empty `xuGua.text` and a populated `zaGuaPair`; the orbit-integrity invariant holds for the 56 non-tail hexagrams.

### U6. Detail-renderer sections expansion + stacked-voice rendering scaffolding

- **Goal:** Extend the dict detail renderer's sections array to surface the new canonical layers. Build the stacked-voice scaffolding (renders zh + each populated en voice in order), but only with currently-shipping voices (modern + wilhelm). Legge slot is wired but empty until U10.
- **Requirements:** Q1 (stack), Q3 (terse 說卦 citation), Q4 (extendedImages collapsed in cast).
- **Dependencies:** U2, U3, U4, U5.
- **Files:**
  - Modify: `packages/terminal/src/scenes/dict/detail-renderer.ts`
  - Modify: `packages/terminal/src/scenes/dict/detail-model.ts`
  - Test: `packages/terminal/src/scenes/dict/__tests__/detail-renderer.test.ts` (extend; create if absent)
- **Approach:**
  - Expand `buildContentLines` sections (current at lines 78-93). New sections: 卦辭 (top of cast, when populated), 大象傳 (existing), 彖傳 (existing), 序卦 (inline), 雜卦 (collapsed-by-default expander; render the pair partner glyph + name + text), 說卦 trigram catalogue (under upper/lower trigram display: family/body/animal/direction/attribute zh + project-en gloss; extendedImages compact: first 3 + "▸ +N more" expander).
  - Add a `renderStackedVoices(node: VoiceNode)` helper that takes `{ zh, modernEn?, wilhelmEn?, leggeEn? }` and emits rows for each populated voice in priority order. Used by Judgment, Image, and per-changing-line yao readings.
  - Update relations block (after derivations) to surface 序卦 + 雜卦 rows alongside the existing nuclear/polarity/mirror/diagonal badges, each annotated with the 說卦 citation chapter where applicable.
  - All new sections gated on field presence (`if (gua.gc) { … }` etc.) so Hexagram entries without new fields render unchanged from today.
- **Patterns to follow:** `scenes/dict/detail-renderer.ts:78-93` (sections array shape); `scenes/dict/detail-renderer.ts:125-134` (derived links block).
- **Test scenarios:**
  - *Happy path — legacy hexagram (no new fields):* rendered output is byte-identical to today's output. Lock with a snapshot or line-by-line comparison.
  - *Happy path — fully-populated hexagram:* output contains 卦辭 section, 序卦 line, 雜卦 expander, 說卦 trigram catalogue under each trigram. Lock with named-section assertions.
  - *Edge — extendedImages compact:* 乾 trigram displays first 3 images + "▸ +11 more" indicator; 坎 displays first 3 + "▸ +N".
  - *Edge — relations row for hex 29 坎:* 雜卦 row shows pair partner 離 (polarity fallback); no error.
  - *Edge — voice stack with no Legge:* `renderStackedVoices({ zh, modernEn, wilhelmEn })` emits 3 rows; no empty "legge:" row.
  - *Error — disordered tail hex:* renders the canonical disordered entry; no user-visible warning.
- **Verification:** Hex 1 (乾), hex 3 (屯), hex 29 (坎) all render the new sections coherently; existing hex 50 (鼎) with no new fields populated yet still renders the legacy 5-section view.

### U7. Style union + CLI hardcoded list updates (lockstep)

- **Goal:** Bring every hardcoded `STYLES` / `VALID_STYLES` / enumeration site into agreement with the new Style union. Single atomic commit.
- **Requirements:** CLI `--style gc` works once data ships; JSON output schema is complete.
- **Dependencies:** U1.
- **Files:**
  - Modify: `packages/core/src/data/trigrams.ts` (STYLES, QUOTE_STYLES at lines 14-15)
  - Modify: `apps/cli/src/commands/hexagram.ts` (VALID_STYLES at line 7)
  - Modify: `apps/cli/src/output/json.ts` (enumeration at lines 45-50, 65-70)
  - Modify: `apps/cli/src/output/plain.ts` (5-line emission at lines 64-68)
  - Test: `apps/cli/src/__tests__/style-union-parity.test.ts` (new)
- **Approach:** Add `"gc"` and `"yaoXiao"` to every list in lockstep. `hexagramToJson` emits every populated optional field (skip undefined keys). `formatHexagramPlain` adds a 卦辭 line when `gc` is populated. Style-union parity test asserts `STYLES`, `QUOTE_STYLES`, `VALID_STYLES`, and the JSON-output enumeration are identical (modulo `"st"` exclusion).
- **Patterns to follow:** `apps/cli/src/output/plain.ts:64-68` (existing per-style emission); `apps/cli/src/commands/hexagram.ts:7` (`VALID_STYLES` declaration).
- **Test scenarios:**
  - *Happy path:* `STYLES`, `QUOTE_STYLES`, `VALID_STYLES`, and the JSON emission keys are all in agreement (parity test).
  - *Edge — undefined optional:* `hexagramToJson` for a hex with no `gc` populated does not emit a `gc: undefined` field; the key is absent.
  - *Error — invalid style:* `iching hexagram 1 --style unknown` exits with the existing typed error; the error message lists all valid styles including new ones.
- **Verification:** `iching hexagram 1 --style gc` errors cleanly (data not yet populated for hex 1), then succeeds after U8 lands.

### U8. 卦辭 + 小象傳 acquisition workflow + data backfill into gua.ts

- **Goal:** Pull the queued first-wave canonical Chinese (卦辭 root oracle + 小象傳 per-line commentary) from ctext.org primary + zh.wikisource cross-check, verify adversarially, and backfill into the `GUA` array's new optional fields. Bilingual: zh from canon, en from Legge (post-cleanup); for this unit, populate zh only and leave en for U10's backfill pass.
- **Requirements:** Foundational gap-filler; surfaces both fields in U6's renderer.
- **Dependencies:** U1, U2 (uses same workflow pattern). Can run in parallel with U3-U7.
- **Files:**
  - Create: `data-acquisition/guaci-xiaoxiang.json` (verified pull artifact, gitignored or committed-as-fixture per workspace decision)
  - Modify: `packages/core/src/data/gua.ts` (populate `gc` on all 64; populate `yaoXiao[6]` on all 64)
  - Test: `packages/core/src/__tests__/guaci-xiaoxiang.test.ts` (new)
- **Approach:** Mirror the `iching-pull-verify-synthesize` workflow used this session for the second-wave corpora. Pull agent fetches ctext.org's per-hexagram pages, extracts the 卦辭 (the line beginning with `《卦名》：` or the prose immediately after) and the 6 小象傳 entries (the `象曰` lines per yao). Adversarial verifiers run completeness (64 / 384 counts) + source-fidelity (spot-check vs zh.wikisource) + structural cleanliness lenses. Verification anchors: hex 1 卦辭 should be `元亨，利貞`; hex 1 line 1 小象 should begin with `潛龍勿用，陽在下也`. Backfill agent reads the verified JSON and rewrites `gua.ts` in place, inserting `gc` and `yaoXiao` into every entry while preserving every existing field and the file's authored comment header.
- **Patterns to follow:** `data-acquisition/xugua-zagua.json` schema (this session's pull). `data/gua.ts:4` (existing array shape — backfill must preserve it).
- **Test scenarios:**
  - *Happy path:* `GUA[0].gc === "元亨，利貞"`; `GUA[0].yaoXiao[0]` is the canonical 小象 for line 1 of 乾.
  - *Coverage:* every `GUA[i].gc` is non-empty; every `GUA[i].yaoXiao` has 6 entries.
  - *Existing fields untouched:* every existing `dx`/`tu`/`en`/`te`/`w`/`yao`/`yaoEn` field is identical to pre-backfill (diff-based assertion against a git blob hash, or against a frozen-fixture copy).
  - *Disconfirming evidence:* if the canonical 卦辭 source disagrees on any hex's text between ctext.org and zh.wikisource by more than a documented variant, the unit fails and the textual variant is recorded.
- **Verification:** All 64 entries have populated `gc` and `yaoXiao`; no existing field changed.

### U9. Legge cleanup re-pull workflow

- **Goal:** Re-pull Legge from public-domain sources that don't carry the Morales/baharna editorial drift, producing a clean `data-acquisition/legge-cleaned.json` that passes verification.
- **Requirements:** Pre-req for shipping the Legge translation lineage.
- **Dependencies:** None (operates on raw sources, not the existing `data-acquisition/legge.json` blocker).
- **Files:**
  - Create: `data-acquisition/legge-cleaned.json` (verified pull artifact)
- **Approach:** Multi-source workflow. Primary: pull from archive.org's `sacredbooksofchi16conf_djvu.txt` OCR (raw Legge, no Morales edits). Secondary: Wikisource's Sacred-Books-of-the-East Vol. XVI Legge pages. Tertiary: sacred-texts.com `ic*.htm` (needs browser-like User-Agent). For each blocker documented in this session's pull:
  1. **NINE/SIX substitution** in line statements: replace with Legge's canonical line-prefix language ("the first/second/third/fourth/fifth/sixth line, undivided" or "...divided"). Wikisource / archive.org plaintext are authoritative.
  2. **Missing 7th paragraph for hex 1 & 2** ("use of the number nine" / "use of the number six"): restore from Wikisource. Type `lines[]` as `string[]`, not `[string, string, string, string, string, string]` (variance accepted for hex 1 & 2).
  3. **Final 雜卦 nav chrome:** strip with regex against known site-chrome strings.
  4. **14 序卦 entries with fused footnote digits** (`Kun1`, `multitudes3`, `Li4`): regex-strip trailing digits where they follow capitalized roman text.
  Run independent verifiers per blocker class: each verifier asserts the specific blocker is gone, and a final completeness verifier asserts 64 hexagrams + Wings coverage matches the existing baharna pull's structural counts.
- **Patterns to follow:** This session's `iching-pull-verify-synthesize` workflow.
- **Test scenarios:**
  - *Blocker resolution:* a regex scan over `legge-cleaned.json.hexagrams[*].lines[*]` produces zero matches for `\b(NINE|SIX)\b` in positions where Legge's transmitted text uses "line".
  - *Hex 1 & 2 completeness:* `legge-cleaned.json.hexagrams[0].lines.length === 7` and `[1].lines.length === 7`.
  - *Nav chrome cleanup:* the final 雜卦 entry text does not contain `"Previous"`, `"Return to"`, or `"Baharna"`.
  - *Footnote cleanup:* no entry in `legge-cleaned.json.wings.xuGua[*].text` matches `[A-Z][a-z]+\d\b`.
  - *Canonical anchor:* hex 1 judgment equals "Khien (represents) what is great and originating, penetrating, advantageous, correct and firm." (the verified canonical phrasing) — match exactly.
- **Verification:** All four documented blockers are absent; 64 hexagrams + 3 Wings remain structurally complete; the workflow's verifiers all pass.

### U10. Legge data module + Stacked-voice rendering activation

- **Goal:** Promote `legge-cleaned.json` into a permanent data module; activate the third voice in the renderer's stacked-voice scaffolding (built in U6).
- **Requirements:** Q1 (stacked translation voices), Wings English availability.
- **Dependencies:** U6, U9.
- **Files:**
  - Create: `packages/core/src/data/legge.ts`
  - Modify: `packages/core/src/data/gua.ts` (populate `legge` on each entry from the cleaned data)
  - Modify: `packages/terminal/src/scenes/dict/detail-renderer.ts` (light edits — wire the leggeEn voice through `renderStackedVoices`)
  - Modify: `packages/core/src/data/xugua.ts`, `data/zagua.ts`, `data/shuogua.ts` (add `textEn?` field populated from Legge's appendices)
  - Test: `packages/core/src/__tests__/legge.test.ts` (new); extend `detail-renderer.test.ts`
- **Approach:** `legge.ts` exports `LEGGE: Record<number, LeggeHexagram>` keyed by KW + `LEGGE_XUGUA_EN: Record<number, string>` + `LEGGE_ZAGUA_EN: string[]` + `LEGGE_SHUOGUA_EN: Record<number, string>`. Backfill `GUA[i].legge` references the corresponding `LEGGE[i+1]` entry. Backfill `XU_GUA[i].textEn` from `LEGGE_XUGUA_EN[i+1]`. For `ZA_GUA`, fall back to a `[zh-only]` badge for the 2 documented gap hexagrams (39 & 49) where Legge has no pair tag — per Q5 decision: fall back rather than omit. Activate the Legge row in `renderStackedVoices` (already wired in U6, just adds non-empty content).
- **Patterns to follow:** `data/gua.ts:4` (backfill respects the file's authored shape); `data/trigrams.ts:14-15` (multiple top-level exports per data file).
- **Test scenarios:**
  - *Happy path:* `GUA[0].legge?.judgment` equals the canonical Khien judgment string.
  - *Wings English:* `XU_GUA[0].textEn` is populated; `SHUOGUA.chapters[10].textEn` (chapter 11) is populated.
  - *Edge — 雜卦 gap:* `ZA_GUA[*]` entries for hex 39 / 49 have no `textEn`; renderer surfaces a `[zh only]` badge instead of crashing.
  - *Composition — three-voice stack:* hex 1 Judgment renders three rows: modern, Wilhelm-flavored, Legge. Test asserts all three are present in renderer output.
  - *Composition — partial stack (Wings):* 序卦 hex 3 entry renders zh + Legge only (no Wilhelm voice for Wings exists). Test asserts the Wilhelm row is absent, not blank.
- **Verification:** `iching hexagram 1` plain output now includes Legge judgment; terminal detail scene shows three stacked voices on hex 1's Judgment.

### U11. Orbit-integrity test + data-layers documentation

- **Goal:** Land the satisfying invariant test from the architectural discussion (geometric pair check vs canonical 雜卦) and document the new data-layer ecology so future contributors understand the canonical/editorial split.
- **Requirements:** Closure on the model-shape change; documentation parity with `docs/vision/` style.
- **Dependencies:** U2, U5.
- **Files:**
  - Create: `packages/core/src/__tests__/orbit-integrity.test.ts`
  - Create: `docs/data-layers.md`
- **Approach:** The test enumerates all 64 hexagrams; for each non-tail hex, computes `mirror(h) !== h ? mirror(h) : polarity(h)` and asserts that result appears in the corresponding `ZA_GUA_BY_HEX[h].pair` array. The disordered tail (whitelisted by a `DISORDERED_TAIL_HEXAGRAMS` set sourced from the JSON's `_meta.notes`) is excluded. The doc `data-layers.md` covers: (a) the canonical vs editorial split (canonical text is verbatim from ctext/wikisource/Legge; editorial = TRIGRAM_ASSOC_EN glosses, structured-field synthesis, project-authored modern English); (b) the file-per-corpus convention; (c) the optional-field discipline on Hexagram; (d) how stacked-voice rendering composes; (e) the orbit-integrity invariant as the canonical sanity check for the Wings.
- **Patterns to follow:** `docs/vision/entropy-sources-vision.md` (vision-doc style); `packages/core/src/__tests__/exhaustive-4096.test.ts:11-84` (exhaustive-iteration test pattern).
- **Test scenarios:**
  - *Happy path:* every non-tail hex 1..64 passes the orbit-integrity check.
  - *Edge — degenerate-mirror hexagrams:* hex 1, 27, 29, 61 (and their polarity partners) pass via the polarity-fallback branch.
  - *Edge — disordered tail:* the whitelisted tail hexagrams are excluded by the test and do not produce failures.
  - *Disconfirming evidence:* if the orbit-integrity invariant fails for a hex *outside* the whitelist, the test fails and identifies the hex — this is the pull-correctness probe.
- **Verification:** The orbit invariant is now a permanent CI signal — silent corruption of the 雜卦 pulled data will fail this test.

## Scope Boundaries

- **Excluded from this plan:** 文言傳 (Wenyan, the appendix dedicated only to hex 1 & 2). The dictionary page placement was discussed but is asymmetric (only renders for 2 of 64 hexagrams) and adds load-bearing rendering branches; route to a separate follow-up after this wave lands.
- **Excluded:** 繫辭傳 (Great Treatise). Not per-hexagram; belongs in a separate library/about surface, not the cast or detail views.
- **Excluded:** Bone-method oracle (turtle-shell verdicts 大吉/吉/凶/大凶). Discussed earlier as a separate oracle type; needs its own architecture, not data enrichment.
- **Excluded:** Wilhelm/Baynes content. Copyrighted; cannot ship in an open-source repo. The existing `w` field stays as project-authored synthesis; the cleanup of the 19 fields with verbatim Wilhelm strings is a separate cleanup workstream tracked in this session's earlier scan.
- **Excluded:** UI for the "translation-voice toggle" (Q1 was decided as stacked-voice, not toggle). No tab/cycle interaction control is built.
- **Excluded:** Tag-cloud rendering of `extendedImages` (Q4 variant C). Compact-with-expander is decided.

### Deferred to Follow-Up Work

- **文言傳 integration** for the hex 1 & 2 dictionary pages: separate plan, after this wave stabilizes. Will reuse the optional-field pattern: `Hexagram.wenyan?: WenyanCommentary`.
- **`gua.ts` voice cleanup**: the 19 `w` fields with verbatim Wilhelm strings (identified in this session's scan) need rewriting into clean paraphrases. Separate concern from data enrichment; tracked separately.
- **Library / about surface** for non-per-hexagram texts (繫辭, full 說卦 reader, full 序卦/雜卦 continuous text). Separate UI scope.
- **Per-translation citation linking**: clicking a Legge row could open `docs/sources/legge-sbe-xvi.md` showing the provenance chain. Useful but not blocking.

## System-Wide Impact

- **Interaction graph:** new optional fields flow through `format/reading.ts:31` dynamic access (safe — optional values render or skip), `output/json.ts:65-70` enumerated emission (must be updated in lockstep — U7), `output/plain.ts:64-68` per-style line emission (must be updated in lockstep — U7), `scenes/dict/detail-renderer.ts:78-93` hardcoded section array (must be extended — U6).
- **Error propagation:** all new fields are optional. Consumers that access `gua.gc` get `undefined` until U8 backfills — every consumer must handle `undefined` defensively (`if (gua.gc) { … }` gating). Type system enforces this via `?:`.
- **State lifecycle risks:** none — this is read-only data addition. No persistence, no migration, no cache invalidation.
- **API surface parity:** `STYLES` (in `data/trigrams.ts:14`), `QUOTE_STYLES` (line 15), `VALID_STYLES` (in `commands/hexagram.ts:7`), and the explicit emission list in `output/json.ts:65-70` must all agree. U7 lands the parity test that locks this in.
- **Integration coverage:** existing `exhaustive-4096.test.ts:11-84` is untouched (tests numeric derivations, not text). New `orbit-integrity.test.ts` (U11) is the cross-layer probe for 雜卦 correctness.
- **Unchanged invariants:** every existing field on `Hexagram` (`u`, `n`, `p`, `ename`, `l`, `dx`, `tu`, `en`, `te`, `w`, `yao`, `yaoEn`) remains required and unchanged. Every existing derivation function signature (`(lines: Line[]) => number`) remains unchanged. The `Cast` shape (existing fields) is unchanged; `CastConnections` is added as a separate overlay carried in `HexagramDetail`. Storage layer (`packages/storage/src/*`) is unchanged — it doesn't persist Hexagram text, only Cast + Structure.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| **Legge cleanup re-pull misses a blocker** — archive.org OCR has its own noise. | U9 names each blocker as an independent named test. Verification is by named-blocker absence, not OCR fidelity. Multi-source fallback covers single-source OCR errors. |
| **Backfilling `gua.ts` corrupts an existing field** — `gua.ts` is 104KB and hand-authored. | U8 verifies every existing field against the pre-backfill content (git blob hash or frozen fixture). Backfill agent only adds new keys; preserve-existing is a load-bearing invariant. |
| **STYLES parity drift** between hardcoded lists during the new-field expansion. | U7 lands a parity test that asserts `STYLES`, `QUOTE_STYLES`, `VALID_STYLES`, and the JSON-emission keys are equal sets (modulo `"st"`). Any future drift fails CI. |
| **Stacked-voice renderer wastes space on hexagrams with no new fields** — legacy hexagrams could regress visually. | U6 explicit happy-path test: "renders legacy 5-field hexagram unchanged from today." Gates this regression at the test layer. |
| **Editorial `TRIGRAM_ASSOC_EN` glosses get mistaken for canonical Legge translation** — credibility concern for serious practitioners. | UI labels the gloss row explicitly as "project gloss" (Q5 decision). U4 documents this at the file head; U11's `data-layers.md` covers it at the docs layer. |
| **Disordered-tail handling produces silent incorrect pairings.** | U11's orbit-integrity test is the probe. It locks the non-tail invariant; tail-by-source-fidelity is enforced by U2's verifiers. |
| **Storage layer migration accidentally needed** if anyone embeds a full Hexagram in journal. | Already verified: `packages/storage/src/schema-keys.ts:29-36` persists only `cast` and `structure`, not Hexagram. Spot-checked in this session's integration mapping. |

## Bug-trace / Confidence Cross-Check

| Origin requirement | Plan response | Match? |
|---|---|---|
| **R: 卦辭 must appear at top of cast (currently absent in both languages)** | U8 backfills `gc`/`gcEn` into all 64 entries; U6 renders 卦辭 section at top when populated. | ✓ |
| **R: 小象傳 pairs with existing yao, renders only for changing lines** | U8 backfills `yaoXiao[6]` per hex; U6 renders per-line under each changing-line yao. | ✓ |
| **R: 說卦 trigramAssociations enriches TrigramInfo + chapters are citation source** | U3 ships SHUOGUA chapters + TRIGRAM_ASSOC keyed map; U4 wires assoc into TrigramInfo; U5 ships `DERIVATION_CITATIONS` map for badge citation; U6 surfaces both. | ✓ |
| **R: 序卦/雜卦 belong inside relations block, not separate bridge-text** | U6 places 序卦 + 雜卦 as rows alongside numeric derivation badges in the relations block; data layer keeps them as overlay (`CastConnections`) not as derivations. | ✓ |
| **R: Legge needs cleanup re-pull before integration (0/3 verdicts on current pull)** | U9 dedicated cleanup workflow; U10 promotes the cleaned data, gated on U9 verification passing. | ✓ |
| **R: Stack all three translation voices vertically (Q1)** | U6 builds `renderStackedVoices` scaffolding; U10 activates the third voice once Legge ships. | ✓ |
| **R: Terse 說卦 citation per badge with click-through (Q3)** | U5's `shuoguaCitations` is single-chapter per derivation; U6 renders citation as a badge annotation; click-through is a render-layer concern, scaffolded in U6. | ✓ |
| **R: extendedImages compact in cast + full on trigram reader page (Q4)** | U6 compact rendering (first 3 + expander). Trigram reader page is out of this plan's scope — deferred. | partial (cast-side complete; reader page deferred) |
| **R: Project-authored English trigram glosses, labeled non-canonical (Q5)** | U4 ships `TRIGRAM_ASSOC_EN` in `trigrams.ts` with explicit "project-authored" label at file head and in UI. | ✓ |

No contradictions surfaced. The partial match on Q4 is intentionally deferred (cast-side ships; reader page is a follow-up surface, not a data-layer concern).

## High-Risk Checklist

- [x] Decision rationale explicit — pure derivations + overlay + flat optional fields, justified by Consistency criterion against documented existing patterns.
- [x] Data flow traced end-to-end — `data/*.ts` → `derivation/connections.ts` → `detail.ts` (HexagramDetail) → `detail-renderer.ts` → CLI surfaces; verified by integration-mapping agent.
- [x] Integration scenarios named — composition matrix in High-Level Technical Design names every test case for the model-shape change.
- [x] Unchanged invariants stated — existing 11 Hexagram fields stay required; derivation signatures unchanged; storage layer untouched; Cast shape unchanged.
- [x] Failure modes enumerated for each external boundary — workflow verifiers per pull, parity test for hardcoded lists, orbit-integrity probe for 雜卦, byte-identical-render test for legacy hexagrams.
- [x] Files-to-touch list grounded in agent findings, not inferred — every modified file:line cited from this session's integration-mapping agent.

## Unit Sequencing

Two parallel tracks; tracks merge at U10.

```
Track A (zh canon + types + renderer + CLI):
  U1 → U2 → U3 → U4 → U5 → U6 → U7 → U8 → U11
              \                       /
               └─ U3 also feeds U4   /
                  (U4 can land any time after U3) 

Track B (Legge):
  U9 → U10  (U10 also depends on U6)
```

- U1 must land first (everything depends on the types).
- U2, U3 can land in parallel after U1.
- U4 depends on U3.
- U5 depends on U2 + U3.
- U6 depends on U2 + U3 + U4 + U5.
- U7 depends on U1 (lockstep on Style union); can land any time before U8 backfills.
- U8 depends on U1; can run in parallel with U2-U7 (data acquisition is independent of UI/type work).
- U9 has no internal dependencies; can run in parallel with everything.
- U10 depends on U6 + U9.
- U11 depends on U2 + U5; lands last as documentation closure.

Shipping order recommendation: U1 → (U2, U3, U7, U9 in parallel) → (U4, U8 in parallel) → U5 → U6 → U10 → U11.
