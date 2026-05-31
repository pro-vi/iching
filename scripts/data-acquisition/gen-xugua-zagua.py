#!/usr/bin/env python3
"""
gen-xugua-zagua.py — U2 of the data-enrichment plan.

Reads `data-acquisition/xugua-zagua.json` (the verified pull of 序卦傳
and 雜卦傳 from ctext.org + zh.wikisource cross-check) and emits two
new data modules:

    packages/core/src/data/xugua.ts   (XU_GUA[64] + XU_GUA_META)
    packages/core/src/data/zagua.ts   (ZA_GUA[53] + ZA_GUA_BY_HEX
                                       reverse index + ZA_GUA_META)

Both source texts are ancient classical Chinese, unambiguously public
domain (Ten Wings of the I Ching, ~Han dynasty or earlier).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib import DATA_DIR, WORKSPACE, ts_str  # noqa: E402

SRC = WORKSPACE / "xugua-zagua.json"


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    _emit_xugua(data)
    _emit_zagua(data)


def _emit_xugua(data: dict) -> None:
    out: list[str] = []
    out.append('import type { XuGuaEntry } from "../types.js";')
    out.append("")
    out.append("/**")
    out.append(" * 序卦傳 — Sequence of the Hexagrams.")
    out.append(" *")
    out.append(" * One of the Ten Wings of the I Ching. Explains why each hexagram")
    out.append(" * follows the previous in King Wen order. Ancient classical Chinese")
    out.append(" * text, public domain.")
    out.append(" *")
    out.append(" * Source: ctext.org/book-of-changes/xu-gua, cross-checked against")
    out.append(" * zh.wikisource.org/wiki/周易/序卦. Punctuation is ctext editorial.")
    out.append(" *")
    out.append(" * Editorial notes preserved:")
    out.append(" * - Hex 1 (乾) and 2 (坤) share the opening cosmological preamble")
    out.append(" *   «有天地，然後萬物生焉» — 序卦 has no explicit standalone line for either.")
    out.append(" * - Hex 30 (離) merges two adjacent ctext cells.")
    out.append(" * - Hex 31 (咸) is assigned the lower-jing cosmological preamble.")
    out.append(" */")
    out.append("export const XU_GUA: XuGuaEntry[] = [")
    for e in data["xuGua"]:
        parts = [
            f'hexagram: {e["hexagram"]}',
            f'name: {ts_str(e["name"])}',
            f'text: {ts_str(e["text"])}',
        ]
        if "note" in e:
            parts.append(f'note: {ts_str(e["note"])}')
        out.append(f'  {{ {", ".join(parts)} }},')
    out.append("];")
    out.append("")
    _emit_meta(out, "XU_GUA_META", data["_meta"])
    out.append("")

    (DATA_DIR / "xugua.ts").write_text("\n".join(out), encoding="utf-8")
    print(f"✓ xugua.ts: {len(data['xuGua'])} entries")


def _emit_zagua(data: dict) -> None:
    out: list[str] = []
    out.append('import type { ZaGuaEntry } from "../types.js";')
    out.append("")
    out.append("/**")
    out.append(" * 雜卦傳 — Miscellaneous Notes on the Hexagrams.")
    out.append(" *")
    out.append(" * One of the Ten Wings of the I Ching. Pairs hexagrams contrastively,")
    out.append(" * one terse line per pair. Ancient classical Chinese text, public domain.")
    out.append(" *")
    out.append(" * Pair structure:")
    out.append(" * - 28 mirror-pairs (綜) + 4 polarity-pairs (錯, for the 8 self-mirror")
    out.append(" *   hexagrams) cover 64 hexagrams in 32 pairs.")
    out.append(" * - 53 entries (not 32) because the famously disordered final stretch")
    out.append(" *   breaks the regular pairing — preserved as-is per recognized")
    out.append(" *   textual feature.")
    out.append(" * - One closing coda entry has an empty pair[] (no specific hex reference).")
    out.append(" */")
    out.append("export const ZA_GUA: ZaGuaEntry[] = [")
    for e in data["zaGua"]:
        parts = [
            f'index: {e["index"]}',
            "pair: [" + ", ".join(str(x) for x in e["pair"]) + "]",
            "names: [" + ", ".join(ts_str(n) for n in e["names"]) + "]",
            f'text: {ts_str(e["text"])}',
        ]
        if "textEn" in e:
            parts.append(f'textEn: {ts_str(e["textEn"])}')
        out.append(f'  {{ {", ".join(parts)} }},')
    out.append("];")
    out.append("")
    _emit_meta(out, "ZA_GUA_META", data["_meta"])
    out.append("")
    out.append("/**")
    out.append(" * Reverse index: hexagram number (1..64) → its 雜卦 entry.")
    out.append(" *")
    out.append(" * Each hexagram appears in exactly one ZA_GUA entry. For the 8 self-")
    out.append(" * mirror hexagrams (1, 2, 27, 28, 29, 30, 61, 62), the entry pairs them")
    out.append(" * with their polarity partner. Closing-coda entry (empty pair[])")
    out.append(" * contributes no index keys.")
    out.append(" */")
    out.append("export const ZA_GUA_BY_HEX: Record<number, ZaGuaEntry> = (() => {")
    out.append("  const idx: Record<number, ZaGuaEntry> = {};")
    out.append("  for (const entry of ZA_GUA) {")
    out.append("    for (const hex of entry.pair) {")
    out.append("      idx[hex] = entry;")
    out.append("    }")
    out.append("  }")
    out.append("  return idx;")
    out.append("})();")
    out.append("")

    (DATA_DIR / "zagua.ts").write_text("\n".join(out), encoding="utf-8")
    print(f"✓ zagua.ts: {len(data['zaGua'])} entries")


def _emit_meta(out: list[str], name: str, meta: dict) -> None:
    out.append(f"export const {name} = {{")
    out.append(f"  source: {ts_str(meta['source'])},")
    out.append("  crossChecks: [")
    for u in meta.get("crossChecks", []):
        out.append(f"    {ts_str(u)},")
    out.append("  ],")
    out.append(f"  license: {ts_str(meta['license'])},")
    if "punctuationSource" in meta:
        out.append(f"  punctuationSource: {ts_str(meta['punctuationSource'])},")
    out.append("} as const;")


if __name__ == "__main__":
    main()
