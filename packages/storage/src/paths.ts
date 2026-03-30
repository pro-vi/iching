import { homedir } from "node:os";
import { join } from "node:path";

/** Resolved file paths for all storage locations */
export interface ResolvedPaths {
  config: string; // config.json
  state: string; // history.jsonl
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
export function resolvePaths(overrides?: { dataDir?: string }): ResolvedPaths {
  const home = homedir();

  // 1. Explicit override collapses everything into one dir
  if (overrides?.dataDir) {
    return {
      config: join(overrides.dataDir, "config.json"),
      state: join(overrides.dataDir, "history.jsonl"),
      cache: join(overrides.dataDir, "daily-cache.json"),
    };
  }

  // 2. ICHING_HOME env var — same collapse
  const ichingHome = process.env.ICHING_HOME;
  if (ichingHome) {
    return {
      config: join(ichingHome, "config.json"),
      state: join(ichingHome, "history.jsonl"),
      cache: join(ichingHome, "daily-cache.json"),
    };
  }

  // 3. XDG defaults (respect per-category overrides)
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  const xdgState = process.env.XDG_STATE_HOME ?? join(home, ".local", "state");
  const xdgCache = process.env.XDG_CACHE_HOME ?? join(home, ".cache");

  return {
    config: join(xdgConfig, "iching", "config.json"),
    state: join(xdgState, "iching", "history.jsonl"),
    cache: join(xdgCache, "iching", "daily-cache.json"),
  };
}
