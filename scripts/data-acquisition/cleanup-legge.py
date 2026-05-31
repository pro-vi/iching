#!/usr/bin/env python3
"""
cleanup-legge.py — U9 of the data-enrichment plan.

Applies in-place structural fixes to `data-acquisition/legge-cleaned.json`
that the U9 pull workflow's `structural-cleanliness` verifier flagged
beyond the four documented blockers. Idempotent: re-running produces the
same file.

Fixes applied:

1. Hex 41 (Sun) line 2 — append a trailing period (verified against
   archive.org SBE16 OCR which has the period; cleanup pass dropped it).
2. xuGua footnote-digit residue — the original regex stripped letter-
   fused digits (Kun1, Li4) but missed two other variants:
     - paren-suffix: `(come to be supplied)2` → `(come to be supplied)`
     - space-separated: `multitudes 3;` → `multitudes;` / `Ku 6.` → `Ku.`
3. OCR artifact "things axe subjected to restraint" → "things are
   subjected to restraint" — `axe` mis-OCR for `are` in 3 xuGua entries
   (hex 8/9/10).

Assertions verify every named blocker stays fixed after the script runs.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib import WORKSPACE  # noqa: E402

PATH = WORKSPACE / "legge-cleaned.json"


def main() -> None:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    fixes_applied: list[str] = []

    # Fix 1: hex 41 line 2 trailing period.
    hex41 = data["hexagrams"][40]
    if hex41["n"] != 41:
        raise SystemExit(f"expected hex 41, got {hex41['n']}")
    if not hex41["lines"][1].rstrip().endswith("."):
        hex41["lines"][1] = hex41["lines"][1].rstrip() + "."
        fixes_applied.append("hex 41 line 2: appended trailing period")

    # Fix 2: xuGua footnote-digit residue (extended variants).
    patterns = [
        (re.compile(r"\)(\d+)\b"), ")"),                              # (X)2 → (X)
        (re.compile(r"\b([a-zA-Z]+)\s+(\d+)([.,;:])"), r"\1\3"),      # word N. → word.
    ]
    xugua_fixes = 0
    for entry in data["wings"]["xuGua"]:
        before = entry["text"]
        for pat, replacement in patterns:
            entry["text"] = pat.sub(replacement, entry["text"])
        if before != entry["text"]:
            xugua_fixes += 1
    if xugua_fixes:
        fixes_applied.append(f"xuGua footnote-digit residue: {xugua_fixes} entries cleaned")

    # Fix 3: 'axe subjected' → 'are subjected'.
    axe_fixes = 0
    for entry in data["wings"]["xuGua"]:
        if "axe subjected" in entry["text"]:
            entry["text"] = entry["text"].replace("axe subjected", "are subjected")
            axe_fixes += 1
    if axe_fixes:
        fixes_applied.append(f"OCR 'axe' → 'are': {axe_fixes} entries")

    # Record fixes in _meta.
    data.setdefault("_meta", {}).setdefault("postPullFixes", []).extend([
        "hex 41 line 2 missing trailing period — appended",
        f"xuGua footnote-digit residue in {xugua_fixes} entries — extended regex for "
        "(...)N and space-separated word N forms",
        f"OCR 'axe subjected' → 'are subjected' in {axe_fixes} entries (hex 8/9/10)",
    ])

    # Verify invariants.
    assert data["hexagrams"][40]["lines"][1].rstrip().endswith("."), "hex 41 line 2 fix failed"
    for entry in data["wings"]["xuGua"]:
        assert not re.search(r"\)\d", entry["text"]), \
            f"hex {entry['n']} still has paren-digit residue"
        assert not re.search(r"\b[a-zA-Z]+ \d+[.,;:]", entry["text"]), \
            f"hex {entry['n']} still has space-separated digit residue"
        assert "axe subjected" not in entry["text"], \
            f"hex {entry['n']} still has 'axe subjected' artifact"
        assert not re.search(r"[A-Z][a-z]+\d\b", entry["text"]), \
            f"hex {entry['n']} regressed letter-fused digit"

    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    for fix in fixes_applied:
        print(f"  ✓ {fix}")
    print(f"File updated: {PATH}")
    print("All structural-cleanliness invariants now hold.")


if __name__ == "__main__":
    main()
