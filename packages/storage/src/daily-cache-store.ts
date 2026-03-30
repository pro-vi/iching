import type { DailyCacheRecord } from "./types.js";

/** Read/write today's cached reading */
export interface DailyCacheStore {
  /** Read the cached daily reading, or null if absent */
  read(): Promise<DailyCacheRecord | null>;

  /** Write (atomic replace) the daily cache */
  write(record: DailyCacheRecord): Promise<void>;
}
