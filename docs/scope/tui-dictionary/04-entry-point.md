# 04: Entry Point & Journal Integration

## Summary

Wire `iching dict` command, add `[d] dictionary` to post-cast prompt, and integrate per-hexagram journal history into the detail view.

## Design

### CLI command

```
iching dict                  # opens browse/search scene
iching dict <n>              # opens detail view for hexagram n (1-64)
iching dict --search "qian"  # opens browse with search pre-filled (optional V1)
```

Register in `apps/cli/src/program.ts` alongside existing commands.

### Post-cast prompt

Update `[enter] open reading   [j] journal   [q] quit` to:

```
[enter] reading   [j] journal   [d] dictionary   [q] quit
```

`[d]` returns `{ goto: "dictionary" }`. `main.ts` handles it by launching the SceneRouter with BrowseScene.

### Journal integration

Add a helper to scan journal for a specific hexagram:

```typescript
// packages/storage/src/journal-query.ts
export interface HexagramHistory {
  castCount: number;
  lastCastDate: string | null;
  dates: string[];         // all dates this hexagram was cast
}

export async function getHexagramHistory(
  store: JournalStore,
  kwNumber: number,
): Promise<HexagramHistory>;
```

The detail scene calls this and displays "Cast 3 times (last: 2026-03-28)" or "Never cast".

### Interactive mode flow

```
main.ts (no args + TTY)
  → CastScene (animated ritual)
  → signal handling:
      "reading" → print plain text
      "journal" → print latest entry
      "dictionary" → SceneRouter:
          BrowseScene ← → DetailScene (push/pop)
      "exit" → quit
```

## Scope

### Files

- `apps/cli/src/commands/dict.ts` (new — register `iching dict` command)
- `apps/cli/src/program.ts` (modify — register dict command)
- `apps/cli/src/main.ts` (modify — handle "dictionary" signal from post-cast)
- `packages/terminal/src/scenes/cast/cast-scene.ts` (modify — add [d] to prompt + handleKey)
- `packages/storage/src/journal-query.ts` (new)
- `packages/storage/src/index.ts` (modify — re-export)
- `packages/terminal/src/scenes/dict/detail-scene.ts` (modify — wire journal history)
- Tests

### Acceptance criteria

- [ ] `iching dict` launches browse scene in alt screen
- [ ] `iching dict 42` opens detail view for hexagram 42
- [ ] Post-cast prompt shows `[d] dictionary` option
- [ ] Pressing `d` after cast opens dictionary browse scene
- [ ] Navigation: browse → detail → derived detail → back → back → browse → quit works
- [ ] `getHexagramHistory()` correctly counts and dates casts for a hexagram
- [ ] Detail scene shows "Cast N times (last: date)" or "Never cast"
- [ ] `q` from any dictionary scene exits cleanly to terminal
- [ ] Alt screen properly enters/exits for dictionary mode

### Dependencies

- Depends on [02-browse-search](02-browse-search.md)
- Depends on [03-hexagram-detail](03-hexagram-detail.md)

### Estimate

~400 LOC (source) + ~150 LOC (tests)
