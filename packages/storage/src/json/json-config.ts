import { readFile } from "node:fs/promises";
import type { UserConfig } from "../types.js";
import type { ConfigStore } from "../config-store.js";
import { atomicWriteJson } from "./atomic-write.js";

const DEFAULT_CONFIG: UserConfig = {
  motion: "default",
  theme: "lantern",
  color: "auto",
  timezone: "system",
  glyphAnim: "noise",
  glyphFont: "kaiti",
  glyphSize: 64,
  taijituStyle: "dots",
};

const VALID_TAIJITU_STYLES = new Set(["dots", "dense"]);

export class JsonConfigStore implements ConfigStore {
  constructor(private readonly path: string) {}

  async load(): Promise<UserConfig> {
    try {
      const raw = await readFile(this.path, "utf-8");
      const partial = JSON.parse(raw) as Partial<UserConfig>;
      const merged = { ...DEFAULT_CONFIG, ...partial };
      // Migrate legacy taijituStyle values (yangDots/yinDots → dots, yangDense/yinDense → dense).
      const style = merged.taijituStyle as string;
      if (!VALID_TAIJITU_STYLES.has(style)) {
        merged.taijituStyle = style.toLowerCase().includes("dense") ? "dense" : "dots";
      }
      // Migrate legacy theme name (temple-night → lantern).
      if ((merged.theme as string) === "temple-night") {
        merged.theme = "lantern";
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
