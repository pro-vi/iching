"""Shared helpers used by every script in this directory.

Kept minimal on purpose — only the helpers that are actually duplicated
across 2+ scripts live here. Per-script logic stays per-script.
"""

from pathlib import Path

# All scripts live in scripts/data-acquisition/, so the repo root is 2 levels up.
REPO = Path(__file__).resolve().parent.parent.parent

# Conventional input/output locations.
WORKSPACE = REPO / "data-acquisition"
DATA_DIR = REPO / "packages" / "core" / "src" / "data"


def ts_str(s: str) -> str:
    """Encode `s` as a TypeScript double-quoted string literal."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def ts_str_arr(arr: list[str]) -> str:
    """Encode a list of strings as a single-line TS array literal."""
    return "[" + ", ".join(ts_str(s) for s in arr) + "]"
