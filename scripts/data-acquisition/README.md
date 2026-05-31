# scripts/data-acquisition/

Reproducible-data tooling for the canonical-text data layer. Each script implements one step of the data-enrichment recipe documented in `docs/data-layers.md` § "Adding a new layer — the recipe".

## The recipe

```
┌──────────────────┐    ┌─────────────────────┐    ┌────────────────────────┐
│  pull workflow   │ →  │  data-acquisition/  │ →  │  packages/core/src/    │
│  (Workflow tool) │    │   *.json (verified, │    │   data/*.ts (canonical │
│                  │    │   gitignored)       │    │   data, committed)     │
└──────────────────┘    └─────────────────────┘    └────────────────────────┘
        ↑                        ↑                          ↑
   architecture plan        this directory             this directory
   (docs/plans/...)         is where pulled            transforms pulled
                            JSON lands                 JSON → TS module
```

A canonical-text data layer ships in two halves:

1. The **JSON artifact** in `data-acquisition/` (gitignored, ephemeral) — produced by a `Workflow` invocation that pulls from PD sources and runs adversarial verification.
2. The **TypeScript module** in `packages/core/src/data/*.ts` (committed) — produced by one of the scripts in this directory, transforming the verified JSON into a typed const.

If you need to regenerate any committed data module from scratch:

1. Re-run the pull workflow (see `docs/plans/2026-05-30-001-feat-data-enrichment-plan.md` for the workflow shape — pull → 3-lens verify → backfill).
2. Confirm the JSON landed under `data-acquisition/<corpus>.json`.
3. Run the corresponding script from this directory.
4. `bun run typecheck && bun run test` from the repo root.

## Scripts in this directory

| Script | Unit | Input → Output |
|---|---|---|
| `gen-xugua-zagua.py` | U2 | `xugua-zagua.json` → `data/xugua.ts` + `data/zagua.ts` |
| `gen-shuogua.py` | U3 | `shuogua.json` → `data/shuogua.ts` |
| `backfill-guaci-xiaoxiang.py` | U8 | `guaci-xiaoxiang.json` → `data/gua.ts` (extends 64 entries with `gc` + `yaoXiao`) |
| `cleanup-legge.py` | U9 | `legge-cleaned.json` → `legge-cleaned.json` (idempotent in-place fix for 4 documented structural blockers) |
| `backfill-legge.py` | U10 | `legge-cleaned.json` → `data/legge.ts` + extends `data/gua.ts`, `data/xugua.ts` |
| `lib.py` | shared | `ts_str` + `ts_str_arr` helpers used by every other script |

## Conventions

- **Repo-relative paths:** every script computes the repo root from its own location (`Path(__file__).parent.parent.parent`). No absolute paths.
- **Encoding:** UTF-8 throughout. Generated TS files preserve traditional Chinese (`無` over `无`, with `无妄` protected as the canonical hex-25 name — see `backfill-guaci-xiaoxiang.py`).
- **Idempotency:** running a script twice produces the same output. Backfill scripts insert new fields between specific boundary markers (`yaoEn[...]`, `yaoXiao[...]`) and refuse to double-insert.
- **Boundaries:** the in-place mutators on `gua.ts` use the regex `(    \],\n)(  \},)` to identify each hexagram's closing brace. Insertion happens between groups; processing in reverse keeps offsets stable.

## Why these are committed

Earlier in the project's life these scripts lived in `/tmp/` and were thrown away after each run. That made the data layer "reproducible in theory" but not in practice — a future contributor would have to re-derive the JSON→TS pipeline from scratch.

Committing them here means the recipe IS the tooling. Read one to understand the pattern; copy + adapt for the next data layer (文言傳, 繫辭傳, oracle bones, etc.).
