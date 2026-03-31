# 02: Browse & Search Scene

## Summary

Scrollable list of all 64 hexagrams with live search filtering. Type to search by Chinese name, pinyin, or English name. Arrow keys to navigate, Enter to open detail view, Escape to clear search.

## Design

### BrowseScene

```
┌─────────────────────────────────────────────┐
│  I Ching Dictionary          [/] search     │  ← header
│─────────────────────────────────────────────│
│  > 1   ䷀  乾  Qián       The Creative     │  ← selected (highlighted)
│    2   ䷁  坤  Kūn        The Receptive     │
│    3   ䷂  屯  Zhūn       Difficulty...     │
│    4   ䷃  蒙  Méng       Youthful Folly    │
│    5   ䷄  需  Xū         Waiting           │
│    ...                                       │
│   64   ䷿  未濟 Wèi Jì    Not Yet Fulfilled │
│─────────────────────────────────────────────│
│  ↑↓ navigate  enter open  / search  q quit  │  ← footer
└─────────────────────────────────────────────┘
```

### Search mode (activated by `/` or any typing)

```
┌─────────────────────────────────────────────┐
│  Search: qian_                               │  ← TextInput active
│─────────────────────────────────────────────│
│  > 1   ䷀  乾  Qián       The Creative     │  ← filtered results
│   15   ䷎  謙  Qiān       Modesty           │
│─────────────────────────────────────────────│
│  ↑↓ navigate  enter open  esc clear  q quit │
└─────────────────────────────────────────────┘
```

### Row format

Each row: `KW#  Unicode  Chinese  Pinyin  EnglishName`

Columns aligned. KW number right-justified (3 chars). Chinese name and pinyin take their natural width. English name fills remaining space (truncated if needed).

### Behavior

- **Arrow up/down**: move cursor in list
- **Page up/down**: scroll by viewport height
- **Enter**: open detail view for selected hexagram → `{ goto: "detail:<kw>" }`
- **/**: activate search mode (focus TextInput)
- **Any printable char** (when not in search mode): activate search with that char
- **Escape** (in search mode): clear search, return to full list
- **Escape** (not in search mode): exit → `{ goto: "back" }` or `"exit"`
- **q**: exit
- Cursor stays on selected item when filtering narrows the list

### Module structure

```
packages/terminal/src/scenes/dict/
├─ browse-scene.ts       # BrowseScene implementing Scene
├─ browse-model.ts       # BrowseModel: cursor position, search state, filtered list
└─ browse-renderer.ts    # render header, list rows, footer, search input
```

## Scope

### Files

- `packages/terminal/src/scenes/dict/browse-scene.ts` (new)
- `packages/terminal/src/scenes/dict/browse-model.ts` (new)
- `packages/terminal/src/scenes/dict/browse-renderer.ts` (new)
- `packages/terminal/src/index.ts` (modify — re-export)
- Tests

### Acceptance criteria

- [ ] Shows all 64 hexagrams in King Wen order by default
- [ ] Arrow keys move cursor, scrolls when cursor hits viewport edge
- [ ] Page up/down scrolls by viewport height
- [ ] Enter on selected hexagram returns `{ goto: "detail:<kw>" }`
- [ ] `/` activates search mode with TextInput
- [ ] Typing any char also activates search mode
- [ ] Search filters by Chinese name, pinyin (diacritic-insensitive), and English name
- [ ] Search by KW number works (typing "11" finds hexagram 11)
- [ ] Escape clears search and restores full list
- [ ] Empty search shows all 64
- [ ] Footer shows available keybindings
- [ ] Cursor wraps or clamps at list boundaries
- [ ] Renders correctly at 80×24 and larger

### Dependencies

- Depends on [01-tui-primitives](01-tui-primitives.md) (ScrollableRegion, TextInput, KeyParser extensions)

### Estimate

~500 LOC (source) + ~200 LOC (tests)
