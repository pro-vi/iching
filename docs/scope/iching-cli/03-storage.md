# 03: Storage Layer

## Summary

Implement JSON/JSONL persistence behind clean interfaces, with XDG-compliant paths, legacy `~/.claude/` discovery, atomic writes, and a config store. Preserves existing data formats exactly.

## Design

### Module structure

```
packages/storage/src/
├─ index.ts                     # public API re-exports
├─ types.ts                     # DailyCacheRecord, UserConfig, HistoryQuery
├─ paths.ts                     # XDG path resolution + legacy discovery
├─ journal-store.ts             # JournalStore interface
├─ daily-cache-store.ts         # DailyCacheStore interface
├─ config-store.ts              # ConfigStore interface
├─ json/
│  ├─ jsonl-journal.ts          # JsonlJournalStore (append, stream, latest)
│  ├─ json-daily-cache.ts       # JsonDailyCacheStore (read, write with atomic replace)
│  ├─ json-config.ts            # JsonConfigStore (read, write)
│  └─ atomic-write.ts           # write-tmp → fsync → rename pattern
└─ legacy/
   └─ discovery.ts              # detect ~/.claude/iching.json and iching.jsonl
```

### Interfaces

```typescript
interface JournalStore {
  append(entry: HistoryEntry): Promise<void>;
  stream(query?: HistoryQuery): AsyncIterable<HistoryEntry>;
  latest(): Promise<HistoryEntry | null>;
}

interface DailyCacheStore {
  read(): Promise<DailyCacheRecord | null>;
  write(record: DailyCacheRecord): Promise<void>;
}

interface ConfigStore {
  load(): Promise<UserConfig>;
  save(config: UserConfig): Promise<void>;
}
```

### XDG path resolution

```
config:   $XDG_CONFIG_HOME/iching/config.json   → ~/.config/iching/config.json
state:    $XDG_STATE_HOME/iching/history.jsonl   → ~/.local/state/iching/history.jsonl
cache:    $XDG_CACHE_HOME/iching/daily-cache.json → ~/.cache/iching/daily-cache.json
```

Precedence: CLI flag → env var (`ICHING_HOME`) → legacy detected → XDG default.

Legacy discovery: if `~/.claude/iching.json` or `~/.claude/iching.jsonl` exist, read from there. New writes go to XDG locations.

### Atomic writes

For `daily-cache.json` and `config.json`:
1. Write to `{path}.{random}.tmp`
2. `fsync` the temp file
3. `rename` over target (atomic on same filesystem)
4. Close

For `history.jsonl`: append mode, one JSON line + `\n` per entry. No atomic replace needed.

### Config schema

```typescript
interface UserConfig {
  motion: "default" | "brisk" | "deep" | "reduced";
  theme: "ink" | "bone" | "cinnabar" | "jade" | "river";
  color: "auto" | "always" | "never";
  timezone: "system" | string;
}
```

### Data flow

```
apps/cli → storage.paths.resolve() → get file locations
        → dailyCacheStore.read() → check today's cast
        → core.castHexagram() → compute new cast
        → dailyCacheStore.write() → atomic save
        → journalStore.append() → append to JSONL
```

## Scope

### Files

- All files listed in module structure above
- `packages/storage/src/__tests__/paths.test.ts`
- `packages/storage/src/__tests__/journal-store.test.ts`
- `packages/storage/src/__tests__/daily-cache-store.test.ts`
- `packages/storage/src/__tests__/config-store.test.ts`
- `packages/storage/src/__tests__/atomic-write.test.ts`
- `packages/storage/src/__tests__/legacy-discovery.test.ts`

### Acceptance criteria

- [ ] `resolvePaths()` returns config/state/cache paths following XDG spec
- [ ] `resolvePaths()` respects `$XDG_CONFIG_HOME`, `$XDG_STATE_HOME`, `$XDG_CACHE_HOME` overrides
- [ ] Paths use `os.homedir()`, never `~` expansion (Bun doesn't expand tilde)
- [ ] Legacy discovery finds existing `~/.claude/iching.json` and `~/.claude/iching.jsonl`
- [ ] `journalStore.append()` writes exactly one JSON line + `\n` per call
- [ ] `journalStore.stream()` yields entries without loading entire file into memory
- [ ] `journalStore.latest()` returns most recent entry
- [ ] Journal entries preserve exact `HistoryEntry` schema: `{ date, cast }`
- [ ] `dailyCacheStore.write()` uses atomic replace (tmp + fsync + rename)
- [ ] `dailyCacheStore.read()` returns null if no cache file exists
- [ ] Daily cache preserves exact `DailyCacheRecord` schema: `{ date, cast, shown, structure }`
- [ ] `configStore.load()` returns defaults when no config file exists
- [ ] `configStore.save()` creates parent directories if needed
- [ ] All store implementations use `node:fs/promises` (not Bun-specific APIs) for portability
- [ ] Round-trip test: write → read → assert deep equality for all stores
- [ ] Atomic write survives simulated crash (tmp file cleaned up)

### Dependencies

- Depends on [01-monorepo-scaffold](01-monorepo-scaffold.md)
- Depends on [02-core-extraction](02-core-extraction.md) (imports types: HistoryEntry, Cast, Structure)

### Estimate

~350 LOC (source) + ~250 LOC (tests)
