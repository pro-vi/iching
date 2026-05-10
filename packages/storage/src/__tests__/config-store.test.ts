import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UserConfig } from "../types.js";
import { JsonConfigStore } from "../json/json-config.js";

describe("JsonConfigStore", () => {
  let dir: string;
  let store: JsonConfigStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "config-test-"));
    store = new JsonConfigStore(join(dir, "config.json"));
  });

  test("load returns defaults when no file", async () => {
    const config = await store.load();

    expect(config).toEqual({
      motion: "default",
      theme: "bone",
      color: "auto",
      timezone: "system",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      taijituStyle: "dots",
      castMode: "auto",
    });
  });

  test("save then load round-trip with non-default castMode", async () => {
    const custom: UserConfig = {
      motion: "brisk",
      theme: "bone",
      color: "never",
      timezone: "America/New_York",
      glyphAnim: "dots",
      glyphFont: "heiti",
      taijituStyle: "dense",
      castMode: "manual",
    };

    await store.save(custom);
    const loaded = await store.load();
    expect(loaded).toEqual(custom);
    expect(loaded.castMode).toBe("manual");
  });

  test("load merges with defaults for partial config file", async () => {
    // Write a partial config directly
    const partial = { motion: "deep" };
    await writeFile(join(dir, "config.json"), JSON.stringify(partial), "utf-8");

    const config = await store.load();
    expect(config).toEqual({
      motion: "deep",
      theme: "bone",
      color: "auto",
      timezone: "system",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      taijituStyle: "dots",
      castMode: "auto",
    });
  });

  test("load migrates legacy taijituStyle values", async () => {
    await writeFile(join(dir, "config.json"), JSON.stringify({ taijituStyle: "yinDots" }), "utf-8");
    const a = await store.load();
    expect(a.taijituStyle).toBe("dots");

    await writeFile(join(dir, "config.json"), JSON.stringify({ taijituStyle: "yangDense" }), "utf-8");
    const b = await store.load();
    expect(b.taijituStyle).toBe("dense");
  });
});
