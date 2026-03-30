import { readFile } from "node:fs/promises";
import type { DailyCacheRecord } from "../types.js";
import type { DailyCacheStore } from "../daily-cache-store.js";
import { atomicWriteJson } from "./atomic-write.js";

export class JsonDailyCacheStore implements DailyCacheStore {
  constructor(private readonly path: string) {}

  async read(): Promise<DailyCacheRecord | null> {
    try {
      const raw = await readFile(this.path, "utf-8");
      return JSON.parse(raw) as DailyCacheRecord;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async write(record: DailyCacheRecord): Promise<void> {
    await atomicWriteJson(this.path, record);
  }
}
