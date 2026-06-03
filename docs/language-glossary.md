# I Ching Language Glossary & Source-of-Truth Policy

Tracked source-of-truth for the language pass (`language-translation-v1`). Verified
by `bun scripts/verify-language-surfaces.ts --glossary`. This artifact decides the
**approved** rendering, **avoided** synonyms, and **exceptions** for high-risk
terms, and fixes the source-layer authority rules so corpus, product UI, machine
tokens, and proper names are never run through one translation path.

Source layers (authority, strongest first):

1. **received-text** — Zhouyi line statements (爻辭). Canonical anchor; never paraphrased.
2. **commentary-wing** — the Ten Wings (大象傳/彖傳/說卦/序卦/雜卦). Canonical anchor.
3. **proper-name** — hexagram/trigram names, pinyin. Preserve; not translated.
4. **interpretive-english** — `en`/`te`/`w`/`ename`/`yaoEn`. Wilhelm-*inspired*, NOT quotation.
5. **product-ui** — app labels/footers/prompts. Localized via message catalog.
6. **machine-token** — command names, config keys, enum values, JSON keys, paths, env vars, Unicode symbols. **Preserve.**

Default language **English**; settings order **EN → 繁 → 简**.

## High-risk judgment terminology

Where the data currently renders a term inconsistently, the **approved** column is
the canonical choice; AC-003 harmonizes the corpus to it.

| Term | Layer | Approved EN | 繁 | 简 | Avoid | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 君子 | received/wing | the noble one | 君子 | 君子 | gentleman; superior man | HARMONIZED in corpus (C-004): all "superior man" → "the noble one"; "great man" is 大人, not 君子 |
| 小人 | received | the inferior person | 小人 | 小人 | small man; petty man | gender-neutral "person" |
| 大人 | received | the great person | 大人 | 大人 | the great man | Wilhelm uses "great man"; we de-gender |
| 貞 | received | constancy / steadfast correctness | 貞 | 贞 | chastity | C-004: received-text sense = constancy/divinatory correctness; "perseverance" is the interpretive (Wilhelm) corpus form only |
| 亨 | received | success | 亨 | 亨 | offering | "prevalence/success through" |
| 利 | received | furthering | 利 | 利 | profit | the "it furthers one to…" idiom |
| 咎 | received | blame | 咎 | 咎 | fault | pairs with 無咎 = "no blame" |
| 悔 | received | remorse | 悔 | 悔 | regret | distinct from 吝 |
| 厲 | received | danger | 厲 | 厉 | severity | "danger, but no blame" pattern |
| 吝 | received | humiliation | 吝 | 吝 | stinginess | distinct from 悔 |
| 吉 | received | good fortune | 吉 | 吉 | lucky | |
| 凶 | received | misfortune | 凶 | 凶 | unlucky | |
| 元吉 | received | supreme good fortune | 元吉 | 元吉 | great luck | |
| 無咎 / 无咎 | received | no blame | 無咎 | 无咎 | blameless | **normalization exception**: 無 (Traditional) and 无 (variant) BOTH occur in the corpus as-authored — preserve in zh-Hant; both → 无 in zh-Hans |
| 利涉大川 | received | it furthers one to cross the great water | 利涉大川 | 利涉大川 | — | fixed Wilhelm-idiom rendering |
| 征 | received | to campaign / undertake a campaign | 征 | 征 | journey | C-004: martial sense (征伐/征邑國); "to set forth" too gentle for the received text |
| 往 | received | to go forward | 往 | 往 | the past | "there is somewhere to go" |
| 有孚 | received | there is trust | 有孚 | 有孚 | captives | C-004: 孚 = trust/credence between parties; "sincerity" is the interpretive (inward) form |
| 時 | wing | the right time | 時 | 时 | season | timing/timeliness (彖傳 usage) |

## Trigrams (proper-name + image)

| 名 | Pinyin | EN image | 简 | Exception |
| --- | --- | --- | --- | --- |
| 乾 | Qián | Heaven | 乾 | **乾 stays 乾, NEVER 干** (canonical exception) |
| 坤 | Kūn | Earth | 坤 | — |
| 震 | Zhèn | Thunder | 震 | — |
| 巽 | Xùn | Wind | 巽 | 風→风 (image) |
| 坎 | Kǎn | Water | 坎 | — |
| 離 | Lí | Fire | 离 | 離→离; 麗→丽 is a DIFFERENT char (do not confuse) |
| 艮 | Gèn | Mountain | 艮 | — |
| 兌 | Duì | Lake | 兑 | 兌→兑; 澤→泽 (image) |

## Derived-relation labels (interpretive taxonomy — 来知德 tradition)

| 繁 | EN | 简 | Notes |
| --- | --- | --- | --- |
| 互卦 | Nuclear | 互卦 | hidden within (lines 2-3-4-5) |
| 錯卦 | Polarity | 错卦 | complementary opposite (錯→错) |
| 綜卦 | Mirror | 综卦 | inverted vantage (綜→综) |
| 之卦 | Becoming | 之卦 | where it heads |
| 對角卦 | Diagonal | 对角卦 | 錯+綜 combined (對→对) |
| 自綜 | self-mirroring | 自综 | vertically symmetric |
| 自返 | returns to self | 自返 | locked-pair diagonal |
| 错综同象 | cross-locked image | 错综同象 | locked pair (already Simplified in source — normalize zh-Hant to 錯綜同象) |

These are **interpretive-tradition / product terminology**, NOT received text or Ten
Wings. `衍卦` ("Derived") is a product label, not a classical category.

## Ten Wings names

| 繁 | EN | 简 | Notes |
| --- | --- | --- | --- |
| 大象傳 | Great Image | 大象传 | the `dx` field; "Image" UI label = 大象傳 (傳→传) |
| 彖傳 | Tuan (Commentary on the Decision) | 彖传 | the `tu` field; "Judgment" UI label maps here even though EN renders `te` |
| 說卦 | Shuogua (Discussion of the Trigrams) | 说卦 | not in current data (說→说) |
| 序卦 | Xugua (Sequence of the Hexagrams) | 序卦 | not in current data |
| 雜卦 | Zagua (Miscellaneous Notes) | 杂卦 | not in current data (雜→杂) |

## Line designations (line-identity — preserve)

Yang lines: **初九 九二 九三 九四 九五 上九**. Yin lines: **初六 六二 六三 六四 六五 上六**.
EN: "nine/six at the beginning", "… in the second/third/fourth/fifth place", "… at the
top". Array index is bottom→top; renderers may show top→bottom, but the position+yin/yang
identity must never be lost. English "Line N" headers currently drop yin/yang — AC-003
restores identity. Special statements **用九 / 用六** (Qian/Kun only) are exceptional line
texts not modeled in the current 6-element `yao[]` — documented exclusion (reopen if added).

## Pinyin

NFC-normalized romanization; **preserved**, never translated, never regenerated from
Simplified characters. Polyphony locked to canonical hexagram readings: 否 **Pǐ**, 賁 **Bì**,
觀 **Guān**, 蹇 **Jiǎn**, 解 **Xiè**, 說/兌 **Duì**.

## Machine tokens (preserve — never translate)

Command names (`cast`, `config`, `hexagram`…), config keys (`language`, `theme`…), enum
**values** (`en`/`zh-Hant`/`zh-Hans`, `coin`/`yarrow`, `kaiti`/`libian`/`heiti`, theme
names, `auto`/`manual`), JSON object keys, file paths, env vars (`NO_COLOR`, `ICHING_HOME`),
and Unicode hexagram/trigram/taijitu symbols. Localized **display labels** for enum values
(e.g. a Chinese chip for `coin`) are a SEPARATE catalog layer that never mutates the stored
token. JSON output stays locale-neutral (stable keys; all five commentary styles emitted).

## The "Wilhelm" label (attribution)

The `w` field and the detail-section header are **Wilhelm-inspired / interpretive
advice**, NOT direct quotation of Richard Wilhelm or the Wilhelm/Baynes translation.
The rendered label must not imply verbatim quotation — so the header is rendered as
**"Wilhelm-inspired"** (not bare "Wilhelm"), applied in detail-renderer per the C-005
consult verdict ("a bare 'Wilhelm' header strongly implies quotation"). `ename`, `en`,
`te`, `yaoEn` likewise carry recognizable Wilhelm/Baynes idiom and are interpretive
English, not licensed quotation.

## C-005 terminology-consult reconciliation

The terminology meaning-consult (C-005) proposed less-Wilhelmese academic renderings.
**Decision:** the app is deliberately *Wilhelm-inspired*, so the primary approved renderings
keep the Wilhelm-Baynes register (consistent with the en/te/w/yaoEn corpus voice); the
consult's alternatives are recorded here as accepted-for-future / documented options, not a
mandate to rewrite the corpus (cf. AR-005). Accepted outright: the **"Wilhelm-inspired"**
label (a real honesty fix, applied). Recorded alternatives (academic, optional):
貞 → *constancy* (vs perseverance); 亨 → *fulfillment* (vs success); 利 → *beneficial*
(vs furthering); 悔 → *regret* (vs remorse); 吝 → *shame* (vs humiliation); 元吉 → *great good
fortune* (vs supreme); 利涉大川 → *…cross the great river* (vs great water); 征 → *undertake an
expedition*; 有孚 → *there is trust* (vs sincerity); 小人 → *petty person* (vs inferior person).
These are within a deliberate translation voice, not fidelity defects.

## C-004 adversarial-audit reconciliation

GPT-5 Pro adversarially attacked simplify.ts / messages.ts / this glossary. Triage:

- **ACCEPTED + FIXED:**
  - *Simplified:* added `陽→阳` (the audit caught the 陰/陽 asymmetry; 陽 is not in the
    current corpus so it was latent, not active). **Enforced** the 乾 exception in
    `toSimplified()` (check `SIMPLIFIED_EXCEPTIONS` before the map) so 乾 can never be
    converted even if a future merge adds it; 幹→干 stays (distinct char), now spot-checked.
  - *Yarrow:* `承策` (invented ritualese for "carry") → **續/续**; `歸奇` (the *action*
    歸奇於扐) → **奇策** (the remainder bundle, which the "set aside N" count labels).
  - *Terminology:* glossary approved renderings tightened — 貞→constancy, 征→to campaign,
    有孚→there is trust (the interpretive Wilhelm forms stay in the corpus layer).
  - *君子:* **harmonized** — all corpus "superior man" → "the noble one" (19 strings); a
    `--core-data` check now fails if "superior man" reappears.
- **DEFERRED (documented follow-up, not v1-blocking):**
  - Wilhelm close-paraphrase **phrase audit** of the `w`/`yaoEn` data — the *label* is
    qualified ("Wilhelm-inspired", disclaims quotation), but a sentence-level rewrite of any
    near-verbatim Baynes diction is a separate editorial pass (reopen if shipped publicly).
  - Rare Ext-A/B simplified glyphs (㧑/颙/豮/觌/阒/赍/绂/鲋) — tofu risk in some terminal
    fonts; flagged for a glyph-coverage check (AC-008 self-test fixture / font policy).
- **REJECTED with rationale:**
  - zh-Hans "Mainland-idiom" suggestion (设置/搜索/导航/滚动/打开 vs current 设定/搜寻/导览/
    卷动/开启): the app is a classical/contemplative tool; zh-Hans here means *Simplified
    script in the same literary register*, not Mainland product-UI idiom. Deliberate, documented.
  - 咷→啕 left as standard PRC simplification (audit called it defensible/minor).
