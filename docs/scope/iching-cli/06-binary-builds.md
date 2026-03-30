# 06: Binary Builds & Distribution

## Summary

Set up `bun build --compile` for standalone executables, cross-platform build matrix, GitHub Actions CI pipeline, and GitHub Releases for distribution.

## Design

### Build targets

```bash
bun build --compile --target=bun-darwin-arm64 --outfile dist/iching-darwin-arm64
bun build --compile --target=bun-darwin-x64   --outfile dist/iching-darwin-x64
bun build --compile --target=bun-linux-x64    --outfile dist/iching-linux-x64
bun build --compile --target=bun-linux-arm64  --outfile dist/iching-linux-arm64
```

Build flags:
```bash
--no-compile-autoload-dotenv    # don't load .env in compiled binary
--no-compile-autoload-bunfig    # don't load bunfig.toml in compiled binary
```

Entry point: `apps/cli/src/main.ts`

### CI pipeline (GitHub Actions)

```
on push/PR:
  1. bun install
  2. bun run typecheck (tsc --noEmit across all packages)
  3. bun test (all packages)

on tag push (v*):
  4. build matrix: darwin-arm64, darwin-x64, linux-x64, linux-arm64
  5. smoke test each binary: ./iching cast --seed 42 --motion reduced
  6. create GitHub Release with binaries attached
  7. codesign macOS binaries (if signing identity available)
```

### npm package (secondary)

```json
{
  "name": "iching-cli",
  "bin": { "iching": "./apps/cli/src/main.ts" },
  "files": ["apps/", "packages/"]
}
```

Published to npm for `bunx iching` / `bun add -g iching-cli`.

### Release script

```
scripts/release.ts:
  - reads version from root package.json
  - runs full test suite
  - builds all targets
  - smoke tests each binary
  - creates git tag
  - outputs ready-to-upload artifacts
```

### Homebrew tap (later)

Not in this ticket. Track as future work after release pipeline is stable.

## Scope

### Files

- `scripts/build.ts` — cross-platform build script
- `scripts/smoke-test.ts` — verify compiled binary works
- `.github/workflows/ci.yml` — lint + test on push/PR
- `.github/workflows/release.yml` — build + publish on tag
- Root `package.json` updates (bin field, version)

### Acceptance criteria

- [ ] `bun run build` produces standalone executable for current platform
- [ ] Compiled binary runs `iching cast --seed 42` and produces correct output
- [ ] Compiled binary runs `iching doctor` and all checks pass
- [ ] Compiled binary starts in <500ms
- [ ] CI runs typecheck + tests on every push and PR
- [ ] CI builds all 4 platform targets on tag push
- [ ] Each compiled binary passes smoke test in CI
- [ ] GitHub Release created with all binaries attached
- [ ] macOS binary codesigned (if signing identity configured)
- [ ] Release binary does NOT auto-load .env or bunfig.toml
- [ ] npm package installable via `bunx iching-cli`
- [ ] `iching --version` matches the git tag version

### Dependencies

- Depends on [04-cli-commands](04-cli-commands.md) (complete CLI to compile)
- Depends on [05c-casting-scenes](05c-casting-scenes.md) (full animation for interactive mode)
- Note: can start CI pipeline (typecheck + tests) as soon as ticket 02 is done

### Estimate

~300 LOC (scripts + CI config)
