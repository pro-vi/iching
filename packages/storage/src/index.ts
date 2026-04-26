// @iching/storage — JSON/JSONL persistence, XDG paths, config

// Types
export type { DailyCacheRecord, UserConfig, HistoryQuery } from "./types.js";

// Paths
export { resolvePaths } from "./paths.js";
export type { ResolvedPaths } from "./paths.js";

// Store interfaces
export type { JournalStore } from "./journal-store.js";
export type { DailyCacheStore } from "./daily-cache-store.js";
export type { ConfigStore } from "./config-store.js";

// JSON implementations
export { JsonlJournalStore } from "./json/jsonl-journal.js";
export { JsonDailyCacheStore } from "./json/json-daily-cache.js";
export { JsonConfigStore } from "./json/json-config.js";
export { atomicWriteJson } from "./json/atomic-write.js";

// Journal query
export { type HexagramHistory, getHexagramHistory } from "./journal-query.js";

// Legacy discovery
export { discoverLegacyPaths } from "./legacy/discovery.js";
export type { LegacyPaths } from "./legacy/discovery.js";

// Schema shape (source of truth for persisted keys)
export { SCHEMA_KEYS } from "./schema-keys.js";
