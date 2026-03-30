# 01: Monorepo Scaffold

## Summary

Set up the Bun workspace monorepo structure with shared TypeScript config, package boundaries, and dev tooling. This is the foundation everything else builds on.

## Design

Bun workspaces via root `package.json`. Three packages (`core`, `storage`, `terminal`) and one app (`cli`). Shared `tsconfig.base.json` with strict mode. Each package gets its own `package.json` and `tsconfig.json` extending the base.

```
iching/
├─ package.json              # "workspaces": ["apps/*", "packages/*"]
├─ tsconfig.base.json        # strict, ESNext, NodeNext module resolution
├─ bunfig.toml               # test config
├─ .gitignore
├─ apps/
│  └─ cli/
│     ├─ package.json        # depends on @iching/core, @iching/storage, @iching/terminal
│     ├─ tsconfig.json
│     └─ src/
├─ packages/
│  ├─ core/
│  │  ├─ package.json        # no dependencies
│  │  ├─ tsconfig.json
│  │  └─ src/
│  ├─ storage/
│  │  ├─ package.json        # depends on @iching/core
│  │  ├─ tsconfig.json
│  │  └─ src/
│  └─ terminal/
│     ├─ package.json        # depends on @iching/core
│     ├─ tsconfig.json
│     └─ src/
```

Package naming: `@iching/core`, `@iching/storage`, `@iching/terminal`, `@iching/cli`.

All packages use `"private": true` (no npm publish for individual packages — only the CLI ships).

## Scope

### Files

- `package.json` — root workspace config
- `tsconfig.base.json` — shared strict TypeScript config
- `bunfig.toml` — Bun test runner config
- `.gitignore` — node_modules, dist, .cache, *.db
- `apps/cli/package.json`
- `apps/cli/tsconfig.json`
- `apps/cli/src/main.ts` — placeholder entry point
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts` — placeholder export
- `packages/storage/package.json`
- `packages/storage/tsconfig.json`
- `packages/storage/src/index.ts` — placeholder export
- `packages/terminal/package.json`
- `packages/terminal/tsconfig.json`
- `packages/terminal/src/index.ts` — placeholder export

### Acceptance criteria

- [ ] `bun install` succeeds from root
- [ ] `bun test` runs from root (finds tests in all packages)
- [ ] `bun run apps/cli/src/main.ts` executes without error
- [ ] `packages/core` has zero dependencies
- [ ] `packages/storage` can import types from `@iching/core`
- [ ] `packages/terminal` can import types from `@iching/core`
- [ ] `apps/cli` can import from all three packages
- [ ] TypeScript strict mode enabled across all packages
- [ ] Cross-package imports resolve correctly via workspace links

### Dependencies

- None (this is L0)

### Estimate

~200 LOC of config
