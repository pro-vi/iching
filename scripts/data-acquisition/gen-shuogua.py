#!/usr/bin/env python3
"""
gen-shuogua.py — U3 of the data-enrichment plan.

Reads `data-acquisition/shuogua.json` and emits
`packages/core/src/data/shuogua.ts` with two exports:

    SHUO_GUA       — 11 canonical chapters (standard 王弼/孔穎達 division)
    TRIGRAM_ASSOC  — 8-trigram structured catalogue keyed by zh char

Source is ancient classical Chinese (~5th-3rd century BCE, Ten Wings),
public domain. Canonical fields are normalized to pure canonical chars
per 說卦 ch.7-10 — phonological variants ((悅) on 兌) and alternate
images (木 on 巽) are stripped from the canonical column; alternates
already live in extendedImages.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib import DATA_DIR, WORKSPACE, ts_str, ts_str_arr  # noqa: E402

SRC = WORKSPACE / "shuogua.json"

TRIGRAM_ORDER = ["qian", "kun", "zhen", "xun", "kan", "li", "gen", "dui"]
CANONICAL_FIELDS = ["image", "family", "body", "animal", "direction", "attribute"]


def normalize_canonical(s: str) -> str:
    """Strip `(...)` annotations and `/ alt` alternatives — keep primary only."""
    s = re.sub(r"\s*\([^)]*\)", "", s)
    s = s.split(" / ")[0]
    return s.strip()


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    out: list[str] = []
    out.append('import type { ShuoguaChapter, TrigramAssoc } from "../types.js";')
    out.append("")
    out.append("/**")
    out.append(" * 說卦傳 — Discussion of the Trigrams.")
    out.append(" *")
    out.append(" * One of the Ten Wings of the I Ching. Composed ~5th-3rd century BCE")
    out.append(" * (Warring States / early Han); transmitted with the Yijing for over")
    out.append(" * 2,200 years. Public domain.")
    out.append(" */")
    out.append("export const SHUO_GUA: { chapters: ShuoguaChapter[] } = {")
    out.append("  chapters: [")
    for ch in data["chapters"]:
        out.append(f'    {{ n: {ch["n"]}, text: {ts_str(ch["text"])} }},')
    out.append("  ],")
    out.append("};")
    out.append("")
    out.append("/**")
    out.append(" * Structured trigram catalogue from 說卦 chapters 7–11, keyed by")
    out.append(" * trigram zh character.")
    out.append(" *")
    out.append(" * Canonical fields are normalized to the pure canonical character.")
    out.append(" * Optional fields (season, cosmologicalRole, other) are editorial")
    out.append(" * synthesis with English glosses — UI must label as derived.")
    out.append(" */")
    out.append("export const TRIGRAM_ASSOC: Record<string, TrigramAssoc> = {")
    for key in TRIGRAM_ORDER:
        a = data["trigramAssociations"][key]
        out.append(f'  // {key} — {a["name"]}')
        out.append(f'  {ts_str(a["name"])}: {{')
        for f in CANONICAL_FIELDS:
            out.append(f"    {f}: {ts_str(normalize_canonical(a[f]))},")
        out.append(f'    extendedImages: {ts_str_arr(a["extendedImages"])},')
        for opt in ("season", "cosmologicalRole", "other"):
            if opt in a:
                out.append(f"    {opt}: {ts_str(a[opt])},")
        out.append("  },")
    out.append("};")
    out.append("")
    out.append("export const SHUO_GUA_META = {")
    out.append(f'  source: {ts_str(data["_meta"]["source"])},')
    out.append("  crossChecks: [")
    for u in data["_meta"].get("crossChecks", []):
        out.append(f"    {ts_str(u)},")
    out.append("  ],")
    out.append(f'  license: {ts_str(data["_meta"]["license"])},')
    out.append(f'  chapterCount: {data["_meta"]["chapterCount"]},')
    out.append("} as const;")
    out.append("")

    (DATA_DIR / "shuogua.ts").write_text("\n".join(out), encoding="utf-8")
    print(f"✓ shuogua.ts: {len(data['chapters'])} chapters, "
          f"{len(data['trigramAssociations'])} trigram associations")


if __name__ == "__main__":
    main()
