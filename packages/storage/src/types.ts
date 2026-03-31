import type { DailyCache } from "@iching/core";

/** Re-export DailyCache as DailyCacheRecord for storage-layer naming */
export type DailyCacheRecord = DailyCache;

/** User-facing configuration */
export interface UserConfig {
  motion: "default" | "brisk" | "deep" | "reduced";
  theme: "temple-night" | "ink" | "dawn" | "jade";
  color: "auto" | "always" | "never";
  timezone: "system" | string;
  glyphAnim: "noise" | "dots" | "radial" | "sand";
  glyphFont: "kaiti" | "libian" | "heiti";
  glyphSize: 32 | 48 | 64;
}

/** Query options for journal streaming */
export interface HistoryQuery {
  since?: string; // ISO date string
  limit?: number;
}
