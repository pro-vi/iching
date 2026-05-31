#!/usr/bin/env python3
"""
backfill-legge.py — U10 of the data-enrichment plan.

Reads `data-acquisition/legge-cleaned.json` (post-cleanup Legge SBE
vol XVI, 1882 — public domain) and produces three artifacts:

1. Creates `packages/core/src/data/legge.ts` with:
     LEGGE_XUGUA_EN          — 64 keyed entries (序卦 English)
     LEGGE_ZAGUA_EN          — Legge's 46 rhymed couplets (雜卦)
     LEGGE_ZAGUA_BY_HEX      — hex → couplet text reverse index
     LEGGE_SHUOGUA_EN        — Legge's 22 paragraphs (說卦 Appendix V)
     LEGGE_META              — source + license

2. Backfills `gua.ts` — inserts `gcEn:` (== Legge judgment) and
   `legge: { leggeName, judgment, image, lines[] }` into every entry.

3. Backfills `xugua.ts` — adds `textEn:` to every entry from
   LEGGE_XUGUA_EN.

ZA_GUA backfill and SHUOGUA backfill are deferred — Legge's 46-couplet
雜卦 doesn't 1:1 map to ZA_GUA's 53 source-order entries, and Legge's
22-paragraph 說卦 differs from the canonical 11-chapter division.
LEGGE_ZAGUA_BY_HEX bridges the 雜卦 gap (with a documented 39/49 gap);
the connections() overlay surfaces the Legge English at cast time.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib import DATA_DIR, WORKSPACE, ts_str  # noqa: E402

SRC = WORKSPACE / "legge-cleaned.json"
GUA_PATH = DATA_DIR / "gua.ts"
XUGUA_PATH = DATA_DIR / "xugua.ts"
LEGGE_PATH = DATA_DIR / "legge.ts"


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    hexagrams = data["hexagrams"]
    xugua_legge = data["wings"]["xuGua"]
    zagua_legge = data["wings"]["zaGua"]
    shuogua_legge = data["wings"]["shuoGua"]

    if len(hexagrams) != 64:
        raise SystemExit(f"expected 64 hexagrams, got {len(hexagrams)}")
    if len(xugua_legge) != 64:
        raise SystemExit(f"expected 64 xuGua entries, got {len(xugua_legge)}")

    legge_xugua_by_hex = {e["n"]: e["text"] for e in xugua_legge}

    _backfill_gua(hexagrams)
    _backfill_xugua(legge_xugua_by_hex)
    _emit_legge_module(xugua_legge, zagua_legge, shuogua_legge, data.get("_meta", {}))


def _backfill_gua(hexagrams: list[dict]) -> None:
    src = GUA_PATH.read_text(encoding="utf-8")
    # After U8 backfill, each entry closes with `    ],\n  },` (yaoXiao close
    # + entry close). The same regex still finds the boundary.
    pattern = re.compile(r"(    \],\n)(  \},)", re.MULTILINE)
    matches = list(pattern.finditer(src))
    if len(matches) != 64:
        raise SystemExit(f"expected 64 closings in gua.ts, got {len(matches)}")

    new_src = src
    for i in range(63, -1, -1):
        new_src = new_src[: matches[i].start(2)] + _make_legge_insert(hexagrams[i]) + new_src[matches[i].start(2):]

    GUA_PATH.write_text(new_src, encoding="utf-8")
    print(f"✓ gua.ts: {src.count(chr(10))} → {new_src.count(chr(10))} lines "
          f"(+{new_src.count(chr(10)) - src.count(chr(10))})")


def _make_legge_insert(h: dict) -> str:
    parts = [
        f'    gcEn: {ts_str(h["judgment"])},',
        "    legge: {",
        f'      leggeName: {ts_str(h["leggeName"])},',
        f'      judgment: {ts_str(h["judgment"])},',
        f'      image: {ts_str(h["image"])},',
        "      lines: [",
    ]
    for line in h["lines"]:
        parts.append(f"        {ts_str(line)},")
    parts.append("      ],")
    parts.append("    },")
    return "\n".join(parts) + "\n"


def _backfill_xugua(legge_xugua_by_hex: dict[int, str]) -> None:
    src = XUGUA_PATH.read_text(encoding="utf-8")
    new_lines: list[str] = []
    backfilled = 0
    for line in src.split("\n"):
        m = re.match(r"^(  \{ hexagram: (\d+), .*?)( \},)$", line)
        if m:
            hex_n = int(m.group(2))
            text = legge_xugua_by_hex.get(hex_n)
            if text:
                new_lines.append(f"{m.group(1)}, textEn: {ts_str(text)}{m.group(3)}")
                backfilled += 1
                continue
        new_lines.append(line)
    XUGUA_PATH.write_text("\n".join(new_lines), encoding="utf-8")
    print(f"✓ xugua.ts: backfilled textEn on {backfilled} entries")
    if backfilled != 64:
        raise SystemExit(f"expected 64 textEn backfills, got {backfilled}")


def _emit_legge_module(
    xugua: list[dict], zagua: list[dict], shuogua: list[dict], meta: dict,
) -> None:
    out: list[str] = []
    out.append("// James Legge — Sacred Books of the East vol. XVI (1882). Public domain.")
    out.append("// Re-pulled from archive.org SBE16 plaintext + Wikisource cross-check.")
    out.append("// The 4 baharna editorial drifts and 3 follow-up structural cleanups")
    out.append("// (hex 41 trailing period, paren/space-separated footnote variants,")
    out.append('// OCR "axe" → "are") have been removed. See cleanup-legge.py.')
    out.append("")
    out.append("/**")
    out.append(" * Legge Appendix VI — Treatise on the Sequence (序卦傳).")
    out.append(" * Keyed by KW hexagram number 1..64; mirrors the structure of XU_GUA.")
    out.append(" */")
    out.append("export const LEGGE_XUGUA_EN: Record<number, string> = {")
    by_hex = {e["n"]: e["text"] for e in xugua}
    for hex_n in range(1, 65):
        out.append(f"  {hex_n}: {ts_str(by_hex[hex_n])},")
    out.append("};")
    out.append("")
    out.append("/**")
    out.append(" * Legge Appendix VII — Treatise on the Mixed Hexagrams (雜卦傳).")
    out.append(" * 46 rhymed couplets in Legge's transmission.")
    out.append(" */")
    out.append("export const LEGGE_ZAGUA_EN: { pair: number[]; text: string }[] = [")
    for entry in zagua:
        pair_str = "[" + ", ".join(str(x) for x in entry["pair"]) + "]"
        out.append(f"  {{ pair: {pair_str}, text: {ts_str(entry['text'])} }},")
    out.append("];")
    out.append("")
    out.append("/**")
    out.append(" * Reverse index for LEGGE_ZAGUA_EN — hex 1..64 → Legge couplet text.")
    out.append(" * Two documented Legge typography anomalies have entries whose pair")
    out.append(" * tags don't match content:")
    out.append(" *   pair=[41]    describes Kien alone (hex 39, single-hex)")
    out.append(" *   pair=[50,51] describes Ko + Ting   (hexes 49 + 50, couplet)")
    out.append(" * Routed to the correct hex(es) so they don't overwrite the legitimate")
    out.append(" * mappings for hex 41 and 51.")
    out.append(" */")
    out.append("export const LEGGE_ZAGUA_BY_HEX: Record<number, string> = (() => {")
    out.append("  const idx: Record<number, string> = {};")
    out.append("  const ANOMALY_REROUTE: Record<string, number[]> = {")
    out.append('    "[41]": [39],')
    out.append('    "[50,51]": [49, 50],')
    out.append("  };")
    out.append("  for (const entry of LEGGE_ZAGUA_EN) {")
    out.append('    const key = `[${entry.pair.join(",")}]`;')
    out.append("    const reroute = ANOMALY_REROUTE[key];")
    out.append("    const targets = reroute ?? entry.pair;")
    out.append("    for (const hex of targets) {")
    out.append("      idx[hex] = entry.text;")
    out.append("    }")
    out.append("  }")
    out.append("  return idx;")
    out.append("})();")
    out.append("")
    out.append("/**")
    out.append(" * Legge Appendix V — Treatise on the Trigrams (說卦傳).")
    out.append(" * 22 paragraphs in Legge's rendering; differs from the canonical")
    out.append(" * 11-chapter division used by SHUO_GUA.chapters.")
    out.append(" */")
    out.append("export const LEGGE_SHUOGUA_EN: Record<number, string> = {")
    for entry in shuogua:
        out.append(f"  {entry['chapter']}: {ts_str(entry['text'])},")
    out.append("};")
    out.append("")
    out.append("export const LEGGE_META = {")
    out.append(f"  source: {ts_str(meta.get('source', ''))},")
    out.append(f"  license: {ts_str(meta.get('license', 'public domain — James Legge d.1897, SBE Vol 16 published 1882'))},")
    out.append("} as const;")
    out.append("")

    LEGGE_PATH.write_text("\n".join(out), encoding="utf-8")
    print(f"✓ legge.ts: {LEGGE_PATH.stat().st_size} bytes")


if __name__ == "__main__":
    main()
