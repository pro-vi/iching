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
| Yarrow casting | Implemented (2026-05-30) | `core/casting/yarrow.ts`, `YarrowScene` auto, `YarrowManualScene` 18-cut full-manual, ritual-chrome parity with coin |
| Distribution | Infrastructure present | build script, smoke script, CI workflow, release workflow |
| Entropy binding (`bound`) | Implemented (2026-06-10) | `core/random.ts` `BoundRandomSource` (SHA-256 length-prefixed binding of fresh crypto bytes + intention + timestamp + process nonce, hash-counter DRBG); `entropy` config key (default `crypto`); `cast --bound`; `rng` provenance on journal/cache/`cast --json`; Settings row; `bound-random.test.ts` |
| Entropy source evolution | In progress | `bound` shipped (row above); `embodied` and `quantum-remote` remain planned — see `docs/vision/entropy-sources-vision.md` |

## Active Product Questions

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

Shipped in [#2](https://github.com/pro-vi/iching/pull/2) as both auto
(animated ritual) and full-manual (18 sweep-and-snap gestures, one per
round) modes. The earlier deferral — "yarrow should return as its own
guided ritual, not a hidden algorithmic toggle" — is satisfied by the
guided-ritual shape.

The Line-Gate variant (6-cut temporal-hinge manual, documented in the
vision doc's "Manual Modes" section) is the only piece that remains
deferred; it's a third-position manual mode for presence-without-
authorship and lives in the vision doc as a future-work map.

Source: [Yarrow Ritual Vision](docs/vision/yarrow-ritual-vision.md).

## Maintenance Rules

- Keep this file as the current scope summary.
- Keep active product questions here until they graduate into implementation.
- Do not keep historical scope packs after implementation.
- If a feature needs more detail, add a concise section here first.
