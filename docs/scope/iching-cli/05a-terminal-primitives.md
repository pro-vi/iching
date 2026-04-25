# 05a: Terminal Primitives

## Summary

Build the foundational terminal rendering layer: ANSI escape code library, styled cell buffer, row-level diff renderer, raw keyboard input decoder, terminal session lifecycle, and the Temple Night color palette. This is the rendering substrate that the animation engine and scenes build on.

## Design

### Module structure

```
packages/terminal/src/
├─ index.ts                     # public API
├─ ansi/
│  ├─ codes.ts                  # escape sequences: cursor, screen, alt buffer
│  └─ sgr.ts                    # color/style codes: truecolor, 256, 16 fallbacks
├─ color/
│  ├─ detect.ts                 # detect terminal color support (COLORTERM, TERM, NO_COLOR)
│  └─ themes/
│     └─ lantern.ts             # bone/ash/gold/moon/vermilion + jade/cinnabar palette
├─ input/
│  ├─ raw-input.ts              # enable raw mode, read stdin bytes
│  └─ key-parser.ts             # decode escape sequences → KeyEvent
├─ render/
│  ├─ cell.ts                   # StyledCell type: { char, fg?, bg?, bold?, dim? }
│  ├─ buffer.ts                 # CellBuffer: 2D grid of StyledCells
│  ├─ rasterize.ts              # scene layout → CellBuffer (centering, gutters)
│  └─ diff-render.ts            # compare prev/next buffer, emit minimal ANSI patch
├─ layout/
│  └─ measure.ts                # Bun.stringWidth wrapper, centering math
└─ session/
   └─ terminal-session.ts       # enter/exit alt screen, hide/show cursor, cleanup on SIGINT
```

### Core abstractions

**StyledCell:**
```typescript
type StyledCell = {
  char: string;       // single character
  fg?: string;        // hex color "#C8A96B" or named
  bg?: string;
  bold?: boolean;
  dim?: boolean;
};
```

**CellBuffer:**
```typescript
class CellBuffer {
  constructor(width: number, height: number);
  setCell(row: number, col: number, cell: StyledCell): void;
  getCell(row: number, col: number): StyledCell;
  writeText(row: number, col: number, text: string, style?: Partial<StyledCell>): void;
  clear(): void;
}
```

**DiffRenderer:**
```typescript
class DiffRenderer {
  present(prev: CellBuffer, next: CellBuffer): void;
  // Compares row-by-row, emits cursor-move + styled text only for changed rows
  // Single process.stdout.write() per frame
}
```

**TerminalSession:**
```typescript
class TerminalSession {
  enter(): void;    // alt screen, hide cursor, raw mode
  exit(): void;     // restore everything
  onResize(cb: (cols: number, rows: number) => void): void;
  // Registers SIGINT/SIGTERM/SIGHUP handlers for cleanup
  // Wraps in try/finally for crash safety
}
```

**KeyEvent:**
```typescript
type KeyEvent =
  | { type: "char"; char: string }
  | { type: "enter" }
  | { type: "escape" }
  | { type: "arrow"; direction: "up" | "down" | "left" | "right" }
  | { type: "ctrl"; char: string }    // ctrl-c, ctrl-d, etc.
  | { type: "resize"; cols: number; rows: number };
```

### Lantern palette (truecolor)

```typescript
const LANTERN = {
  ash:        "#6E5840",    // scaffolding, breath, dim prompts
  stone:      "#A89072",    // forming lines
  bone:       "#EBD9B2",    // settled lines, main text
  gold:       "#D88A3C",    // active/reveal accent (flame)
  brightGold: "#F0AC54",    // peak pulse
  moon:       "#9CA8A0",    // old yin accent
  vermilion:  "#B05540",    // rare title accent
  jade:       "#7FA08A",    // old yin (brief 2)
  cinnabar:   "#C66838",    // old yang (brief 2)
  mist:       "#6B6052",    // forming coins
  glow:       "#FFE5B0",    // peak brightness
  ink:        "#15110B",    // background (warm dark)
};
```

With 256-color fallbacks for each.

### Color detection

Check in order: `NO_COLOR` → `COLORTERM` → `TERM` → `WT_SESSION` → default 16.

## Scope

### Files

- All files listed in module structure above
- `packages/terminal/src/__tests__/buffer.test.ts`
- `packages/terminal/src/__tests__/diff-render.test.ts`
- `packages/terminal/src/__tests__/key-parser.test.ts`
- `packages/terminal/src/__tests__/measure.test.ts`
- `packages/terminal/src/__tests__/color-detect.test.ts`

### Acceptance criteria

- [ ] CellBuffer: create, setCell, getCell, writeText, clear all work correctly
- [ ] CellBuffer.writeText handles multi-cell-width characters (CJK) via Bun.stringWidth
- [ ] DiffRenderer: identical buffers → zero bytes written
- [ ] DiffRenderer: single changed row → only that row's ANSI emitted
- [ ] DiffRenderer: outputs exactly one `process.stdout.write()` call per present()
- [ ] DiffRenderer: generates correct truecolor SGR sequences (`38;2;r;g;b`)
- [ ] DiffRenderer: falls back to 256-color when truecolor not detected
- [ ] KeyParser: decodes arrow keys, Enter, Escape, Ctrl-C from raw bytes
- [ ] KeyParser: handles incomplete escape sequences (buffer and wait)
- [ ] TerminalSession: enters alt screen, hides cursor on enter()
- [ ] TerminalSession: restores alt screen, shows cursor on exit()
- [ ] TerminalSession: cleanup runs on SIGINT, SIGTERM, SIGHUP
- [ ] TerminalSession: cleanup runs even if an error is thrown
- [ ] SIGWINCH / resize event fires onResize callback with correct dimensions
- [ ] Temple Night palette renders correctly in truecolor terminals
- [ ] Color detection correctly identifies truecolor, 256, 16, and none
- [ ] `NO_COLOR` env var disables all color output
- [ ] Layout centering works for terminal widths 80, 100, 120

### Dependencies

- Depends on [01-monorepo-scaffold](01-monorepo-scaffold.md)
- Depends on [02-core-extraction](02-core-extraction.md) (imports types for scene data)

### Estimate

~500 LOC (source) + ~300 LOC (tests)
