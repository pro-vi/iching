# Vision Docs

Vision docs capture direction, tradeoffs, and product intent. They are upstream
of implementation scope, so they can contain future work and rejected options.

| Doc | What It Decides | Implementation Posture |
|---|---|---|
| [Entropy Sources Vision](entropy-sources-vision.md) | Names and contracts for `crypto`, `bound`, `embodied`, `quantum-remote`, and `seed` entropy modes | No implementation yet; recommends `bound` as the next entropy step. |
| [Large Glyph Integration](large-glyph-integration.md) | Placement and behavior of large braille-rendered Chinese glyphs across cast, dictionary, settings, and journal surfaces | Treat as design direction; verify current code before using as a task list. |

## How To Use These

Read vision docs before changing user-facing ritual, animation, entropy, or
dictionary behavior. If implementation decisions diverge from a vision doc,
prefer updating the doc with a short "Current decision" note over letting it
drift.
