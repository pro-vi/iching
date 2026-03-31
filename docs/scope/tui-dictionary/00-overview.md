# Feature: TUI Dictionary

Searchable I Ching reference inside the terminal. Browse all 64 hexagrams, search by Chinese name/pinyin/English, view full detail with commentary and navigable derived hexagram links.

## Dependency Layers

```
L0 — Primitives
  01-tui-primitives (ScrollableRegion, TextInput, KeyParser extensions, scene router)

L1 — Scenes (parallel after L0)
  02-browse-search (scrollable list + search filter)
  03-hexagram-detail (full hexagram info + derived navigation)

L2 — Integration
  04-entry-point (iching dict command, post-cast [d], journal per-hexagram)
```

## Tickets

- [ ] [01-tui-primitives](01-tui-primitives.md) — ScrollableRegion, TextInput, KeyParser extensions, scene router
- [ ] [02-browse-search](02-browse-search.md) — Browsable list of 64 hexagrams with search by name/pinyin/English
- [ ] [03-hexagram-detail](03-hexagram-detail.md) — Full hexagram view with commentary, trigrams, derived links
- [ ] [04-entry-point](04-entry-point.md) — Wire `iching dict` command, post-cast prompt, journal integration

## Data Change

Add `ename` (short English name) to the `Hexagram` type in `@iching/core`. Done as part of ticket 01 since it's a data prerequisite.
