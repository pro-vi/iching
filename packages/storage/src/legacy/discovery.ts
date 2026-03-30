import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Paths to legacy files that may exist under ~/.claude/ */
export interface LegacyPaths {
  cache: string | null; // ~/.claude/iching.json if exists
  journal: string | null; // ~/.claude/iching.jsonl if exists
}

/**
 * Detect legacy I Ching files in ~/.claude/.
 * Returns non-null paths only for files that actually exist on disk.
 */
export async function discoverLegacyPaths(): Promise<LegacyPaths> {
  const claudeDir = join(homedir(), ".claude");
  const cachePath = join(claudeDir, "iching.json");
  const journalPath = join(claudeDir, "iching.jsonl");

  const [cacheExists, journalExists] = await Promise.all([
    fileExists(cachePath),
    fileExists(journalPath),
  ]);

  return {
    cache: cacheExists ? cachePath : null,
    journal: journalExists ? journalPath : null,
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
