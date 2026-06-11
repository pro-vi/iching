import { readFile, writeFile } from "node:fs/promises";
import type { DailyCacheRecord } from "../types.js";
import type { DailyCacheStore } from "../daily-cache-store.js";
import { atomicWriteJson } from "./atomic-write.js";

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
      // Corrupt cache (torn write / disk fault): treat as absent so startup
      // proceeds to a fresh day instead of crashing until the user deletes
      // the file by hand. Copy the bytes aside first — wx: never clobber the
      // FIRST backup (cf. JsonConfigStore's corrupt handling) — so the next
      // daily write can't silently destroy them.
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
    // Valid JSON but not a cache record (hand-edit damage): also treat as
    // absent — callers expect an object with date/cast, never a scalar.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as DailyCacheRecord;
  }

  async write(record: DailyCacheRecord): Promise<void> {
    await atomicWriteJson(this.path, record);
  }
}
