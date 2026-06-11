import { readFile, writeFile } from "node:fs/promises";
import type { DailyCacheRecord } from "../types.js";
import type { DailyCacheStore } from "../daily-cache-store.js";
import { atomicWriteJson } from "./atomic-write.js";
import { isCastShaped } from "./cast-shape.js";

/**
 * True for a persisted structure with the upper/lower trigram objects that
 * formatTodayPlain and the hook's display cascade dereference unguarded
 * (structure.upper.sym etc.). structure.becoming is only read behind a
 * truthiness guard, so it stays unchecked.
 */
function isStructureShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const structure = value as Record<string, unknown>;
  return (
    typeof structure.upper === "object" &&
    structure.upper !== null &&
    typeof structure.lower === "object" &&
    structure.lower !== null
  );
}

/**
 * Required cache-record shape: every key readers dereference without
 * guarding — `iching today` / the hook / the home scene walk date, shown,
 * structure.upper/.lower, and the full cast (lines, primary, becoming,
 * changingPositions, derived numbers — see cast-shape.ts). Optional keys
 * (intention/method/rng) stay unchecked — their absence is normal.
 */
function isCacheShaped(parsed: unknown): parsed is DailyCacheRecord {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const record = parsed as Record<string, unknown>;
  if (typeof record.date !== "string") return false;
  if (typeof record.shown !== "boolean") return false;
  if (!isStructureShaped(record.structure)) return false;
  return isCastShaped(record.cast);
}

export class JsonDailyCacheStore implements DailyCacheStore {
  constructor(private readonly path: string) {}

  /** The corrupt warning fires once per store instance (cf. JsonConfigStore). */
  private warnedCorrupt = false;

  async read(): Promise<DailyCacheRecord | null> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.quarantine(raw);
    }
    // Valid JSON but not cache-shaped (hand-edit damage / wrong file): same
    // treatment as unparseable bytes — callers expect date, shown, structure
    // and the whole cast to be dereferenceable, so a half-shaped record would
    // crash today/hook just as hard as garbage would.
    if (!isCacheShaped(parsed)) return this.quarantine(raw);
    return parsed;
  }

  /**
   * Corrupt cache (torn write / disk fault / hand-edit damage): treat as
   * absent so startup proceeds to a fresh day instead of crashing until the
   * user deletes the file by hand. Copy the bytes aside first — wx: never
   * clobber the FIRST backup (cf. JsonConfigStore's corrupt handling) — so
   * the next daily write can't silently destroy them.
   */
  private async quarantine(raw: string): Promise<null> {
    let backupOk = false;
    try {
      await writeFile(`${this.path}.corrupt`, raw, { encoding: "utf-8", flag: "wx" });
      backupOk = true;
    } catch (err: unknown) {
      // EEXIST means a backup is already safe; anything else (read-only /
      // full) is best-effort — a cache must never block startup.
      backupOk = (err as NodeJS.ErrnoException).code === "EEXIST";
    }
    if (!this.warnedCorrupt) {
      this.warnedCorrupt = true;
      const saved = backupOk ? ` The old bytes are saved at ${this.path}.corrupt.` : "";
      console.error(`iching: daily cache at ${this.path} is unreadable — starting fresh.${saved}`);
    }
    return null;
  }

  async write(record: DailyCacheRecord): Promise<void> {
    await atomicWriteJson(this.path, record);
  }
}
