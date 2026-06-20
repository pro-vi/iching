import { readFile } from "node:fs/promises";
import type { DailyCacheRecord } from "../types.js";
import type { DailyCacheStore } from "../daily-cache-store.js";
import { atomicWriteJson } from "./atomic-write.js";
import { isCastShaped } from "./cast-shape.js";
import { isRecord } from "./is-record.js";
import { quarantineCorrupt } from "./quarantine-corrupt.js";

/**
 * True for a trigram object carrying the string sym/n/img that the renderers
 * dereference unguarded (`structure.upper.sym` etc.).
 */
function isTrigramShaped(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const t = value;
  return typeof t.sym === "string" && typeof t.n === "string" && typeof t.img === "string";
}

/**
 * True for a persisted structure whose upper/lower trigrams carry the sym/n/img
 * that formatTodayPlain and the hook's display cascade dereference unguarded —
 * a half-shaped `{upper:{},lower:{}}` would otherwise pass and render "undefined".
 * structure.becoming (the becoming hexagram's trigram pair, present on a changing
 * cast) is dereferenced the same way by formatReading's `st` style — formatTrigrams
 * reads becoming.upper/.lower behind ONLY a truthiness guard — so a truthy
 * non-trigram becoming would also render "undefined". Require it null/absent, or
 * fully trigram-shaped.
 */
function isStructureShaped(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const structure = value;
  if (!isTrigramShaped(structure.upper) || !isTrigramShaped(structure.lower)) return false;
  const becoming = structure.becoming;
  if (becoming === null || becoming === undefined) return true;
  if (!isRecord(becoming)) return false;
  return isTrigramShaped(becoming.upper) && isTrigramShaped(becoming.lower);
}

/**
 * Required cache-record shape: every key readers dereference without
 * guarding — `iching today` / the hook / the home scene walk date, shown,
 * structure.upper/.lower, and the full cast (lines, primary, becoming,
 * changingPositions, derived numbers — see cast-shape.ts). Optional keys
 * (intention/method/rng) stay unchecked — their absence is normal.
 */
export function isCacheShaped(parsed: unknown): parsed is DailyCacheRecord {
  if (!isRecord(parsed)) return false;
  const record = parsed;
  if (typeof record.date !== "string") return false;
  if (typeof record.shown !== "boolean") return false;
  if (!isStructureShaped(record.structure)) return false;
  return isCastShaped(record.cast);
}

export class JsonDailyCacheStore implements DailyCacheStore {
  /**
   * When true, the corrupt/unreadable-cache notices are suppressed. The hook and
   * `iching today` run on every shell prompt in a fresh process (so warnedCorrupt
   * can't dedup across runs) and must keep output clean — a persistently-corrupt
   * cache would otherwise spam stderr on every prompt, exactly like the config
   * read (cf. JsonConfigStore's quiet). The interactive TUI/CLI stay loud (one
   * long-lived process → deduped, and the notice is surfaced where the user acts).
   */
  private readonly quiet: boolean;

  constructor(private readonly path: string, opts: { quiet?: boolean } = {}) {
    this.quiet = opts.quiet ?? false;
  }

  /** The corrupt warning fires once per store instance (cf. JsonConfigStore). */
  private warnedCorrupt = false;

  async read(): Promise<DailyCacheRecord | null> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      // The cache exists but can't be read at all — a directory left at the
      // path, permission denied (a root-owned cache after a sudo run). read()
      // runs every launch, so an unguarded throw here crashes startup. The
      // cache is a performance mirror, never the source of truth (the journal
      // is) — warn once, reusing the corrupt-cache notice (we can't quarantine
      // bytes we couldn't read), and start fresh.
      this.warnUnreadable(`iching: daily cache at ${this.path} is unreadable — starting fresh.`);
      return null;
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
    const backupOk = await quarantineCorrupt(this.path, raw);
    const saved = backupOk ? ` The old bytes are saved at ${this.path}.corrupt.` : "";
    this.warnUnreadable(`iching: daily cache at ${this.path} is unreadable — starting fresh.${saved}`);
    return null;
  }

  /**
   * Warn once per store instance, unless quiet — the can't-read (read) and
   * can't-parse (quarantine) paths share one dedup flag (which flips even when
   * quiet, exactly as the inlined guards did). Callers pass the full message so
   * each user-facing literal stays at its site (and in the language inventory);
   * JsonConfigStore carries the same helper. */
  private warnUnreadable(message: string): void {
    if (this.warnedCorrupt) return;
    this.warnedCorrupt = true;
    if (!this.quiet) console.error(message);
  }

  async write(record: DailyCacheRecord): Promise<void> {
    await atomicWriteJson(this.path, record);
  }
}
