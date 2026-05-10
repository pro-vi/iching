# Current Scope Spec

This is the current scope view for the repository. It is the only scope/spec
document in the repository.

## Product Shape

`iching` is a local-first terminal I Ching application:

- one-shot CLI commands for casting, journal, config, paths, doctor, and lookup
- fullscreen TUI for daily casting, journal review, settings, and dictionary
- pure domain package for casts, derivations, search, and hexagram data
- JSON/JSONL storage using XDG-compatible local paths
- raw ANSI terminal renderer with animation scenes and large glyph reveals
- build and release scripts for standalone binaries and npm distribution

## Scope Status

This table is code-inventory verified as of 2026-05-09. It confirms that the
major subsystem exists in the tree; it is not a fresh acceptance pass for every
old checkbox.

| Area | Status | Evidence |
|---|---|---|
| Workspace monorepo | Implemented | `apps/cli`, `packages/core`, `packages/storage`, `packages/terminal` |
| Core domain | Implemented | casting, derivation, lookup, detail, search, formatters, exhaustive tests |
| Storage | Implemented | paths, JSON/JSONL stores, config store, legacy discovery, atomic-write tests |
| CLI commands | Implemented | `cast`, `journal`, `hexagram`, `config`, `paths`, `doctor`, `dict` |
| Terminal primitives | Implemented | cell buffer, diff renderer, ANSI, key parser, raw input, session lifecycle |
| Animation engine | Implemented | timeline DSL, runner, easing, presets, scene loop |
| Casting scenes | Implemented | cast scene, coin/line/morph/reveal renderers, timeline builder |
| TUI dictionary | Implemented | browse model/scene, detail model/scene, dictionary command, scene routing |
| Large glyph support | Implemented | glyph data, glyph animation modes, cast/detail integration |
| Distribution | Infrastructure present | build script, smoke script, CI workflow, release workflow |
| Entropy source evolution | Planned | see `docs/vision/entropy-sources-vision.md` |

## Active Product Questions

### Entropy Binding

Next likely scope: add a `bound` entropy path that mixes local crypto entropy
with intention/session context.

Constraints:

- keep `crypto` as the default
- use intention as salt/context, never as the sole seed
- preserve explicit deterministic `--seed`
- record provenance in JSON and journal output if the source becomes user-visible
- do not add network entropy in this step

Source: [Entropy Sources Vision](docs/vision/entropy-sources-vision.md).

### Embodied Entropy

Future scope: collect local timing/jitter during an existing ritual window and
mix it with local crypto entropy plus intention binding.

Constraints:

- keep raw timing local
- do not store raw timing samples unless there is a specific need
- describe the feature as local participation, not superior science
- add only after the casting flow has a natural collection point

Source: [Entropy Sources Vision](docs/vision/entropy-sources-vision.md).

### Quantum Remote

Future optional scope: fetch remote quantum-origin entropy and mix it with local
crypto and intention binding.

Constraints:

- opt-in only
- never default
- provider abstraction required
- timeout and fallback required
- fetch one entropy block per cast, not one call per coin/line/stalk
- user-facing provenance must say remote quantum-origin entropy, not stronger
  metaphysical efficacy

Source: [Entropy Sources Vision](docs/vision/entropy-sources-vision.md).

### Yarrow

Deferred.

Yarrow should not be added as a hidden algorithmic toggle. It has animation,
pacing, instruction, and data-entry implications and should return as its own
guided ritual scope.

Source: [Entropy Sources Vision](docs/vision/entropy-sources-vision.md).

## Maintenance Rules

- Keep this file as the current scope summary.
- Keep active product questions here until they graduate into implementation.
- Do not keep historical scope packs after implementation.
- If a feature needs more detail, add a concise section here first.
