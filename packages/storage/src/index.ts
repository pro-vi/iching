// @iching/storage — JSON/JSONL persistence, XDG paths, config

// Types
export type { DailyCacheRecord, UserConfig, HistoryQuery } from "./types.js";

// Paths
export { resolvePaths } from "./paths.js";
export { errnoCode } from "./fs-errors.js";
export type { ResolvedPaths } from "./paths.js";

// Store interfaces
export type { JournalStore } from "./journal-store.js";
export type { DailyCacheStore } from "./daily-cache-store.js";
export type { ConfigStore } from "./config-store.js";

// JSON implementations
export { JsonlJournalStore } from "./json/jsonl-journal.js";
export { JsonDailyCacheStore, isCacheShaped } from "./json/json-daily-cache.js";
export { JsonConfigStore, detectSystemLanguage, canonicalLanguage } from "./json/json-config.js";
export { atomicWriteJson } from "./json/atomic-write.js";

// Journal query
export {
  type HexagramHistory,
  type AnnotatedEntry,
  loadHexagramHistory,
  loadHexagramHistories,
  loadEntriesWithNotes,
  noteMatchesEntry,
  entryNoteRef,
} from "./journal-query.js";

// Terminal-safe text (journal notes are replayed to terminals)
export { stripTerminalControls } from "./sanitize.js";

// Schema shape (source of truth for persisted keys)
export { SCHEMA_KEYS } from "./schema-keys.js";
