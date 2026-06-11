# Text Surface Inventory

Goal version: `language-translation-v1`. Status: **populated** (iteration 1).

This is the AC-001 anchor inventory. Rows are at the right altitude: per-string for
UI/CLI labels and errors; per **field-class** for the 64-entry corpus data files
(`gua.ts`, `trigrams.ts`, `large-glyphs.ts`) where enumerating every cell is neither
useful nor tractable. The tracked verifier `scripts/verify-language-surfaces.ts
--inventory-only` proves zero unclassified user-facing surfaces against this file.

Row contract (fields, in order):

```yaml
surface_id:            # stable kebab id
file:
code_locator:
current_text:          # exact literal (UI/CLI) or representative example(s)+count (corpus)
surface_class:
render_context:
language_policy:       # translate | canonical-anchor | developer-only | not-user-facing
en_source:
zh_hant_source:
zh_hans_strategy:
source_layer:          # received-text | commentary-wing | product-ui | interpretive-english | machine-token | proper-name | docs
token_policy:          # translate | preserve | alias-only
json_policy:           # not-json | stable-key | localized-display | locale-neutral-display
script_exception_policy:
locale_test:
risk:                  # low | medium | high
agentify_required:     # yes | no
status:                # open | translated | exempted | audited | verified
verifier:
notes:
```

For brevity, rows below populate the load-bearing fields; unset policy fields
(`en_source`/`zh_hant_source`/`zh_hans_strategy`/`locale_test`) are finalized in
AC-002 (policy matrix) and the per-surface criteria. `status: open` = enumerated,
translation decision pending.

---

## Cross-cutting architectural findings (AC-001 evidence)

1. **`DisplayLanguage` reaches almost nothing today.** Only `DetailScene` /
   `detail-renderer.ts` consumes the `language` setting. The core display pipeline
   (`selectDisplay`/`formatReading`/`formatDerived`), all CLI plain/JSON/hook output,
   and every other TUI scene (home, cast, yarrow, toss, browse, journal, settings)
   are hardcoded — English, or hardcoded Chinese (`問`, `自綜`, `错综同象`, wing titles).
2. **Simplified is a naive partial char map.** zh-Hans is implemented as a 96-entry
   `SIMPLIFIED_CHARS` per-character substitution in `detail-renderer.ts`; any char not
   in the map passes through as Traditional. `乾` is correctly absent (stays `乾`, never
   `干`) — but coverage is partial. Directly relevant to AC-006.
3. **Config schema is correct and stable.** `language` ∈ {`en`,`zh-Hant`,`zh-Hans`},
   default `en`, settings order `EN 繁 简`, aliases (`简/簡/simplified`→zh-Hans,
   `繁/traditional`→zh-Hant, `EN/english`→en). Machine tokens (keys, enum values) stable.
4. **JSON is locale-neutral-by-accident and should stay so.** `cast --json`/`hexagram
   --json` emit all five commentary styles regardless of `language`; keys are stable. The
   only localized-display leak is `doctor --json` `name`/`detail`.
5. **Wilhelm attribution risk.** `ename`, `w`, `yaoEn`, and the synthetic `"Wilhelm"`
   detail header carry recognizable Wilhelm/Baynes idiom; the data is Wilhelm-*inspired*,
   not direct quotation. The label must not imply direct quotation (AC-010).
6. **Line-identity tokens** (`初九 六二 九三 六四 九五 上九` / `初六…上六`) are embedded in
   `yao[]` and must be preserved verbatim across display order.

---

## Group: core-data-gua  (`packages/core/src/data/gua.ts`)

Field-class altitude. 64 entries × fields. Verifier uses field-class coverage for this file.

```yaml
- surface_id: core-gua-u
  file: packages/core/src/data/gua.ts
  code_locator: "field u ×64 (e.g. L6 \"䷀\")"
  current_text: '"䷀" "䷁" … (64 Unicode hexagram symbols, U+4DC0–U+4DFF)'
  surface_class: runtime-symbols
  render_context: "hexagram glyph in titles, lists, reading headlines"
  language_policy: canonical-anchor
  source_layer: machine-token
  token_policy: preserve
  json_policy: locale-neutral-display
  script_exception_policy: "n/a — codepoint"
  risk: low
  agentify_required: no
  status: open
  verifier: "--core-data unicode index/order check; --inventory-only field-class coverage"
  notes: "King-Wen ordered codepoints. USER-FACING (visibly rendered) but NOT a translation target — preserve. (C-001 fix: was not-user-facing; 'not translated' != 'not user-facing'.) JSON value is locale-neutral canonical."

- surface_id: core-gua-name
  file: packages/core/src/data/gua.ts
  code_locator: "field n ×64 (e.g. L7 \"乾\")"
  current_text: '"乾" "坤" "屯" … "噬嗑" … (64 Traditional names, 1–2 chars)'
  surface_class: core-data-gua
  render_context: "primary hexagram title everywhere (detail, lists, readings, derived refs)"
  language_policy: canonical-anchor
  source_layer: proper-name
  token_policy: preserve
  json_policy: localized-display
  script_exception_policy: "Traditional source; zh-Hans via audited conversion; 乾 must NOT become 干"
  risk: medium
  agentify_required: yes
  status: open
  verifier: "--core-data; --simplified canonical-exception (乾)"
  notes: "Canonical hexagram names. English equivalent is the separate ename field."

- surface_id: core-gua-pinyin
  file: packages/core/src/data/gua.ts
  code_locator: "field p ×64 (e.g. L8 \"Qián\")"
  current_text: '"Qián" "Kūn" … "Shì Kè" … (Hanyu Pinyin with tone diacritics)'
  surface_class: core-data-gua
  render_context: "romanization beside the Chinese name"
  language_policy: canonical-anchor
  source_layer: proper-name
  token_policy: preserve
  json_policy: locale-neutral-display
  script_exception_policy: "NFC-normalized romanization; preserved in all languages"
  risk: medium
  agentify_required: no
  status: open
  verifier: "--core-data pinyin NFC-normalization check"
  notes: "Romanization, not translated. Title-cased; two-syllable names space-separated."

- surface_id: core-gua-ename
  file: packages/core/src/data/gua.ts
  code_locator: "field ename ×64 (e.g. L9 \"The Creative\")"
  current_text: '"The Creative" "The Receptive" … "Darkening of the Light" …'
  surface_class: core-data-gua
  render_context: "English hexagram name/title"
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  json_policy: localized-display
  risk: medium
  agentify_required: yes
  status: open
  verifier: "--core-data; --glossary Wilhelm-attribution check"
  notes: "Wilhelm/Baynes-style English titles; high overlap with canonical Wilhelm names — attribution risk (AC-010)."

- surface_id: core-gua-dx
  file: packages/core/src/data/gua.ts
  code_locator: "field dx ×64 (e.g. L11)"
  current_text: '"天行健，君子以自強不息" "地勢坤，君子以厚德載物" … (大象傳)'
  surface_class: core-data-gua
  render_context: "detail view 大象傳 / Image section; reading style \"dx\""
  language_policy: canonical-anchor
  source_layer: commentary-wing
  token_policy: preserve
  json_policy: localized-display
  script_exception_policy: "Traditional; fullwidth punctuation 「，；」; zh-Hans via audited conversion"
  risk: high
  agentify_required: yes
  status: open
  verifier: "--core-data; --terminal English-mode-no-CJK; --simplified residue"
  notes: "象傳 (Ten Wings). Must NOT show in English mode unless canonical-anchor. English mirror = en."

- surface_id: core-gua-tu
  file: packages/core/src/data/gua.ts
  code_locator: "field tu ×64 (e.g. L12)"
  current_text: '"大哉乾元，萬物資始，乃統天。…" … (彖傳)'
  surface_class: core-data-gua
  render_context: "detail view 彖傳 section; reading style \"tu\""
  language_policy: canonical-anchor
  source_layer: commentary-wing
  token_policy: preserve
  json_policy: localized-display
  script_exception_policy: "Traditional; fullwidth 「，。」"
  risk: high
  agentify_required: yes
  status: open
  verifier: "--core-data; --simplified residue"
  notes: "彖傳 (Ten Wings). English mirror = te."

- surface_id: core-gua-en
  file: packages/core/src/data/gua.ts
  code_locator: "field en ×64 (e.g. L13)"
  current_text: '"Heaven moves with vigor; the noble one strives ceaselessly" …'
  surface_class: core-data-gua
  render_context: "detail view English Image; reading style \"en\"; journal preview"
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  json_policy: localized-display
  risk: high
  agentify_required: yes
  status: open
  verifier: "--core-data; --glossary terminology (君子→noble one etc.)"
  notes: "English rendering of dx. Classical-corpus translation = high fidelity risk."

- surface_id: core-gua-te
  file: packages/core/src/data/gua.ts
  code_locator: "field te ×64 (e.g. L14)"
  current_text: '"Vast is the primal creative — all things owe their beginning to it. …" …'
  surface_class: core-data-gua
  render_context: "detail view English Judgment; reading style \"te\""
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  json_policy: localized-display
  risk: high
  agentify_required: yes
  status: open
  verifier: "--core-data; --glossary"
  notes: "English rendering of tu. NOTE field-divergence: EN 'Judgment' = te, but ZH 彖傳 section = tu."

- surface_id: core-gua-w
  file: packages/core/src/data/gua.ts
  code_locator: "field w ×64 (e.g. L15)"
  current_text: '"The movement of heaven is full of power. Know when to persist…" …'
  surface_class: core-data-gua
  render_context: "detail view \"Wilhelm\" section (EN only); reading style \"w\""
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  json_policy: localized-display
  risk: high
  agentify_required: yes
  status: open
  verifier: "--glossary Wilhelm-attribution; --core-data"
  notes: "Wilhelm-INSPIRED advice register. Some entries (否 #12, 觀 #20) echo Wilhelm closely — attribution risk. No ZH counterpart."

- surface_id: core-gua-yao
  file: packages/core/src/data/gua.ts
  code_locator: "field yao[6] ×64 = 384 strings (e.g. L17–22)"
  current_text: '"初九：潛龍勿用。" … "上六：龍戰于野，其血玄黃。" …'
  surface_class: core-data-gua
  render_context: "detail view 爻辭 / Line Texts (Chinese mode)"
  language_policy: canonical-anchor
  source_layer: received-text
  token_policy: preserve
  json_policy: localized-display
  script_exception_policy: "Traditional; delimiter inconsistency 「：」 vs 「，」; 无/無 both occur; preserve line-identity tokens"
  risk: high
  agentify_required: yes
  status: open
  verifier: "--core-data line-identity preservation (初九…上九 / 初六…上六)"
  notes: "爻辭 = received-text (Zhouyi line statements). Each prefixed with a line-identity token encoding position+yin/yang — load-bearing."

- surface_id: core-gua-yaoEn
  file: packages/core/src/data/gua.ts
  code_locator: "field yaoEn[6] ×64 = 384 strings (e.g. L25–30)"
  current_text: '"Hidden dragon. Do not act." "Dragon appearing in the field. It furthers one to see the great man." …'
  surface_class: core-data-gua
  render_context: "detail view English Line Texts (English mode, under \"Line N\" headers)"
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  json_policy: localized-display
  risk: high
  agentify_required: yes
  status: open
  verifier: "--core-data; --glossary Wilhelm idiom"
  notes: "English of yao. Line-identity token dropped (position via array index). Heavy Wilhelm idiom ('It furthers one to…','the great man','no blame')."

- surface_id: core-gua-gc
  file: packages/core/src/data/gua.ts
  code_locator: "field gc ×64 (injected by scripts/inject-guaci.ts)"
  current_text: '"元亨，利貞。" "元亨，利牝馬之貞。…" …'
  surface_class: core-data-gua
  render_context: "detail view 卦辭 section (all modes; dim classical anchor under Legge in en); cast reading panel when no lines move; cast/hexagram JSON + plain"
  language_policy: canonical-anchor
  source_layer: received-text
  token_policy: preserve
  json_policy: localized-display
  script_exception_policy: "Traditional; zh-Hans via audited toSimplified (incl. 卦辭/小象傳 supplement rows); 乾 exception holds"
  risk: high
  agentify_required: yes
  status: verified
  verifier: "--inventory-only; packages/core/src/__tests__/guaci.test.ts"
  notes: "卦辭 — the canonical judgment. AC-001 REOPENED for reading-depth v1 (AR-001 amended): enrichment sanctioned with these rows. Source: data-acquisition/guaci-xiaoxiang.json (ctext + wikisource cross-check)."

- surface_id: core-gua-gcEn
  file: packages/core/src/data/gua.ts
  code_locator: "field gcEn ×64 (injected by scripts/inject-guaci.ts)"
  current_text: '"Khien (represents) what is great and originating, penetrating, advantageous, correct and firm." …'
  surface_class: core-data-gua
  render_context: "detail view Judgment section (en mode); cast reading panel; cast/hexagram JSON + plain"
  language_policy: canonical-anchor
  source_layer: received-text
  token_policy: preserve
  json_policy: localized-display
  risk: medium
  agentify_required: no
  status: verified
  verifier: "--inventory-only; guaci.test.ts"
  notes: "Legge's public-domain judgment translation, quoted VERBATIM (parenthetical glosses kept). NOT interpretive-english — C-004 君子 harmonization does not rewrite quotations ('superior man' stays as Legge wrote it; attribution over harmonization)."

- surface_id: core-gua-yaoXiao
  file: packages/core/src/data/gua.ts
  code_locator: "field yaoXiao[6] ×64 = 384 strings (injected by scripts/inject-guaci.ts)"
  current_text: '"潛龍勿用，陽在下也。" "亢龍有悔，盈不可久也。" …'
  surface_class: core-data-gua
  render_context: "detail view — dim beneath each 爻辭 (all modes); hexagram JSON lineTexts"
  language_policy: canonical-anchor
  source_layer: commentary-wing
  token_policy: preserve
  json_policy: localized-display
  script_exception_policy: "Traditional; zh-Hans via audited toSimplified supplement (馴/貴/賤/瀆/辯/… rows); 繘 Ext-B retention"
  risk: high
  agentify_required: yes
  status: verified
  verifier: "--inventory-only; guaci.test.ts conversion coverage"
  notes: "小象傳 per-line commentary. AC-001 reopen companion to core-gua-gc."

- surface_id: core-gua-extra
  file: packages/core/src/data/gua.ts
  code_locator: "field extra (hexagrams 1-2 only): name/text/textEn"
  current_text: '"用九" "見群龍無首，吉。" / "用六" "利永貞。" + Legge textEn'
  surface_class: core-data-gua
  render_context: "cast reading panel + JSON/plain when all six lines move on hex 1/2; hexagram JSON"
  language_policy: canonical-anchor
  source_layer: received-text
  token_policy: preserve
  json_policy: localized-display
  risk: medium
  agentify_required: no
  status: verified
  verifier: "--inventory-only; guaci.test.ts"
  notes: "用九/用六 special statements — formerly the documented exclusion in the glossary; now carried OUTSIDE yao[6] as an optional field (yao stays 6 entries; line-identity invariant intact). textEn is verbatim Legge."

- surface_id: core-gua-doc-comment
  file: packages/core/src/data/gua.ts
  code_locator: "L3 /** 64 hexagrams with commentary in 5 styles */"
  current_text: "64 hexagrams with commentary in 5 styles"
  surface_class: core-data-gua
  render_context: "source comment only"
  language_policy: developer-only
  source_layer: docs
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "Not rendered. NOTE STYLES lists 6 incl 'st' but GUA has 5 commentary fields; 'st' is synthetic structure style."
```

## Group: core-data-trigrams  (`packages/core/src/data/trigrams.ts`)

```yaml
- surface_id: core-trigram-name
  file: packages/core/src/data/trigrams.ts
  code_locator: "TRIGRAMS[].n L4–11 (8)"
  current_text: '"坤" "震" "坎" "兌" "艮" "離" "巽" "乾"'
  surface_class: core-data-trigrams
  render_context: "trigram name in structure breakdown; reading style \"st\""
  language_policy: canonical-anchor
  source_layer: proper-name
  token_policy: preserve
  script_exception_policy: "Traditional; 兌→兑, 離→离 in zh-Hans; 乾 stays 乾"
  risk: medium
  agentify_required: yes
  status: open
  verifier: "--core-data; --simplified"
  notes: "Bagua names, indexed 000→111 (not King Wen). English = img."

- surface_id: core-trigram-img
  file: packages/core/src/data/trigrams.ts
  code_locator: "TRIGRAMS[].img L4–11 (8)"
  current_text: '"earth" "thunder" "water" "lake" "mountain" "fire" "wind" "heaven"'
  surface_class: core-data-trigrams
  render_context: "trigram natural-image label in structure breakdown"
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  risk: low
  agentify_required: no
  status: open
  verifier: "--core-data; --terminal (zh uses TRIGRAM_IMAGE_ZH 天/地/雷/水/山/風/火/澤)"
  notes: "Bagua attributes. zh trigram structure line maps to Chinese image via detail-renderer TRIGRAM_IMAGE_ZH."

- surface_id: core-trigram-sym
  file: packages/core/src/data/trigrams.ts
  code_locator: "TRIGRAMS[].sym L4–11 (8)"
  current_text: '"☷" "☳" "☵" "☱" "☶" "☲" "☴" "☰" (U+2630–U+2637)'
  surface_class: runtime-symbols
  render_context: "trigram glyph in structure breakdown"
  language_policy: canonical-anchor
  source_layer: machine-token
  token_policy: preserve
  risk: low
  agentify_required: no
  status: open
  verifier: "--core-data unicode check"
  notes: "Trigram codepoints. USER-FACING visible symbol, preserve (C-001 fix: was not-user-facing)."

- surface_id: core-derived-labels-en
  file: packages/core/src/data/trigrams.ts
  code_locator: "DERIVED_LABELS L17–23"
  current_text: '"互卦 (hidden within)" "錯卦 (polarity)" "綜卦 (mirror)" "之卦 (becoming)" "對角卦 (diagonal)"'
  surface_class: core-format
  render_context: "derived-hexagram label (default branch of formatDerived ~50%)"
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  script_exception_policy: "MIXED: Traditional 卦-name + English gloss; no Chinese-free path exists"
  risk: high
  agentify_required: yes
  status: open
  verifier: "--core-data; --terminal English-mode-no-CJK"
  notes: "Even the 'English' set leads with Traditional 互卦/錯卦/綜卦/之卦/對角卦. Bilingual leakage."

- surface_id: core-derived-labels-cn
  file: packages/core/src/data/trigrams.ts
  code_locator: "DERIVED_LABELS_CN L25–32 (+ comment L25)"
  current_text: '"互卦 (潜藏轨迹)" "錯卦 (矛盾调和)" "綜卦 (表里)" "之卦 (所往)" "對角卦 (極反)"'
  surface_class: core-format
  render_context: "derived-hexagram label, Chinese variant (~50% via random byte)"
  language_policy: translate
  source_layer: commentary-wing
  token_policy: preserve
  script_exception_policy: "INCONSISTENT scripts: Traditional terms; Simplified parentheticals (潜/轨/迹, 调; 里) except 極反 Traditional, 所往 neutral"
  risk: high
  agentify_required: yes
  status: open
  verifier: "--simplified script-consistency; --core-data"
  notes: "来知德 framework labels. Selected by random byte, NOT by language — bilingual leakage. Mixed Trad/Simp within strings."

- surface_id: core-styles-tokens
  file: packages/core/src/data/trigrams.ts
  code_locator: "STYLES L14, QUOTE_STYLES L15"
  current_text: '["dx","tu","en","te","w","st"] / ["dx","tu","en","te","w"]'
  surface_class: core-format
  render_context: "internal style enum keys"
  language_policy: developer-only
  source_layer: machine-token
  token_policy: preserve
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "Not display text. 'st' has no backing GUA field (synthetic structure style)."
```

## Group: core-data-sequence  (`packages/core/src/data/sequence.ts`)

```yaml
- surface_id: core-sequence-xu
  file: packages/core/src/data/sequence.ts
  code_locator: "SEQUENCE[].xu ×64 (generated by scripts/generate-sequence.ts)"
  current_text: '"有天地，然後萬物生焉。" "盈天地之間者唯萬物，故受之以《屯》。" …'
  surface_class: core-data-sequence
  render_context: "detail view closing 序卦 section (classical in ALL modes — Legge's xu translation is paragraph-segmented, not per-hexagram, so en quotes the canonical text dim)"
  language_policy: canonical-anchor
  source_layer: commentary-wing
  token_policy: preserve
  json_policy: not-json
  script_exception_policy: "Traditional; zh-Hans via audited toSimplified (序卦/雜卦 supplement rows: 間/輕/飭/飾/盡/爛/誅/稺; 著 deliberately identity in 蒙雜而著)"
  risk: medium
  agentify_required: no
  status: verified
  verifier: "--inventory-only; packages/core/src/__tests__/guaci.test.ts SEQUENCE block"
  notes: "序卦傳 — where the hexagram sits in the sequence. Source: data-acquisition/xugua-zagua.json."

- surface_id: core-sequence-za
  file: packages/core/src/data/sequence.ts
  code_locator: "SEQUENCE[].za ×64 (pair-shared lines)"
  current_text: '"《乾》剛《坤》柔。" "《屯》見而不失其居。" …'
  surface_class: core-data-sequence
  render_context: "detail view closing 雜卦 section (zh modes)"
  language_policy: canonical-anchor
  source_layer: commentary-wing
  token_policy: preserve
  json_policy: not-json
  risk: medium
  agentify_required: no
  status: verified
  verifier: "--inventory-only; guaci.test.ts SEQUENCE block"
  notes: "雜卦傳 epigram, keyed by 綜 pair; each hexagram receives its pair's line."

- surface_id: core-sequence-zaEn
  file: packages/core/src/data/sequence.ts
  code_locator: "SEQUENCE[].zaEn ×64"
  current_text: '"Strength in Khien, weakness in Khwan we find." …'
  surface_class: core-data-sequence
  render_context: "detail view closing 雜卦 section (en mode)"
  language_policy: canonical-anchor
  source_layer: commentary-wing
  token_policy: preserve
  json_policy: not-json
  risk: low
  agentify_required: no
  status: verified
  verifier: "--inventory-only; guaci.test.ts SEQUENCE block (incl. Legge pair-mistag fixups for 蹇/革)"
  notes: "Legge's rhymed 雜卦 couplets, pair-aligned and quoted verbatim. Two legge-cleaned pair mistags ([41]→39 蹇, [50,51]→[50,49] 革) corrected in the generator."
```

## Group: runtime-symbols (large glyphs)  (`packages/core/src/data/large-glyphs.ts`)

```yaml
- surface_id: core-large-glyphs
  file: packages/core/src/data/large-glyphs.ts
  code_locator: "LARGE_GLYPHS (71 char keys × 3 fonts × 3 sizes); banner L1–7"
  current_text: "braille-pattern bitmap art (U+2800 block); char keys are the 71 unique CJK chars of the 64 names"
  surface_class: runtime-symbols
  render_context: "large braille-rendered hexagram-name glyph (cast reveal, detail header)"
  language_policy: canonical-anchor
  source_layer: machine-token
  token_policy: preserve
  script_exception_policy: "auto-generated; keys include simplified-style 无 matching gua.ts"
  risk: low
  agentify_required: no
  status: exempted
  verifier: "--inventory-only field-class coverage (file represented)"
  notes: "Auto-generated by scripts/generate-glyphs.ts. Font glosses 楷体/隶变/黑体 are Simplified, dev-only. Bitmap of the Chinese name, not translatable text."

- surface_id: core-simplify-map
  file: packages/core/src/i18n/simplify.ts
  code_locator: "SIMPLIFIED_MAP (~270 entries) + toSimplified() + SIMPLIFIED_EXCEPTIONS"
  current_text: 'audited Traditional→Simplified table (傳→传 … 龍→龙); 乾 deliberately ABSENT (stays 乾, not 干)'
  surface_class: runtime-symbols
  render_context: "the zh-Hans conversion mechanism; consumed by detail-renderer zh() (AC-006). Values reach screen."
  language_policy: developer-only
  source_layer: machine-token
  token_policy: preserve
  json_policy: not-json
  script_exception_policy: "AC-006 proven path (Agentify C-002 audited); 乾 canonical exception enforced; classical false-friends resolved (後→后, 雲→云, 麗/離 distinct, 係/繫→系, 於→于, 穀→谷); 藉 not converted"
  locale_test: "scripts/verify-language-surfaces.ts --simplified (residue + exceptions + consumer-side)"
  risk: high
  agentify_required: yes
  status: audited
  verifier: "--simplified"
  notes: "NEW source file (AC-001 reopen: added). Replaces the naive 96-char detail-renderer map. Rare Ext-B/C simplified codepoints (㧑/𦈡/𬙊/𫗧) for obscure line-text chars may render as tofu in some fonts — correctness over rendering."
```

## Group: core-format / service  (`format/*.ts`, `service/display-select.ts`, `identify/structure.ts`)

```yaml
- surface_id: core-reading-headline
  file: packages/core/src/format/reading.ts
  code_locator: "L34 formatReading template"
  current_text: '`${g.u} ${g.n} (${g.p}) — ${middle}`'
  surface_class: core-format
  render_context: "reading headline (daily/non-derived) and hook output"
  language_policy: translate
  source_layer: product-ui
  token_policy: translate
  risk: high
  agentify_required: yes
  status: open
  verifier: "--terminal; --core-data"
  notes: "g.n (Chinese name) ALWAYS shown regardless of language; ename never used. middle=g[style]; style dx/tu => Chinese. No DisplayLanguage param. Em-dash glue."

- surface_id: core-reading-becoming-suffix
  file: packages/core/src/format/reading.ts
  code_locator: "L36–39"
  current_text: '` → ${t.u} ${t.n} [${cast.changingPositions.join(",")}]`'
  surface_class: core-format
  render_context: "reading transformation suffix"
  language_policy: translate
  source_layer: product-ui
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "t.n Chinese name unconditional. Arrow/brackets/comma = machine glue."

- surface_id: core-getrandomquotestyle
  file: packages/core/src/format/reading.ts
  code_locator: "L8–14 getRandomQuoteStyle"
  current_text: "(no literal; returns QUOTE_STYLES[byte%5])"
  surface_class: runtime-symbols
  render_context: "selects derived-quote style (dx/tu/en/te/w)"
  language_policy: not-user-facing
  source_layer: machine-token
  risk: high
  agentify_required: no
  status: open
  verifier: "--terminal bilingual-leakage"
  notes: "40% chance Chinese (dx/tu) per derived quote, no language gate — primary leakage engine."

- surface_id: core-derived-templates
  file: packages/core/src/format/derived.ts
  code_locator: "L17–49 formatDerived"
  current_text: '"自綜" / "self-mirroring" / "綜卦 (…)" / "错综同象 …" / "對角卦 = 錯卦 (自綜) …" / "對角卦 = ${g.n} (自返) …" / "${label} ${g.u} ${g.n} (${g.p}) — …"'
  surface_class: core-format
  render_context: "derived-hexagram reading lines"
  language_policy: translate
  source_layer: product-ui
  token_policy: preserve
  script_exception_policy: "hardcoded Traditional/Simplified terms; 错综同象 is Simplified, 自綜/自返/對角卦/錯卦 Traditional"
  risk: high
  agentify_required: yes
  status: open
  verifier: "--terminal English-mode-no-CJK; --simplified"
  notes: "Multiple hardcoded Chinese terms with no English variant and no language gate. 50% CN coin flip for tag (自綜 vs self-mirroring). g.n unconditional. Quote 40% Chinese."

- surface_id: core-displayselect
  file: packages/core/src/service/display-select.ts
  code_locator: "L18–47 selectDisplay; style literals L25,30–44"
  current_text: '"dx","tu","en","te","w","st","nuclear","polarity","mirror","becoming","diagonal"'
  surface_class: runtime-symbols
  render_context: "top-level cascade deciding what to display"
  language_policy: developer-only
  source_layer: machine-token
  token_policy: preserve
  risk: high
  agentify_required: no
  status: open
  verifier: "--terminal; --core-data"
  notes: "NO DisplayLanguage param. First-of-day ALWAYS 'dx' (Chinese). Random cascade surfaces Chinese ~2/6 reading branches + all derived. Style keys decide corpus language."

- surface_id: core-structure-formattrigrams
  file: packages/core/src/identify/structure.ts
  code_locator: "L30–36 formatTrigrams"
  current_text: '`${s.upper.sym} ${s.upper.n} ${s.upper.img} / ${s.lower.sym} ${s.lower.n} ${s.lower.img}`'
  surface_class: core-data-trigrams
  render_context: "'st' structure style body, e.g. '☰ 乾 heaven / ☲ 離 fire'"
  language_policy: translate
  source_layer: product-ui
  risk: high
  agentify_required: yes
  status: open
  verifier: "--terminal; --core-data"
  notes: "Inherently bilingual: Chinese trigram name + English image, no language gate. ' / ' joiner neutral."

- surface_id: core-random-tape-error
  file: packages/core/src/random.ts
  code_locator: "L60–63 TapeRandomSource.nextBytes"
  current_text: '`TapeRandomSource exhausted: requested ${count} bytes at offset ${this.offset}, tape length ${this.tape.length}`'
  surface_class: runtime-symbols
  render_context: "thrown Error (test/replay only)"
  language_policy: developer-only
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "Test double; never in production. English OK."

- surface_id: core-derivation-docs
  file: packages/core/src/derivation/{diagonal,locked-pairs,mirror,nuclear,polarity}.ts
  code_locator: "JSDoc only"
  current_text: '對角卦 / 错综同象 / 綜卦 / 互卦 / 錯卦 (in comments)'
  surface_class: runtime-symbols
  render_context: "developer doc comments; pure math modules emit no text"
  language_policy: developer-only
  source_layer: docs
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "No runtime literals reach render."

- surface_id: core-search-assumptions
  file: packages/core/src/search.ts
  code_locator: "L25–71 searchHexagrams/normalize"
  current_text: '(regex /[̀-ͯ]/g, "NFD"; no UI literals)'
  surface_class: runtime-symbols
  render_context: "search engine; returns Hexagram[]; caller picks display field"
  language_policy: not-user-facing
  source_layer: machine-token
  risk: medium
  agentify_required: no
  status: open
  verifier: "--core-data pinyin/accent normalization"
  notes: "Matches over n/p/ename/kw. Display-language of results decided by caller. NFD accent-insensitive."
```

---

## Group: terminal-home  (`scenes/home/*`)

```yaml
- surface_id: term-home-title
  file: packages/terminal/src/scenes/home/home-scene.ts
  code_locator: "L52"
  current_text: "☯  I Ching"
  surface_class: terminal-home
  render_context: "app title above menu"
  language_policy: canonical-anchor
  source_layer: proper-name
  token_policy: preserve
  risk: low
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "Brand name + ☯ glyph."

- surface_id: term-home-menu
  file: packages/terminal/src/scenes/home/home-scene.ts
  code_locator: "L59–64 items[].label"
  current_text: '"Cast" "Play"(dev) "Today"(cast-exists) "Dictionary" "Journal" "Settings" "Quit"'
  surface_class: terminal-home
  render_context: "home menu items '[k]  Label'; key letters are accelerators"
  language_policy: translate
  source_layer: product-ui
  token_policy: translate
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "Localized via catalog (menu.*). 'Play' is dev-mode-only; 'Today' (menu.today, [t] → replay) renders only when a cast exists for the day."

- surface_id: term-home-status
  file: packages/terminal/src/scenes/home/home-scene.ts
  code_locator: "L79,86,91"
  current_text: '"Today: ${gua.u} ${gua.n} (${gua.p})" / "→ ${bg.u} ${bg.n}" / "No cast today"'
  surface_class: terminal-home
  render_context: "today's-cast status lines + empty state"
  language_policy: translate
  source_layer: product-ui
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "'Today:' / 'No cast today' English; gua.n always Chinese (not language-switched)."

- surface_id: term-home-taijitu
  file: packages/terminal/src/scenes/home/taijitu-render.ts
  code_locator: "L82"
  current_text: "braille glyph U+2800..U+28FF (computed)"
  surface_class: runtime-symbols
  render_context: "rotating yin-yang figure"
  language_policy: not-user-facing
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "Graphical. 'dots'/'dense' style tokens dev-only."
```

## Group: terminal-cast  (`scenes/cast/*`, `scenes/intention/*`, `scenes/toss/*`)

```yaml
- surface_id: term-intention-prompt
  file: packages/terminal/src/scenes/intention/intention-scene.ts
  code_locator: "L46"
  current_text: "問"
  surface_class: terminal-intention
  render_context: "large prompt glyph above intention input"
  language_policy: canonical-anchor
  source_layer: product-ui
  token_policy: preserve
  script_exception_policy: "問 is identical Trad/Simp; hardcoded regardless of language"
  risk: high
  agentify_required: yes
  status: open
  verifier: "--terminal English-mode policy (is 問 an intended canonical anchor in EN?)"
  notes: "The ONLY intention prompt. English users see 問. Decide: canonical-anchor vs localized."

- surface_id: term-intention-hint
  file: packages/terminal/src/scenes/intention/intention-scene.ts
  code_locator: "L58"
  current_text: "[enter] confirm  ·  [esc] back"
  surface_class: terminal-intention
  render_context: "footer hint"
  language_policy: translate
  source_layer: product-ui
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "English. [esc] back verb recurs across scenes (not a shared constant)."

- surface_id: term-toss-footers
  file: packages/terminal/src/scenes/toss/toss-scene.ts
  code_locator: "L99,101"
  current_text: '"[space] toss  ·  [esc] back" / "[space] reveal  ·  [esc] discard"'
  surface_class: terminal-toss
  render_context: "toss footers (waiting / complete)"
  language_policy: translate
  source_layer: product-ui
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "English. Ritual verbs toss/reveal/discard."

- surface_id: term-toss-coin-glyphs
  file: packages/terminal/src/scenes/toss/coin-physics.ts
  code_locator: "L9,10,84"
  current_text: '"◉" "○" "◑" "│" "◐" (FLIP/SPIN frames, settled faces)'
  surface_class: runtime-symbols
  render_context: "physics coins flying/landing"
  language_policy: not-user-facing
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "Graphical. ◉ heads / ○ tails."

- surface_id: term-cast-prompts
  file: packages/terminal/src/scenes/cast/cast-scene.ts
  code_locator: "L270–274"
  current_text: '"[enter] explore  ·  [esc] back" / "[←→] switch  ·  [enter] detail  ·  [esc] back" / "[enter] detail  ·  [esc] back"'
  surface_class: terminal-cast
  render_context: "cast footer prompts (pre/with/without becoming)"
  language_policy: translate
  source_layer: product-ui
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "English. Verbs explore/switch/detail/back."

- surface_id: term-cast-chrome-counters
  file: packages/terminal/src/scenes/cast/ritual-chrome.ts
  code_locator: "L31,33 formatLineCounter"
  current_text: '"line ${i+1}/${total}" / "${base}  ·  round ${r+1}/${total}"'
  surface_class: terminal-global-chrome
  render_context: "shared position counter (cast/toss/yarrow), e.g. 'line 1/6  ·  round 2/3'"
  language_policy: translate
  source_layer: product-ui
  risk: high
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "Words 'line'/'round' hardcoded English. SHARED single source of truth. Yarrow is the only round-counter caller."

- surface_id: term-cast-reveal-title
  file: packages/terminal/src/scenes/cast/reveal-renderer.ts
  code_locator: "L46–58,124–125"
  current_text: '"${gua.u} ${gua.n}" / "${gua.p}" / "${gua.ename}" / "${structure.upper.sym} above ${structure.lower.sym}" / "→ ${gua.u} ${gua.n}"'
  surface_class: terminal-cast
  render_context: "reveal title block (primary + becoming)"
  language_policy: translate
  source_layer: product-ui
  risk: high
  agentify_required: yes
  status: open
  verifier: "--terminal; --core-data"
  notes: "Hardcodes English ' above ' connective; gua.n Chinese always shown. ename only in glyph mode. '…' ellipsis truncation."

- surface_id: term-cast-line-glyphs
  file: packages/terminal/src/scenes/cast/{line,hexagram,morph,coin,glyph,right-hex}-renderer.ts
  code_locator: "GLYPHS.* references"
  current_text: '"━━━…" yang/yin frames; "○"/"×" gutter markers; "◉"/"◎" inline; coin/morph frames; braille name glyph'
  surface_class: runtime-symbols
  render_context: "hexagram line/coin/glyph rendering"
  language_policy: not-user-facing
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "All from shared glyphs.ts. Encode ritual meaning (old yang ○, old yin ×) as symbols, no words. Large glyph built from gua.n (Chinese)."

- surface_id: term-cast-internal-tokens
  file: packages/terminal/src/scenes/cast/model.ts, toss-scene.ts, home-scene.ts
  code_locator: "phase/layout/focus unions; SceneSignal type tags"
  current_text: '"idle"/"spin"/"land"/"collapse"/"done"/"centered"/"splitting"/"side-by-side"/"primary"/"becoming"; "startCast"/"openDictionary"/… '
  surface_class: runtime-symbols
  render_context: "internal state-machine + signal discriminants, never rendered"
  language_policy: not-user-facing
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "Internal enums/signals."
```

## Group: terminal-cast (yarrow)  (`scenes/yarrow/*`, `animation/yarrow-presets.ts`)

```yaml
- surface_id: term-yarrow-footers
  file: packages/terminal/src/scenes/yarrow/yarrow-scene.ts
  code_locator: "L98–103"
  current_text: '"[space] receive the reading  ·  [esc] discard" / "[space] resume  ·  [→] step  ·  [s] skip  ·  [esc] back" / "[space] pause  ·  [f] speed  ·  [s] skip  ·  [esc] back" / "  ·  ${speed}×"'
  surface_class: terminal-cast
  render_context: "auto/guided yarrow footers + speed badge"
  language_policy: translate
  source_layer: product-ui
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "English. Verbs receive/discard/resume/step/skip/pause/speed. '×' (U+00D7) speed multiplier."

- surface_id: term-yarrow-manual-prompts
  file: packages/terminal/src/scenes/yarrow/yarrow-manual-scene.ts
  code_locator: "L286–298"
  current_text: '"[space] receive the reading  ·  [esc] discard" / "press [space] to begin cutting  ·  [esc] back" / "press [space] to cut" / "cut around here" / ""'
  surface_class: terminal-cast
  render_context: "manual 18-cut footer prompts by phase"
  language_policy: translate
  source_layer: product-ui
  risk: medium
  agentify_required: yes
  status: open
  verifier: "--terminal"
  notes: "English ritual prompts. 'cut around here' deliberately approximate (user authors window, RNG picks k) — preserve nuance in translation."

- surface_id: term-yarrow-line-values
  file: packages/terminal/src/scenes/yarrow/yarrow-timeline.ts
  code_locator: "L32–35 LINE_VALUE_NAMES"
  current_text: '"old yin"(6) "young yang"(7) "young yin"(8) "old yang"(9)'
  surface_class: terminal-cast
  render_context: "fuse caption line-value name"
  language_policy: canonical-anchor
  source_layer: interpretive-english
  token_policy: translate
  risk: high
  agentify_required: yes
  status: open
  verifier: "--glossary ritual line-value terms; --terminal"
  notes: "HIGH: old/young vs moving/greater-lesser not standardized. CN canonical 老陰/少陽/少陰/老陽. Decide anchor + gloss; keep all 4 consistent."

- surface_id: term-yarrow-captions
  file: packages/terminal/src/scenes/yarrow/yarrow-timeline.ts
  code_locator: "L47–62 RoundCaptions + buildFuseCaption + nextLabel + meaning"
  current_text: '"Round ${n} · ${count} stalks" / "Cut at k=${l} · heaps ${l} | ${r}" / "One aside · heaps ${l} | ${r}" / "Count each heap by fours." / "1 + ${a} + ${b} = ${s} (${meaning})" / "Carry ${rem} → ${nextLabel}" / "Remaining ${rem} ÷ 4 = ${v} · ${name}" / "few = 3" / "many = 2" / "fuse" / "round ${n}"'
  surface_class: terminal-cast
  render_context: "teach-once per-beat captions"
  language_policy: translate
  source_layer: product-ui
  token_policy: translate
  risk: high
  agentify_required: yes
  status: open
  verifier: "--terminal; --glossary ritual terms (stalks/heaps/set-aside/carry/fuse)"
  notes: "English ritual narration. Casing/punctuation/middot-spacing drift noted. 'k=' exposes code var. Numbers raw-interpolated (no locale grouping/plural)."

- surface_id: term-yarrow-field-labels
  file: packages/terminal/src/scenes/yarrow/field-renderer.ts
  code_locator: "L327,338,413,430"
  current_text: '"${count} stalks" / String(count) / "set aside ${n}" / "│" "╞" "╡" "▌"'
  surface_class: terminal-cast
  render_context: "bar/count/remainder/set-aside display + ritual glyphs"
  language_policy: translate
  source_layer: product-ui
  risk: high
  agentify_required: yes
  status: open
  verifier: "--terminal; --glossary (set aside / stalks)"
  notes: "'stalks'/'set aside' English; bare numbers via String(n) not locale-aware. Glyphs │╞╡▌ language-neutral."

- surface_id: term-yarrow-internal
  file: packages/terminal/src/scenes/yarrow/model.ts, yarrow-manual-scene.ts, animation/yarrow-presets.ts
  code_locator: "YarrowBeat/Phase enums; throw Error guards; RitualDetail/MotionPreset keys"
  current_text: '"idle"/"gather"/"divide"/"takeOne"/"count"/"tally"/"carry"/"fuse"/"done"; "appendLine: transcript already complete (6 lines)" etc.; "expanded"/"summarized"/"stepped"; "default"/"deep"/"brisk"/"reduced"'
  surface_class: runtime-symbols
  render_context: "internal beat/phase enums + dev-only invariant errors + timing config"
  language_policy: developer-only
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "yarrow-presets.ts has zero user-facing strings. Model errors are invariant guards. MotionPreset NOT a settings chip currently."
```

## Group: terminal-dict  (`scenes/dict/*`)

```yaml
- surface_id: term-dict-browse-chrome
  file: packages/terminal/src/scenes/dict/browse-renderer.ts
  code_locator: "L41,51,52,158,160,161"
  current_text: '"Search: " / "I Ching Dictionary" / "[/] search" / "${n} hexagrams" / "[↑↓] navigate  ·  [enter] open  ·  [esc] clear search" / "[↑↓] navigate  ·  [enter] open  ·  [/] search  ·  [esc] back"'
  surface_class: terminal-dict
  render_context: "browse header/footer/count"
  language_policy: translate
  source_layer: product-ui
  risk: low
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "English, NO language branch. Rows always show CN name + pinyin + EN name simultaneously. '…' truncation; '#1A2030' hardcoded selected-row bg."

- surface_id: term-dict-detail-sections-en
  file: packages/terminal/src/scenes/dict/detail-renderer.ts
  code_locator: "L210–211,226–228,245,251,267,286–287,302,304"
  current_text: '"above" / "Image" / "Judgment" / "Wilhelm-inspired" / "Line Texts" / "Line ${n}" / "Derived" / "Locked pair: ${ename}" / "Cast ${n} time(s) (last: ${date})" / "No history"'
  surface_class: terminal-dict
  render_context: "SYNTHETIC detail section/line labels (English mode, language===\"en\")"
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  risk: medium
  agentify_required: yes
  status: open
  verifier: "--terminal English-mode coverage; --glossary (Wilhelm)"
  notes: "Generated labels, not corpus. 'Wilhelm' proper name — attribution. Plural 'time(s)' handled inline."

- surface_id: term-dict-detail-sections-zh
  file: packages/terminal/src/scenes/dict/detail-renderer.ts
  code_locator: "L212,231,232,245,267,288,303,304"
  current_text: '"上"/"下" / "大象傳" / "彖傳" / "爻辭" / "衍卦" / "鎖定對卦" / "已占 ${n} 次 (最近: ${date})" / "未有占記"'
  surface_class: terminal-dict
  render_context: "SYNTHETIC detail labels (Chinese mode); passed through zh()"
  language_policy: canonical-anchor
  source_layer: commentary-wing
  token_policy: preserve
  script_exception_policy: "Traditional source; zh-Hans via SIMPLIFIED_CHARS (傳→传, 辭→辞, 鎖→锁, 對→对, 記→记); 衍卦 unchanged"
  risk: medium
  agentify_required: yes
  status: open
  verifier: "--terminal; --simplified residue + canonical-exception"
  notes: "Wilhelm section OMITTED in zh. 'Line N' header has NO zh equivalent. Field-divergence: EN Judgment=te, ZH 彖傳=tu."

- surface_id: term-dict-detail-oracle-sections
  file: packages/terminal/src/scenes/dict/detail-renderer.ts
  code_locator: "buildContentLines — 卦辭/序卦/雜卦 section labels + en equivalents"
  current_text: '"Judgment" / "卦辭" / "Tuan (Commentary on the Decision)" / "Xugua (Sequence of the Hexagrams)" / "序卦" / "Zagua (Miscellaneous Notes)" / "雜卦"'
  surface_class: terminal-dict
  render_context: "SYNTHETIC labels for the oracle-text sections added by reading-depth v1: 卦辭 first section, 序卦/雜卦 closing section; zh labels through zh()"
  language_policy: canonical-anchor
  source_layer: commentary-wing
  token_policy: preserve
  script_exception_policy: "zh-Hans via toSimplified (辭→辞, 雜→杂); EN names per docs/language-glossary.md Ten Wings table"
  risk: medium
  agentify_required: no
  status: verified
  verifier: "--inventory-only; packages/terminal/src/__tests__/detail-renderer.test.ts"
  notes: "Resolves the field-divergence noted on term-dict-detail-sections-en: EN 'Judgment' now labels the actual 卦辭 (gcEn); the te section is relabeled 'Tuan (Commentary on the Decision)' per glossary."

- surface_id: term-dict-detail-footer
  file: packages/terminal/src/scenes/dict/detail-renderer.ts
  code_locator: "L392,393,396–398"
  current_text: '"[↑↓] select  ·  [enter] open  ·  [tab] scroll  ·  [esc] back" / "[↑↓] scroll  ·  [tab] derived  ·  [enter] open  ·  [esc] back" / "${page}/${total}"'
  surface_class: terminal-dict
  render_context: "detail footer keybindings (NOT language-branched — always English)"
  language_policy: translate
  source_layer: product-ui
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal (footer not localized even in zh — bug)"
  notes: "renderFooter ignores language. Always English even in zh modes."

- surface_id: term-dict-derived-labels
  file: packages/terminal/src/scenes/dict/detail-model.ts
  code_locator: "L62–87 derivedLinks label/labelCn"
  current_text: '"Nuclear"/"互卦" "Polarity"/"錯卦" "Mirror"/"綜卦" "Diagonal"/"對角"'
  surface_class: terminal-dict
  render_context: "derived-link row labels (EN label vs CN labelCn)"
  language_policy: translate
  source_layer: interpretive-english
  token_policy: translate
  script_exception_policy: "labelCn Traditional; zh-Hans 錯→错, 綜→综, 對→对; 互卦 unchanged"
  risk: low
  agentify_required: no
  status: open
  verifier: "--terminal; --simplified"
  notes: "Already has EN+CN pair; chosen by language. Good model to generalize."

- surface_id: term-dict-zh-maps
  file: packages/terminal/src/scenes/dict/detail-renderer.ts
  code_locator: "L29–125 SIMPLIFIED_CHARS (96); L127–136 TRIGRAM_IMAGE_ZH"
  current_text: 'SIMPLIFIED_CHARS {兌:兑,…,龜:龟}; TRIGRAM_IMAGE_ZH {乾:天,坤:地,震:雷,坎:水,艮:山,巽:風,離:火,兌:澤}'
  surface_class: runtime-symbols
  render_context: "zh() conversion table + trigram image map; values reach screen"
  language_policy: developer-only
  source_layer: machine-token
  token_policy: preserve
  script_exception_policy: "THE zh-Hans mechanism — partial 96-char map; non-mapped chars leak Traditional. AC-006 core concern."
  risk: high
  agentify_required: yes
  status: open
  verifier: "--simplified coverage + leakage; --self-test"
  notes: "Naive per-char substitution, NOT real translation. 乾 correctly absent (no 乾→干). Coverage gaps = Traditional residue in zh-Hans."
```

## Group: terminal-journal  (`scenes/journal/*`)

```yaml
- surface_id: term-journal-chrome
  file: packages/terminal/src/scenes/journal/journal-scene.ts
  code_locator: "L39,43,52,120"
  current_text: '"Journal" / "${n} readings" / "No readings yet" / "[enter] view · [n] note · [g] detail · [/] search · [p] patterns · [esc] back" (catalog: verb.note/verb.patterns, journal.noteMarker/journal.notePrompt, journal.patterns.*)'
  surface_class: terminal-journal
  render_context: "journal title/count/empty-state/footer + note input + patterns pane (all via tr())"
  language_policy: translate
  source_layer: product-ui
  risk: low
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "English, NO language branch. Distinct empty state from detail 'No history'."

- surface_id: term-journal-row-chrome
  file: packages/terminal/src/scenes/journal/journal-scene.ts
  code_locator: "L83,85,92–104,114"
  current_text: '" → " / " [${positions}]" / "“…”" curly quotes / "…" / " > " cursor / "${i}/${n} (${pct}%)"'
  surface_class: runtime-symbols
  render_context: "row glue (arrow/brackets/quotes/cursor/scroll indicator)"
  language_policy: not-user-facing
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "Language-neutral chrome wrapping data + user intention."

- surface_id: term-journal-detail-preview
  file: packages/terminal/src/scenes/journal/journal-scene.ts
  code_locator: "L131–134"
  current_text: "gua.en (English Image of selected entry)"
  surface_class: terminal-journal
  render_context: "dimmed preview above footer"
  language_policy: translate
  source_layer: interpretive-english
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal (hardcoded English regardless of language)"
  notes: "Comment: 'Show English image'. No DisplayLanguage — always EN."
```

## Group: terminal-settings  (`scenes/settings/*`)

```yaml
- surface_id: term-settings-chrome
  file: packages/terminal/src/scenes/settings/settings-scene.ts
  code_locator: "L185,242,252; row prefix L218; chip wrap L226"
  current_text: '"Settings" / "[↑↓] setting  ·  [←→] option  ·  [esc] save & back" / "Preview:" / "> " / "[${opt}]"'
  surface_class: terminal-settings
  render_context: "settings title/footer/preview label"
  language_policy: translate
  source_layer: product-ui
  risk: low
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "Settings UI itself always English even though it controls language."

- surface_id: term-settings-row-labels
  file: packages/terminal/src/scenes/settings/settings-scene.ts
  code_locator: "L103–109"
  current_text: '"Theme" "Language" "Taijitu" "Glyph Animation" "Font" "Cast Method" "Cast Mode"'
  surface_class: terminal-settings
  render_context: "setting row labels"
  language_policy: translate
  source_layer: product-ui
  risk: low
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "English. 'Taijitu' romanized proper name. Option chips: display-label catalog layer per term-settings-option-chips (font/castMethod/castMode/taijitu/anim); theme chips verbatim per term-theme-names deferral; language chips are endonym badges per term-settings-lang-options. Stored tokens preserved everywhere."

- surface_id: term-settings-lang-options
  file: packages/terminal/src/scenes/settings/settings-scene.ts
  code_locator: "L25–30 LANGUAGE_OPTIONS/LANGUAGE_LABELS; L104"
  current_text: 'LANGUAGE_OPTIONS=["en","zh-Hant","zh-Hans"]; LANGUAGE_LABELS={en:"EN","zh-Hant":"繁","zh-Hans":"简"} → chips render "EN 繁 简"'
  surface_class: terminal-settings
  render_context: "language selector option chips"
  language_policy: canonical-anchor
  source_layer: product-ui
  token_policy: alias-only
  risk: high
  agentify_required: no
  status: open
  verifier: "--policy default-order EN->繁->简; --terminal"
  notes: "Order matches spec EN->繁->简. Labels are abbreviations EN/繁/简 (not English/繁體/简体). Drives DisplayLanguage everywhere."

- surface_id: term-settings-option-chips
  file: packages/terminal/src/i18n/option-labels.ts
  code_locator: "OPTION_LABELS (token-keyed); settings-scene render loop derives labels per token"
  current_text: 'font kaiti/libian/heiti → 楷體/隸變/黑體 (楷体/隶变/黑体); castMethod coin/yarrow → 銅錢 (coin)/蓍草 (yarrow) (铜钱 (coin)); castMode auto/manual → 自動/手動 (自动/手动); taijitu dots/dense → 點陣/密實 (点阵/密实); anim noise/dots/radial/sand → 噪點/點陣/放射/沙化 (噪点/点阵/放射/沙化)'
  surface_class: terminal-settings
  render_context: "settings option-value chips — display labels derived at render; stored tokens preserved"
  language_policy: translate
  source_layer: product-ui
  token_policy: preserve
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal (option-label coverage); --policy"
  notes: "Display-label catalog layer per glossary §Settings option-chip display labels — labels never mutate stored tokens; NO input aliases (config set + hand-edit stay canonical-only). 點陣 ratified once for BOTH taijitu.dots and anim.dots; 噪點 = noise (transposition hazard). Theme chips excluded — deferred per term-theme-names. Language chips excluded — endonym badges per term-settings-lang-options. zh-Hans authored explicitly, not derived."

- surface_id: term-settings-preview-char
  file: packages/terminal/src/scenes/settings/settings-scene.ts
  code_locator: "L53 PREVIEW_CHAR"
  current_text: "乾"
  surface_class: runtime-symbols
  render_context: "fixed sample glyph for glyph/font/anim preview"
  language_policy: canonical-anchor
  source_layer: received-text
  token_policy: preserve
  risk: low
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "Always Traditional 乾; not passed through zh()."
```

## Group: terminal-global-chrome / shared  (`glyphs.ts`, widgets, theme, scene infra)

```yaml
- surface_id: term-glyphs-shared
  file: packages/terminal/src/glyphs.ts
  code_locator: "L4–61 GLYPHS + SPLIT_ARROW"
  current_text: '◌ coinIdle; ◴◷◶◵ spin; ● heads/○ tails; ━ line frames; ○/× changing markers; ◉/◎ inline; ⇒ SPLIT_ARROW'
  surface_class: runtime-symbols
  render_context: "shared glyph set across cast/toss/yarrow"
  language_policy: not-user-facing
  source_layer: machine-token
  token_policy: preserve
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "Symbols carry meaning (becomes ⇒, old yang ○, old yin ×) but no translatable text."

- surface_id: term-theme-names
  file: packages/terminal/src/color/theme.ts
  code_locator: "THEME_NAMES L139 (ink/bone/cinnabar/jade/river)"
  current_text: '"ink" "bone" "cinnabar" "jade" "river"'
  surface_class: terminal-settings
  render_context: "Theme settings-row option chips (shown verbatim)"
  language_policy: canonical-anchor
  source_layer: machine-token
  token_policy: preserve
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal; --policy (enum-as-chip)"
  notes: "Machine tokens shown as chips + persisted config keys; translating in place would break setTheme(). 'bone' default. Display labels DEFERRED (plan 2026-06-10-001): theme-name semantics unresolved (brand vs literal — 墨/骨/硃砂/玉/河 candidates not ratified); chips stay verbatim until the glossary records the ruling. No input aliases."

- surface_id: term-motion-preset
  file: packages/terminal/src/animation/presets.ts
  code_locator: "L24 MotionPreset; L112–117 PRESETS"
  current_text: '"default" "brisk" "deep" "reduced"'
  surface_class: terminal-settings
  render_context: "config 'motion' value; NOT a settings chip currently"
  language_policy: developer-only
  source_layer: machine-token
  token_policy: preserve
  risk: medium
  agentify_required: no
  status: open
  verifier: "--policy"
  notes: "Would become user-facing if a Motion settings row is added (reopen)."

- surface_id: term-scroll-indicator
  file: packages/terminal/src/widgets/scrollable.ts
  code_locator: "L52–59"
  current_text: '"1/1" / "${page}/${totalPages}"'
  surface_class: terminal-global-chrome
  render_context: "shared scroll page indicator across scenes"
  language_policy: canonical-anchor
  source_layer: product-ui
  token_policy: preserve
  risk: low
  agentify_required: no
  status: open
  verifier: "--terminal"
  notes: "Numeric, language-neutral. Western digits assumed."

- surface_id: term-textinput-widget
  file: packages/terminal/src/widgets/text-input.ts
  code_locator: "L87–160"
  current_text: '" " cursor fill; "#C8A96B"/"#0D1117" fallback colors'
  surface_class: terminal-global-chrome
  render_context: "shared text input (intention); no placeholder, reverse-video block cursor"
  language_policy: not-user-facing
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "No placeholder string. Nothing to translate."

- surface_id: term-shared-internal
  file: packages/terminal/src/{scene/types.ts,scene/loop.ts,session/terminal-session.ts,color/detect.ts,color/themes/cinnabar.ts,clock.ts,index.ts}
  code_locator: "various"
  current_text: 'SceneSignal tags; ColorSupport "truecolor"/"256"/"16"/"none"; env names NO_COLOR/COLORTERM/TERM/WT_SESSION; SIG* names; cinnabar palette keys; devMode row numbers'
  surface_class: runtime-symbols
  render_context: "internal infra; not rendered (devMode overlay numbers gated)"
  language_policy: developer-only
  source_layer: machine-token
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "No user-facing prose in shared infra. clock.ts has no string literals."
```

---

## Group: cli-commands / cli-invalid-paths  (`apps/cli/src/**`)

```yaml
- surface_id: cli-program-meta
  file: apps/cli/src/program.ts
  code_locator: "L13–18"
  current_text: 'name "iching" (pkg fallback); version "0.1.0" fallback; "--json" "structured JSON output"; "--seed <n>" "deterministic RNG seed (cast command)"; "--data-dir <path>" "override data directory"; "--dev" "enable dev mode (coin toss playground, etc.)"'
  surface_class: cli-commands
  render_context: "--help global options"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli"
  notes: "Commander help is static English unless localized. Flags/name = machine tokens (preserve)."

- surface_id: cli-command-descriptions
  file: apps/cli/src/commands/{cast,config,dict,doctor,hexagram,journal,paths,today}.ts
  code_locator: ".description()/.argument()/.option() across commands"
  current_text: '"Perform an I Ching casting" / "question for the oracle" / "Browse the I Ching dictionary" / "hexagram number (1-64) to view directly" / "Verify environment and configuration" / "Look up hexagram by King Wen number (1-64)" / "commentary style: dx|tu|en|te|w" / "--style <style>" / "View reading journal" / "List recent readings (most recent first)" / "show readings since date (YYYY-MM-DD)" / "--since <date>" / "maximum entries to show" / "--limit <n>" / "show all entries (no limit)" / "Show a specific day''s reading" / "date (YYYY-MM-DD), ''today'', or ''latest''" / "Show today''s reading (cast in the TUI)" / "Manage configuration" / "Show all configuration values" / "Read a config value" / "Write a config value" / "config key" / "config value" / "Show config file location" / "Show all resolved file locations" / "--hexagram <n>" / "only readings where hexagram <n> is primary or becoming" / "config key (shorthand for get; with a value, for set)" / "config value (shorthand for set)" / "Attach a reflection note to the latest reading" / "note text" / "--date <date>" / "annotate the reading of a specific day (YYYY-MM-DD)"
    # verbatim (real punctuation) for verifier fragment-coverage:
    # Show a specific day's reading
    # Show today's reading (cast in the TUI)
    # date (YYYY-MM-DD), 'today', or 'latest'"
  surface_class: cli-commands
  render_context: "--help (command/arg/option descriptions)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli help coverage"
  notes: "English Commander help. Keywords 'today'/'latest', style tokens, dates = canonical inputs (preserve). Command names preserve."

- surface_id: cli-config-key-descriptions
  file: apps/cli/src/commands/config.ts
  code_locator: "L31–131 ConfigEntry.description (×11)"
  current_text: 'Color theme / Casting animation speed / Display language (English, 繁, or 简) / ANSI color mode / Timezone ("system" or IANA name) / Glyph reveal animation / Glyph font / Home-screen taijitu style / Cast method (coin or yarrow stalk ritual) / Cast mode (auto or operator-guided) / Entropy source (machine entropy, or bound to the intention and moment)'
  surface_class: cli-commands
  render_context: "DEAD — never printed (config list shows key/value/values only)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli (dead-description note)"
  notes: "Language desc contains CJK 繁/简. Currently dead text; flag for surfacing or removal."

- surface_id: cli-config-output
  file: apps/cli/src/commands/config.ts
  code_locator: "L149,167–168,175,193–194,200–201,205–206,213,228,317"
  current_text: '"  ${key} = ${value} (${values})" / "Unknown key \"${key}\". Valid keys: …" / "Invalid value \"${value}\" for ${key}. Valid: …" / "${key} = ${value}" / "any string" / "config key (theme, motion, language, color, timezone, glyphAnim, glyphFont, taijituStyle, castMethod, castMode)"'
  surface_class: cli-invalid-paths
  render_context: "config list/get/set stdout + validation errors (stderr, exit 1)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: high
  agentify_required: no
  status: open
  verifier: "--cli invalid-path coverage (every process.exit(1) message)"
  notes: "Error sentences translatable; keys + enum values canonical anchors. language validation enumerates en, zh-Hant, zh-Hans."

- surface_id: cli-range-errors
  file: apps/cli/src/commands/{cast,dict,hexagram,journal}.ts
  code_locator: "dict L36; hexagram L18,27–29; cast --seed guard; journal --hexagram guard"
  current_text: '"Hexagram number must be an integer from 1 to 64." / "Invalid style \"${style}\". Choose from: dx, tu, en, te, w" / "Invalid --seed \"${rawSeed}\": expected a number." / "Invalid --hexagram \"${cmdOpts.hexagram}\": expected a number 1-${GUA.length}."'
  surface_class: cli-invalid-paths
  render_context: "stderr, exit 1"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: high
  agentify_required: no
  status: open
  verifier: "--cli invalid-path"
  notes: "Range error DUPLICATED verbatim in dict+hexagram (should share constant). --style help omits 'st' but plain.ts supports it (inconsistency)."

- surface_id: cli-hexagram-name-lookup
  file: apps/cli/src/commands/{dict,hexagram}.ts
  code_locator: "hexagram .description()/.argument() + matches/none branches; dict .argument()"
  current_text: '"Look up hexagram by King Wen number, name, pinyin, or English name" / "hexagram number (1-64), name, pinyin, or English name" / "hexagram number (1-64), name, pinyin, or search query" / "Multiple matches for \"${query}\":" / "No hexagram matches \"${query}\"."'
  surface_class: cli-commands
  render_context: "--help descriptions; shortlist stdout (exit 0); not-found stderr (exit 1)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli; apps/cli/src/__tests__/hexagram-resolve.test.ts"
  notes: "Name/pinyin/trigram lookup via core searchHexagrams (resolveHexagramQuery shared by hexagram+dict). --json shortlist uses stable keys number/name/pinyin/ename/symbol."

- surface_id: cli-cast-seed-error
  file: apps/cli/src/commands/cast.ts
  code_locator: "--seed validation"
  current_text: '"Invalid --seed \"${rawSeed}\": expected a number."'
  surface_class: cli-invalid-paths
  render_context: "stderr, exit 1"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli invalid-path"
  notes: "Same 'expected a number' idiom as the journal --hexagram validation."

- surface_id: cli-config-positional-shorthand
  file: apps/cli/src/commands/config.ts
  code_locator: ".argument() positional key/value (git-style shorthand)"
  current_text: '"config key (shorthand for get; with a value, for set)" / "config value (shorthand for set)"'
  surface_class: cli-commands
  render_context: "--help argument descriptions"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli help coverage"
  notes: "Positional `config <key> [value]` shorthand added alongside get/set subcommands."

- surface_id: cli-journal-hexagram-filter
  file: apps/cli/src/commands/journal.ts
  code_locator: ".option(--hexagram) + validation"
  current_text: '"--hexagram <n>" / "only readings where hexagram <n> is primary or becoming" / "Invalid --hexagram \"${h}\": expected a number 1-${GUA.length}."'
  surface_class: cli-commands
  render_context: "--help option description; stderr validation (exit 1)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli help coverage + invalid-path"
  notes: "Flag token --hexagram preserves; the sentence translates."

- surface_id: cli-journal-errors-empty
  file: apps/cli/src/commands/journal.ts, output/plain.ts
  code_locator: "journal L46,88; plain L113"
  current_text: '"No readings found." / "No reading found for ${label}" / "No reading found to annotate." / "Note text is empty." / "Note added to ${date}  ${u} ${n} (${p})"'
  surface_class: cli-invalid-paths
  render_context: "stdout empty-state + stderr not-found (exit 1)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli"
  notes: "label='today (YYYY-MM-DD)' for keyword 'today'. plain.ts L113 dup is dead (guarded)."

- surface_id: cli-today-output
  file: apps/cli/src/commands/today.ts, apps/cli/src/output/plain.ts
  code_locator: "today command action; formatTodayPlain"
  current_text: '"no reading yet today — run `iching` to cast" (stdout, exit 0 — a state, not an error); reading output reuses cli-plain-labels (Date:/Intention:/Method: + formatCastPlain)'
  surface_class: cli-commands
  render_context: "`iching today` stdout — daily-anchor recall of the cached reading; --json via todayToJson (stable keys)"
  language_policy: developer-only
  source_layer: product-ui
  json_policy: stable-key
  risk: low
  agentify_required: no
  status: verified
  verifier: "--inventory-only; apps/cli/src/__tests__/today-command.test.ts"
  notes: "Empty state exits 0 (calm invitation; shell-greeting safe). Casting itself stays in the TUI — this command only recalls."

- surface_id: cli-doctor-output
  file: apps/cli/src/commands/doctor.ts
  code_locator: "L21–161"
  current_text: |
    "Glyphs"/"Data"/"Color"/"Terminal"/"Paths" check names; "I Ching Doctor"; "OK"/"WARN"/"FAIL";
    "Config:"/"State:"/"Cache:" + "[exists]"/"[not found]"; "truecolor (24-bit)"/"256-color"/"basic (16-color)"/"unknown";
    "Some trigram glyphs may not render correctly"; "${n} check(s) failed. Please review the output above.";
    "All checks passed with ${n} warning(s)."; "All checks passed.";
    detail strings (verbatim): "Trigrams: ${trigrams}  Lines: ${lines}";
    "GUA: ${guaCount} entries, BINARY_TO_KW: ${binaryCount} entries, alignment verified";
    "GUA: ${guaCount}/64, BINARY_TO_KW: ${binaryCount}/64, valid=${allValid}, unique=${unique}";
    "NO_COLOR is set — color output disabled"; "COLORTERM=${colorterm}, TERM=${term} → ${level}";
    "(< 80 columns — some output may wrap)"
  surface_class: cli-commands
  render_context: "doctor stdout + (--json name/detail values)"
  language_policy: translate
  source_layer: product-ui
  json_policy: localized-display
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli; json doctor name/detail policy"
  notes: "Plural '(s)' idiom needs locale plural. 'unknown' is behavior-coupled (compared at L79). doctor --json leaks localized name/detail — add stable id or keep status enum."

- surface_id: cli-paths-output
  file: apps/cli/src/commands/paths.ts
  code_locator: "L18–20"
  current_text: '"Config:  ${path}" "State:   ${path}" "Cache:   ${path}"'
  surface_class: cli-commands
  render_context: "paths stdout"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli"
  notes: "Manual-space alignment differs from doctor; translated labels misalign."

- surface_id: cli-main-fatal
  file: apps/cli/src/main.ts
  code_locator: "L205–207"
  current_text: "console.error(err.message); exit 1"
  surface_class: cli-invalid-paths
  render_context: "stderr top-level catch"
  language_policy: developer-only
  source_layer: machine-token
  json_policy: not-json
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli"
  notes: "Pass-through of underlying error (core/storage/Commander). Commander unknown-command/missing-arg = its own English."

- surface_id: cli-settings-save-failed
  file: apps/cli/src/main.ts
  code_locator: "settings 'save & back' — best-effort persist"
  current_text: "iching: couldn't save settings (read-only data dir?); changes apply for this session only."
  surface_class: cli-invalid-paths
  render_context: "stderr warning when a read-only/full data dir blocks the settings save"
  language_policy: developer-only
  source_layer: machine-token
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli"
  notes: "Non-fatal: changes still apply live for the session. English-only diagnostic."

- surface_id: cli-config-save-failed
  file: apps/cli/src/commands/config.ts
  code_locator: "config set — guarded store.save()"
  current_text: "Couldn't write config to <path> (read-only or full data dir?)."
  surface_class: cli-invalid-paths
  render_context: "stderr error (exit 1) when a read-only/full data dir blocks `config set`"
  language_policy: developer-only
  source_layer: machine-token
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli"
  notes: "Fatal for the command (a write command must fail when it can't persist). English-only diagnostic, mirrors cli-settings-save-failed."

- surface_id: cli-cast-entropy-flag
  file: apps/cli/src/commands/cast.ts
  code_locator: ".option(\"--bound\", …) on the cast command"
  current_text: '"--bound" "bind the cast to the question and moment (local entropy)"'
  surface_class: cli-commands
  render_context: "--help (cast command option description)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli help coverage"
  notes: "Entropy-binding opt-in (B4). Flag token --bound = machine token (preserve); description English Commander help like its siblings. Honest-provenance wording: question/moment participation, no efficacy claim."

- surface_id: cli-cast-seed-error
  file: apps/cli/src/commands/cast.ts
  code_locator: "--seed validation guard (exit 1)"
  current_text: 'Invalid --seed "…": expected a number.'
  surface_class: cli-invalid-paths
  render_context: "stderr, exit 1 (typo-proofing the deterministic seed path)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli invalid-path (asserted by cast.test.ts subprocess suite)"
  notes: "Regression guard: Number(\"abc\") is NaN and NaN|0 collapsed the PRNG. Mirrors cli-range-errors disposition."

- surface_id: cli-config-positional-args
  file: apps/cli/src/commands/config.ts
  code_locator: "config [key] [value] positional shorthand .argument() descriptions"
  current_text: '"config key (shorthand for get; with a value, for set)" / "config value (shorthand for set)"'
  surface_class: cli-commands
  render_context: "--help (git-style `config <key> [value]` shorthand args)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli help coverage"
  notes: "Companion to cli-command-descriptions; routes through the same runGet/runSet bodies so validation surfaces are unchanged."

- surface_id: cli-journal-hexagram-filter
  file: apps/cli/src/commands/journal.ts
  code_locator: "list --hexagram <n> option + validation guard"
  current_text: '"--hexagram <n>" "only readings where hexagram <n> is primary or becoming" / error: Invalid --hexagram "…": expected a number 1-64.'
  surface_class: cli-commands
  render_context: "--help option description + stderr validation (exit 1)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli invalid-path (asserted by journal-command.test.ts)"
  notes: "Journal filter by hexagram number; option/flag tokens preserve, prose follows cli-command-descriptions disposition."

- surface_id: cli-commander-framework
  file: node_modules/commander (dependency-generated; surfaced by apps/cli/src/program.ts)
  code_locator: "Commander auto-output: Usage/Options/Commands/Arguments headings; unknown-command, missing-argument, excess-argument, invalid-option errors; auto -h/--help"
  current_text: '"Usage:" "Options:" "Commands:" "Arguments:" "error: unknown command" "error: missing required argument" "--help" "-h, --help" "display help for command"'
  surface_class: cli-invalid-paths
  render_context: "--help output and Commander error/exit paths (stderr, exit 1)"
  language_policy: developer-only
  en_source: "Commander.js default English"
  zh_hant_source: "n/a (decide in AC-005)"
  zh_hans_strategy: "n/a (decide in AC-005)"
  source_layer: machine-token
  token_policy: preserve
  json_policy: not-json
  script_exception_policy: "n/a"
  locale_test: "AC-005 runtime --help / bad-command snapshot"
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli runtime sentinels (Commander text invisible to repo literal scan — added via C-001 audit)"
  notes: "C-001 finding 1.2/1.3. Dependency-generated, NOT a repo literal — the AC-001 string-sink cannot see it. Default policy: dependency-English exempt; AC-005 decides whether to localize via Commander hooks. Enumerated here so the surface class is not silently missed."
```

## Group: cli plain output / json-api-output / hook  (`apps/cli/src/output/*`, `hook/adapter.ts`)

```yaml
- surface_id: cli-plain-labels
  file: apps/cli/src/output/plain.ts
  code_locator: "L20–159"
  current_text: '"Question: " / "Hexagram ${n}" / "Lines (bottom to top):" / "old yang ⚊→⚋" / "old yin ⚋→⚊" / "yang ⚊" / "yin ⚋" / "Upper: " / "Lower: " / "Becoming: " / "[lines …]" / "Commentary:" / "  大象 (dx): " / "  彖傳 (tu): " / "  Image (en): " / "  Judgment (te): " / "  Wilhelm (w): " / "Date: " / "Intention: " / "Method: " / "coins" / "coins, by hand" / "yarrow stalks" / "yarrow stalks, by hand" / "Notes:"'
  surface_class: cli-commands
  render_context: "cast/hexagram/journal plain stdout"
  language_policy: translate
  source_layer: interpretive-english
  json_policy: not-json
  risk: high
  agentify_required: yes
  status: open
  verifier: "--cli; --core-data (line-type/commentary labels)"
  notes: "HARDWIRED BILINGUAL: even with language=en, plain output prints Chinese name n, Chinese wing titles 大象/彖傳, and Chinese dx/tu values. Formatters take NO language param. Wilhelm label attribution. Untyped (x as any).ename escape hatch."

- surface_id: cli-plain-oracle-labels
  file: apps/cli/src/output/plain.ts
  code_locator: "formatCastPlain/formatHexagramPlain — judgment + changing-line blocks"
  current_text: '"Judgment (gc): " / "Judgment (gcEn): " / "Changing lines:"'
  surface_class: cli-commands
  render_context: "cast/hexagram plain stdout — 卦辭 + Legge judgment lines, changing-line 爻辭 block (reading-depth v1)"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: verified
  verifier: "--inventory-only; apps/cli/src/__tests__/cast.test.ts + hexagram-output.test.ts"
  notes: "Labels follow the existing parenthetical field-code convention (dx/tu/en/te/w); gc/gcEn values are canonical-anchor + verbatim Legge."

- surface_id: cli-plain-method-labels
  file: apps/cli/src/output/plain.ts
  code_locator: "methodLabel() + Method:/list-note call sites"
  current_text: '"coins" / "coins, by hand" / "yarrow stalks" / "yarrow stalks, by hand" / "Method: " prefix / "  · " list note'
  surface_class: cli-commands
  render_context: "journal list (quiet non-coin note) + journal show Method line"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli (asserted by journal-command.test.ts method-provenance tests)"
  notes: "Cast-method provenance labels (wave A2). A note, not a badge: coins (the ambient default) stays unmarked in lists. JSON carries the raw method token instead."

- surface_id: cli-plain-entropy-provenance
  file: apps/cli/src/output/plain.ts
  code_locator: "entropyLine() — quiet closing note in formatCastPlain/formatJournalShowPlain"
  current_text: '"Entropy: local machine entropy, bound to the intention and moment." / "Entropy: local machine entropy, bound to the moment." / "Entropy: deterministic replay from seed …."'
  surface_class: cli-commands
  render_context: "cast/journal-show plain output — printed ONLY for bound/seed; plain crypto stays silent"
  language_policy: translate
  source_layer: product-ui
  json_policy: not-json
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli (asserted by cast.test.ts + journal-command.test.ts entropy tests)"
  notes: "Honest provenance labels per docs/vision/entropy-sources-vision.md §Provenance Labels — local participation, never metaphysical efficacy. JSON twin is the rng block (stable keys: source/intentionBound/seed)."

- surface_id: cli-json-output
  file: apps/cli/src/output/json.ts
  code_locator: "L5–81"
  current_text: 'keys: question/primary/number/name/pinyin/ename/symbol/judgment/gc/gcEn/lines/value/yang/changing/becoming/changingPositions/changingLines/position/yao/yaoEn/extra/lineTexts/yaoXiao/derived/nuclear/polarity/mirror/diagonal/commentary/dx/tu/en/te/w/key/value/path/rng/source/intentionBound/seed — today adds date/intention/method (todayToJson/noTodayToJson)'
  surface_class: json-api-output
  render_context: "all --json output (2-space pretty)"
  language_policy: developer-only
  source_layer: machine-token
  json_policy: stable-key
  risk: high
  agentify_required: no
  status: open
  verifier: "--cli json locale-policy (stable keys, all 5 commentary styles, status enum)"
  notes: "Keys = stable API contract (never translate). cast/hexagram --json emit ALL commentary styles regardless of language — KEEP locale-neutral & complete. Only doctor --json name/detail are localized-display."

- surface_id: cli-hook-output
  file: apps/cli/src/hook/adapter.ts
  code_locator: "L93–95"
  current_text: "console.log(display) where display = core selectDisplay()"
  surface_class: cli-hook-output
  render_context: "Claude Code hook mode (piped/non-TTY) stdout"
  language_policy: translate
  source_layer: interpretive-english
  json_policy: not-json
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli; --terminal (hook honors language?)"
  notes: "Text originates in core selectDisplay (which has no language param). Hook uses resolvePaths() and never loads config — does NOT honor config.language. Wiring gap."
```

---

## Group: storage-errors  (`packages/storage/src/**`)

```yaml
- surface_id: storage-config-schema
  file: packages/storage/src/{schema-keys.ts,types.ts,json/json-config.ts}
  code_locator: "SCHEMA_KEYS.config; UserConfig; DEFAULT_CONFIG; LANGUAGE_OPTIONS/ALIASES"
  current_text: 'config keys: motion/language/theme/color/timezone/glyphAnim/glyphFont/taijituStyle/castMethod/castMode; language ∈ {en,zh-Hant,zh-Hans} default "en"; aliases 简/簡/simplified→zh-Hans, 繁/traditional→zh-Hant, EN/english→en'
  surface_class: runtime-symbols
  render_context: "persisted config schema (never rendered)"
  language_policy: not-user-facing
  source_layer: machine-token
  token_policy: preserve
  json_policy: stable-key
  risk: high
  agentify_required: no
  status: open
  verifier: "--policy schema/default/order; --cli value validation"
  notes: "LOAD-BEARING. language is a required key; values match core DisplayLanguage exactly. Default en. Schema only expands (migration gate)."

- surface_id: storage-errors-passthrough
  file: packages/storage/src/json/{json-config,json-daily-cache,jsonl-journal}.ts
  code_locator: "ENOENT swallow + bare throw err; json-config readRaw corrupt warning"
  current_text: "iching: config at <path> is unreadable — using defaults. Your old settings are saved at <path>.corrupt; restore them by fixing the JSON and renaming the file back."
  surface_class: storage-errors
  render_context: "stderr warning (once per store instance) when the config file won't parse; other storage errors bubble as native Node/JSON messages"
  language_policy: developer-only
  source_layer: machine-token
  json_policy: not-json
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli (other error wording originates outside storage)"
  notes: "One custom diagnostic: the corrupt-config warning (English-only, fires once per store; loadOrSeed heals the file after backup). Other storage errors re-throw raw ErrnoException/SyntaxError. Migrations silent."
```

## Group: docs-publish  (`README*.md`, `publish/*`, `package.json`)

```yaml
- surface_id: docs-readme-en
  file: README.md
  code_locator: "whole"
  current_text: '"# iching" / "A contemplative I Ching TUI for the terminal." / "Set an intention. Cast a hexagram. Sit with what shows up." / "Observe. Don'\''t interpret."'
  surface_class: docs-publish
  render_context: "GitHub landing (English)"
  language_policy: translate
  source_layer: docs
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli/docs (release docs only)"
  notes: "USER-FACING. Header '**English** · [简体中文](README.zh-CN.md)'. Does NOT document the language config command (gap)."

- surface_id: docs-readme-zh
  file: README.zh-CN.md
  code_locator: "whole"
  current_text: '"一款沉静的终端易经 TUI。" / "立意。起卦。静观所现。" / "观之，勿释。"'
  surface_class: docs-publish
  render_context: "GitHub landing (Chinese, canonical CN doc)"
  language_policy: translate
  source_layer: docs
  risk: medium
  agentify_required: no
  status: open
  verifier: "--cli/docs"
  notes: "Canonical hand-quality Simplified translation. In sync except omits the docs/README.md pointer line. Same language-command doc gap."

- surface_id: docs-publish-readme-meta
  file: publish/README.md, publish/package.json
  code_locator: "whole; description L4 / keywords L12"
  current_text: 'README body (npm); "A contemplative I Ching TUI for the terminal."; keywords iching/i-ching/yijing/tui/terminal/divination/node/bun'
  surface_class: docs-publish
  render_context: "npmjs.com package page"
  language_policy: translate
  source_layer: docs
  risk: low
  agentify_required: no
  status: open
  verifier: "--cli/docs"
  notes: "USER-FACING on npm. README.zh-CN.md link 404s on npm (not in files list). No language keyword."

- surface_id: docs-internal-not-shipped
  file: SPEC.md, docs/README.md, docs/vision/*.md, package.json, apps/cli/package.json
  code_locator: "whole"
  current_text: "scope spec, doc map, vision notes; root/cli package.json have no description, private:true"
  surface_class: docs-publish
  render_context: "in-repo contributor docs / private manifests"
  language_policy: developer-only
  source_layer: docs
  risk: low
  agentify_required: no
  status: exempted
  verifier: "n/a"
  notes: "INTERNAL, not shipped. SPEC has no language/i18n entry yet (scope gap). Version skew cli 0.2.0 vs root 0.2.1."
```

## Group: format-locale  (cross-cutting — number / date / plural formatting)

```yaml
- surface_id: format-locale-numerics
  file: packages/terminal/src/scenes/yarrow/{field-renderer,yarrow-timeline}.ts; packages/terminal/src/scenes/dict/detail-renderer.ts; apps/cli/src/output/plain.ts; apps/cli/src/commands/{journal,doctor}.ts; apps/cli/src/util/today.ts
  code_locator: "String(n) / ${n} interpolation; line N/6; round K/3; ÷4; ×; page N/M; pct%; 'time(s)'/'次'; lastCastDate; journal dates; YYYY-MM-DD"
  current_text: "raw ASCII digits + English pluralization idioms ('time(s)','check(s)','warning(s)','readings','stalks'); dates as YYYY-MM-DD; counters N/M; percentages"
  surface_class: runtime-symbols
  render_context: "every count/fraction/percentage/date/plural across TUI + CLI"
  language_policy: translate
  en_source: "current ASCII formatting"
  zh_hant_source: "AC-002 decision"
  zh_hans_strategy: "AC-002 decision"
  source_layer: product-ui
  token_policy: preserve
  json_policy: locale-neutral-display
  script_exception_policy: "n/a"
  locale_test: "AC-004/AC-005 plural + date + digit-grouping fixtures"
  risk: medium
  agentify_required: no
  status: open
  verifier: "--terminal / --cli locale-format checks (added via C-001 audit)"
  notes: "C-001 finding 1.9/1.15. Cross-cutting locale-formatting CLASS: no locale-aware plural ('1 stalks'), no digit grouping/non-ASCII numerals, dates not localized. Numbers are SMALL (<=49 stalks, 1-64 hexagrams) so impact is low, but the policy must be explicit. JSON stays locale-neutral (ISO dates, ASCII digits)."
```

## Group: future-enrichment  (NOT PRESENT this branch — see AR-001)

```yaml
- surface_id: future-enrichment-not-present
  file: data-acquisition/**, scripts/data-acquisition/**
  code_locator: "untracked; not imported by apps|packages"
  current_text: "legge.json, shuogua.json, wings/, king_wen.json, guaci-xiaoxiang.json (raw acquisition data)"
  surface_class: future-enrichment
  render_context: "NONE — not wired into core; Hexagram has no gc/gcEn/yaoXiao/legge/XU_GUA/ZA_GUA/SHUO_GUA fields"
  language_policy: not-user-facing
  source_layer: docs
  token_policy: preserve
  risk: low
  agentify_required: no
  status: exempted
  verifier: "--inventory-only confirms no enrichment fields on Hexagram"
  notes: "Out of scope for language-translation-v1 (AR-001). REOPEN AC-001 if enrichment is wired into core or imported by app."
```

---

## Extractor commands (verifier supersedes these)

```bash
rg -n '\.description\(|\.argument\(|\.option\(|console\.|process\.exit|throw new Error' apps -g '*.ts' -g '!**/__tests__/**'
rg -n 'writeText|writeCentered|lines\.push|return `|footer|title|label|prompt' packages/terminal/src -g '*.ts' -g '!**/__tests__/**'
rg -nP '[\x{4e00}-\x{9fff}]' packages apps -g '*.ts' -g '!**/__tests__/**'   # all CJK literals
rg -n 'dx:|tu:|en:|te:|w:|yao:|yaoEn:|TRIGRAMS|DERIVED_LABELS|SIMPLIFIED_CHARS|LANGUAGE_OPTIONS' packages -g '*.ts'
```

The tracked verifier `scripts/verify-language-surfaces.ts` replaces these ad-hoc
commands with a deterministic string-sink + field-class + sentinel oracle.

---

## C-001 Agentify missed-surface audit — reconciliation (iteration 1)

GPT-5 Pro (extended-pro) audited this inventory (15 missed-surface / 12 misclass /
15 I-Ching-risk / 15 verifier-blind-spot items; full reconciliation in
`.loop/language/CONSULTS.md`). AC-001 outcome:

- **Added** surface classes the inventory genuinely lacked: `cli-commander-framework`
  (dependency-generated `--help`/error text, invisible to repo literal scan) and
  `format-locale-numerics` (number/date/plural formatting class).
- **Reclassified** `core-gua-u`, `core-trigram-sym`, `core-large-glyphs` from
  `not-user-facing` → `canonical-anchor` (visible but non-translated).
- **Added** verifier sentinels `自返`, `對角卦`.
- **No new scene gaps**: the auditor saw only 6 files; the full inventory already
  rows home/cast/toss/yarrow/browse/journal/settings/dict surfaces.
- **Routed forward** (do NOT block AC-001): composite-row segmentation + JSON
  per-field policy → AC-002; glossary terms + wing-title precision + Wilhelm label
  → AC-010; 用九/用六 + line-identity + pinyin polyphony → AC-003; context-aware
  Simplified table + exceptions (後≠后, 雲/云, 麗/離, 餘, 係/系, 乾≠干) → AC-006;
  runtime/snapshot/seeded-random/per-entry sentinels → AC-008.

---

## AC-005 CLI disposition

Per AR-004: the immersive **localized** reading experience is the **TUI** (AC-004, complete);
`--json` is the **locale-neutral machine API** (stable keys, all 5 commentary styles, status
enum); the **plain/diagnostic CLI prose is intentionally developer-only / power-user / reference
English** for `language-translation-v1`. AC-005 explicitly permits surfaces "intentionally
classified as developer-only with rationale." The config `language` value round-trips verbatim
(`en`/`zh-Hant`/`zh-Hans`). Verified by `--cli`.

| surface_id | disposition | rationale |
| --- | --- | --- |
| `cli-json-output` | **locale-neutral API** | stable keys + all 5 commentary styles; machine-consumed; never language-gated |
| `cli-program-meta` | developer-only (exempt) | Commander global flags/help — scriptable/dev surface |
| `cli-command-descriptions` | developer-only (exempt) | Commander `--help` descriptions — dev/scripting |
| `cli-commander-framework` | developer-only (exempt) | dependency-generated (Usage/Options/errors), not a repo literal |
| `cli-config-key-descriptions` | developer-only (exempt) | config schema help (currently dead text) |
| `cli-config-output` | developer-only (exempt); **tokens stable** | config list/get/set + validation errors are power-user; keys/enum values (incl. language en/zh-Hant/zh-Hans) echo verbatim; invalid-path messages asserted to exist |
| `cli-range-errors` | developer-only (exempt) | dict/hexagram arg validation — power-user |
| `cli-journal-errors-empty` | developer-only (exempt) | empty/not-found — power-user |
| `cli-today-output` | developer-only (exempt) | daily-anchor recall (`iching today`); invitation + plain reading reuse cli-plain-labels; `--json` rides the locale-neutral API |
| `cli-doctor-output` | developer-only (exempt) | diagnostic tool |
| `cli-paths-output` | developer-only (exempt) | diagnostic tool |
| `cli-plain-labels` | developer-only (exempt) | `cast`/`hexagram`/`journal` plain output is a COMPLETE bilingual reference dump (大象傳 + Image + 彖傳 + Judgment + Wilhelm); corpus content (canonical names + Chinese commentary) is shown to all; only the English scaffolding labels (Question:/Commentary:…) are not localized |
| `cli-cast-entropy-flag` | developer-only (exempt) | Commander option help for `--bound` — dev/scripting, sibling of `cli-command-descriptions` |
| `cli-cast-seed-error` | developer-only (exempt) | `--seed` validation error — power-user, sibling of `cli-range-errors` |
| `cli-config-positional-args` | developer-only (exempt) | Commander argument help for the config shorthand — dev/scripting |
| `cli-journal-hexagram-filter` | developer-only (exempt) | `--hexagram` option help + validation — power-user |
| `cli-plain-method-labels` | developer-only (exempt) | quiet method-provenance notes in plain journal output; token rides in JSON |
| `cli-plain-entropy-provenance` | developer-only (exempt) | quiet entropy-provenance note (bound/seed only); JSON twin is the stable `rng` block |
| `cli-hook-output` | developer-only (exempt) | Claude Code hook integration; daily fragment via core `selectDisplay` (locale behavior tracked under AC-003) |

**Reopen** (AR-004 rollback): if the project ships a localized single-language CLI reading mode,
reopen AC-005 — build a CLI message catalog, thread `config.language` into `output/plain.ts`, load
config in the `cast`/`hexagram`/`journal` command actions, and branch corpus display by language.

## Policy Matrix (AC-002)

Authoritative EN / 繁 (zh-Hant) / 简 (zh-Hans) policy for **every** `surface_id`.
`en_source` = where English comes from; `zh_hant_source` = where Traditional comes
from; `zh_hans_strategy` = how Simplified is produced. "catalog" = a new product
message catalog keyed per surface (literal translations land in AC-004 under the
AC-010 glossary); "convert" = OpenCC-style context-aware Traditional→Simplified.
Default language **en**; settings order **EN → 繁 → 简** (asserted by
`settings-scene.test.ts` and `config-store.test.ts`). Verified by
`bun scripts/verify-language-surfaces.ts --policy`.

```yaml
# ---- core data: gua ----
- id: core-gua-u
  language_policy: canonical-anchor
  en_source: Unicode hexagram symbol (preserve, not translated)
  zh_hant_source: same codepoint (preserve)
  zh_hans_strategy: same codepoint (preserve)
  render_context: hexagram glyph in titles/lists/readings
- id: core-gua-name
  language_policy: canonical-anchor
  en_source: gua.ename (separate English-name field)
  zh_hant_source: gua.n (existing Traditional data)
  zh_hans_strategy: per-hexagram-name conversion table; 乾 stays 乾 (AC-006)
  render_context: hexagram title everywhere
- id: core-gua-pinyin
  language_policy: canonical-anchor
  en_source: gua.p romanization (preserve)
  zh_hant_source: gua.p (preserve)
  zh_hans_strategy: gua.p NFC (preserve; never regenerated from chars)
  render_context: romanization beside the name
- id: core-gua-ename
  language_policy: translate
  en_source: gua.ename (existing)
  zh_hant_source: rendered as gua.n in zh mode (canonical name)
  zh_hans_strategy: rendered as converted gua.n
  render_context: English hexagram title (en mode)
- id: core-gua-dx
  language_policy: canonical-anchor
  en_source: gua.en (English mirror)
  zh_hant_source: gua.dx (existing Traditional)
  zh_hans_strategy: context-aware conversion of dx (AC-006)
  render_context: 大象傳 / Image section
- id: core-gua-tu
  language_policy: canonical-anchor
  en_source: gua.te (English mirror)
  zh_hant_source: gua.tu (existing Traditional)
  zh_hans_strategy: context-aware conversion of tu (AC-006)
  render_context: 彖傳 section
- id: core-gua-en
  language_policy: translate
  en_source: gua.en (existing English Image)
  zh_hant_source: rendered as gua.dx in zh mode
  zh_hans_strategy: converted dx
  render_context: English Image (en mode)
- id: core-gua-te
  language_policy: translate
  en_source: gua.te (existing English Judgment)
  zh_hant_source: rendered as gua.tu in zh mode
  zh_hans_strategy: converted tu
  render_context: English Judgment (en mode)
- id: core-gua-w
  language_policy: translate
  en_source: gua.w (Wilhelm-inspired; attribution-qualified per AC-010)
  zh_hant_source: omitted in zh mode (no Chinese counterpart)
  zh_hans_strategy: omitted in zh mode
  render_context: Wilhelm section (en only)
- id: core-gua-yao
  language_policy: canonical-anchor
  en_source: gua.yaoEn (English line texts)
  zh_hant_source: gua.yao (existing; line-identity 初九/六二 preserved)
  zh_hans_strategy: context-aware conversion preserving line-identity tokens (AC-006)
  render_context: 爻辭 / Line Texts
- id: core-gua-yaoEn
  language_policy: translate
  en_source: gua.yaoEn (existing)
  zh_hant_source: rendered as gua.yao in zh mode
  zh_hans_strategy: converted yao
  render_context: English Line Texts
- id: core-gua-gc
  language_policy: canonical-anchor
  en_source: quoted classical (dim, beneath gcEn) — received text shown as itself
  zh_hant_source: gua.gc (existing Traditional data)
  zh_hans_strategy: audited toSimplified (卦辭/小象傳 supplement rows)
  render_context: 卦辭 section (detail first section; cast reading panel; CLI)
- id: core-gua-gcEn
  language_policy: canonical-anchor
  en_source: gua.gcEn — verbatim Legge judgment (public domain, quoted as-is)
  zh_hant_source: not rendered in zh modes (gc carries the section)
  zh_hans_strategy: not rendered in zh modes
  render_context: Judgment section (en mode); cast reading panel; CLI
- id: core-gua-yaoXiao
  language_policy: canonical-anchor
  en_source: quoted classical (dim, beneath each yaoEn) — no translation exists in data
  zh_hant_source: gua.yaoXiao (existing Traditional data)
  zh_hans_strategy: audited toSimplified (supplement rows; 繘 Ext-B retention)
  render_context: dim 小象 under each line text (detail view)
- id: core-gua-extra
  language_policy: canonical-anchor
  en_source: extra.textEn — verbatim Legge (public domain)
  zh_hant_source: extra.text (用九/用六 canonical statements)
  zh_hans_strategy: audited toSimplified
  render_context: all-six-moving reading on hexagrams 1-2 (cast panel; CLI)
- id: core-gua-doc-comment
  language_policy: developer-only
  en_source: n/a — source comment (not rendered)
  zh_hant_source: n/a — not rendered
  zh_hans_strategy: n/a — not rendered
  render_context: source comment
# ---- core data: sequence (序卦/雜卦) ----
- id: core-sequence-xu
  language_policy: canonical-anchor
  en_source: quoted classical (dim) — Legge xu is paragraph-segmented, not per-hexagram
  zh_hant_source: SEQUENCE[].xu (Traditional)
  zh_hans_strategy: audited toSimplified (序卦/雜卦 supplement rows; 著 identity)
  render_context: detail closing 序卦 section (all modes)
- id: core-sequence-za
  language_policy: canonical-anchor
  en_source: rendered as zaEn in en mode
  zh_hant_source: SEQUENCE[].za (Traditional, pair-shared)
  zh_hans_strategy: audited toSimplified
  render_context: detail closing 雜卦 section (zh modes)
- id: core-sequence-zaEn
  language_policy: canonical-anchor
  en_source: SEQUENCE[].zaEn — verbatim Legge couplet (pair-aligned)
  zh_hant_source: not rendered in zh modes (za carries the section)
  zh_hans_strategy: not rendered in zh modes
  render_context: detail closing 雜卦 section (en mode)
# ---- core data: trigrams ----
- id: core-trigram-name
  language_policy: canonical-anchor
  en_source: TRIGRAMS.img (English image word)
  zh_hant_source: TRIGRAMS.n (existing Traditional)
  zh_hans_strategy: convert (兌→兑, 離→离; 乾 stays 乾)
  render_context: trigram name in structure
- id: core-trigram-img
  language_policy: translate
  en_source: TRIGRAMS.img (existing)
  zh_hant_source: TRIGRAM_IMAGE_ZH (天/地/雷/水/山/風/火/澤)
  zh_hans_strategy: convert (風→风, 澤→泽)
  render_context: trigram image in structure
- id: core-trigram-sym
  language_policy: canonical-anchor
  en_source: trigram codepoint (preserve)
  zh_hant_source: same codepoint (preserve)
  zh_hans_strategy: same codepoint (preserve)
  render_context: trigram glyph
- id: core-derived-labels-en
  language_policy: translate
  en_source: parenthetical gloss (hidden within/polarity/mirror/becoming/diagonal)
  zh_hant_source: leading 卦-term 互卦/錯卦/綜卦/之卦/對角卦 (canonical, preserve)
  zh_hans_strategy: convert term (錯→错, 綜→综, 對→对; 互卦 stays)
  render_context: derived label (default branch)
- id: core-derived-labels-cn
  language_policy: translate
  en_source: reuse DERIVED_LABELS English gloss (CN-only today)
  zh_hant_source: normalize 来知德 labels to Traditional (潜→潛, 轨→軌, 迹→跡, 调→調)
  zh_hans_strategy: 来知德 Simplified labels (existing)
  render_context: derived label CN variant (~50% random)
- id: core-styles-tokens
  language_policy: developer-only
  en_source: n/a — machine token (preserve)
  zh_hant_source: n/a — machine token
  zh_hans_strategy: n/a — machine token
  render_context: internal style enum keys
- id: core-large-glyphs
  language_policy: canonical-anchor
  en_source: braille bitmap of Chinese name (preserve)
  zh_hant_source: same bitmap (Traditional name)
  zh_hans_strategy: regenerate bitmap from converted name char
  render_context: large name glyph
- id: core-simplify-map
  language_policy: developer-only
  en_source: n/a — conversion data table (not user-facing prose)
  zh_hant_source: Traditional keys (source side)
  zh_hans_strategy: the audited map values ARE the proven T->S mechanism (AC-006); 乾 excepted
  render_context: zh-Hans conversion engine consumed by detail-renderer zh()
# ---- core format / leakage ----
- id: core-reading-headline
  language_policy: translate
  en_source: g.u+g.n+g.p (preserve) + middle=g[en|te|w]
  zh_hant_source: g.u+g.n+g.p + middle=g[dx|tu]
  zh_hans_strategy: convert name + converted middle
  render_context: reading headline (needs language param — AC-004)
- id: core-reading-becoming-suffix
  language_policy: canonical-anchor
  en_source: arrow + g.u + g.n (preserve) + positions
  zh_hant_source: same + g.n
  zh_hans_strategy: convert g.n
  render_context: transformation suffix
- id: core-getrandomquotestyle
  language_policy: developer-only
  en_source: n/a — style selector (preserve; must become language-gated AC-004)
  zh_hant_source: n/a — selector
  zh_hans_strategy: n/a — selector
  render_context: derived-quote style selection
- id: core-derived-templates
  language_policy: translate
  en_source: needs English variants for 自綜/错综同象/對角卦/自返 (Chinese-only today)
  zh_hant_source: existing Chinese terms (normalize 错综同象→錯綜同象)
  zh_hans_strategy: convert (對角卦→对角卦, 自綜→自综; 错综同象 already Simplified)
  render_context: derived reading lines
- id: core-displayselect
  language_policy: developer-only
  en_source: n/a — cascade selector (preserve; must accept language param AC-004)
  zh_hant_source: n/a — selector
  zh_hans_strategy: n/a — selector
  render_context: top-level display selection
- id: core-structure-formattrigrams
  language_policy: translate
  en_source: sym + English img + ' / '
  zh_hant_source: sym + zh trigram name + zh image + 上/下
  zh_hans_strategy: convert names/images
  render_context: 'st' structure style
- id: core-random-tape-error
  language_policy: developer-only
  en_source: test-only English error (preserve)
  zh_hant_source: n/a — test only
  zh_hans_strategy: n/a — test only
  render_context: thrown error (test/replay only)
- id: core-derivation-docs
  language_policy: developer-only
  en_source: n/a — doc comments
  zh_hant_source: n/a — not rendered
  zh_hans_strategy: n/a — not rendered
  render_context: not rendered
- id: core-search-assumptions
  language_policy: not-user-facing
  en_source: n/a — engine; caller selects display field
  zh_hant_source: n/a — engine
  zh_hans_strategy: n/a — engine
  render_context: search matching
# ---- terminal ----
- id: term-home-title
  language_policy: canonical-anchor
  en_source: ☯ I Ching (brand, preserve)
  zh_hant_source: same brand
  zh_hans_strategy: same brand
  render_context: app title
- id: term-home-menu
  language_policy: translate
  en_source: hardcoded literals (Cast/Dictionary/Journal/Settings/Quit)
  zh_hant_source: catalog (new key per label)
  zh_hans_strategy: convert from zh-Hant catalog
  render_context: home menu items
- id: term-home-status
  language_policy: translate
  en_source: 'Today:'/'No cast today' literals; gua.n preserved
  zh_hant_source: catalog + gua.n
  zh_hans_strategy: convert
  render_context: today-cast status + empty state
- id: term-home-taijitu
  language_policy: not-user-facing
  en_source: n/a — computed braille glyph
  zh_hant_source: n/a — glyph
  zh_hans_strategy: n/a — glyph
  render_context: rotating yin-yang figure
- id: term-intention-prompt
  language_policy: canonical-anchor
  en_source: 問 kept as canonical anchor in all modes (single glyph)
  zh_hant_source: 問
  zh_hans_strategy: 问 (convert)
  render_context: intention prompt glyph
- id: term-intention-hint
  language_policy: translate
  en_source: hardcoded footer hint
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: intention footer hint
- id: term-toss-footers
  language_policy: translate
  en_source: hardcoded footers
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: toss footers
- id: term-toss-coin-glyphs
  language_policy: not-user-facing
  en_source: n/a — graphical coin glyphs
  zh_hant_source: n/a — glyph
  zh_hans_strategy: n/a — glyph
  render_context: physics coins
- id: term-cast-prompts
  language_policy: translate
  en_source: hardcoded footer prompts
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: cast footer prompts
- id: term-cast-chrome-counters
  language_policy: translate
  en_source: 'line'/'round' literals + N/M fractions
  zh_hant_source: catalog (行/輪 etc) + N/M
  zh_hans_strategy: convert
  render_context: shared position counter
- id: term-cast-reveal-title
  language_policy: translate
  en_source: ' above ' connective + gua fields (name preserved)
  zh_hant_source: catalog connective + gua.n
  zh_hans_strategy: convert
  render_context: reveal title block
- id: term-cast-line-glyphs
  language_policy: not-user-facing
  en_source: n/a — line/coin glyphs
  zh_hant_source: n/a — glyph
  zh_hans_strategy: n/a — glyph
  render_context: hexagram line rendering
- id: term-cast-internal-tokens
  language_policy: developer-only
  en_source: n/a — internal enums/signals
  zh_hant_source: n/a — internal
  zh_hans_strategy: n/a — internal
  render_context: state machine (not rendered)
- id: term-yarrow-footers
  language_policy: translate
  en_source: hardcoded footers + '×' multiplier
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: yarrow footers
- id: term-yarrow-manual-prompts
  language_policy: translate
  en_source: hardcoded prompts
  zh_hant_source: catalog (preserve 'approximate' nuance of 'cut around here')
  zh_hans_strategy: convert
  render_context: manual 18-cut prompts
- id: term-yarrow-line-values
  language_policy: canonical-anchor
  en_source: old/young yin/yang (glossary-fixed under AC-010)
  zh_hant_source: 老陰/少陽/少陰/老陽
  zh_hans_strategy: 老阴/少阳/少阴/老阳 (convert)
  render_context: fuse caption line-value
- id: term-yarrow-captions
  language_policy: translate
  en_source: hardcoded ritual narration
  zh_hant_source: catalog + ritual glossary (stalks/heaps/set-aside/carry/fuse)
  zh_hans_strategy: convert
  render_context: teach-once beat captions
- id: term-yarrow-field-labels
  language_policy: translate
  en_source: 'stalks'/'set aside' literals + numbers
  zh_hant_source: catalog (策/set-aside terminology)
  zh_hans_strategy: convert
  render_context: bar/count/set-aside display
- id: term-yarrow-internal
  language_policy: developer-only
  en_source: n/a — beat/phase enums + invariant errors
  zh_hant_source: n/a — internal
  zh_hans_strategy: n/a — internal
  render_context: internal (not rendered)
- id: term-dict-browse-chrome
  language_policy: translate
  en_source: hardcoded header/footer/count
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: browse header/footer/count
- id: term-dict-detail-sections-en
  language_policy: translate
  en_source: synthetic labels (Image/Judgment/Wilhelm/Line Texts/Derived/Locked pair)
  zh_hant_source: the zh-mode labels (大象傳/彖傳/爻辭/衍卦/鎖定對卦)
  zh_hans_strategy: convert zh labels
  render_context: detail section labels (en mode)
- id: term-dict-detail-sections-zh
  language_policy: canonical-anchor
  en_source: synthetic EN labels (paired)
  zh_hant_source: existing 大象傳/彖傳/爻辭/衍卦/鎖定對卦/上/下
  zh_hans_strategy: zh() conversion (傳→传, 辭→辞, 鎖→锁, 對→对, 記→记)
  render_context: detail section labels (zh mode)
- id: term-dict-detail-oracle-sections
  language_policy: canonical-anchor
  en_source: glossary EN names (Judgment / Tuan (Commentary on the Decision) / Xugua / Zagua)
  zh_hant_source: 卦辭/序卦/雜卦 (canonical wing names)
  zh_hans_strategy: zh() conversion (辭→辞, 雜→杂)
  render_context: oracle-text section labels added by reading-depth v1
- id: term-dict-detail-footer
  language_policy: translate
  en_source: hardcoded footer (currently always EN even in zh — bug)
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: detail footer keybindings
- id: term-dict-derived-labels
  language_policy: translate
  en_source: label (Nuclear/Polarity/Mirror/Diagonal)
  zh_hant_source: labelCn (互卦/錯卦/綜卦/對角)
  zh_hans_strategy: convert (錯→错, 綜→综, 對→对; 互卦 stays)
  render_context: derived-link row labels
- id: term-dict-zh-maps
  language_policy: developer-only
  en_source: n/a — SIMPLIFIED_CHARS/TRIGRAM_IMAGE_ZH data tables
  zh_hant_source: Traditional keys (source side of the map)
  zh_hans_strategy: map values ARE the conversion mechanism (audited in AC-006)
  render_context: zh() conversion tables
- id: term-journal-chrome
  language_policy: translate
  en_source: hardcoded title/count/empty/footer
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: journal chrome
- id: term-journal-row-chrome
  language_policy: not-user-facing
  en_source: n/a — arrow/brackets/quotes/cursor glue
  zh_hant_source: n/a — glue
  zh_hans_strategy: n/a — glue
  render_context: journal row glue
- id: term-journal-detail-preview
  language_policy: translate
  en_source: gua.en English image (currently always EN — bug)
  zh_hant_source: gua.dx
  zh_hans_strategy: converted dx
  render_context: dimmed selected-entry preview
- id: term-settings-chrome
  language_policy: translate
  en_source: hardcoded title/footer/'Preview:'
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: settings chrome
- id: term-settings-row-labels
  language_policy: translate
  en_source: hardcoded row labels
  zh_hant_source: catalog (Taijitu→太極圖)
  zh_hans_strategy: convert (太极图)
  render_context: setting row labels
- id: term-settings-lang-options
  language_policy: canonical-anchor
  en_source: EN/繁/简 abbreviations (preserve as bilingual badges)
  zh_hant_source: 繁
  zh_hans_strategy: 简
  render_context: language selector chips (order EN→繁→简)
- id: term-settings-option-chips
  language_policy: translate
  en_source: canonical enum tokens shown as-is (kaiti/coin/auto/dots…)
  zh_hant_source: option-label catalog 楷體/隸變/黑體/銅錢 (coin)/蓍草 (yarrow)/自動/手動/點陣/密實/噪點/放射/沙化 — stored tokens preserved
  zh_hans_strategy: authored explicitly 楷体/隶变/黑体/铜钱 (coin)/自动/手动/点阵/密实/噪点 — never derived via toSimplified
  render_context: settings option-value chips (theme + language rows excluded)
- id: term-settings-preview-char
  language_policy: canonical-anchor
  en_source: 乾 (preserve)
  zh_hant_source: 乾
  zh_hans_strategy: 乾 (NOT 干 — canonical exception)
  render_context: glyph preview exemplar
- id: term-glyphs-shared
  language_policy: not-user-facing
  en_source: n/a — shared Unicode glyph set
  zh_hant_source: n/a — glyphs
  zh_hans_strategy: n/a — glyphs
  render_context: shared glyphs
- id: term-theme-names
  language_policy: canonical-anchor
  en_source: enum chip values ink/bone/cinnabar/jade/river (preserve stored tokens)
  zh_hant_source: display-label map deferred (semantics ruling pending, brand vs literal) — chips render stored tokens
  zh_hans_strategy: deferred with zh-Hant ruling; stored tokens render meanwhile
  render_context: Theme settings chips
- id: term-motion-preset
  language_policy: developer-only
  en_source: n/a — config 'motion' value, not a settings chip currently
  zh_hant_source: n/a — config value
  zh_hans_strategy: n/a — config value
  render_context: config motion value
- id: term-scroll-indicator
  language_policy: canonical-anchor
  en_source: numeric N/M (preserve)
  zh_hant_source: numeric (preserve)
  zh_hans_strategy: numeric (preserve)
  render_context: shared scroll indicator
- id: term-textinput-widget
  language_policy: not-user-facing
  en_source: n/a — cursor block, no placeholder string
  zh_hant_source: n/a — widget
  zh_hans_strategy: n/a — widget
  render_context: shared text input
- id: term-shared-internal
  language_policy: developer-only
  en_source: n/a — infra enums/signals/env names
  zh_hant_source: n/a — internal
  zh_hans_strategy: n/a — internal
  render_context: internal infra
# ---- cli ----
- id: cli-program-meta
  language_policy: translate
  en_source: Commander descriptions + flags (flags preserved)
  zh_hant_source: catalog for descriptions; flags preserved
  zh_hans_strategy: convert descriptions
  render_context: --help global options
- id: cli-command-descriptions
  language_policy: translate
  en_source: hardcoded Commander descriptions
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: --help command/arg/option descriptions
- id: cli-config-key-descriptions
  language_policy: translate
  en_source: hardcoded (currently dead — never printed)
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: ConfigEntry.description (latent)
- id: cli-config-output
  language_policy: translate
  en_source: error sentences + 'key = value' (keys/enums preserved)
  zh_hant_source: catalog for sentences; tokens preserved
  zh_hans_strategy: convert sentences
  render_context: config list/get/set + validation errors
- id: cli-range-errors
  language_policy: translate
  en_source: hardcoded range/style errors
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: dict/hexagram errors
- id: cli-hexagram-name-lookup
  language_policy: translate
  en_source: hardcoded help text + shortlist/not-found messages
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: hexagram/dict name lookup (help, shortlist stdout, not-found stderr)
- id: cli-cast-seed-error
  language_policy: translate
  en_source: hardcoded --seed validation error
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: cast --seed validation stderr
- id: cli-config-positional-shorthand
  language_policy: translate
  en_source: hardcoded argument descriptions
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: config positional shorthand help
- id: cli-journal-hexagram-filter
  language_policy: translate
  en_source: hardcoded option description + validation error
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: journal --hexagram filter help + validation stderr
- id: cli-plain-cast-method-labels
  language_policy: translate
  en_source: hardcoded method provenance labels
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: journal/cast plain stdout method labels
- id: cli-journal-errors-empty
  language_policy: translate
  en_source: hardcoded empty/not-found messages
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: journal empty + not-found
- id: cli-today-output
  language_policy: developer-only
  en_source: hardcoded invitation; reading body reuses cli-plain-labels
  zh_hant_source: n/a — developer-only CLI surface (AC-005 exemption)
  zh_hans_strategy: n/a — developer-only CLI surface (AC-005 exemption)
  render_context: today command stdout (daily-anchor recall + --json)
- id: cli-doctor-output
  language_policy: translate
  en_source: hardcoded labels/status/details (env names preserved)
  zh_hant_source: catalog; status enum (pass/warn/fail) preserved
  zh_hans_strategy: convert
  render_context: doctor stdout
- id: cli-paths-output
  language_policy: translate
  en_source: 'Config:/State:/Cache:' labels (paths preserved)
  zh_hant_source: catalog
  zh_hans_strategy: convert
  render_context: paths stdout
- id: cli-main-fatal
  language_policy: developer-only
  en_source: pass-through of underlying error
  zh_hant_source: n/a — depends on source error
  zh_hans_strategy: n/a — depends on source error
  render_context: top-level catch
- id: cli-settings-save-failed
  language_policy: developer-only
  en_source: literal diagnostic
  zh_hant_source: n/a — developer-only diagnostic
  zh_hans_strategy: n/a — developer-only diagnostic
  render_context: stderr warning on read-only settings save
- id: cli-config-save-failed
  language_policy: developer-only
  en_source: literal diagnostic
  zh_hant_source: n/a — developer-only diagnostic
  zh_hans_strategy: n/a — developer-only diagnostic
  render_context: stderr error on read-only config set
- id: cli-commander-framework
  language_policy: developer-only
  en_source: Commander default English (dependency)
  zh_hant_source: preserve (exempt dependency English)
  zh_hans_strategy: preserve (exempt dependency English)
  render_context: --help/error framework text
- id: cli-cast-entropy-flag
  language_policy: translate
  en_source: Commander option description (hardcoded English, AC-005 dev-exempt)
  zh_hant_source: catalog if the CLI reading mode ships (AC-005 reopen)
  zh_hans_strategy: catalog (authored)
  render_context: cast --help option description
- id: cli-cast-seed-error
  language_policy: translate
  en_source: hardcoded validation error (AC-005 dev-exempt)
  zh_hant_source: catalog if the CLI reading mode ships (AC-005 reopen)
  zh_hans_strategy: catalog (authored)
  render_context: cast --seed stderr validation (exit 1)
- id: cli-config-positional-args
  language_policy: translate
  en_source: Commander argument descriptions (hardcoded English, AC-005 dev-exempt)
  zh_hant_source: catalog if the CLI reading mode ships (AC-005 reopen)
  zh_hans_strategy: catalog (authored)
  render_context: config shorthand --help argument descriptions
- id: cli-journal-hexagram-filter
  language_policy: translate
  en_source: Commander option description + validation error (AC-005 dev-exempt)
  zh_hant_source: catalog if the CLI reading mode ships (AC-005 reopen)
  zh_hans_strategy: catalog (authored)
  render_context: journal list --hexagram help + stderr validation
- id: cli-plain-method-labels
  language_policy: translate
  en_source: methodLabel() hardcoded labels (AC-005 dev-exempt); method token preserved in JSON
  zh_hant_source: catalog if the CLI reading mode ships (AC-005 reopen)
  zh_hans_strategy: catalog (authored)
  render_context: journal list note + journal show Method line
- id: cli-plain-entropy-provenance
  language_policy: translate
  en_source: entropyLine() labels — vision-doc provenance wording (AC-005 dev-exempt)
  zh_hant_source: catalog if the CLI reading mode ships (AC-005 reopen)
  zh_hans_strategy: catalog (authored)
  render_context: cast/journal-show quiet entropy note (bound/seed only)
- id: cli-plain-labels
  language_policy: translate
  en_source: hardcoded labels + Chinese wing titles (大象/彖傳 canonical) + data
  zh_hant_source: catalog for labels; wing titles canonical
  zh_hans_strategy: convert
  render_context: cast/hexagram/journal plain output
- id: cli-plain-oracle-labels
  language_policy: translate
  en_source: hardcoded labels (Judgment (gc)/Judgment (gcEn)/Changing lines) + canonical data
  zh_hant_source: catalog for labels; gc/yao values canonical
  zh_hans_strategy: convert
  render_context: cast/hexagram plain output judgment + changing-line blocks
- id: cli-json-output
  language_policy: not-user-facing
  en_source: stable API keys (preserve) + all 5 commentary styles (locale-neutral)
  zh_hant_source: n/a — JSON stays locale-neutral
  zh_hans_strategy: n/a — JSON stays locale-neutral
  render_context: --json output (keys never translated)
- id: cli-hook-output
  language_policy: translate
  en_source: core selectDisplay text (must honor language — wiring gap AC-005)
  zh_hant_source: same via language-gated selectDisplay
  zh_hans_strategy: convert
  render_context: hook stdout
# ---- storage ----
- id: storage-config-schema
  language_policy: not-user-facing
  en_source: n/a — config keys/values are machine tokens (preserve)
  zh_hant_source: n/a — stored token zh-Hant
  zh_hans_strategy: n/a — stored token zh-Hans
  render_context: persisted schema (language key en/zh-Hant/zh-Hans)
- id: storage-errors-passthrough
  language_policy: developer-only
  en_source: native Node/JSON error English (exempt or wrap AC-005)
  zh_hant_source: n/a — native error
  zh_hans_strategy: n/a — native error
  render_context: re-thrown fs/parse errors
# ---- docs ----
- id: docs-readme-en
  language_policy: translate
  en_source: README.md (existing)
  zh_hant_source: n/a — no Traditional README (release ships en + zh-Hans docs)
  zh_hans_strategy: README.zh-CN.md (existing canonical CN doc)
  render_context: GitHub landing (English)
- id: docs-readme-zh
  language_policy: translate
  en_source: README.md (paired)
  zh_hant_source: n/a — no Traditional doc
  zh_hans_strategy: README.zh-CN.md (existing)
  render_context: GitHub landing (CN)
- id: docs-publish-readme-meta
  language_policy: translate
  en_source: publish/README.md + description (existing)
  zh_hant_source: n/a — no Traditional doc
  zh_hans_strategy: zh-CN README not shipped on npm (link 404 — known gap)
  render_context: npm package page
- id: docs-internal-not-shipped
  language_policy: developer-only
  en_source: n/a — internal docs (SPEC/docs/vision), not shipped
  zh_hant_source: n/a — internal
  zh_hans_strategy: n/a — internal
  render_context: contributor docs
# ---- cross-cutting + enrichment ----
- id: format-locale-numerics
  language_policy: translate
  en_source: ASCII digits + English plurals (existing)
  zh_hant_source: locale plural/date policy via catalog
  zh_hans_strategy: convert
  render_context: counts/dates/plurals across TUI+CLI
- id: future-enrichment-not-present
  language_policy: not-user-facing
  en_source: n/a — not present this branch (AR-001)
  zh_hant_source: n/a — not present
  zh_hans_strategy: n/a — not present
  render_context: not wired into core
```
