# 04: CLI Commands

## Summary

Wire Commander.js for command dispatch with subcommands (cast, journal, hexagram, config, paths, doctor). Support both quick command mode and interactive fullscreen mode. Include hook-mode adapter for backward compatibility with Claude Code. No terminal animation yet — plain text output.

## Design

### Module structure

```
apps/cli/src/
├─ main.ts                      # entry point: TTY check → interactive or Commander parse
├─ program.ts                   # Commander program definition with global options
├─ commands/
│  ├─ cast.ts                   # iching cast [question] — one-shot casting
│  ├─ journal.ts                # iching journal list / show <id>
│  ├─ hexagram.ts               # iching hexagram <n> — lookup
│  ├─ config.ts                 # iching config get/set/path
│  ├─ paths.ts                  # iching paths — show resolved file locations
│  └─ doctor.ts                 # iching doctor — environment verification
├─ hook/
│  └─ adapter.ts                # detect hook mode (stdin JSON + no TTY) → run legacy flow
└─ output/
   ├─ plain.ts                  # plain text formatters for terminal output
   └─ json.ts                   # --json structured output
```

### Entry point logic

```typescript
// main.ts
async function main() {
  // Hook mode: stdin is JSON, not a TTY
  if (!process.stdin.isTTY && await detectHookPayload()) {
    return hookAdapter();
  }

  // Interactive mode: no args + TTY
  if (process.argv.length === 2 && process.stdin.isTTY) {
    return interactiveSession(); // placeholder → wired in 05c
  }

  // Command mode: parse with Commander
  program.parse(process.argv);
}
```

### Command surface

```
iching                          # no args + TTY → interactive (placeholder for now)
iching cast [question]          # one-shot cast, plain text output
iching cast --seed 42           # deterministic cast for debugging
iching cast --json              # structured JSON output
iching journal list             # list recent readings
iching journal list --since 2026-03-01
iching journal show <date>      # show specific day's reading
iching journal --json           # JSON output
iching hexagram <n>             # lookup hexagram 1-64
iching hexagram 11 --style dx   # specific commentary style
iching config get motion        # read config value
iching config set motion brisk  # write config value
iching config path              # show config file location
iching paths                    # show all resolved paths (config, state, cache)
iching doctor                   # verify glyphs, data integrity, color support, terminal width
```

### Global options

```
--json              structured JSON output (suppresses all decoration)
--theme <name>      color theme (default: lantern)
--motion <preset>   animation preset: default | brisk | deep | reduced
--ansi <mode>       color mode: auto | always | never
--seed <n>          deterministic RNG seed (debug/test)
--data-dir <path>   override data directory
```

### Hook adapter

Detects Claude Code hook context:
1. `process.stdin.isTTY === false`
2. First bytes of stdin parse as JSON
3. Runs the existing daily-reading logic (check cache → cast if new day → select display → output)

This preserves backward compatibility so the CLI can replace the old hook with `bun apps/cli/src/main.ts` in `hooks.json`.

### Doctor checks

1. **Glyphs**: render ☰ ☱ ☲ ☳ ☴ ☵ ☶ ☷ and ━━━━━ ━━━━━, measure with `Bun.stringWidth()`
2. **Data**: verify GUA array (64 entries), BINARY_TO_KW alignment
3. **Color**: detect COLORTERM, TERM, NO_COLOR → report truecolor/256/16/none
4. **Terminal**: report columns × rows, check ≥ 80 wide
5. **Paths**: show resolved config/state/cache locations, report which exist

## Scope

### Files

- All files listed in module structure above
- `apps/cli/src/__tests__/cast.test.ts`
- `apps/cli/src/__tests__/hook-adapter.test.ts`
- `apps/cli/src/__tests__/doctor.test.ts`

### Acceptance criteria

- [ ] `iching cast` performs a cast and prints plain text reading (hexagram symbol, name, pinyin, commentary)
- [ ] `iching cast --seed 42` produces identical output on every run
- [ ] `iching cast --json` outputs valid JSON with cast data (no ANSI, no decoration)
- [ ] `iching journal list` reads history.jsonl and lists readings by date
- [ ] `iching journal show 2026-03-29` displays a specific day's reading
- [ ] `iching hexagram 11` displays hexagram #11 with all commentary styles
- [ ] `iching config get motion` returns current config value
- [ ] `iching config set motion brisk` updates config file
- [ ] `iching config path` prints resolved config file path
- [ ] `iching paths` prints all resolved file locations (config, state, cache)
- [ ] `iching doctor` runs all 5 checks and reports pass/warn/fail
- [ ] `iching --help` shows all commands and global options
- [ ] `iching cast --help` shows cast-specific help
- [ ] Hook adapter: `echo '{}' | bun apps/cli/src/main.ts` runs daily-reading flow and outputs to stdout
- [ ] Hook adapter: saves cache and appends history like original hook
- [ ] Unknown commands produce helpful error message
- [ ] `--json` suppresses all non-JSON output (no colors, no prompts)
- [ ] Version displayed via `iching --version`

### Dependencies

- Depends on [02-core-extraction](02-core-extraction.md)
- Depends on [03-storage](03-storage.md)
- Dev dependency: `commander`, `@commander-js/extra-typings`

### Estimate

~500 LOC (source) + ~200 LOC (tests)
