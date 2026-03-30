import type { UserConfig } from "./types.js";

/** Read/write user configuration */
export interface ConfigStore {
  /** Load config, returning defaults for any missing fields */
  load(): Promise<UserConfig>;

  /** Save config (atomic write) */
  save(config: UserConfig): Promise<void>;
}
