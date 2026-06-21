# Documentation Map

This directory has three main kinds of documentation:

| Area | Purpose | Use When |
|---|---|---|
| [vision](vision/README.md) | Product and architectural direction | You need the "why" or want to shape future work. |
| [SPEC](../SPEC.md) | Current scope summary | You need the "what to build" breakdown for current work. |
| [process](process/) | Engineering invariants to check against | You're touching a cross-cutting correctness path (e.g. how readings are recovered). |

The only scope document is [SPEC.md](../SPEC.md) at the repository root. Older
historical scope packs were removed to keep the docs focused on the current
product shape.

## Vision Notes

| Doc | Focus | Status |
|---|---|---|
| [Entropy Sources Vision](vision/entropy-sources-vision.md) | Randomness, intention binding, locality, and provenance | Vision note; not an implementation plan. |
| [Large Glyph Integration](vision/large-glyph-integration.md) | Where large braille-rendered Chinese glyphs appear in cast and dictionary flows | Vision direction; implementation details may need revalidation. |
| [Yarrow Ritual Vision](vision/yarrow-ritual-vision.md) | The yarrow stalk method — canonical yarrow odds, 49-stalk arithmetic, terminal vocabulary, ritual choreography, and pacing | Shipped in #2; doc remains as design rationale + future-work map (Line-Gate manual variant). |

## Scope Spec

| Spec | Focus | Entry Point |
|---|---|---|
| Current Scope Spec | Current product shape, subsystem status, and active product questions | [../SPEC.md](../SPEC.md) |

## Process / Invariants

| Doc | Focus | Status |
|---|---|---|
| [Durable Recovery](process/durable-recovery.md) | The journal is the source of truth; cache + note refs are lossy mirrors. Three invariants (durable source, precise ref, consistent recency), the sites each governs, and the anchor tests. | Active engineering invariant — check when touching any reading read/recovery path. |

## Reading Order

For current product direction:

1. [Entropy Sources Vision](vision/entropy-sources-vision.md)
2. [Large Glyph Integration](vision/large-glyph-integration.md)
3. [Yarrow Ritual Vision](vision/yarrow-ritual-vision.md)

For implementation context:

1. [Current Scope Spec](../SPEC.md)

## Maintenance Rules

- Put long-term product and architecture choices in `vision/`.
- Put cross-cutting engineering invariants (correctness rules that span several
  files and recur in review) in `process/`, with the anchor tests named.
- Keep current implementation scope in repository-root `SPEC.md`.
- If a new feature needs a larger breakdown, add it to `SPEC.md` first and only
  split it out once the single file becomes hard to read.
- Do not keep historical scope packs around after implementation; preserve only
  current decisions and active questions.
