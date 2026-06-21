#!/usr/bin/env bun
/**
 * One-off codemod: inject the canonical oracle texts into gua.ts.
 *
 *   gc      卦辭 — canonical judgment (classical Chinese), from
 *           data-acquisition/guaci-xiaoxiang.json ("gc", keyed by hexagram 1-64)
 *   gcEn    English judgment, from data-acquisition/legge-cleaned.json
 *           (hexagrams[].judgment — public-domain Legge, parenthetical glosses kept)
 *   yaoXiao 小象傳 — 6 classical per-line commentaries, from guaci-xiaoxiang.json
 *   extra   用九/用六 (hexagrams 1-2 only) — canonical text per zh.wikisource,
 *           English from Legge's 7th line entry in legge-cleaned.json
 *
 * The data-acquisition/ directory is gitignored (raw scrape artifacts live only
 * in the main working copy); pass its path as argv[2] if running from elsewhere:
 *
 *   bun scripts/inject-guaci.ts [path/to/data-acquisition]
 *
 * Idempotent: refuses to run if gua.ts already contains a `gc:` field.
 * Kept in scripts/ for provenance of the 192+ mechanical insertions.
 */

import { join } from "path";

interface GuaciEntry {
  hexagram: number;
  name: string;
  gc: string;
  yaoXiao: string[];
}

interface LeggeHexagram {
  n: number;
  chinese: string;
  judgment: string;
  lines: string[];
}

// 用九/用六 canonical texts (zh.wikisource 周易/乾, 周易/坤) — intentionally
// excluded from guaci-xiaoxiang.json to keep yaoXiao at 6 entries, so they
// are pinned here instead.
const EXTRA_TEXT: Record<number, { name: string; text: string }> = {
  1: { name: "用九", text: "見群龍無首，吉。" },
  2: { name: "用六", text: "利永貞。" },
};

const dataDir = process.argv[2] ?? join(import.meta.dir, "..", "data-acquisition");
const guaPath = join(import.meta.dir, "..", "packages", "core", "src", "data", "gua.ts");

const guaci = (await Bun.file(join(dataDir, "guaci-xiaoxiang.json")).json()) as {
  entries: GuaciEntry[];
};
const legge = (await Bun.file(join(dataDir, "legge-cleaned.json")).json()) as {
  hexagrams: LeggeHexagram[];
};

if (guaci.entries.length !== 64) throw new Error(`guaci entries: ${guaci.entries.length} !== 64`);
if (legge.hexagrams.length !== 64) throw new Error(`legge hexagrams: ${legge.hexagrams.length} !== 64`);

let src = await Bun.file(guaPath).text();
if (/\n {4}gc: /.test(src)) {
  throw new Error("gua.ts already contains gc fields — refusing to re-inject");
}

/** Render one hexagram's new fields, matching gua.ts indentation/style. */
function renderFields(kw: number): string {
  const g = guaci.entries.find((e) => e.hexagram === kw);
  const l = legge.hexagrams.find((h) => h.n === kw);
  if (!g || !l) throw new Error(`missing source data for hexagram ${kw}`);
  if (g.yaoXiao.length !== 6) throw new Error(`hexagram ${kw}: yaoXiao length ${g.yaoXiao.length}`);

  const out: string[] = [];
  out.push(`    gc: ${JSON.stringify(g.gc)},`);
  out.push(`    gcEn: ${JSON.stringify(l.judgment)},`);
  out.push(`    yaoXiao: [`);
  for (const x of g.yaoXiao) out.push(`      ${JSON.stringify(x)},`);
  out.push(`    ],`);

  const extra = EXTRA_TEXT[kw];
  if (extra) {
    // Legge renders 用九/用六 as a 7th line entry on hexagrams 1 and 2.
    const textEn = l.lines[6];
    if (!textEn) throw new Error(`hexagram ${kw}: expected Legge 用九/用六 line`);
    out.push(`    extra: {`);
    out.push(`      name: ${JSON.stringify(extra.name)},`);
    out.push(`      text: ${JSON.stringify(extra.text)},`);
    out.push(`      textEn: ${JSON.stringify(textEn)},`);
    out.push(`    },`);
  }

  return out.join("\n");
}

// Each hexagram entry ends with its yaoEn array followed by the object's
// closing brace. Inject the new fields between them, in King Wen order.
let kw = 0;
src = src.replace(
  /(\n {4}yaoEn: \[[\s\S]*?\n {4}\],)(\n {2}\},)/g,
  (_m, yaoEnBlock: string, close: string) => {
    kw++;
    return `${yaoEnBlock}\n${renderFields(kw)}${close}`;
  },
);

if (kw !== 64) throw new Error(`injected ${kw} hexagrams, expected 64`);

await Bun.write(guaPath, src);
console.log(`Injected gc/gcEn/yaoXiao into ${kw} hexagrams (+ extra on 1, 2) → ${guaPath}`);
