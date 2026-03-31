# 03: Hexagram Detail Scene

## Summary

Full hexagram reference view with visual line diagram, all commentary styles, trigram structure, and navigable derived hexagram links. Scrollable for long content.

## Design

### Layout

```
┌──────────────────────────────────────────────────┐
│                    ䷀ 乾 Qián                     │  header
│                  The Creative                     │
│──────────────────────────────────────────────────│
│                                                   │
│               ━━━━━━━━━━━━━━━                    │  line 6
│               ━━━━━━━━━━━━━━━                    │  line 5
│               ━━━━━━━━━━━━━━━                    │  line 4
│                                                   │  trigram gap
│               ━━━━━━━━━━━━━━━                    │  line 3
│               ━━━━━━━━━━━━━━━                    │  line 2
│               ━━━━━━━━━━━━━━━                    │  line 1
│                                                   │
│            ☰ 乾 heaven above ☰ 乾 heaven         │  trigrams
│──────────────────────────────────────────────────│
│                                                   │
│  大象傳                                           │  section headers
│  天行健，君子以自強不息                              │  commentary
│                                                   │
│  彖傳                                             │
│  大哉乾元，萬物資始，乃統天。雲行雨施，品物流形。      │
│                                                   │
│  Image                                            │
│  Heaven moves with vigor; the noble one strives   │
│  ceaselessly                                      │
│                                                   │
│  Judgment                                         │
│  Vast is the primal creative — all things owe     │
│  their beginning to it...                         │
│                                                   │
│  Wilhelm                                          │
│  The movement of heaven is full of power...       │
│──────────────────────────────────────────────────│
│  Derived                                          │
│  > 互卦 Nuclear    ䷀ 乾  The Creative            │  selectable
│    錯卦 Polarity   ䷁ 坤  The Receptive            │  selectable
│    綜卦 Mirror     ䷀ 乾  The Creative             │  selectable
│    對角 Diagonal   ䷁ 坤  The Receptive            │  selectable
│    🔒 Locked pair: 否                              │  (if applicable)
│──────────────────────────────────────────────────│
│  History: Cast 3 times (last: 2026-03-28)        │  journal data
│──────────────────────────────────────────────────│
│  ↑↓ scroll  tab derived  enter open  esc back    │  footer
└──────────────────────────────────────────────────┘
```

### Sections

1. **Header**: hexagram symbol + Chinese name + pinyin + English name
2. **Line diagram**: visual hexagram (reuse existing line-renderer)
3. **Trigram info**: upper/lower with symbols and names
4. **Commentary** (5 sections, each with label + wrapped text):
   - 大象傳 (dx)
   - 彖傳 (tu)
   - Image (en)
   - Judgment (te)
   - Wilhelm (w)
5. **Derived hexagrams** (4 navigable links):
   - Nuclear, Polarity, Mirror, Diagonal
   - Each shows: label + hexagram symbol + name + English name
   - Cursor-selectable → Enter navigates to that hexagram's detail
   - Locked pair indicator if applicable
6. **History**: count + last date from journal
7. **Footer**: keybindings

### Text wrapping

Commentary text wraps to fit terminal width with padding. Use a simple word-wrap function that breaks at spaces within a max width.

### Navigation

- **Arrow up/down**: scroll content
- **Page up/down**: scroll by viewport height
- **Tab**: jump focus between commentary scroll and derived links
- **Arrow up/down** (on derived links): navigate between links
- **Enter** (on derived link): push new detail scene → `{ goto: "detail:<kw>" }`
- **Escape / backspace**: go back → `{ goto: "back" }`
- **q**: exit entirely

### Module structure

```
packages/terminal/src/scenes/dict/
├─ detail-scene.ts       # DetailScene implementing Scene
├─ detail-model.ts       # DetailModel: scroll position, focused section, selected derived link
├─ detail-renderer.ts    # render all sections into CellBuffer
└─ word-wrap.ts          # simple word-wrap utility
```

### Core data helper

```typescript
// packages/core/src/detail.ts
export interface HexagramDetail {
  kw: number;
  gua: Hexagram;
  structure: { upper: TrigramInfo; lower: TrigramInfo };
  nuclear: { kw: number; gua: Hexagram };
  polarity: { kw: number; gua: Hexagram };
  mirror: { kw: number; gua: Hexagram };
  diagonal: { kw: number; gua: Hexagram };
  isLocked: boolean;
  lockedPartner?: { kw: number; gua: Hexagram };
}

export function buildHexagramDetail(kw: number): HexagramDetail;
```

Shared by both CLI `hexagram` command and TUI detail scene.

## Scope

### Files

- `packages/terminal/src/scenes/dict/detail-scene.ts` (new)
- `packages/terminal/src/scenes/dict/detail-model.ts` (new)
- `packages/terminal/src/scenes/dict/detail-renderer.ts` (new)
- `packages/terminal/src/scenes/dict/word-wrap.ts` (new)
- `packages/core/src/detail.ts` (new — shared HexagramDetail builder)
- `packages/core/src/index.ts` (modify — re-export)
- `packages/terminal/src/index.ts` (modify — re-export)
- Tests

### Acceptance criteria

- [ ] Shows all hexagram info: symbol, names, line diagram, trigrams, 5 commentaries, derived links
- [ ] Commentary text wraps correctly at terminal width
- [ ] Scrollable when content exceeds viewport
- [ ] Derived hexagram links are selectable with arrow keys
- [ ] Enter on derived link navigates to that hexagram → `{ goto: "detail:<kw>" }`
- [ ] Escape/backspace returns → `{ goto: "back" }`
- [ ] Locked pair indicator shows when applicable
- [ ] History line shows cast count and last date (or "never cast")
- [ ] `buildHexagramDetail(kw)` returns complete detail struct
- [ ] Line diagram renders correctly (reuses existing renderLine)
- [ ] Renders correctly at 80×24 minimum

### Dependencies

- Depends on [01-tui-primitives](01-tui-primitives.md) (ScrollableRegion, KeyParser extensions)
- Depends on [02-browse-search](02-browse-search.md) (for navigation context, but can be built in parallel)

### Estimate

~700 LOC (source) + ~300 LOC (tests)
