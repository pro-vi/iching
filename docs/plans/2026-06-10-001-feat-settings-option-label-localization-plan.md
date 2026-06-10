---
title: Settings Option-Label Localization
type: feat
status: active
date: 2026-06-10
origin: PR #5 code-review session — settings-chips analysis (3-analyst workflow) + GPT-Pro second opinion; chat blueprint approved with U2 amendment
---

# Settings Option-Label Localization

Follow-up to PR #5 (`feat: add language-aware detail view`). Localizes the Settings
scene's option-value chips through a display-label catalog layer while keeping stored
enum tokens, CLI stdout, and the config parse surface untouched. Implements the policy
already recorded in `docs/language-glossary.md:106-107`: localized display labels for
enum values "are a SEPARATE catalog layer that never mutates the stored token."

## Requirements

- **R1** — zh-Hant/zh-Hans Settings render localized display labels for font, cast
  method, cast mode, taijitu, and glyph-animation chips; `en` rendering unchanged.
- **R2** — Persisted config tokens, CLI stdout, and hand-edit acceptance unchanged;
  **no new config aliases**.
- **R3** — Labels resolve from the *live* language selection (mid-screen flip updates
  same frame, like the title already does).
- **R4** — Missing label entry falls back to the canonical token: never crash, never
  persist a label.
- **R5** — Theme chips stay verbatim until the glossary records what theme names *are*
  (literal words vs branded palette names).
- **R6** — Policy artifacts (glossary, TEXT_SURFACES matrix, pinned tests, verifier)
  re-pinned to say "stored tokens canonical; labels via catalog" — not "chips are
  English."

## Architecture Decision

**Approach:** A sibling option-label catalog module (`option-labels.ts`) with its own
typed accessor `optionLabel(lang, settingKey, token)` — *not* routed through
`tr()`/`MESSAGES` — plus a value-bound refactor of `SettingRow` so labels are derived
at render time from canonical tokens, and `getValues()` reads by **row identity**
rather than row position.

**Rationale (consistency + integration shape):** The catalog *shape* mirrors
`messages.ts` (`{en, zhHant, zhHans}` records, zh-Hans authored explicitly per the
file's stated convention). But the integration-shape check fails for reusing `tr()`
directly: `tr(lang, "option.castMethod." + token)` does not typecheck — `MessageKey`
is a literal union (`packages/terminal/src/i18n/messages.ts:107`), and widening it to
template-literal keys would break the exhaustive catalog contract. The bridge is
therefore a named module, not a footnote. Fallback semantics (token when no entry)
also belong in the accessor, which `tr()` deliberately lacks.

**Two label mechanisms coexist, on purpose:** `LANGUAGE_LABELS`
(`settings-scene.ts:27-31`) stays untouched — language chips are *endonyms*,
deliberately invariant across display languages, and they're pinned by high-risk
fixture rows, the `"[EN]  繁  简"` test assertion, and verifier sentinels requiring
those literals in `settings-scene.ts`. `OPTION_LABELS` is the new,
per-display-language layer for the other rows. Semantically different things; don't
unify them.

**Trade-offs accepted:** TUI↔CLI vocabulary divergence (銅錢 vs `coin`) mitigated by
canonical hints in the label strings themselves, not by parser widening. Theme row
stays mixed-register until the glossary decision — a documented gap, not an accident.

## Implementation Units

### U1. Glossary + policy-matrix groundwork

- **Goal:** Approved zh-Hant/zh-Hans renderings for every chip token entering the
  catalog; theme-name semantics decision recorded; input-alias policy recorded as
  **none**.
- **Requirements:** R5, R6
- **Dependencies:** None
- **Files:**
  - Modify: `docs/language-glossary.md`
  - Modify: `tests/fixtures/language/TEXT_SURFACES.md` (rows `term-theme-names`,
    `term-settings-row-labels`; add/update rows for font/castMethod/castMode/
    taijitu/anim chips)
- **Approach:** Glossary table is **token-keyed from the start** (token → en ·
  zh-Hant · zh-Hans · literal-vs-brand · accepted-as-input: no) so ordering mistakes
  cannot survive into code. Candidate renderings to ratify or replace: font 楷體/隸變/
  黑體; castMethod 銅錢 (coin)/蓍草 (yarrow); castMode 自動/手動; taijitu dots→點陣,
  dense→密實; anim noise→噪點, dots→點陣, radial→放射, sand→沙化. **Note the
  cross-token hazard:** 噪點 = `noise`, 點陣 = `dots` — and 點陣 is used by BOTH
  `taijitu.dots` and `anim.dots`; ratify the rendering once with both usages
  cross-referenced. Theme row: record "semantics undecided (brand vs literal); labels
  deferred" explicitly.
- **Patterns to follow:** glossary "Machine tokens" section structure
  (`docs/language-glossary.md:101-108`); existing TEXT_SURFACES row schema.
- **Test expectation:** none — docs/fixture only; verification is
  `bun scripts/verify-language-surfaces.ts --policy --glossary` still PASS (no
  deferral-placeholder fields introduced).
- **Verification:** Every token in U3/U4 scope has a ratified rendering keyed by
  token; theme deferral and no-alias policy are quotable lines.

### U2. Option-label resolver + identity-bound row refactor

- **Goal:** The mechanism: `optionLabel()` with token fallback; `SettingRow` carries
  canonical values with labels derived at render; `getValues()` derives from **row
  identity, not position**; pinned tests rephrased.
- **Requirements:** R3, R4, R6
- **Dependencies:** U1
- **Files:**
  - Create: `packages/terminal/src/i18n/option-labels.ts`
  - Modify: `packages/terminal/src/scenes/settings/settings-scene.ts`
  - Modify: `packages/terminal/src/i18n/messages.ts` (export the `Message` interface
    only)
  - Test: `packages/terminal/src/__tests__/settings-scene.test.ts`,
    `packages/terminal/src/__tests__/scene-language.test.ts`
- **Approach:** `OPTION_LABELS` built as `Map` (or null-prototype record +
  `Object.hasOwn`) — the PR #5 prototype-chain lesson applied at birth.
  `SettingRow.options: string[]` → canonical token array (rename to `values`); render
  loop calls `optionLabel(lang, setting.key, value)`. **Amendment (reviewer-verified):
  `getValues()` is currently coupled two ways — display-string→canonical by index AND
  field→row by hardcoded position (`this.rows[0]`…`this.rows[6]`,
  `settings-scene.ts:117-127`); reordering rows today would silently swap persisted
  values. Derive `getValues()` from row identity: look up each row by its `key`, read
  `row.values[row.selected]`. Kills the whole drift class, not half of it.** Language
  row untouched. Ship with an **empty catalog** — behavior identical before/after,
  proving R4 fallback.
- **Patterns to follow:** `tr()` shape (`messages.ts:110-113`); live-language render
  derivation (lang from live selection in `render()`); `LANGUAGE_LABELS` as the
  display≠stored precedent.
- **Test scenarios:**
  - *Happy path:* empty catalog → en and zh renders byte-identical to pre-refactor;
    persistence writes canonical tokens.
  - *Edge case:* token with no catalog entry in zh-Hant → renders the token itself
    (R4).
  - *Edge case:* prototype-chain key (`"constructor"` as token) → falls back to token
    string, never resolves an inherited member.
  - *Edge case (amendment):* construct rows in a shuffled order → `getValues()` still
    maps each field to the correct row by key (locks the identity-bound contract).
  - *Integration:* flip Language row ←/→ with a seeded label entry → chip text changes
    same frame, `getValues()` unchanged.
  - *Re-pin:* scene-language.test comment/assertions updated from "canonical anchors"
    to "labels per policy matrix; stored tokens canonical"; `"[EN]  繁  简"` assertion
    preserved verbatim.
- **Verification:** Refactor is behavior-neutral with empty catalog; no positional
  `this.rows[N]` field mapping remains; no display array exists that `getValues()`
  reads positionally against a different array.

### U3. Rollout wave 1 — font row

- **Goal:** First real labels: `kaiti/libian/heiti` → 楷體/隸變/黑體 (楷体/隶变/黑体).
- **Requirements:** R1
- **Dependencies:** U2
- **Files:**
  - Modify: `packages/terminal/src/i18n/option-labels.ts`
  - Test: `packages/terminal/src/__tests__/scene-language.test.ts`
- **Approach:** Safest row first — tokens are pinyin of the labels, so the CLI mental
  bridge survives without hints.
- **Test scenarios:**
  - *Happy path:* zh-Hant shows 楷體, en shows `kaiti`, saved config still `"kaiti"`.
  - *Regression pin (not a risk mitigation):* CJK double-width — selected-chip
    brackets land on correct cells at 80 cols. The render loop already positions by
    `stringWidth`, not `.length`, so this passes immediately; the test pins it against
    future render-loop changes.
- **Verification:** Font row fully localized in both zh modes; persistence round-trip
  unchanged.

### U4. Rollout wave 2 — cast method (with canonical hint), cast mode, taijitu, glyph anim

- **Goal:** Remaining sanctioned rows: 銅錢 (coin)/蓍草 (yarrow), 自動/手動,
  taijitu 點陣/密實, anim 噪點/點陣/放射/沙化 (+ zh-Hans forms). Catalog entries are
  token-keyed (`noise`→噪點, `dots`→點陣 — per U1's cross-referenced ratification).
- **Requirements:** R1, R2
- **Dependencies:** U2 (U3 independent — can land in either order)
- **Files:**
  - Modify: `packages/terminal/src/i18n/option-labels.ts`
  - Test: `packages/terminal/src/__tests__/scene-language.test.ts`
- **Approach:** Canonical hint encoded *in the catalog string* (`銅錢 (coin)`) — no
  new render machinery; glossary owns hint text. Cast method gets hints (no
  transliteration bridge); cast mode/taijitu/anim are literal common words,
  label-only.
- **Test scenarios:**
  - *Happy path:* per row, zh label renders, en unchanged, token persists.
  - *Edge:* widest localized row measured `<` current theme-row width (36 cols) at 80
    cols — no clip, brackets correct.
  - *Integration:* `iching config get castMethod` still prints `coin` after a TUI save
    made in zh-Hant.
- **Verification:** All sanctioned rows localized; theme row still verbatim; CLI
  stdout untouched.

### U5. Verifier + fixture sync

- **Goal:** The language verifier *enforces* the new layer instead of merely
  tolerating it.
- **Requirements:** R6
- **Dependencies:** U3, U4
- **Files:**
  - Modify: `scripts/verify-language-surfaces.ts`
  - Modify: `tests/fixtures/language/TEXT_SURFACES.md` (status flips for
    newly-covered rows)
- **Approach:** Extend `--terminal` to assert option-label coverage for sanctioned
  rows (mirroring the existing `settings.theme`/`settings.castMode` label-key checks);
  keep sentinels (`EN`/`繁`/`简`/`乾` in settings-scene.ts) valid — they are, since
  the language row didn't move. Flip TEXT_SURFACES rows from "shown verbatim" to
  "display-label via catalog" where shipped.
- **Test scenarios:**
  - *Happy path:* `--policy --terminal --glossary` all PASS.
  - *Error path:* deleting one shipped label entry makes `--terminal` FAIL (proves
    enforcement, not tolerance).
- **Verification:** A future regression that drops a label is caught by CI, not by a
  zh user.

## Scope Boundaries

- **No new config-input aliases** — `config set` and hand-edited files accept
  canonical tokens only; `LANGUAGE_ALIASES` is not extended. Revisit only on observed
  user friction, as a designed opt-in per enum.
- **No CLI stdout changes** — `config list/get/set` stays canonical English
  (script-facing contract).
- **Language row untouched** — endonym chips EN/繁/简 are a different mechanism,
  already correct, heavily pinned.
- **No new Settings rows** (motion stays CLI-only per its `developer-only` policy
  row).

### Deferred to Follow-Up Work

- **Theme chip labels** — blocked on the U1 glossary decision (brand vs literal);
  separate small PR once decided.
- **Localized validation-error descriptions** in non-script contexts — only if
  friction appears.

## System-Wide Impact

- **Interaction graph:** render-path only — no other scene ever `writeText`s these
  tokens (verified by sweep); CLI and storage packages are untouched by U2–U4.
- **Error propagation:** label resolution is total (fallback to token) — no new
  failure path reaches the scene loop.
- **API surface parity:** intentional TUI↔CLI label divergence, bridged by in-label
  hints + (existing) error messages listing canonical values.
- **State lifecycle:** not stateful — settings save path byte-identical (canonical
  tokens in, canonical tokens out).
- **Unchanged invariants:** persisted schema and values; CLI stdout;
  `LANGUAGE_ALIASES`/`THEME_ALIASES` parse surface; 乾 preview char; `"[EN]  繁  简"`.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Branch base: this work builds on `feat/language` (PR #5), which already contains the `Object.hasOwn` alias hardening, `canonicalLanguage`, and the verifier fixtures. Branch from `feat/language`; **merging #5 to main is not a blocker** — but if #5 changes under review, rebase before U2 | Branch from `feat/language`; U2's catalog uses `Map`/own-property discipline from birth regardless |
| Pinned artifacts are pervasive (fixture rows, sentinel literals, exact-string test assertions) — a missed pin breaks CI in a confusing place | Each unit names its pins explicitly; U2 re-pins tests *in the same commit* as the refactor; U5's error-path test proves the verifier's direction |
| Wrong zh renderings ossify (the 承策 lesson — invented ritualese already corrected once in `messages.ts:98`) | U1 glossary ratification before any code; candidate renderings in this plan are *candidates*, not finals |
| zh-Hans accidentally derived via `toSimplified` instead of authored | Follow `messages.ts` header convention: author zh-Hans explicitly per entry |
| Glossary token↔rendering transposition (噪點/點陣 class of error) | U1 table is token-keyed; 點陣 ratified once, cross-referenced to both `taijitu.dots` and `anim.dots` |

**Confidence cross-check (session findings → contract):** mixed-register defect →
U3/U4; test-ossification amendment → U2 re-pin; aliases-by-osmosis → U1 policy line +
scope boundary; parallel-array + positional-row drift → U2 identity-bound refactor;
theme ambiguity → U1 decision + deferred section; prototype-chain class → U2 edge-case
test. No upstream item dropped.

> Note on line references: anchors cited (e.g. `settings-scene.ts:27-31`,
> `messages.ts:107`) were verified against `feat/language` as of 2026-06-10; a few
> drifted slightly after the PR #7 squash but all resolve. Treat them as directional.
