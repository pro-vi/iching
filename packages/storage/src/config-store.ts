import type { UserConfig } from "./types.js";

/** Read/write user configuration */
export interface ConfigStore {
  /** Load config, returning defaults for any missing fields */
  load(): Promise<UserConfig>;

  /**
   * Load config, or on first boot (no file) seed the display language from the
   * system locale and persist it — a one-time seed that freezes the choice.
   */
  loadOrSeed(): Promise<UserConfig>;

  /** Save config (atomic write) */
  save(config: UserConfig): Promise<void>;
}
