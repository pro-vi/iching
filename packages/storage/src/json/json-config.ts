import { readFile } from "node:fs/promises";
import type { UserConfig } from "../types.js";
import type { ConfigStore } from "../config-store.js";
import { atomicWriteJson } from "./atomic-write.js";

const DEFAULT_CONFIG: UserConfig = {
  motion: "default",
  theme: "temple-night",
  color: "auto",
  timezone: "system",
  glyphAnim: "noise",
  glyphFont: "kaiti",
  glyphSize: 64,
  taijituStyle: "yangDots",
};

export class JsonConfigStore implements ConfigStore {
  constructor(private readonly path: string) {}

  async load(): Promise<UserConfig> {
    try {
      const raw = await readFile(this.path, "utf-8");
      const partial = JSON.parse(raw) as Partial<UserConfig>;
      return { ...DEFAULT_CONFIG, ...partial };
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
