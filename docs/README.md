# Documentation Map

This directory has two main kinds of documentation:

| Area | Purpose | Use When |
|---|---|---|
| [vision](vision/README.md) | Product and architectural direction | You need the "why" or want to shape future work. |
| [SPEC](../SPEC.md) | Current scope summary | You need the "what to build" breakdown for current work. |

The only scope document is [SPEC.md](../SPEC.md) at the repository root. Older
historical scope packs were removed to keep the docs focused on the current
product shape.

## Vision Notes

| Doc | Focus | Status |
|---|---|---|
| [Entropy Sources Vision](vision/entropy-sources-vision.md) | Randomness, intention binding, locality, and provenance | Vision note; not an implementation plan. |
| [Large Glyph Integration](vision/large-glyph-integration.md) | Where large braille-rendered Chinese glyphs appear in cast and dictionary flows | Vision direction; implementation details may need revalidation. |

## Scope Spec

| Spec | Focus | Entry Point |
|---|---|---|
| Current Scope Spec | Current product shape, subsystem status, and active product questions | [../SPEC.md](../SPEC.md) |

## Reading Order

For current product direction:

1. [Entropy Sources Vision](vision/entropy-sources-vision.md)
2. [Large Glyph Integration](vision/large-glyph-integration.md)

For implementation context:

1. [Current Scope Spec](../SPEC.md)

## Maintenance Rules

- Put long-term product and architecture choices in `vision/`.
- Keep current implementation scope in repository-root `SPEC.md`.
- If a new feature needs a larger breakdown, add it to `SPEC.md` first and only
  split it out once the single file becomes hard to read.
- Do not keep historical scope packs around after implementation; preserve only
  current decisions and active questions.
