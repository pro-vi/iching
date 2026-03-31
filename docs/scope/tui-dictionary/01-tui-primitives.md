# 01: TUI Primitives

## Summary

Add the mid-level terminal widgets needed for a dictionary UI: scrollable region, text input, extended key parsing, scene router, and English hexagram names in core data.

## Design

### Module structure (new files in packages/terminal/src/)

```
packages/terminal/src/
├─ widgets/
│  ├─ scrollable.ts         # ScrollableRegion: virtual content + viewport
│  └─ text-input.ts         # TextInput: char accumulator, cursor, render
├─ input/
│  └─ key-parser.ts         # EXTEND: add PageUp/Down, Home/End, Tab, Backspace
└─ scene/
   └─ router.ts             # SceneRouter: push/pop/goto scene navigation
```

### ScrollableRegion

```typescript
export class ScrollableRegion {
  contentLines: string[];       // all content (can exceed viewport height)
  scrollOffset: number;         // first visible line index
  viewportHeight: number;

  scrollUp(n?: number): void;
  scrollDown(n?: number): void;
  pageUp(): void;
  pageDown(): void;
  scrollToTop(): void;
  scrollToBottom(): void;

  // Returns the visible slice of content for rendering
  visibleLines(): string[];

  // Scroll indicator: "3/42" or percentage
  scrollIndicator(): string;
}
```

### TextInput

```typescript
export class TextInput {
  value: string;
  cursorPos: number;

  insert(char: string): void;
  backspace(): void;
  delete(): void;
  moveCursorLeft(): void;
  moveCursorRight(): void;
  moveToStart(): void;
  moveToEnd(): void;
  clear(): void;

  // Render the input field into a buffer row with cursor highlight
  render(buf: CellBuffer, row: number, col: number, width: number, style?: Partial<StyledCell>): void;
}
```

### KeyParser extensions

Add recognition for:
- `PageUp` (ESC [ 5 ~) → `{ type: "page"; direction: "up" }`
- `PageDown` (ESC [ 6 ~) → `{ type: "page"; direction: "down" }`
- `Home` (ESC [ H or ESC [ 1 ~) → `{ type: "home" }`
- `End` (ESC [ F or ESC [ 4 ~) → `{ type: "end" }`
- `Tab` (0x09) → `{ type: "tab" }`
- `Backspace` (0x7F) → `{ type: "backspace" }` (currently mapped to ctrl-?)

Update KeyEvent union type accordingly.

### SceneRouter

```typescript
export class SceneRouter {
  private stack: Scene[];

  push(scene: Scene): void;      // navigate forward
  pop(): Scene | undefined;      // go back
  replace(scene: Scene): void;   // replace current
  current(): Scene;              // active scene

  // Run the router inside a terminal session — handles goto signals
  async run(session: TerminalSession, clock: Clock, colorSupport: ColorSupport): Promise<void>;
}
```

The router wraps `runScene` in a loop. When a scene returns `{ goto: "back" }`, it pops. When it returns `{ goto: "detail:42" }`, it pushes a new scene. `"exit"` exits the whole router.

### Core data: English names

Add `ename: string` to the `Hexagram` interface in `packages/core/src/types.ts`. Populate all 64 entries in `packages/core/src/data/gua.ts`:

```
1: "The Creative", 2: "The Receptive", 3: "Difficulty at the Beginning",
4: "Youthful Folly", 5: "Waiting", 6: "Conflict", 7: "The Army",
8: "Holding Together", 9: "Small Taming", 10: "Treading", ...
```

### Search utility (in @iching/core)

```typescript
// packages/core/src/search.ts
export function searchHexagrams(query: string): Hexagram[] {
  // Normalize: lowercase, strip diacritics
  // Match against: n (Chinese), p (pinyin), ename (English), KW number
  // Return matching hexagrams sorted by relevance (exact > prefix > includes)
}
```

## Scope

### Files

- `packages/terminal/src/widgets/scrollable.ts` (new)
- `packages/terminal/src/widgets/text-input.ts` (new)
- `packages/terminal/src/scene/router.ts` (new)
- `packages/terminal/src/input/key-parser.ts` (modify — extend KeyEvent + parseKey)
- `packages/terminal/src/index.ts` (modify — re-export new widgets/router)
- `packages/core/src/types.ts` (modify — add ename field)
- `packages/core/src/data/gua.ts` (modify — add ename to all 64 entries)
- `packages/core/src/search.ts` (new)
- `packages/core/src/index.ts` (modify — re-export search)
- Tests for each new module

### Acceptance criteria

- [ ] ScrollableRegion: scroll up/down/page, stays within bounds, returns correct visible slice
- [ ] ScrollableRegion: scrollIndicator shows position
- [ ] TextInput: insert/backspace/delete/cursor movement all work
- [ ] TextInput: renders with cursor highlight at correct position
- [ ] KeyParser: PageUp, PageDown, Home, End, Tab, Backspace all emit correct events
- [ ] KeyParser: existing tests still pass (backward compatible)
- [ ] SceneRouter: push/pop/replace navigate correctly
- [ ] SceneRouter: `{ goto: "back" }` pops, `"exit"` exits loop
- [ ] `Hexagram.ename` exists on all 64 entries with correct English names
- [ ] `searchHexagrams("qian")` finds 乾 (The Creative)
- [ ] `searchHexagrams("creative")` finds 乾
- [ ] `searchHexagrams("乾")` finds 乾
- [ ] `searchHexagrams("1")` finds hexagram 1
- [ ] Search is case-insensitive and diacritic-insensitive
- [ ] All existing 254 tests still pass

### Dependencies

- None (L0 — foundation)

### Estimate

~800 LOC (source) + ~400 LOC (tests)
