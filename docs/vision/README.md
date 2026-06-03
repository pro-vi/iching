# Vision Docs

Vision docs capture direction, tradeoffs, and product intent. They are upstream
of implementation scope, so they can contain future work and rejected options.

| Doc | What It Decides | Implementation Posture |
|---|---|---|
| [Entropy Sources Vision](entropy-sources-vision.md) | Names and contracts for `crypto`, `bound`, `embodied`, `quantum-remote`, and `seed` entropy modes | No implementation yet; recommends `bound` as the next entropy step. |
| [Large Glyph Integration](large-glyph-integration.md) | Placement and behavior of large braille-rendered Chinese glyphs across cast, dictionary, settings, and journal surfaces | Treat as design direction; verify current code before using as a task list. |
| [Yarrow Ritual Vision](yarrow-ritual-vision.md) | Canonical yarrow odds, 49-stalk arithmetic, the bar-vocabulary terminal field, the seven-beat round, two-axis pacing, full-manual 18-cut authorship, and cast-flow integration | Shipped in #2 — auto + 18-cut full-manual modes; Line-Gate (6-cut temporal hinge) remains deferred per the "Manual Modes" section. |

## How To Use These

Read vision docs before changing user-facing ritual, animation, entropy, or
dictionary behavior. If implementation decisions diverge from a vision doc,
prefer updating the doc with a short "Current decision" note over letting it
drift.
