# Agentify Consult Ledger

Status: seeded. The first live consult was fired by the authoring pass:

```yaml
- consult_id: C-000
  surface_group: loop-design
  purpose: audit
  key: iching-language-loop-review
  prompt_summary: >
    Review planned autonomous translation loop; identify missed surfaces,
    I Ching-specific translation risks, acceptance criteria, verifier ideas,
    and false-confidence traps.
  context_paths:
    - packages/core/src/types.ts
    - packages/core/src/data/gua.ts
    - packages/core/src/data/trigrams.ts
    - packages/terminal/src/scenes/dict/detail-renderer.ts
    - apps/cli/src/commands/config.ts
  status: complete
  finished_at: 2026-06-02T07:05:21Z
  duration_ms: 444843
  conversation_url: https://chatgpt.com/g/g-p-69c9d0b3c3b88191872d6b59cb5adfb8-agentify/c/6a1e7f1d-4050-83e8-8c1c-e83ffa31f765
  findings: >
    Make AC-001 a hard gate; include Commander help/descriptions/arguments,
    invalid-path errors, TUI footers/keybinding verbs, synthetic labels,
    plural/date strings, JSON display policy, config token stability, data
    constants, Unicode symbol/index checks, pinyin normalization, source-layer
    separation, glossary-driven terminology, line-identity preservation, and
    context-aware Simplified conversion with exceptions such as 乾 not becoming
    干.
  reconciled_into:
    - .loop/language/PROMPT.md initial audit findings, bootstrap inventory,
      language policy, high-risk terminology, dependency topology
    - .loop/language/ACCEPTANCE.md AC-003, AC-004, AC-005, AC-006, AC-008,
      AC-009, AC-010
    - .loop/language/TEXT_SURFACES.md row contract and candidate surface groups
```

```yaml
- consult_id: C-001
  surface_group: bootstrap-inventory (all groups)
  purpose: audit
  key: iching-language-missed-surface-audit
  prompt_summary: >
    Missed-surface audit (required cadence step 1). Given the completed
    TEXT_SURFACES.md inventory + the language-aware/leakage source files
    (detail-renderer.ts, settings-scene.ts, format/derived.ts, display-select.ts,
    config.ts), identify: (a) any user-facing text surface CLASS missing from the
    inventory, (b) misclassifications (machine-token marked translate, or
    user-facing marked not-user-facing/exempted), (c) I Ching-specific risks not
    captured, (d) anything the AC-001 string-sink verifier would systematically
    miss.
  context_paths:
    - .loop/language/TEXT_SURFACES.md
    - packages/terminal/src/scenes/dict/detail-renderer.ts
    - packages/terminal/src/scenes/settings/settings-scene.ts
    - packages/core/src/format/derived.ts
    - packages/core/src/service/display-select.ts
    - apps/cli/src/commands/config.ts
  modeIntent: extended-pro
  status: complete
  finished_at: 2026-06-02T08:00Z
  runs: 2   # MCP transport returned "fetch failed" twice but the desktop completed BOTH sends;
            # two provider runs under one key (counts as 2 toward the 48/invocation cap). Findings agree.
  conversation_url: https://chatgpt.com/g/g-p-69c9d0b3c3b88191872d6b59cb5adfb8-agentify/c/6a1e8bb9-f1a0-83e8-a774-4e60cb7296ba
  findings: >
    GPT-5 Pro (extended-pro) returned 15 missed-surface, 12 misclassification, 15 I-Ching-risk,
    and 15 verifier-blind-spot items. Key actionable items below; full text in conversation.
  reconciliation:
    accepted_into_ac001:
      - "MISSED 1.2/1.3: Commander FRAMEWORK-generated text (Usage:/Options:/Commands:/unknown-command/
         missing-argument) is user-facing but lives in node_modules, invisible to repo literal extraction.
         -> ADDED inventory row cli-commander-framework (policy: dependency-English; localize-vs-exempt is AC-005)."
      - "MISSED 1.9/1.15: locale-sensitive number/date/plural formatting is a surface CLASS not yet rowed.
         -> ADDED inventory row format-locale-numerics (locale-format policy decided in AC-002)."
      - "MISCLASS 2.1/2.2/2.3: core-gua-u, core-trigram-sym, core-large-glyphs were language_policy:
         not-user-facing — wrong ('not translated' != 'not user-facing'). -> RECLASSIFIED to canonical-anchor
         (user-facing, preserve, not a translation target)."
      - "Strengthened AC-001 verifier sentinels: added 自返 and 對角卦 (derived special-case templates)."
    rejected_or_noted_already_covered:
      - "MISSED 1.14/1.20 (home/cast/toss/yarrow/browse/journal scene footers/empty states): the model only
         saw detail/settings/derived/config; the FULL TEXT_SURFACES.md already rows all these scenes. No gap."
      - "MISSED 1.1/1.5/1.6/1.8 (config help, settings labels, detail footer): already inventoried
         (cli-command-descriptions, term-settings-*, term-dict-detail-footer)."
    routed_to_later_criteria:
      - "AC-002 (policy): segment composite rows (core-reading-headline/becoming-suffix, core-derived-labels-en)
         into preserve|canonical|localize parts; split token-vs-display-label for enum chips (theme/EN-繁-简/
         coin/yarrow/kaiti...); JSON per-field policy (corpus dx/tu/yao = locale-neutral in JSON, NOT
         localized-display)."
      - "AC-010 (glossary): 君子/小人/大人/貞/亨/利/咎/厲/悔/吝/征/孚 term decisions; wing-title precision
         (Image=大象傳 vs 象傳; Judgment=彖傳 vs 卦辭); 衍卦 = product term not received-text; derived-relation
         terms (互/錯/綜/之/對角/自綜/自返); ritual terms 蓍草/筮/銅錢/手動-自動; Wilhelm label = inspired/advice,
         must not imply quotation."
      - "AC-003 (core-data): corpus omits 用九/用六 (Qian/Kun special line statements) — document exclusion or
         model them; preserve line-identity (初九…上九) in English headers; lock audited pinyin polyphony
         (否 Pǐ, 賁 Bì, 蹇 Jiǎn, 解 Xiè) — never regenerate pinyin from simplified."
      - "AC-006 (simplified): per-char map is unsafe for classical text — needs context-aware/table-driven
         conversion + audited exceptions: 後≠后, 於≠于, 雲/云 (cloud vs 'says'), 麗/離, 餘/余, 里/裏, 係/系,
         發/髮, 征/徵, and the canonical 乾≠干; hexagram-name conversion should be a per-name table."
      - "AC-008 (verifier self-test): add runtime/snapshot sentinels for Commander --help & error paths,
         seeded-RandomSource tests for every selectDisplay threshold + formatDerived branch, special-cast
         fixtures (self-mirror/locked-pair/no-change/diagonal), terminal-size×focus snapshot matrix,
         stringWidth visual-width tests, SEMANTIC simplified fixtures (not just residue scan), JSON
         per-field policy assertions, config alias round-trip, and a 'no-display'(null) behavioral test."
```

```yaml
- consult_id: C-002
  surface_group: simplified-conversion (HIGH-RISK group; AC-006 + AC-007 meaning/research)
  purpose: meaning
  key: iching-language-simplified-table
  prompt_summary: >
    Produce an audited Traditional->Simplified character map for the exact 929 unique Han
    characters of the rendered I Ching corpus (hexagram names + 大象傳/彖傳/爻辭). Return ONLY
    chars whose Simplified form DIFFERS, as a compact JSON object. EXCLUDE 乾 (must stay 乾 here,
    NOT 干). Separately flag any context-dependent char (後/后, 雲/云, 麗/離, 餘/余, 係/系, 著, 幾,
    etc.) where a blind char-swap could corrupt classical meaning.
  context: inline 929-char list (/tmp/corpus-han.txt)
  modeIntent: thinking
  status: complete
  finished_at: 2026-06-02T09:26Z (thinking, 3m12s)
  conversation_url: https://chatgpt.com/g/g-p-69c9d0b3c3b88191872d6b59cb5adfb8-agentify/c/6a1ea0e9-a968-83e8-835d-017fe7471e58
  findings: >
    Returned a ~250-entry T->S JSON map for the corpus + a context-sensitive flags section.
    Correctly EXCLUDED 乾 (kept 乾); mapped the DISTINCT 幹->干; resolved classical false-friends
    one-directionally: 後->后, 雲->云, 麗->丽 vs 離->离, 係/繫->系, 於->于, 穀->谷, 幾->几; and
    explicitly kept 藉 (易经「藉用白茅」). Flagged a few Ext-B/C simplified codepoints (㧑/𦈡/𬙊/𫗧)
    for obscure line-text chars.
  reconciliation:
    accepted: >
      Built packages/core/src/i18n/simplify.ts (SIMPLIFIED_MAP + toSimplified + SIMPLIFIED_EXCEPTIONS),
      merging C-002's corpus map with the previously-vetted UI-label/variant chars (傳/辭/記/鎖/…) the
      929-char extraction didn't include. Exported from @iching/core. Rewired detail-renderer zh() to
      delegate to core toSimplified and DELETED the naive local 96-char SIMPLIFIED_CHARS map.
    verified: >
      --simplified PASS (乾 stays 乾 / no 干, spot-checks 傳->传 … 餘->余, residue scan over corpus,
      consumer-side: detail-renderer uses toSimplified + no local map). End-to-end: 坤 in zh-Hans
      renders 万/无/龙/载/黄 with no Traditional residue; 乾卦 keeps 乾. typecheck PASS; detail tests 15/15.
    serves_AC007: >
      This is the high-risk Simplified group's MEANING/research consult. Its ADVERSARIAL audit (review
      the converted corpus for residue/errors against the embedded table) remains for AC-007.
```

```yaml
- consult_id: C-003
  surface_group: yarrow-ritual (HIGH-RISK; AC-004 timeline captions + AC-007 meaning)
  purpose: meaning
  key: iching-language-yarrow-terms
  prompt_summary: >
    Translate the yarrow-stalk ritual UI terms to 繁體 + 简体 for an I Ching TUI, keeping classical
    accuracy: line-values old/young yin-yang (老陰/少陽/少陰/老陽), and ritual nouns/verbs — stalks,
    heaps, set aside / one aside, count by fours, carry, fuse (product-coined line-crystallization
    beat), Round N, Remaining, few/many, "Cut at k". Asked for compact JSON {term: {zhHant, zhHans}}
    + notes on any non-standard coinage.
  context: inline (exact yarrow-timeline caption strings + field-renderer "stalks"/"set aside")
  modeIntent: thinking
  status: complete
  finished_at: 2026-06-02T~10:10Z
  conversation_url: agentify key iching-language-yarrow-terms
  findings: >
    JSON term map: line-values 老陰/少陽/少陰/老陽 (繁) / 老阴/少阳/少阴/老阳 (简) — confirmed standard;
    stalks 策, heaps 二分, set aside 歸奇/归奇, one aside 掛一/挂一, count-by-fours 揲四, carry 承策,
    Remaining 餘策/余策, Round 變/变, fuse 成爻 ("forms a line", chosen over 凝爻), few/many 少/多,
    Cut-at-k 分於k/分于k. Notes flagged carry/heaps/few-many/fuse as UI coinages (not fixed classical
    labels) — kept short, no "fake-ancient cosplay".
  reconciliation:
    accepted: >
      Added yarrow.* keys to messages.ts (en = exact existing words, zhHant/zhHans from C-003).
      Threaded `language` through buildYarrowTimeline -> buildYarrowFullLineBeats -> buildYarrowRoundBeats/
      buildYarrowFuseBeat opts -> buildRoundCaptions/buildFuseCaption/lineValueName; ctor-threaded into
      YarrowScene + YarrowManualScene (from reading-flow deps.language); field-renderer renderYarrowField/
      renderChrome/strip localize stalks/set-aside + counter.
    verified: >
      End-to-end: en captions byte-identical ("Round 1 · 49 stalks", "Count each heap by fours."),
      zh-Hant "變 1 · 49 策 / 分於k=… 二分 / 掛一 / 每堆揲四", zh-Hans "变…/分于k=…/挂一". Numbers/operators
      (·,k=,|,÷,→,N/M) verbatim. --terminal GREEN; scene-language 12/12; full suite 501/501.
    serves_AC007: yarrow group MEANING consult done; ADVERSARIAL audit still pending for AC-007.
```

```yaml
- consult_id: C-005
  surface_group: core-terminology + Wilhelm (HIGH-RISK; AC-007 meaning)
  purpose: meaning
  key: iching-language-terminology-meaning
  prompt_summary: >
    Validate the glossary's approved EN renderings for the high-risk judgment terms (君子/小人/大人/貞/
    亨/利/咎/悔/厲/吝/吉/凶/元吉/無咎/利涉大川/征/往/有孚/時) + the Wilhelm-label attribution policy.
  modeIntent: thinking
  status: complete
  finished_at: 2026-06-02T~10:50Z
  findings: >
    君子(noble one)/大人/咎/厲/吉/凶/無咎/往/時 = ok. Preferred (academic) alternatives: 小人→petty person,
    貞→constancy, 亨→fulfillment, 利→beneficial, 悔→regret, 吝→shame, 元吉→great good fortune,
    利涉大川→cross the great river, 征→undertake an expedition, 有孚→there is trust. Wilhelm verdict:
    bare "Wilhelm" implies quotation — MUST say "Wilhelm-inspired"/"after Wilhelm".
  reconciliation:
    accepted: >
      Wilhelm honesty fix APPLIED — detail-renderer EN section header "Wilhelm" -> "Wilhelm-inspired"
      (AC-010 attribution policy); inventory + glossary updated.
    noted_kept_voice: >
      The de-Wilhelmized term alternatives are RECORDED in docs/language-glossary.md as documented
      options but NOT adopted as primary, because the app is deliberately Wilhelm-inspired and the
      en/te/w/yaoEn corpus voice is Wilhelm-Baynes (consistent + intentional, not a fidelity defect; cf.
      AR-005). Not a corpus rewrite.
- consult_id: C-004
  surface_group: ALL high-risk (simplified + yarrow + terminology + Wilhelm) (AC-007 adversarial)
  purpose: adversarial
  key: iching-language-adversarial-audit
  prompt_summary: >
    Adversarial audit of the IMPLEMENTED decisions: attack the embedded Simplified table (residue/wrong
    conversions/乾 exception), the yarrow terms (C-003), the glossary terminology + Wilhelm label, and the
    EN 君子 divergence (AR-005). Find fidelity defects.
  context_paths:
    - docs/language-glossary.md
    - packages/core/src/i18n/simplify.ts
    - packages/terminal/src/i18n/messages.ts
  modeIntent: extended-pro
  status: complete
  finished_at: 2026-06-02T~11:00Z (extended-pro, 9m)
  conversation_url: agentify key iching-language-adversarial-audit
  findings: >
    Verdict "not fit to ship until fixed": (blocker→latent) missing 陽→阳 (corpus has none, but 陰/陽
    asymmetry); 乾 exception not ENFORCED (only works by absence); 承策 invented ritualese; 歸奇 is the
    action not the bundle; 貞/征 too gentle as received-text approved; Wilhelm label needs to not imply
    quotation; 君子 inconsistency (noble one vs superior man) is a real defect; rare Ext glyph tofu risk;
    zh-Hans halfway between literary-register and Mainland-idiom.
  reconciliation: >
    Full triage in docs/language-glossary.md "## C-004 adversarial-audit reconciliation".
    ACCEPTED+FIXED: 陽→阳 added; 乾 exception enforced in toSimplified() (EXCEPTION_SET before map) +
    幹→干 spot-check; 承策→續/续; 歸奇→奇策; glossary 貞→constancy/征→to campaign/有孚→there is trust;
    君子 harmonized in corpus (superior man→the noble one, 19 strings) + --core-data guard.
    DEFERRED: Wilhelm close-paraphrase phrase audit; rare-glyph font policy (-> AC-008). REJECTED:
    zh-Hans Mainland-idiom (literary register is deliberate); 咷→啕 (standard PRC, minor).
    Covers all high-risk groups (simplified + yarrow + terminology/Wilhelm) adversarially.
```

Before each future Agentify query, append a `planned` row here. After completion,
summarize findings and either cite the affected acceptance row or record why the
finding was rejected.
