// Journal query helpers — per-hexagram history lookup

import type { JournalStore } from "./journal-store.js";

export interface HexagramHistory {
  castCount: number;
  lastCastDate: string | null;
  dates: string[];
}

/** Scan journal for all casts of a specific hexagram by KW number */
export async function getHexagramHistory(
  store: JournalStore,
  kwNumber: number,
): Promise<HexagramHistory> {
  const dates: string[] = [];

  for await (const entry of store.stream()) {
    if (entry.cast.primary === kwNumber) {
      dates.push(entry.date);
    }
  }

  return {
    castCount: dates.length,
    lastCastDate: dates.length > 0 ? dates[dates.length - 1] : null,
    dates,
  };
}
