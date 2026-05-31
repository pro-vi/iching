#!/usr/bin/env python3
"""
backfill-guaci-xiaoxiang.py — U8 of the data-enrichment plan.

Reads `data-acquisition/guaci-xiaoxiang.json` (verified pull of 卦辭 +
小象傳 from ctext + Wikisource cross-check) and backfills `gc` and
`yaoXiao[6]` fields into every entry of
`packages/core/src/data/gua.ts`.

Two important transforms:

1. Encoding normalization. The pulled JSON uses 无 throughout; gua.ts
   uses 無 elsewhere. Normalizes 无 → 無 GLOBALLY in the inserted text,
   with one exception: the canonical hex-25 name 无妄 is preserved
   verbatim (the hexagram name uses 无 by canonical convention).

2. Boundary-respecting insertion. Each gua.ts hexagram entry closes
   with `    ],\n  },` (yaoEn array close + entry close). The script
   inserts the new fields between the array close and the entry close,
   preserving every existing field byte-for-byte.

Idempotency: re-running on a file that already has `gc:` and `yaoXiao:`
fields will produce duplicates. Don't re-run without reverting gua.ts
first (or extend the script to detect prior insertion).
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lib import DATA_DIR, WORKSPACE, ts_str  # noqa: E402

SRC = WORKSPACE / "guaci-xiaoxiang.json"
GUA_PATH = DATA_DIR / "gua.ts"

SENTINEL = "\x00WUWANG\x00"


def normalize(s: str) -> str:
    """Replace 无 → 無 everywhere except in the canonical hex-25 name 无妄."""
    s = s.replace("无妄", SENTINEL)
    s = s.replace("无", "無")
    s = s.replace(SENTINEL, "无妄")
    return s


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    entries = data["entries"]

    swaps = 0
    for e in entries:
        before = e["gc"]
        e["gc"] = normalize(e["gc"])
        swaps += before.count("无") - e["gc"].count("无")
        for i in range(len(e["yaoXiao"])):
            before_yx = e["yaoXiao"][i]
            e["yaoXiao"][i] = normalize(before_yx)
            swaps += before_yx.count("无") - e["yaoXiao"][i].count("无")
    print(f"normalized {swaps} 无 → 無 substitutions (preserving 无妄)")

    # Sanity check: any remaining 无 must be in 无妄.
    for e in entries:
        for txt in [e["gc"], *e["yaoXiao"]]:
            for m in re.finditer(r"无.", txt):
                if m.group(0) != "无妄":
                    raise SystemExit(
                        f"UNEXPECTED 无 context at hex {e['hexagram']}: {m.group(0)!r}"
                    )
    print("✓ all remaining 无 are in 无妄 (canonical hex-25 name)")

    if len(entries) != 64:
        raise SystemExit(f"expected 64 entries, got {len(entries)}")
    for i, e in enumerate(entries):
        if e["hexagram"] != i + 1:
            raise SystemExit(f"entry order mismatch at index {i}")
        if len(e["yaoXiao"]) != 6:
            raise SystemExit(f"hex {e['hexagram']}: yaoXiao length is {len(e['yaoXiao'])}, expected 6")

    src = GUA_PATH.read_text(encoding="utf-8")
    pattern = re.compile(r"(    \],\n)(  \},)", re.MULTILINE)
    matches = list(pattern.finditer(src))
    if len(matches) != 64:
        raise SystemExit(f"expected 64 hexagram closings in gua.ts, found {len(matches)}")
    print(f"✓ found {len(matches)} hexagram closings in gua.ts")

    new_src = src
    for i in range(63, -1, -1):
        new_src = new_src[: matches[i].start(2)] + _make_insert(entries[i]) + new_src[matches[i].start(2):]

    GUA_PATH.write_text(new_src, encoding="utf-8")
    old_lines = src.count("\n")
    new_lines = new_src.count("\n")
    print(f"✓ gua.ts updated: {old_lines} → {new_lines} lines (+{new_lines - old_lines})")


def _make_insert(entry: dict) -> str:
    parts = [f'    gc: {ts_str(entry["gc"])},']
    parts.append("    yaoXiao: [")
    for s in entry["yaoXiao"]:
        parts.append(f"      {ts_str(s)},")
    parts.append("    ],")
    return "\n".join(parts) + "\n"


if __name__ == "__main__":
    main()
