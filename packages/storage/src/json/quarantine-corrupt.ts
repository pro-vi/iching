import { writeFile } from "node:fs/promises";

/**
 * Best-effort back up corrupt bytes to `${path}.corrupt`, never clobbering an
 * existing backup (wx) — the FIRST corruption is the recoverable one; a later one
 * is usually garbage-on-garbage. Returns whether a backup is now safely on disk:
 * a fresh write, or a pre-existing one (EEXIST). Any other failure (read-only /
 * full disk) returns false, so callers omit the "saved at .corrupt" note rather
 * than block startup. The config and daily-cache stores must quarantine alike.
 */
export async function quarantineCorrupt(path: string, raw: string): Promise<boolean> {
  try {
    await writeFile(`${path}.corrupt`, raw, { encoding: "utf-8", flag: "wx" });
    return true;
  } catch (err: unknown) {
    return (err as NodeJS.ErrnoException).code === "EEXIST";
  }
}
