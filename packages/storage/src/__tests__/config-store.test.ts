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
      language: "zh-Hant",
      theme: "bone",
      color: "auto",
      timezone: "system",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      taijituStyle: "dots",
      castMethod: "coin",
      castMode: "auto",
    });
  });

  test("save then load round-trip with non-default cast settings", async () => {
    const custom: UserConfig = {
      motion: "brisk",
      language: "en",
      theme: "bone",
      color: "never",
      timezone: "America/New_York",
      glyphAnim: "dots",
      glyphFont: "heiti",
      taijituStyle: "dense",
      castMethod: "yarrow",
      castMode: "manual",
    };

    await store.save(custom);
    const loaded = await store.load();
    expect(loaded).toEqual(custom);
    expect(loaded.castMethod).toBe("yarrow");
    expect(loaded.castMode).toBe("manual");
  });

  test("load merges with defaults for partial config file", async () => {
    const partial = { motion: "deep" };
    await writeFile(join(dir, "config.json"), JSON.stringify(partial), "utf-8");

    const config = await store.load();
    expect(config).toEqual({
      motion: "deep",
      language: "zh-Hant",
      theme: "bone",
      color: "auto",
      timezone: "system",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      taijituStyle: "dots",
      castMethod: "coin",
      castMode: "auto",
    });
  });

  test("load migrates legacy single-string castMode → method+mode pair", async () => {
    // Old configs only have the single `castMode` string. The loader infers
    // `castMethod` from absence and splits into the new pair.
    const cases: Array<[string, string, string]> = [
      ["auto", "coin", "auto"],
      ["manual", "coin", "manual"],
      ["yarrow", "yarrow", "auto"],
      ["yarrow-manual", "yarrow", "manual"],
    ];
    for (const [legacy, expectedMethod, expectedMode] of cases) {
      await writeFile(join(dir, "config.json"), JSON.stringify({ castMode: legacy }), "utf-8");
      const loaded = await store.load();
      expect(loaded.castMethod).toBe(expectedMethod as UserConfig["castMethod"]);
      expect(loaded.castMode).toBe(expectedMode as UserConfig["castMode"]);
    }
  });

  test("load migrates legacy taijituStyle values", async () => {
    await writeFile(join(dir, "config.json"), JSON.stringify({ taijituStyle: "yinDots" }), "utf-8");
    const a = await store.load();
    expect(a.taijituStyle).toBe("dots");

    await writeFile(join(dir, "config.json"), JSON.stringify({ taijituStyle: "yangDense" }), "utf-8");
    const b = await store.load();
    expect(b.taijituStyle).toBe("dense");
  });

  test("load defaults invalid language values", async () => {
    await writeFile(join(dir, "config.json"), JSON.stringify({ language: "klingon" }), "utf-8");
    const loaded = await store.load();
    expect(loaded.language).toBe("zh-Hant");
  });

  test("load accepts display language aliases from hand-edited config", async () => {
    await writeFile(join(dir, "config.json"), JSON.stringify({ language: "简" }), "utf-8");
    const simplified = await store.load();
    expect(simplified.language).toBe("zh-Hans");

    await writeFile(join(dir, "config.json"), JSON.stringify({ language: "EN" }), "utf-8");
    const english = await store.load();
    expect(english.language).toBe("en");
  });
});
