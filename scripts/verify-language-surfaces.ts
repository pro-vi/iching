#!/usr/bin/env bun
/**
 * Language-surface verifier — the deterministic oracle for the I Ching language
 * translation work. Its default inputs (inventory + consults) are committed
 * under tests/fixtures/language/ so it runs reproducibly from a fresh clone.
 *
 * Modes (one per acceptance criterion). Only --inventory-only is implemented in
 * this iteration; every other mode (and the no-flag run-all / final-verify mode)
 * intentionally FAILS with "not yet implemented" so it cannot produce a false
 * green before its criterion is genuinely built.
 *
 *   --inventory-only   AC-001: zero unclassified user-facing text surfaces.
 *   --policy           AC-002 | --core-data AC-003 | --terminal AC-004
 *   --cli AC-005 | --simplified AC-006 | --consults AC-007
 *   --self-test AC-008 | --glossary AC-010 | (no flag) AC-009 run-all.
 *
 * Inventory source: tests/fixtures/language/TEXT_SURFACES.md (override --inventory <path>).
 *
 * AC-001 oracle = three honest checks:
 *   1. SOURCE -> INVENTORY string-sink: extract user-facing candidate literals
 *      from in-scope UI/CLI source; every significant literal text fragment must
 *      appear in the inventory. Catches a new surface added to code but not
 *      inventoried. Template ${...} interpolations are split out; each literal
 *      fragment around them is matched independently.
 *   2. CONSUMER-SIDE sentinels: known load-bearing strings must exist BOTH in
 *      their source file (the surface really renders) AND in the inventory.
 *   3. INTEGRITY: corpus-data files covered at field-class altitude; every
 *      scanned file represented (brace-glob aware); enrichment fields absent
 *      from core Hexagram (AR-001 rollback guard).
 *
 * Usage: bun scripts/verify-language-surfaces.ts --inventory-only [--inventory <path>]
 */
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(name);
const optValue = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const INVENTORY_REL = optValue("--inventory") ?? "tests/fixtures/language/TEXT_SURFACES.md";

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------
const STRING_SINK_FILES: string[] = [
  "apps/cli/src/program.ts",
  "apps/cli/src/main.ts",
  "apps/cli/src/commands/cast.ts",
  "apps/cli/src/commands/config.ts",
  "apps/cli/src/commands/dict.ts",
  "apps/cli/src/commands/doctor.ts",
  "apps/cli/src/commands/hexagram.ts",
  "apps/cli/src/commands/journal.ts",
  "apps/cli/src/commands/paths.ts",
  "apps/cli/src/commands/today.ts",
  "apps/cli/src/output/plain.ts",
  "packages/core/src/format/reading.ts",
  "packages/core/src/format/derived.ts",
  "packages/core/src/identify/structure.ts",
  "packages/terminal/src/scenes/home/home-scene.ts",
  "packages/terminal/src/scenes/intention/intention-scene.ts",
  "packages/terminal/src/scenes/toss/toss-scene.ts",
  "packages/terminal/src/scenes/cast/cast-scene.ts",
  "packages/terminal/src/scenes/cast/ritual-chrome.ts",
  "packages/terminal/src/scenes/cast/reveal-renderer.ts",
  "packages/terminal/src/scenes/yarrow/yarrow-scene.ts",
  "packages/terminal/src/scenes/yarrow/yarrow-manual-scene.ts",
  "packages/terminal/src/scenes/yarrow/yarrow-timeline.ts",
  "packages/terminal/src/scenes/yarrow/field-renderer.ts",
  "packages/terminal/src/scenes/dict/browse-renderer.ts",
  "packages/terminal/src/scenes/dict/detail-renderer.ts",
  "packages/terminal/src/scenes/dict/detail-model.ts",
  "packages/terminal/src/scenes/journal/journal-scene.ts",
  "packages/terminal/src/scenes/settings/settings-scene.ts",
];

const CORPUS_DATA_FILES: string[] = [
  "packages/core/src/data/gua.ts",
  "packages/core/src/data/trigrams.ts",
  "packages/core/src/data/large-glyphs.ts",
  "packages/core/src/data/sequence.ts",
];

const REQUIRED_FIELD_IDS: string[] = [
  "core-gua-u",
  "core-gua-name",
  "core-gua-pinyin",
  "core-gua-ename",
  "core-gua-dx",
  "core-gua-tu",
  "core-gua-en",
  "core-gua-te",
  "core-gua-w",
  "core-gua-yao",
  "core-gua-yaoEn",
  "core-gua-gc",
  "core-gua-gcEn",
  "core-gua-yaoXiao",
  "core-gua-extra",
  "core-sequence-xu",
  "core-sequence-za",
  "core-sequence-zaEn",
  "core-trigram-name",
  "core-trigram-img",
  "core-trigram-sym",
  "core-derived-labels-en",
  "core-derived-labels-cn",
  "core-large-glyphs",
];

/** Consumer-side sentinels: [literal, sourceFile]. Must exist in BOTH. */
const SENTINELS: Array<[string, string]> = [
  ["問", "packages/terminal/src/scenes/intention/intention-scene.ts"],
  ["乾", "packages/terminal/src/scenes/settings/settings-scene.ts"],
  ["上", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["下", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["已占", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["最近", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["未有占記", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["大象傳", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["彖傳", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["爻辭", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["衍卦", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["鎖定對卦", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  ["自綜", "packages/core/src/format/derived.ts"],
  ["错综同象", "packages/core/src/format/derived.ts"],
  ["自返", "packages/core/src/format/derived.ts"], // C-001 audit sentinel
  ["對角卦", "packages/core/src/format/derived.ts"], // C-001 audit sentinel
  ["大象", "apps/cli/src/output/plain.ts"],
  ["EN", "packages/terminal/src/scenes/settings/settings-scene.ts"],
  ["繁", "packages/terminal/src/scenes/settings/settings-scene.ts"],
  ["简", "packages/terminal/src/scenes/settings/settings-scene.ts"],
  // Option-chip display labels (representative set; full contract in --terminal):
  ["楷體", "packages/terminal/src/i18n/option-labels.ts"],
  ["楷体", "packages/terminal/src/i18n/option-labels.ts"],
  ["銅錢", "packages/terminal/src/i18n/option-labels.ts"],
  ["铜钱", "packages/terminal/src/i18n/option-labels.ts"],
  ["噪點", "packages/terminal/src/i18n/option-labels.ts"],
  ["噪点", "packages/terminal/src/i18n/option-labels.ts"],
  ["Cast", "packages/terminal/src/scenes/home/home-scene.ts"],
  ["Settings", "packages/terminal/src/scenes/home/home-scene.ts"],
  ["No history", "packages/terminal/src/scenes/dict/detail-renderer.ts"],
  // These moved into the message catalog when their scenes were localized (AC-004):
  ["No readings yet", "packages/terminal/src/i18n/messages.ts"],
  ["receive the reading", "packages/terminal/src/i18n/messages.ts"],
  ["old yang", "apps/cli/src/output/plain.ts"],
  [
    "Hexagram number must be an integer from 1 to 64.",
    "apps/cli/src/commands/dict.ts",
  ],
  ["Unknown key", "apps/cli/src/commands/config.ts"],
  ["Invalid value", "apps/cli/src/commands/config.ts"],
  ["I Ching Doctor", "apps/cli/src/commands/doctor.ts"],
];

/** Machine-token literals the heuristic flags but which are NOT user-facing. */
const EXEMPT: Set<string> = new Set<string>();

// ---------------------------------------------------------------------------
// Tokenizer: extract string/template literals; decode escapes; ${...} -> 
// ---------------------------------------------------------------------------
const INTERP = ""; // placeholder marking a template ${...} interpolation

function decodeEscape(src: string, i: number): { text: string; next: number } {
  // src[i] === "\\"; decode the escape starting at i.
  const c = src[i + 1] ?? "";
  if (c === "u") {
    if (src[i + 2] === "{") {
      const end = src.indexOf("}", i + 3);
      if (end > 0) {
        const cp = parseInt(src.slice(i + 3, end), 16);
        return { text: Number.isNaN(cp) ? "" : String.fromCodePoint(cp), next: end + 1 };
      }
    }
    const hex = src.slice(i + 2, i + 6);
    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
      return { text: String.fromCharCode(parseInt(hex, 16)), next: i + 6 };
    }
  }
  if (c === "x") {
    const hex = src.slice(i + 2, i + 4);
    if (/^[0-9a-fA-F]{2}$/.test(hex)) {
      return { text: String.fromCharCode(parseInt(hex, 16)), next: i + 4 };
    }
  }
  if (c === "n" || c === "t" || c === "r") return { text: " ", next: i + 2 };
  return { text: c, next: i + 2 };
}

function extractLiterals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      let buf = "";
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") {
          const d = decodeEscape(src, i);
          buf += d.text;
          i = d.next;
          continue;
        }
        if (src[i] === "\n") break;
        buf += src[i];
        i++;
      }
      i++;
      out.push(buf);
      continue;
    }
    if (c === "`") {
      i++;
      let buf = "";
      while (i < n) {
        if (src[i] === "\\") {
          const d = decodeEscape(src, i);
          buf += d.text;
          i = d.next;
          continue;
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          buf += INTERP;
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            i++;
          }
          continue;
        }
        if (src[i] === "`") {
          i++;
          break;
        }
        buf += src[i];
        i++;
      }
      out.push(buf);
      continue;
    }
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Classification & matching
// ---------------------------------------------------------------------------
const CJK_RE = /[㐀-鿿豈-﫿]/g;
const cjkCount = (s: string): number => (s.match(CJK_RE) ?? []).length;
const norm = (s: string): string => s.replace(/\s+/g, " ").trim();
/** literal text with interpolations turned into spaces, for candidacy analysis. */
const plain = (raw: string): string => norm(raw.split(INTERP).join(" "));

function isCandidate(raw: string): boolean {
  const s = plain(raw);
  if (!s) return false;
  if (s.startsWith("./") || s.startsWith("../") || s.startsWith("@")) return false;
  if (/^(node:|bun:)/.test(s)) return false; // module specifier
  if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return false; // hex color
  if (/^[a-z]{2,3}(-[A-Za-z]{2,8})+$/.test(s)) return false; // locale code zh-Hant
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(s)) return false; // kebab token cast-auto
  if (/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]*)+$/.test(s)) return false; // message-catalog key menu.cast / yarrow.lineValue.
  if (/^[A-Z0-9]+_[A-Z0-9_]*$/.test(s)) return false; // SCREAMING_SNAKE
  if (/^[\d.\-/x:|%]+$/.test(s)) return false; // numeric/format
  if (cjkCount(s) >= 2) return true;
  if (cjkCount(s) === 1) return false; // single CJK char -> SENTINELS
  // Latin
  const words = s.replace(/[^A-Za-z]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  if (words.length >= 2 && words.join("").length >= 3) return true;
  if (/^[A-Z][a-z]{2,}$/.test(words[0]!)) return true; // Title-case
  if (/^[A-Z]{2,}$/.test(words[0]!)) return true; // ALL-CAPS label
  return false;
}

/** trim leading/trailing non-letter (non-CJK) chars from a fragment. */
function fragCore(frag: string): string {
  return norm(frag.replace(/^[^\p{L}]+/u, "").replace(/[^\p{L}]+$/u, ""));
}
function isSignificant(core: string): boolean {
  return cjkCount(core) >= 2 || /[A-Za-z]{3,}/.test(core);
}

// ---------------------------------------------------------------------------
// Brace-glob expansion for inventory file representation
// ---------------------------------------------------------------------------
function expandBraces(inv: string): Set<string> {
  const set = new Set<string>();
  const re = /([\w./-]+)\{([^}]+)\}([\w./-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inv)) !== null) {
    const [, pre, alts, post] = m;
    for (const a of alts!.split(",")) set.add(`${pre}${a.trim()}${post}`);
  }
  return set;
}

// ---------------------------------------------------------------------------
// Reporting / IO
// ---------------------------------------------------------------------------
const failures: string[] = [];
const fail = (msg: string): void => {
  failures.push(msg);
};
function readMaybe(rel: string): string | null {
  const p = resolve(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

// ---------------------------------------------------------------------------
// AC-001
// ---------------------------------------------------------------------------
function runInventoryOnly(): void {
  const invRaw = readMaybe(INVENTORY_REL);
  if (invRaw === null) {
    fail(`inventory not found: ${resolve(ROOT, INVENTORY_REL)}`);
    return;
  }
  const invNorm = norm(invRaw);
  const braced = expandBraces(invRaw);
  const represented = (rel: string): boolean => invRaw.includes(rel) || braced.has(rel);

  // 1. SOURCE -> INVENTORY string-sink (fragment coverage)
  for (const rel of STRING_SINK_FILES) {
    const src = readMaybe(rel);
    if (src === null) {
      fail(`scanned source file missing: ${rel}`);
      continue;
    }
    if (!represented(rel)) fail(`source file has no inventory row: ${rel}`);
    const seen = new Set<string>();
    for (const lit of extractLiterals(src)) {
      const key = plain(lit);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (EXEMPT.has(key)) continue;
      if (!isCandidate(lit)) continue;
      for (const frag of lit.split(INTERP)) {
        const core = fragCore(frag);
        if (!isSignificant(core)) continue;
        if (!invNorm.includes(core)) {
          fail(
            `UNCLASSIFIED surface fragment in ${rel}: ${JSON.stringify(core)} (from ${JSON.stringify(key)})`,
          );
        }
      }
    }
  }

  // 2. Corpus-data field-class coverage
  for (const rel of CORPUS_DATA_FILES) {
    if (readMaybe(rel) === null) fail(`corpus data file missing: ${rel}`);
    else if (!represented(rel)) fail(`corpus data file not represented: ${rel}`);
  }
  for (const id of REQUIRED_FIELD_IDS) {
    // precise line match so e.g. core-gua-yao is not masked by core-gua-yaoEn
    const re = new RegExp(`surface_id:\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
    if (!re.test(invRaw)) fail(`missing required field-class row: ${id}`);
  }

  // 3. Consumer-side sentinels
  for (const [str, file] of SENTINELS) {
    const src = readMaybe(file);
    if (src === null) {
      fail(`sentinel source file missing: ${file} (for ${JSON.stringify(str)})`);
      continue;
    }
    if (!src.includes(str))
      fail(`sentinel surface GONE from source ${file}: ${JSON.stringify(str)}`);
    if (!invNorm.includes(norm(str)))
      fail(`sentinel not in inventory: ${JSON.stringify(str)} (source ${file})`);
  }

  // 4. AR-001 guard (amended by reading-depth v1): the gc/gcEn/yaoXiao/extra
  // enrichment fields are now SANCTIONED — AC-001 was reopened and each field
  // carries an inventory field-class row (core-gua-gc et al.). The guard now
  // verifies sanctioned fields stay inventoried, and any OTHER enrichment
  // field still reopens AC-001.
  const types = readMaybe("packages/core/src/types.ts");
  if (types) {
    const start = types.indexOf("interface Hexagram");
    const hexBlock = start >= 0 ? types.slice(start, types.indexOf("}", start)) : "";
    const sanctioned: Array<[string, string]> = [
      ["gc:", "core-gua-gc"],
      ["gcEn:", "core-gua-gcEn"],
      ["yaoXiao:", "core-gua-yaoXiao"],
      ["extra?:", "core-gua-extra"],
    ];
    for (const [field, rowId] of sanctioned) {
      if (hexBlock.includes(field) && !invRaw.includes(rowId))
        fail(`enrichment field "${field}" on Hexagram lacks inventory row ${rowId} (AR-001)`);
    }
    for (const field of ["legge:"]) {
      if (hexBlock.includes(field))
        fail(`enrichment field "${field}" on Hexagram — AC-001 must REOPEN (AR-001)`);
    }
  } else {
    fail("packages/core/src/types.ts not found (cannot verify enrichment absence)");
  }
}

// ---------------------------------------------------------------------------
// AC-002: policy matrix
// ---------------------------------------------------------------------------
const REQUIRED_POLICY_FIELDS = [
  "language_policy",
  "en_source",
  "zh_hant_source",
  "zh_hans_strategy",
  "render_context",
];
// A value is a real decision unless it is empty or an explicit deferral.
const DEFERRAL = /\bTBD\b|\bTODO\b|\bdecide (in|later)\b|decision in AC|AC-0\d\d (decision|decides)\b/i;

function fieldValue(block: string, name: string): string {
  const m = block.match(new RegExp(`(?:^|\\n)\\s*${name}:[ \\t]*(.*)`));
  return m ? m[1].trim() : "";
}

function runPolicy(): void {
  const invRaw = readMaybe(INVENTORY_REL);
  if (invRaw === null) {
    fail(`inventory not found: ${resolve(ROOT, INVENTORY_REL)}`);
    return;
  }
  const ids = [...invRaw.matchAll(/^- surface_id:\s*(\S+)\s*$/gm)].map((m) => m[1]!);
  const mi = invRaw.indexOf("## Policy Matrix");
  if (mi < 0) {
    fail("no '## Policy Matrix (AC-002)' section in inventory");
    return;
  }
  const matrix = invRaw.slice(mi);
  const entries = new Map<string, string>();
  for (const raw of matrix.split(/\n(?=- id:)/)) {
    const m = raw.match(/^- id:\s*(\S+)/m);
    if (m) entries.set(m[1]!, raw);
  }
  for (const id of ids) {
    const block = entries.get(id);
    if (!block) {
      fail(`policy matrix missing entry: ${id}`);
      continue;
    }
    for (const f of REQUIRED_POLICY_FIELDS) {
      const v = fieldValue(block, f);
      if (!v) fail(`policy field empty: ${id}.${f}`);
      else if (DEFERRAL.test(v))
        fail(`policy field deferred (not a real decision): ${id}.${f} = ${JSON.stringify(v)}`);
    }
  }
  // Source-side default + order (independent of the test suite).
  const cfg = readMaybe("packages/storage/src/json/json-config.ts") ?? "";
  if (!/DEFAULT_CONFIG[\s\S]{0,400}language:\s*"en"/.test(cfg))
    fail('DEFAULT_CONFIG.language default is not "en"');
  const settings =
    readMaybe("packages/terminal/src/scenes/settings/settings-scene.ts") ?? "";
  if (!/LANGUAGE_OPTIONS[^=]*=\s*\[\s*"en"\s*,\s*"zh-Hant"\s*,\s*"zh-Hans"\s*\]/.test(settings))
    fail("settings LANGUAGE_OPTIONS order is not [en, zh-Hant, zh-Hans]");
  // "English default/order asserted by tests" (pass_evidence).
  const stest =
    readMaybe("packages/terminal/src/__tests__/settings-scene.test.ts") ?? "";
  if (!stest.includes("[EN]  繁  简"))
    fail("settings-scene.test.ts does not assert the EN->繁->简 order");
  const ctest =
    readMaybe("packages/storage/src/__tests__/config-store.test.ts") ?? "";
  if (!/language:\s*"en"/.test(ctest))
    fail("config-store.test.ts does not assert default language en");
}

// ---------------------------------------------------------------------------
// AC-010: glossary / source-of-truth policy
// ---------------------------------------------------------------------------
const GLOSSARY_REL = optValue("--glossary-file") ?? "docs/language-glossary.md";
const REQUIRED_GLOSSARY_TERMS = [
  // high-risk judgment terminology
  "君子", "小人", "大人", "貞", "亨", "利", "咎", "悔", "厲", "吝", "吉", "凶",
  "元吉", "無咎", "无咎", "利涉大川", "征", "往", "有孚", "時",
  // trigrams
  "乾", "坤", "震", "巽", "坎", "離", "艮", "兌",
  // derived labels
  "互卦", "錯卦", "綜卦", "之卦", "對角卦",
  // Ten Wings
  "大象傳", "彖傳", "說卦", "序卦", "雜卦",
  // line designations
  "初九", "六二", "九三", "上九", "初六", "上六",
];
// English policy markers + canonical exceptions (case-insensitive contains).
const REQUIRED_GLOSSARY_MARKERS = [
  "干", "用九", "用六", "Wilhelm", "inspired", "NFC", "preserve",
  "machine token", "Avoid", "superior man", "gentleman", "Pǐ",
];

function runGlossary(): void {
  const g = readMaybe(GLOSSARY_REL);
  if (g === null) {
    fail(`glossary artifact not found (tracked): ${GLOSSARY_REL}`);
    return;
  }
  const gl = g.toLowerCase();
  for (const t of REQUIRED_GLOSSARY_TERMS)
    if (!g.includes(t)) fail(`glossary missing required term: ${t}`);
  for (const m of REQUIRED_GLOSSARY_MARKERS)
    if (!gl.includes(m.toLowerCase()))
      fail(`glossary missing required policy marker: ${JSON.stringify(m)}`);
  if (!(/乾 stays 乾/.test(g) || /乾[^\n]*(never|not)[^\n]*干/i.test(g)))
    fail("glossary lacks the 乾≠干 canonical exception");
  if (!/(not)[^\n]*(direct )?quotation/i.test(g))
    fail("glossary lacks the Wilhelm 'not direct quotation' attribution policy");
}

// ---------------------------------------------------------------------------
// AC-006: simplified conversion (no naive partial map)
// ---------------------------------------------------------------------------
// Confirmed Traditional-ONLY characters (Simplified form differs). If any of
// these survive the conversion of the rendered corpus, the conversion is
// incomplete (residue). 乾 is deliberately ABSENT — it must stay 乾, not become 干.
const TRAD_ONLY = new Set(
  // 陽 added per C-004 adversarial audit (was missing from the map; 陰 was present).
  Array.from(
    "傳與無學萬龍風澤離錯綜對歸師謙來時開關東車馬鳥魚為義樂處觀見興養業從國圖後復陽陰險隨雜難雲電順飛餘體麗龜貞賁蠱節記過進遠違適鎖嚴喪應損敗斷會極樹殘沒災牽獲當發盜終結維縣羅聽虛號衆裏訟貫趨跡輔辭驚",
  ),
);
// Spot-check mappings the conversion MUST get right.
const MUST_CONVERT: Record<string, string> = {
  傳: "传", 與: "与", 無: "无", 萬: "万", 龍: "龙", 風: "风", 澤: "泽", 離: "离",
  錯: "错", 綜: "综", 對: "对", 歸: "归", 師: "师", 謙: "谦", 後: "后", 雲: "云",
  麗: "丽", 餘: "余", 辭: "辞", 觀: "观",
  幹: "干", // the DISTINCT char that DOES become 干 (vs 乾 which stays 乾) — C-004
};

async function runSimplified(): Promise<void> {
  let mod: {
    toSimplified?: (s: string) => string;
    SIMPLIFIED_MAP?: Record<string, string>;
  };
  try {
    mod = (await import(resolve(ROOT, "packages/core/src/i18n/simplify.ts"))) as {
      toSimplified?: (s: string) => string;
      SIMPLIFIED_MAP?: Record<string, string>;
    };
  } catch {
    fail(
      "conversion module packages/core/src/i18n/simplify.ts missing — the naive 96-char detail-renderer map is not yet replaced by a proven path",
    );
    return;
  }
  const toS = mod.toSimplified;
  if (typeof toS !== "function") {
    fail("simplify.ts must export toSimplified(text: string): string");
    return;
  }
  // Map-integrity invariant: the conversion must be character-IDENTITY-preserving
  // and single-pass-safe. toSimplified relies on each entry being a 1:1
  // single-codepoint mapping (so character count is preserved) and on no value
  // also being a key (so the transform is idempotent — converting already-Simplified
  // text is a no-op). Both hold today by hand-authoring; this locks them so a future
  // table edit can't silently break length-preservation or introduce double-conversion.
  const SIMPLIFIED_MAP = mod.SIMPLIFIED_MAP;
  if (!SIMPLIFIED_MAP || typeof SIMPLIFIED_MAP !== "object") {
    fail("simplify.ts must export SIMPLIFIED_MAP (the audited Traditional->Simplified table)");
  } else {
    const mapKeys = new Set(Object.keys(SIMPLIFIED_MAP));
    for (const [k, v] of Object.entries(SIMPLIFIED_MAP)) {
      if ([...k].length !== 1 || [...v].length !== 1)
        fail(`SIMPLIFIED_MAP entry not single-codepoint 1:1: "${k}" -> "${v}" (breaks length-preservation)`);
      if (v !== k && mapKeys.has(v))
        fail(`SIMPLIFIED_MAP value is also a key: "${k}" -> "${v}" (double-conversion / non-idempotent)`);
    }
  }
  // Canonical exception: 乾 stays 乾 (NOT 干).
  if (toS("乾") !== "乾") fail(`canonical exception violated: 乾 -> ${toS("乾")} (must stay 乾)`);
  if (toS("乾坤") !== "乾坤") fail(`乾 must not convert inside 乾坤 -> ${toS("乾坤")}`);
  // Known-correct conversions.
  for (const [t, s] of Object.entries(MUST_CONVERT))
    if (toS(t) !== s) fail(`wrong conversion: ${t} -> ${toS(t)} (expected ${s})`);
  // Residue scan over the ACTUAL rendered corpus (consumer-side oracle).
  let gmod: { GUA?: Array<Record<string, unknown>> };
  let tmod: { TRIGRAMS?: Array<Record<string, unknown>> };
  try {
    gmod = (await import(resolve(ROOT, "packages/core/src/data/gua.ts"))) as {
      GUA: Array<Record<string, unknown>>;
    };
    tmod = (await import(resolve(ROOT, "packages/core/src/data/trigrams.ts"))) as {
      TRIGRAMS: Array<Record<string, unknown>>;
    };
  } catch {
    fail("cannot load corpus for residue scan");
    return;
  }
  const strings: string[] = [];
  for (const g of gmod.GUA ?? []) {
    strings.push(String(g.n), String(g.dx), String(g.tu));
    for (const y of (g.yao as string[]) ?? []) strings.push(y);
  }
  for (const t of tmod.TRIGRAMS ?? []) strings.push(String(t.n));
  const residue = new Set<string>();
  for (const s of strings) for (const ch of toS(s)) if (TRAD_ONLY.has(ch)) residue.add(ch);
  if (residue.size > 0)
    fail(`Traditional residue after conversion (${residue.size} chars): ${[...residue].join("")}`);
  // Exception documented in the tracked glossary.
  const gloss = readMaybe(GLOSSARY_REL) ?? "";
  if (!/乾 stays 乾/.test(gloss)) fail("乾 exception not documented in glossary");
  // Consumer-side: the detail renderer must USE the audited core converter, not
  // a re-introduced naive local map.
  const dr = readMaybe("packages/terminal/src/scenes/dict/detail-renderer.ts") ?? "";
  if (!/toSimplified/.test(dr))
    fail("detail-renderer does not use core toSimplified (consumer-side gap)");
  if (/const SIMPLIFIED_CHARS\b/.test(dr))
    fail("detail-renderer still defines a local naive SIMPLIFIED_CHARS map");
}

// ---------------------------------------------------------------------------
// AC-004: terminal scenes honor language (no bilingual stacking)
// ---------------------------------------------------------------------------
// Scene/renderer files that carry translatable product-ui text and must consume
// the message catalog (or otherwise honor DisplayLanguage). detail-renderer/
// detail-model already honor language and are excluded.
const SCENE_CONSUMERS = [
  "packages/terminal/src/scenes/home/home-scene.ts",
  "packages/terminal/src/scenes/intention/intention-scene.ts",
  "packages/terminal/src/scenes/toss/toss-scene.ts",
  "packages/terminal/src/scenes/cast/cast-scene.ts",
  "packages/terminal/src/scenes/cast/reveal-renderer.ts",
  "packages/terminal/src/scenes/cast/ritual-chrome.ts",
  "packages/terminal/src/scenes/yarrow/yarrow-scene.ts",
  "packages/terminal/src/scenes/yarrow/yarrow-manual-scene.ts",
  "packages/terminal/src/scenes/yarrow/yarrow-timeline.ts",
  "packages/terminal/src/scenes/yarrow/field-renderer.ts",
  "packages/terminal/src/scenes/dict/browse-renderer.ts",
  "packages/terminal/src/scenes/journal/journal-scene.ts",
  "packages/terminal/src/scenes/settings/settings-scene.ts",
];

async function runTerminal(): Promise<void> {
  // 1. Catalog completeness.
  let cat: { MESSAGES?: Record<string, { en: string; zhHant: string; zhHans: string }>; tr?: (l: string, k: string) => string };
  try {
    cat = (await import(resolve(ROOT, "packages/terminal/src/i18n/messages.ts"))) as typeof cat;
  } catch {
    fail("message catalog packages/terminal/src/i18n/messages.ts missing");
    return;
  }
  const MESSAGES = cat.MESSAGES;
  const tr = cat.tr;
  if (!MESSAGES || typeof tr !== "function") {
    fail("messages.ts must export MESSAGES + tr(language, key)");
    return;
  }
  const REQUIRED_KEYS = [
    "menu.cast", "menu.dictionary", "menu.journal", "menu.settings", "menu.quit",
    "home.noCast", "verb.back", "journal.empty", "dict.title",
    "settings.theme", "settings.language", "settings.castMode",
  ];
  for (const k of REQUIRED_KEYS)
    if (!(k in MESSAGES)) fail(`catalog missing required key: ${k}`);
  for (const [k, m] of Object.entries(MESSAGES)) {
    if (!m.en?.trim()) fail(`catalog ${k}.en empty`);
    if (!m.zhHant?.trim()) fail(`catalog ${k}.zhHant empty`);
    if (!m.zhHans?.trim()) fail(`catalog ${k}.zhHans empty`);
  }
  // tr() must distinguish languages.
  if ("menu.settings" in MESSAGES) {
    const en = tr("en", "menu.settings");
    const ht = tr("zh-Hant", "menu.settings");
    if (en === ht) fail("tr() does not distinguish en vs zh-Hant for menu.settings");
  }
  // 1b. Option-label catalog — the SEPARATE display-label layer for enum chips
  // (glossary §Settings option-chip display labels). Behavioral contract: every
  // ratified (settingKey, token) resolves to the glossary renderings, en stays
  // the canonical token, theme tokens fall through verbatim (labels deferred),
  // and prototype-chain reaches miss. Deleting or mangling an entry fails here.
  const OPTION_LABEL_CONTRACT: Array<[string, string, string, string]> = [
    ["settings.font", "kaiti", "楷體", "楷体"],
    ["settings.font", "libian", "隸變", "隶变"],
    ["settings.font", "heiti", "黑體", "黑体"],
    ["settings.castMethod", "coin", "銅錢 (coin)", "铜钱 (coin)"],
    ["settings.castMethod", "yarrow", "蓍草 (yarrow)", "蓍草 (yarrow)"],
    ["settings.entropy", "crypto", "機器 (crypto)", "机器 (crypto)"],
    ["settings.entropy", "bound", "繫於心念 (bound)", "系于心念 (bound)"],
    ["settings.castMode", "auto", "自動", "自动"],
    ["settings.castMode", "manual", "手動", "手动"],
    ["settings.taijitu", "dots", "點陣", "点阵"],
    ["settings.taijitu", "dense", "密實", "密实"],
    ["settings.glyphAnimation", "dots", "點陣", "点阵"],
    ["settings.glyphAnimation", "noise", "噪點", "噪点"],
    ["settings.glyphAnimation", "radial", "放射", "放射"],
    ["settings.glyphAnimation", "sand", "沙化", "沙化"],
  ];
  let optMod: { optionLabel?: (l: string, s: string, t: string) => string };
  try {
    optMod = (await import(
      resolve(ROOT, "packages/terminal/src/i18n/option-labels.ts")
    )) as typeof optMod;
  } catch {
    fail("option-label catalog packages/terminal/src/i18n/option-labels.ts missing");
    optMod = {};
  }
  const optionLabel = optMod.optionLabel;
  if (typeof optionLabel !== "function") {
    fail("option-labels.ts must export optionLabel(language, settingKey, token)");
  } else {
    for (const [sk, token, hant, hans] of OPTION_LABEL_CONTRACT) {
      if (optionLabel("en", sk, token) !== token)
        fail(`option label ${sk}.${token}: en must equal the canonical token`);
      if (optionLabel("zh-Hant", sk, token) !== hant)
        fail(`option label ${sk}.${token}: zh-Hant != ratified ${JSON.stringify(hant)}`);
      if (optionLabel("zh-Hans", sk, token) !== hans)
        fail(`option label ${sk}.${token}: zh-Hans != ratified ${JSON.stringify(hans)}`);
    }
    for (const theme of ["ink", "bone", "cinnabar", "jade", "river"])
      if (optionLabel("zh-Hant", "settings.theme", theme) !== theme)
        fail(`theme chip "${theme}" must stay verbatim (labels deferred per glossary)`);
    if (optionLabel("zh-Hant", "settings.font", "constructor") !== "constructor")
      fail("optionLabel resolves prototype-chain keys (must fall back to the token)");
  }
  // The settings scene must actually derive chips through the catalog.
  const settingsSrc =
    readMaybe("packages/terminal/src/scenes/settings/settings-scene.ts") ?? "";
  if (!/from "[^"]*i18n\/option-labels/.test(settingsSrc))
    fail("settings-scene does not consume the option-label catalog");
  // 2. Consumer-side: every translatable scene must consume the catalog (or language).
  for (const rel of SCENE_CONSUMERS) {
    const src = readMaybe(rel);
    if (src === null) {
      fail(`scene file missing: ${rel}`);
      continue;
    }
    const consumes =
      /from "[^"]*i18n\/messages/.test(src) || /\btr?\(\s*(this\.)?language/.test(src);
    if (!consumes) fail(`scene does not honor language via catalog: ${rel}`);
  }
  // 2b. NAME-RENDERING paths. The import-presence check above is structural; it
  // cannot see that a renderer prints a hexagram NAME in the wrong language. Any
  // renderer that emits gua.n must convert for zh-Hans (toSimplified) and must
  // not stack English. These three were the AC-004 blind spots (reveal title,
  // browse rows, journal rows) the structural check missed.
  const NAME_RENDERERS = [
    "packages/terminal/src/scenes/cast/reveal-renderer.ts",
    "packages/terminal/src/scenes/dict/browse-renderer.ts",
    "packages/terminal/src/scenes/journal/journal-scene.ts",
  ];
  for (const rel of NAME_RENDERERS) {
    const src = readMaybe(rel) ?? "";
    if (!src) {
      fail(`name renderer missing: ${rel}`);
      continue;
    }
    if (!/toSimplified/.test(src))
      fail(`${rel} renders hexagram names but does not convert for zh-Hans (toSimplified)`);
  }
  // 2c. Cast reveal specifically: the structure connective must come from the
  // catalog (cast.trigramConnective), never a hardcoded English " above ", and the
  // title functions must accept a DisplayLanguage (P1-a regression guard).
  const reveal = readMaybe("packages/terminal/src/scenes/cast/reveal-renderer.ts") ?? "";
  if (reveal) {
    // Strip line/block comments so a comment mentioning the key can't satisfy
    // a code-usage check (the mutation-test that fooled the first cut).
    const revealCode = reveal
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    // The connective must be an actual catalog CALL, not just a mention.
    if (!/\btr?\(\s*language\s*,\s*"cast\.trigramConnective"\s*\)/.test(revealCode))
      fail('reveal-renderer does not call the catalog for the structure connective (tr(language, "cast.trigramConnective"))');
    // And no English connective literal may survive anywhere in the code — catches
    // both ` above ` template forms and a bare "above"/`above` string literal.
    if (/ above |["'`]above["'`]/.test(revealCode))
      fail('reveal-renderer hardcodes the English connective "above" (must use cast.trigramConnective)');
    if (!/language:\s*DisplayLanguage/.test(revealCode))
      fail("reveal-renderer title functions do not accept a DisplayLanguage param");
  }
  // 2d. FOOTER LEAK GUARD. Scene footers are built as `[key] verb` segments. A
  // hardcoded English nav verb after a keycap (not routed through tr()) is exactly
  // the leak the structural consumer check at (2) cannot see — and detail-renderer
  // is even EXCLUDED from SCENE_CONSUMERS as "already honors language", so its
  // footer leaked undetected. Scan every footer-bearing renderer (incl. detail).
  const FOOTER_RENDERERS = [
    ...SCENE_CONSUMERS,
    "packages/terminal/src/scenes/dict/detail-renderer.ts",
  ];
  const FOOTER_VERBS =
    "navigate|view|dictionary|scroll|derived|select|open|back|explore|switch|" +
    "detail|confirm|toss|reveal|discard|search|pause|resume|step|skip";
  // `]` keycap, a little whitespace, then an English nav verb as a bare literal
  // (the `[^"'`]` window stops at a string boundary, so a `tr(.,"verb.x")` call —
  // where the word sits inside quotes — never matches).
  const footerLeak = new RegExp(`\\][^"'\`\\n]{0,4}\\b(?:${FOOTER_VERBS})\\b`);
  for (const rel of FOOTER_RENDERERS) {
    const src = readMaybe(rel);
    if (src === null) continue;
    for (const line of src.split("\n")) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // skip comments
      if (/\btr\(/.test(line)) continue; // routed through the catalog — fine
      if (footerLeak.test(line))
        fail(`footer leak (hardcoded English keycap verb, not via tr()) in ${rel}: ${line.trim().slice(0, 72)}`);
    }
  }
  // 3. A no-bilingual-stacking behavioral test must exist, and it must exercise
  // the name-rendering paths in 简 (not just the menu/chrome surfaces): cast
  // reveal (兌→兑), journal (觀→观), and the journal/detail FOOTERS.
  const sceneTest = readMaybe("packages/terminal/src/__tests__/scene-language.test.ts");
  if (sceneTest === null) {
    fail("missing scene-language.test.ts (no-bilingual-stacking assertions)");
  } else {
    if (!/zh-Hans|zh-Hant/.test(sceneTest))
      fail("scene-language.test.ts does not assert per-language rendering");
    if (!/CastScene/.test(sceneTest))
      fail("scene-language.test.ts does not exercise CastScene (cast reveal name path)");
    if (!/兑/.test(sceneTest) || !/兌/.test(sceneTest))
      fail("scene-language.test.ts does not assert 兌→兑 conversion (KW58 reveal/browse)");
    if (!/观/.test(sceneTest))
      fail("scene-language.test.ts does not assert 觀→观 conversion (KW20 journal)");
    // Footer coverage in Chinese modes (the leaks the structural check missed):
    // journal nav verbs (导览/检视) + detail nav verbs (卷动/衍卦).
    if (!/导览|檢視|检视/.test(sceneTest))
      fail("scene-language.test.ts does not assert the journal footer localizes (导览/检视)");
    if (!/卷动|衍卦|捲動/.test(sceneTest))
      fail("scene-language.test.ts does not assert the detail footer localizes (卷动/衍卦)");
  }
}

// ---------------------------------------------------------------------------
// AC-005: CLI localized or intentionally developer-only (with rationale)
// ---------------------------------------------------------------------------
const CLI_EXEMPT_SURFACES = [
  "cli-program-meta",
  "cli-command-descriptions",
  "cli-config-key-descriptions",
  "cli-config-output",
  "cli-range-errors",
  "cli-journal-errors-empty",
  "cli-doctor-output",
  "cli-paths-output",
  "cli-commander-framework",
  "cli-plain-labels",
  "cli-hook-output",
];

function runCli(): void {
  // (a) JSON output must stay locale-neutral / API-stable.
  const json = readMaybe("apps/cli/src/output/json.ts") ?? "";
  if (!json) {
    fail("apps/cli/src/output/json.ts missing");
  } else {
    for (const s of ["dx:", "tu:", "en:", "te:", "w:"])
      if (!json.includes(s)) fail(`JSON commentary missing style "${s}" (must emit all 5)`);
    if (/config\.language|JsonConfigStore|toSimplified|DisplayLanguage/.test(json))
      fail("JSON output is not locale-neutral (it references a language mechanism)");
  }
  // (b) Invalid-path messages exist (the every-exit(1) surface).
  const cfg = readMaybe("apps/cli/src/commands/config.ts") ?? "";
  if (!cfg.includes("Unknown key")) fail("config Unknown-key error missing");
  if (!cfg.includes("Invalid value")) fail("config Invalid-value error missing");
  if (!(readMaybe("apps/cli/src/commands/dict.ts") ?? "").includes("integer from 1 to 64"))
    fail("dict range error missing");
  if (!(readMaybe("apps/cli/src/commands/hexagram.ts") ?? "").includes("Invalid style"))
    fail("hexagram invalid-style error missing");
  // (c) Config token stability: language values are the canonical en/zh-Hant/zh-Hans.
  if (!/LANGUAGE_VALUES[\s\S]{0,80}"en"[\s\S]{0,40}"zh-Hant"[\s\S]{0,40}"zh-Hans"/.test(cfg))
    fail("config LANGUAGE_VALUES is not [en, zh-Hant, zh-Hans]");
  // (d) A test asserts the config language round-trip (token stability, consumer-side).
  const ctest = readMaybe("apps/cli/src/__tests__/config-command.test.ts") ?? "";
  if (!/set", "language"|set language/.test(ctest) && !ctest.includes('"language"'))
    fail("config-command.test.ts does not exercise the language key");
  // (e) The developer-only exemption must be DOCUMENTED with rationale (AC-005 clause).
  const inv = readMaybe(INVENTORY_REL) ?? "";
  const marker = "## AC-005 CLI disposition";
  const i = inv.indexOf(marker);
  if (i < 0) {
    fail(`${marker} registry missing from TEXT_SURFACES (AC-005 exemption must be documented)`);
  } else {
    const sec = inv.slice(i);
    for (const s of CLI_EXEMPT_SURFACES)
      if (!sec.includes(s)) fail(`CLI disposition does not classify surface: ${s}`);
    if (!/developer-only|exempt/i.test(sec)) fail("CLI disposition lacks the exemption rationale");
  }
  // (f) The localized launch path (the `dict` command opens the browse scene) MUST
  // thread the configured language into the router, or the browse scene silently
  // renders in the default language regardless of config (the P1-b defect).
  const dictCmd = readMaybe("apps/cli/src/commands/dict.ts") ?? "";
  if (!/config\.language/.test(dictCmd))
    fail("dict command does not load config.language");
  // Match to the statement terminator (`;`), not the first `)` — the call has
  // nested parens (new RealClock(), detectColorSupport()).
  else if (/router\.run\(/.test(dictCmd) && !/router\.run\([^;]*config\.language/.test(dictCmd))
    fail("dict command does not thread config.language into router.run (browse ignores language)");
}

// ---------------------------------------------------------------------------
// AC-003: core corpus audit (Unicode index/order, pinyin, line-identity)
// ---------------------------------------------------------------------------
async function runCoreData(): Promise<void> {
  let gmod: { GUA?: Array<{ u: string; p: string; l: number[]; yao: string[]; n: string }> };
  let tmod: { TRIGRAMS?: Array<{ sym: string; n: string }> };
  try {
    gmod = (await import(resolve(ROOT, "packages/core/src/data/gua.ts"))) as typeof gmod;
    tmod = (await import(resolve(ROOT, "packages/core/src/data/trigrams.ts"))) as typeof tmod;
  } catch {
    fail("cannot load core corpus data");
    return;
  }
  const GUA = gmod.GUA ?? [];
  const TRIGRAMS = tmod.TRIGRAMS ?? [];
  if (GUA.length !== 64) fail(`GUA must have 64 entries, has ${GUA.length}`);

  // Unicode hexagram symbols: King-Wen order, U+4DC0 (䷀) .. U+4DFF (䷿).
  for (let i = 0; i < GUA.length; i++) {
    const want = String.fromCodePoint(0x4dc0 + i);
    if (GUA[i]!.u !== want)
      fail(`gua[${i}] (KW${i + 1}) symbol ${JSON.stringify(GUA[i]!.u)} != King-Wen codepoint ${want}`);
  }
  // Trigram glyphs: binary index 000..111 -> U+2637..U+2630 set.
  const TRIG_SYMS = ["☷", "☳", "☵", "☱", "☶", "☲", "☴", "☰"];
  for (let i = 0; i < 8; i++)
    if (TRIGRAMS[i]?.sym !== TRIG_SYMS[i])
      fail(`trigram[${i}] sym ${JSON.stringify(TRIGRAMS[i]?.sym)} != ${TRIG_SYMS[i]}`);

  // Pinyin: NFC-normalized + locked polyphony for ambiguous readings.
  for (const g of GUA) if (g.p !== g.p.normalize("NFC")) fail(`pinyin not NFC-normalized: ${JSON.stringify(g.p)}`);
  const POLY: Record<number, string> = { 12: "Pǐ", 22: "Bì", 20: "Guān", 39: "Jiǎn", 40: "Xiè" };
  for (const [kw, p] of Object.entries(POLY)) {
    const g = GUA[Number(kw) - 1];
    if (g && g.p !== p) fail(`pinyin polyphony KW${kw}: ${JSON.stringify(g.p)} != ${JSON.stringify(p)}`);
  }

  // Line-identity: every yao[i] must begin with its position+nature token
  // (初九/六二/九三/… encoding both line position AND yin-yang from gua.l[i]).
  const MID = ["", "二", "三", "四", "五", ""];
  for (let k = 0; k < GUA.length; k++) {
    const g = GUA[k]!;
    if (!Array.isArray(g.yao) || g.yao.length !== 6) {
      fail(`gua KW${k + 1} yao is not 6 entries (用九/用六 are a documented exclusion, not extra entries)`);
      continue;
    }
    for (let i = 0; i < 6; i++) {
      const nature = g.l[i] === 1 ? "九" : "六";
      const tok = i === 0 ? `初${nature}` : i === 5 ? `上${nature}` : `${nature}${MID[i]}`;
      if (!g.yao[i]!.startsWith(tok))
        fail(`line-identity KW${k + 1} line${i + 1}: ${JSON.stringify(g.yao[i]!.slice(0, 4))} lacks token ${tok}`);
    }
  }

  // 用九/用六 documented exclusion in the glossary.
  const gloss = readMaybe("docs/language-glossary.md") ?? "";
  if (!gloss.includes("用九") || !gloss.includes("用六"))
    fail("glossary lacks the 用九/用六 special-statement exclusion note");

  // Corpus field-class rows present in the inventory (source-layer/policy coverage).
  const inv = readMaybe(INVENTORY_REL) ?? "";
  for (const id of ["core-gua-name", "core-gua-pinyin", "core-gua-yao", "core-gua-yaoEn", "core-trigram-name"])
    if (!inv.includes(id)) fail(`inventory missing corpus field-class row: ${id}`);

  // 君子 harmonization (C-004): the interpretive English corpus must render 君子
  // consistently as "the noble one", never "superior man" ("great man" stays —
  // that is 大人). gcEn/textEn are VERBATIM Legge quotations (public domain,
  // attribution policy AC-010) and are excluded — quotations are not rewritten.
  const guaSrc = readMaybe("packages/core/src/data/gua.ts") ?? "";
  const guaInterpretive = guaSrc
    .split("\n")
    .filter((l) => !/^\s*(gcEn|textEn):/.test(l))
    .join("\n");
  if (/superior man/.test(guaInterpretive))
    fail('君子 inconsistency: "superior man" still in corpus EN — harmonize to "the noble one" (C-004)');
}

// ---------------------------------------------------------------------------
// AC-007: high-risk groups have reconciled meaning + adversarial consults
// ---------------------------------------------------------------------------
function runConsults(): void {
  const c = readMaybe("tests/fixtures/language/CONSULTS.md") ?? "";
  if (!c) {
    fail("CONSULTS.md missing");
    return;
  }
  // Required consults: a MEANING consult per high-risk group + a comprehensive
  // ADVERSARIAL audit. Each must be status:complete and reconciled.
  const required: Array<{ id: string; label: string }> = [
    { id: "C-002", label: "simplified meaning" },
    { id: "C-003", label: "yarrow meaning" },
    { id: "C-005", label: "terminology/Wilhelm meaning" },
    { id: "C-004", label: "high-risk adversarial audit" },
  ];
  const blockFor = (id: string): string | null => {
    const m = c.match(new RegExp(`consult_id:\\s*${id}\\b[\\s\\S]*?(?=\\n- consult_id:|\\n\\u0060\\u0060\\u0060|$)`));
    return m ? m[0] : null;
  };
  for (const r of required) {
    const b = blockFor(r.id);
    if (!b) {
      fail(`AC-007: consult ${r.id} (${r.label}) missing from ledger`);
      continue;
    }
    if (!/status:\s*complete/.test(b)) fail(`AC-007: consult ${r.id} (${r.label}) not status:complete`);
    if (!/reconcil/i.test(b)) fail(`AC-007: consult ${r.id} (${r.label}) has no reconciliation`);
  }
  // The adversarial audit (C-004) must cover each high-risk group.
  const adv = blockFor("C-004") ?? "";
  for (const g of ["simplified", "yarrow", "terminolog"]) {
    if (!new RegExp(g, "i").test(adv)) fail(`AC-007: adversarial consult C-004 does not cover group "${g}"`);
  }
}

// ---------------------------------------------------------------------------
// AC-008: verifier self-test (meta-oracle — proves the verifier reds on mutations)
// ---------------------------------------------------------------------------
/** Run this verifier as a subprocess with `args`; return true if it exited NON-ZERO (red). */
function verifierRedsOn(args: string[]): boolean {
  try {
    execFileSync("bun", [resolve(ROOT, "scripts/verify-language-surfaces.ts"), ...args], {
      stdio: "ignore",
    });
    return false; // exit 0 = green = mutation NOT caught
  } catch {
    return true; // non-zero = red = mutation caught
  }
}

async function runSelfTest(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "vlang-selftest-"));
  const inv = readMaybe(INVENTORY_REL) ?? "";
  const gloss = readMaybe(GLOSSARY_REL) ?? "";
  if (!inv || !gloss) {
    fail("self-test: cannot read inventory/glossary baseline");
    return;
  }
  // Craft mutated temp inputs (no real source is touched).
  const empty = join(dir, "empty.md");
  writeFileSync(empty, "");
  const noPolicy = join(dir, "nopolicy.md");
  writeFileSync(noPolicy, inv.slice(0, inv.indexOf("## Policy Matrix")));
  const noSentinel = join(dir, "nosentinel.md");
  writeFileSync(noSentinel, inv.split("問").join("")); // drop the 問 sentinel
  const noQian = join(dir, "noqian.md");
  writeFileSync(
    noQian,
    gloss
      .split("\n")
      .filter((l) => !/乾 stays 乾/.test(l) && !/乾.*(never|not).*干/i.test(l))
      .join("\n"),
  );

  // 1. Subprocess red-proofs: each mutation MUST make the verifier exit non-zero.
  const scenarios: Array<{ cls: string; args: string[] }> = [
    { cls: "missing inventory", args: ["--inventory-only", "--inventory", empty] },
    { cls: "dropped sentinel surface (問)", args: ["--inventory-only", "--inventory", noSentinel] },
    { cls: "missing policy matrix", args: ["--policy", "--inventory", noPolicy] },
    { cls: "canonical exception drift (乾)", args: ["--glossary", "--glossary-file", noQian] },
  ];
  for (const s of scenarios)
    if (!verifierRedsOn(s.args))
      fail(`self-test: verifier is FALSE-GREEN on mutation [${s.cls}] — oracle theater`);

  // 2. In-process predicate discrimination (string-sink classifier).
  if (!isCandidate("No history")) fail("self-test: string-sink misses a real user-facing surface");
  if (isCandidate("menu.cast")) fail("self-test: string-sink flags a catalog KEY (catalog-as-home regression)");
  if (isCandidate("startCast")) fail("self-test: string-sink flags an internal enum token");

  // 3. JSON locale-neutral predicate (must flag a language mechanism in JSON output).
  const jsonGate = /config\.language|JsonConfigStore|toSimplified|DisplayLanguage/;
  if (!jsonGate.test('import type { DisplayLanguage } from "@iching/core";'))
    fail("self-test: JSON-locale-neutral predicate would miss a language reference");

  // 4. Line-identity token builder (mirrors --core-data) discriminates position+nature.
  const tok = (i: number, yang: boolean): string => {
    const nature = yang ? "九" : "六";
    const MID = ["", "二", "三", "四", "五", ""];
    return i === 0 ? `初${nature}` : i === 5 ? `上${nature}` : `${nature}${MID[i]}`;
  };
  if (tok(0, true) !== "初九" || tok(1, false) !== "六二" || tok(5, true) !== "上九")
    fail("self-test: line-identity token builder is wrong");

  // 5. Conversion teeth + enforced 乾 exception (core toSimplified).
  let toS: (s: string) => string;
  try {
    const m = (await import(resolve(ROOT, "packages/core/src/i18n/simplify.ts"))) as {
      toSimplified: (s: string) => string;
    };
    toS = m.toSimplified;
  } catch {
    fail("self-test: cannot load simplify.ts");
    return;
  }
  if (toS("乾") !== "乾") fail("self-test: 乾 canonical exception not holding");
  if (toS("乾坤") !== "乾坤") fail("self-test: 乾 exception not enforced inside a string");
  if (toS("傳") !== "传") fail("self-test: conversion has no teeth (傳 not converted)");
  // unmapped Traditional char passes through unchanged — this is WHY the residue scan can
  // catch an incomplete map (proves the scan is meaningful, not a no-op).
  if (toS("颱") !== "颱") fail("self-test: pass-through invariant broken (residue scan would be a no-op)");
}

// ---------------------------------------------------------------------------
// Not-yet-implemented modes
// ---------------------------------------------------------------------------
const notImplemented = (mode: string, crit: string): void => {
  fail(`${mode} (${crit}) not yet implemented — criterion is not passable yet`);
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
let mode = "run-all (AC-009 final)";
async function dispatch(): Promise<void> {
  if (flag("--inventory-only")) {
    mode = "--inventory-only (AC-001)";
    runInventoryOnly();
  } else if (flag("--policy")) {
    mode = "--policy (AC-002)";
    runPolicy();
  } else if (flag("--core-data")) {
    mode = "--core-data (AC-003)";
    await runCoreData();
  } else if (flag("--terminal")) {
    mode = "--terminal (AC-004)";
    await runTerminal();
  } else if (flag("--cli")) {
    mode = "--cli (AC-005)";
    runCli();
  } else if (flag("--simplified")) {
    mode = "--simplified (AC-006)";
    await runSimplified();
  } else if (flag("--consults")) {
    mode = "--consults (AC-007)";
    runConsults();
  } else if (flag("--self-test")) {
    mode = "--self-test (AC-008)";
    await runSelfTest();
  } else if (flag("--glossary")) {
    mode = "--glossary (AC-010)";
    runGlossary();
  } else {
    // AC-009 final-verify: run EVERY criterion's check in one repo state. (Was
    // scaffolded to fail until all criteria were genuinely built — now wired.)
    mode = "run-all (AC-009 final)";
    runInventoryOnly();
    runPolicy();
    runGlossary();
    await runSimplified();
    await runTerminal();
    runCli();
    await runCoreData();
    runConsults();
    await runSelfTest();
  }
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
void dispatch().then(() => {
  console.log(`verify-language-surfaces :: ${mode}`);
  if (failures.length === 0) {
    console.log("PASS — 0 issues");
    process.exit(0);
  } else {
    console.error(`FAIL — ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
});
