import { homedir } from "node:os";
import { join } from "node:path";

/** Resolved file paths for all storage locations */
export interface ResolvedPaths {
  config: string; // config.json
  state: string; // history.jsonl
  notes: string; // notes.jsonl — reflection-note sidecar, beside history.jsonl
  cache: string; // daily-cache.json
}

/**
 * Resolve storage paths following XDG Base Directory Specification.
 *
 * Priority: override (dataDir) → ICHING_HOME env → XDG env vars → XDG defaults.
 *
 * When `dataDir` is provided or ICHING_HOME is set, all three files live
 * under that single directory. Otherwise each file follows its XDG category.
 */
/** The four storage filenames — one source of truth across every layout mode. */
const FILES = {
  config: "config.json",
  state: "history.jsonl",
  notes: "notes.jsonl",
  cache: "daily-cache.json",
} as const;

/** Collapse all four files directly under one directory (override / ICHING_HOME). */
function flatLayout(dir: string): ResolvedPaths {
  return {
    config: join(dir, FILES.config),
    state: join(dir, FILES.state),
    notes: join(dir, FILES.notes),
    cache: join(dir, FILES.cache),
  };
}

export function resolvePaths(overrides?: { dataDir?: string }): ResolvedPaths {
  // 1. Explicit override collapses everything into one dir
  if (overrides?.dataDir) return flatLayout(overrides.dataDir);

  // 2. ICHING_HOME env var — same collapse
  const ichingHome = process.env.ICHING_HOME;
  if (ichingHome) return flatLayout(ichingHome);

  // 3. XDG defaults (respect per-category overrides)
  const home = homedir();
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  const xdgState = process.env.XDG_STATE_HOME ?? join(home, ".local", "state");
  const xdgCache = process.env.XDG_CACHE_HOME ?? join(home, ".cache");

  return {
    config: join(xdgConfig, "iching", FILES.config),
    state: join(xdgState, "iching", FILES.state),
    notes: join(xdgState, "iching", FILES.notes),
    cache: join(xdgCache, "iching", FILES.cache),
  };
}
