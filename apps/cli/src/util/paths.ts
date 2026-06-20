import { resolvePaths, type ResolvedPaths } from "@iching/storage";

/**
 * Resolve storage paths for an optional `--data-dir` override. Every command
 * threads its (possibly undefined) data-dir flag through the same ternary —
 * `resolvePaths(d ? { dataDir: d } : undefined)` — so centralize it: an absent
 * flag falls through to the XDG/ICHING_HOME defaults, a present one collapses
 * everything into that dir. One place owns how the CLI maps its flag to storage.
 */
export function resolvePathsFor(dataDir?: string): ResolvedPaths {
  return resolvePaths(dataDir ? { dataDir } : undefined);
}
