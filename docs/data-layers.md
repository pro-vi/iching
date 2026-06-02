# Data Layers

How the I Ching app composes per-hexagram data from canonical sources, project authorship, and computed structure. This doc is the contract for adding new layers; if you change one of the conventions here, change this doc in the same commit.

## What ships

After the data-enrichment wave (`docs/plans/2026-05-30-001-feat-data-enrichment-plan.md`), the per-hexagram data surface is:

```
                    canonical zh                 English             computed / authored
                    ────────────                 ───────             ───────────────────
root oracle         gc (卦辭)                    gcEn (Legge)        —
judgment commentary tu (彖傳)                    te                  w (Wilhelm-flavored
                                                                      synthesis, project-authored)
image commentary    dx (大象傳)                  en                  —
line texts          yao[6] (爻辭)                yaoEn[6]            —
line commentary     yaoXiao[6] (小象傳)          yaoXiaoEn[6]?       —
full translation    —                            legge.judgment      —
                                                 legge.image
                                                 legge.lines[6 or 7]
trigram catalogue   TrigramInfo.assoc            TRIGRAM_ASSOC_GLOSS_EN —
                    (image, family, body,        (project-authored
                     animal, direction,           short glosses,
                     attribute, extendedImages)   labeled non-canonical)
sequence narrative  XU_GUA[i].text (序卦傳)      .textEn (Legge)     —
contrast pair       ZA_GUA[i].text (雜卦傳)      LEGGE_ZAGUA_EN     —
                                                  (separate index;
                                                  46 entries vs ZA_GUA's 53)
trigram chapters    SHUO_GUA.chapters (說卦傳)    LEGGE_SHUOGUA_EN   —
                                                  (Legge's 22 paras
                                                   vs canonical 11)
relations overlay   —                            —                  CastConnections —
                                                                    xuGua, zaGuaPair,
                                                                    shuoguaCitations
numeric derivations —                            —                  nuclear, polarity,
                                                                    mirror, diagonal,
                                                                    becoming, isLocked
```

## Canonical vs editorial — the split

**Canonical text** is verbatim PD content with source provenance. The verification chain is:

| Layer | Primary source | Cross-check | License |
|---|---|---|---|
| `gc`, `yaoXiao` | ctext.org/book-of-changes/{slug} | zh.wikisource.org/wiki/周易 | ancient Zhou Yi + Ten Wings, PD |
| `XU_GUA`, `ZA_GUA` | ctext.org/book-of-changes/xu-gua, .../za-gua | zh.wikisource.org | Ten Wings, PD |
| `SHUO_GUA.chapters`, `TRIGRAM_ASSOC` (named fields) | ctext.org/book-of-changes/shuo-gua | zh.wikisource + 3 PD mirrors | Ten Wings, PD |
| `legge.*`, `LEGGE_*_EN` | archive.org SBE16 plaintext | sacred-texts.com + Wikisource | Legge d. 1897, SBE Vol 16 pub. 1882 — PD worldwide |

**Editorial** content is project-supplied and labeled as such everywhere it renders:

| Field | Why it's editorial | Where labeled |
|---|---|---|
| `TRIGRAM_ASSOC[k].season`, `.cosmologicalRole`, `.other` | English glosses in parens (e.g. "late autumn / early winter") synthesized for downstream UX, not in 說卦 source | optional in `TrigramAssoc`; UI must surface as "derived" |
| `TRIGRAM_ASSOC_GLOSS_EN` | project-authored short English labels (father / head / horse / northwest / strength) — not from Legge or Wilhelm/Baynes | file-head comment + dedicated `TrigramAssocGloss` interface; UI must surface as "project gloss" |
| `Hexagram.w` (Wilhelm-flavored synthesis) | project paraphrase; some entries contain verbatim Wilhelm/Baynes phrasing flagged by the session's overlap scan (separate cleanup track) | declared at types.ts ("Inspired by Wilhelm — experimental, not direct quotes") |
| `Hexagram.en`, `.te`, `.yaoEn` | anonymous modern English — author/lineage not declared; reads modern-paraphrase | de facto editorial; treat as project content |

The boundary matters at two surfaces:

1. **Rendering** — when a section displays a value, it must be clear whether that value carries canonical authority. The detail renderer dims project glosses (`fg: t.tertiary, dim: true`) and surfaces canonical text in primary color.
2. **Acquisition** — when a new layer is added, every text field gets categorized as canonical OR editorial. Editorial fields are typed optional; canonical fields are required (or optional only when not yet acquired).

## File-per-corpus convention

Each canonical-text layer lives in its own `data/*.ts` module:

```
packages/core/src/data/
  gua.ts            — 64 Hexagram entries (the main surface; carries optional
                      gc, gcEn, yaoXiao, yaoXiaoEn, legge fields backfilled
                      from per-corpus modules below)
  trigrams.ts       — TRIGRAMS[8] (TrigramInfo + assoc wiring),
                      TRIGRAM_ASSOC_GLOSS_EN (project glosses)
  xugua.ts          — XU_GUA[64] (序卦), XU_GUA_META
  zagua.ts          — ZA_GUA[53] (雜卦), ZA_GUA_BY_HEX, ZA_GUA_META
  shuogua.ts        — SHUO_GUA.chapters[11] + TRIGRAM_ASSOC[8], SHUOGUA_META
  legge.ts          — LEGGE_XUGUA_EN[64], LEGGE_ZAGUA_EN[46],
                      LEGGE_SHUOGUA_EN[22], LEGGE_META
  large-glyphs.ts   — pre-existing Braille glyph data
```

Conventions:

- One named const per primary data structure. Plural uppercase name (`GUA`, `TRIGRAMS`, `XU_GUA`, `LEGGE_XUGUA_EN`). No default exports.
- Each module ships a sibling `*_META` const carrying `source`, `crossChecks`, `license`, `notes`. The meta block is honest about editorial decisions (chapter chunking conventions, mislabellings inherited from the source, etc.).
- Per-hexagram data in 64-entry arrays uses 0-based indexing — `GUA[kw - 1]`.
- Per-hexagram lookup maps use 1-based keys — `LEGGE_XUGUA_EN[kw]`, `ZA_GUA_BY_HEX[kw]`.
- New canonical text is added by:
  1. Pulling from PD source(s) with adversarial verification (see the workflow in U8 / U9 of the data-enrichment plan as the template).
  2. Writing the verified JSON to `data-acquisition/` (gitignored).
  3. Generating the data module via a Python script that reads the JSON.
  4. Re-exporting from `packages/core/src/index.ts`.
  5. Adding integrity tests (length, sequential indices, verification anchors, no encoding drift).

## Optional-field discipline on Hexagram + TrigramInfo

Every data-enrichment field on `Hexagram` and `TrigramInfo` is **optional** (`?:`). This is load-bearing:

- The legacy 11 `Hexagram` fields (`u`, `n`, `p`, `ename`, `l`, `dx`, `tu`, `en`, `te`, `w`, `yao`, `yaoEn`) remain required. No existing consumer needs to change.
- The 5 added `Hexagram` fields (`gc`, `gcEn`, `yaoXiao`, `yaoXiaoEn`, `legge`) and 1 added `TrigramInfo` field (`assoc`) are optional. Renderers gate on presence (`if (gua.gc) { ... }`) so a hexagram entry that lacks a field renders the same as before that field existed.
- The `Style` union grows in lockstep with the field set. After U7, `Style = "dx" | "tu" | "en" | "te" | "w" | "st" | "gc"`. `QuoteStyle` (used by the random-quote selector) **deliberately excludes "gc"** because 卦辭 is the root oracle, not a random-quotable commentary lineage. `STYLES`, `QUOTE_STYLES`, and `VALID_STYLES` (CLI) are kept in agreement by the parity test at `apps/cli/src/__tests__/style-union-parity.test.ts`.

When you add a new optional field:

1. Mark it `?:` in `types.ts`. Comment what populates it and which unit.
2. If it's a single-string commentary field that goes through `g[style]` dynamic access, add the key to `Style` AND fix the consumer sites (`format/reading.ts:31`, `output/plain.ts:96`, `commands/hexagram.ts`) AS ONE COMMIT — the parity test catches drift.
3. If it's array-valued (like `yaoXiao`), do NOT add to `Style` — keep direct-access only (matching the `yao` convention).
4. The renderer extension is per-section: a new label + the rendering pattern of choice (single-row, voice-stacked, or annotation).

## Stacked-voice rendering

For text that carries multiple translation lineages (Judgment, Image, line readings, 卦辭), the detail renderer iterates voices in fixed order:

```
1. zh canonical            primary color, bold
2. modern English          secondary
3. Wilhelm-flavored        secondary, dim
4. Legge (1882)            tertiary, dim
```

Each voice row only emits when its content exists. The `renderStackedVoices(node: VoiceNode)` helper in `detail-renderer.ts` handles this — passing `{ zh, modernEn?, wilhelmEn?, leggeEn? }` causes only the populated rows to render. The same `VoiceNode` shape is used by the 卦辭 section (where only zh + Legge en exist — no modern, no Wilhelm).

For the Image / Judgment sections and the per-line yao block, U10 ships Legge as a single dim sibling row under the existing English translation rather than a full helper refactor. The `Section` type in `detail-renderer.ts:buildContentLines` carries an optional `legge` string per section, surfaced when `gua.legge` is populated.

The Wings (序卦, 雜卦, 說卦 chapters) have no Wilhelm lineage — the voice stack naturally degrades to zh + Legge when rendered.

## Orbit-integrity invariant — the sanity check for 雜卦

The most satisfying probe on the Wings data is geometric. The 雜卦傳 pairs hexagrams via the same `mirror(h) !== h ? mirror(h) : polarity(h)` rule that drives the King Wen sequence: 28 mirror-pairs plus 4 polarity-pairs (for the 8 self-mirror hexagrams — 1/2, 27/28, 29/30, 61/62) cover 64 hexagrams in 32 canonical pairs.

The famously disordered final stretch of 雜卦傳 breaks this rule. The disordered hexagrams — **大過 (28), 姤 (44), 漸 (53), 頤 (27), 既濟 (63), 歸妹 (54), 未濟 (64), 夬 (43)** — are preserved as-is per recognized textual feature (not normalized to fit the pair geometry).

The integrity test (`packages/core/src/__tests__/connections.test.ts`, "orbit-integrity invariant" describe block) asserts:

```
for every non-tail hex h:
  let entry = ZA_GUA_BY_HEX[h]
  if entry.pair.length === 2:
    let partner = mirror(h) !== h ? mirror(h) : polarity(h)
    assert: entry.pair contains partner
```

Disagreement on a non-tail hexagram = a real pull bug or upstream source corruption. Disagreement on a whitelisted tail hexagram = expected, the canon's irregularity.

This invariant catches silent regressions: if a future re-pull replaces a 2-element pair entry with a wrong partner, the test fails immediately. The disordered tail is encoded as a `DISORDERED_TAIL` Set; updates to the canon (or different editorial choices about which hexagrams count as "disordered") flow through one constant.

## Adding a new layer — the recipe

1. **Decide canonical vs editorial.** Categorize every text field.
2. **Pull with adversarial verification.** Multi-source pull + 3 lenses (completeness, source-fidelity, structural cleanliness). The U8 + U9 workflows are templates; copy and adapt.
3. **Output to `data-acquisition/`.** Verified JSON, gitignored.
4. **Generate the data module via Python.** Read JSON, emit `data/*.ts` with named const + `_META` + integrity-helping reverse indexes if applicable. Preserve traditional Chinese encoding (`無` over `无`, with `无妄` protected as canonical hex 25 name).
5. **Backfill into the main surfaces.** `GUA[i].*?` for per-hexagram fields, `TrigramInfo.assoc` for trigram-level, etc. Backfill via Python — never sed/awk for multi-line edits, never silent field replacement.
6. **Re-export from `index.ts`.**
7. **Tests.** Length / sequential / verification-anchor / no-encoding-drift / integrity invariants.
8. **Renderer.** Add sections gated on field presence so legacy entries (or entries without the new field) render unchanged.
9. **Update this doc** in the same commit.

## License + source citation

Every text field in the data layer has unambiguous public domain status:

- **Ancient Chinese texts** (Zhou Yi root judgments, all Ten Wings) — composed before 200 BCE, transmitted with the Yijing for over 2,000 years. Public domain worldwide under any copyright regime.
- **James Legge translation** — Legge died 1897; SBE Vol XVI published 1882. Public domain by ~144 years past any copyright term in any jurisdiction.
- **Project-authored content** — `w` paraphrases, `en`/`te`/`yaoEn` modern English, `TRIGRAM_ASSOC_GLOSS_EN` glosses. Owned by this project, MIT-licensed (or whatever the repo's license is).

Sources cited per module's `*_META` block. The `data-acquisition/` workspace (gitignored) preserves the verification trail — raw pulls, parse scripts, intermediate JSONs, complementary-mapping report. Re-running a pull workflow regenerates everything reproducibly.
