# Feature: I Ching Interactive CLI

Migrate a 1190-line Claude Code hook into a standalone interactive CLI with animated terminal divination, journal tracking, and derived hexagram computation. TypeScript + Bun workspace monorepo.

## Dependency Layers

```
L0 — Scaffolding
  01-monorepo-scaffold

L1 — Domain
  02-core-extraction (depends on 01)

L2 — Infrastructure
  03-storage (depends on 02)

L3 — CLI Shell
  04-cli-commands (depends on 02, 03)

L4 — Terminal Engine
  05a-terminal-primitives (depends on 02)
  05b-animation-engine (depends on 05a)
  05c-casting-scenes (depends on 02, 05a, 05b)

L5 — Distribution
  06-binary-builds (depends on 04, 05c)
```

## Tickets

- [ ] [01-monorepo-scaffold](01-monorepo-scaffold.md) — Workspace structure, tsconfig, bunfig, dev deps
- [ ] [02-core-extraction](02-core-extraction.md) — Pure domain logic, 64-hexagram catalog, casting, derivation, 4096-state tests
- [ ] [03-storage](03-storage.md) — JSON/JSONL persistence, XDG paths, config store, legacy discovery
- [ ] [04-cli-commands](04-cli-commands.md) — Commander.js dispatch, hook adapter, non-animated output
- [ ] [05a-terminal-primitives](05a-terminal-primitives.md) — ANSI codes, cell buffer, diff renderer, raw input, color palette
- [ ] [05b-animation-engine](05b-animation-engine.md) — Timeline DSL, sequence/parallel/tween, scene lifecycle, motion presets
- [ ] [05c-casting-scenes](05c-casting-scenes.md) — Coin toss, line formation, hexagram reveal, becoming transformation
- [ ] [06-binary-builds](06-binary-builds.md) — bun build --compile, cross-platform matrix, GitHub Releases, CI

## Data Format Constraint

The existing `iching.json` (daily cache) and `iching.jsonl` (history journal) formats are preserved exactly. No migration required.

## Architecture

```
iching/
├─ apps/cli/          # Commander.js dispatch + interactive session
├─ packages/
│  ├─ core/           # Pure domain (no I/O, no ANSI, no fs)
│  ├─ storage/        # JSON/JSONL persistence behind interfaces
│  └─ terminal/       # ANSI renderer, animation, scenes
```

## Verification Strategy

| Layer | Oracle |
|---|---|
| core | Exhaustive 4096-state test (4^6 line combos → all derivations) |
| storage | Round-trip tests (write → read → assert identical) |
| cli | Deterministic --seed output snapshots |
| terminal | sceneAt(t) keyframe snapshots at known timestamps |
