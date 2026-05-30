import { readFile } from "node:fs/promises";
import type { UserConfig } from "../types.js";
import type { ConfigStore } from "../config-store.js";
import { atomicWriteJson } from "./atomic-write.js";

const DEFAULT_CONFIG: UserConfig = {
  motion: "default",
  theme: "bone",
  color: "auto",
  timezone: "system",
  glyphAnim: "dots",
  glyphFont: "kaiti",
  taijituStyle: "dots",
  castMethod: "coin",
  castMode: "auto",
};

// Old castMode strings (pre split into castMethod+castMode) → new pair.
const LEGACY_CAST_MODE: Record<string, { method: UserConfig["castMethod"]; mode: UserConfig["castMode"] }> = {
  "auto": { method: "coin", mode: "auto" },
  "manual": { method: "coin", mode: "manual" },
  "yarrow": { method: "yarrow", mode: "auto" },
  "yarrow-manual": { method: "yarrow", mode: "manual" },
};

// Legacy theme names → current canonical names.
const THEME_ALIASES: Record<string, string> = {
  "temple-night": "cinnabar",
  "lantern": "cinnabar",
  "dawn": "bone",
};

const VALID_TAIJITU_STYLES = new Set(["dots", "dense"]);
const VALID_CAST_METHODS = new Set(["coin", "yarrow"]);
const VALID_CAST_MODES = new Set(["auto", "manual"]);

export class JsonConfigStore implements ConfigStore {
  constructor(private readonly path: string) {}

  async load(): Promise<UserConfig> {
    try {
      const raw = await readFile(this.path, "utf-8");
      // Widen castMethod + castMode to plain string for the normalization
      // checks below — at runtime these can be anything (legacy values, hand
      // edits) even though their UserConfig types are narrow unions.
      const partial = JSON.parse(raw) as Omit<Partial<UserConfig>, "castMethod" | "castMode"> & {
        glyphSize?: unknown;
        castMethod?: string;
        castMode?: string;
      };
      // Migrate legacy single-string castMode → castMethod + castMode pair.
      // Old configs only had `castMode`; absence of `castMethod` is the tell.
      if (partial.castMode && partial.castMethod === undefined) {
        const split = LEGACY_CAST_MODE[partial.castMode];
        if (split) {
          partial.castMethod = split.method;
          partial.castMode = split.mode;
        }
      }
      // Defense-in-depth: a current-shaped file with both fields can still
      // carry an out-of-domain value (legacy CLI writes, hand edits, future
      // schema drift). Route any unknown castMode back through LEGACY_CAST_MODE
      // when possible, or fall back to the default. Same idiom we already use
      // for taijituStyle and theme below.
      if (partial.castMode && !VALID_CAST_MODES.has(partial.castMode)) {
        const split = LEGACY_CAST_MODE[partial.castMode];
        if (split) {
          partial.castMethod = split.method;
          partial.castMode = split.mode;
        } else {
          partial.castMode = DEFAULT_CONFIG.castMode;
        }
      }
      if (partial.castMethod && !VALID_CAST_METHODS.has(partial.castMethod)) {
        partial.castMethod = DEFAULT_CONFIG.castMethod;
      }
      const merged = { ...DEFAULT_CONFIG, ...partial } as UserConfig;
      // Drop removed glyphSize key from older configs.
      delete (merged as { glyphSize?: unknown }).glyphSize;
      // Migrate legacy taijituStyle values (yangDots/yinDots → dots, yangDense/yinDense → dense).
      const style = merged.taijituStyle as string;
      if (!VALID_TAIJITU_STYLES.has(style)) {
        merged.taijituStyle = style.toLowerCase().includes("dense") ? "dense" : "dots";
      }
      // Migrate legacy theme names.
      const aliased = THEME_ALIASES[merged.theme as string];
      if (aliased) {
        merged.theme = aliased as UserConfig["theme"];
      }
      return merged;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT")
        return { ...DEFAULT_CONFIG };
      throw err;
    }
  }

  async save(config: UserConfig): Promise<void> {
    await atomicWriteJson(this.path, config);
  }
}
