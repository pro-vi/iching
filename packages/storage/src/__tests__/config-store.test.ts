import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UserConfig } from "../types.js";
import { JsonConfigStore, detectSystemLanguage } from "../json/json-config.js";

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
      language: "en",
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
      language: "en",
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
    expect(loaded.language).toBe("en");
  });

  test("load accepts display language aliases from hand-edited config", async () => {
    await writeFile(join(dir, "config.json"), JSON.stringify({ language: "简" }), "utf-8");
    const simplified = await store.load();
    expect(simplified.language).toBe("zh-Hans");

    await writeFile(join(dir, "config.json"), JSON.stringify({ language: "EN" }), "utf-8");
    const english = await store.load();
    expect(english.language).toBe("en");
  });

  // ── first-boot system-language seed (loadOrSeed) ──

  test("load() stays pure on first boot — defaults, no detection, no file written", async () => {
    const cfg = await store.load();
    expect(cfg.language).toBe("en"); // never the detected locale
    await expect(readFile(join(dir, "config.json"), "utf-8")).rejects.toThrow(); // no write
  });

  test("loadOrSeed seeds a valid language and PERSISTS it on first boot", async () => {
    const seeded = await store.loadOrSeed();
    expect(["en", "zh-Hant", "zh-Hans"]).toContain(seeded.language);
    // persisted: the file now exists and a pure load() round-trips the same value
    const reloaded = await store.load();
    expect(reloaded).toEqual(seeded);
  });

  test("loadOrSeed freezes the first-boot language — later locale changes are ignored", async () => {
    const orig = process.env.LC_ALL;
    try {
      process.env.LC_ALL = "zh_CN.UTF-8"; // highest-precedence locale var
      const first = await store.loadOrSeed();
      expect(first.language).toBe("zh-Hans"); // seeded Simplified from the locale

      process.env.LC_ALL = "en_US.UTF-8"; // user later moves to an English shell
      const second = await store.loadOrSeed();
      expect(second.language).toBe("zh-Hans"); // …but the saved choice is frozen
    } finally {
      if (orig === undefined) delete process.env.LC_ALL;
      else process.env.LC_ALL = orig;
    }
  });
});

describe("detectSystemLanguage", () => {
  const cases: Array<[Record<string, string | undefined>, UserConfig["language"]]> = [
    [{ LANG: "en_US.UTF-8" }, "en"],
    [{}, "en"], // unset
    [{ LANG: "C" }, "en"],
    [{ LANG: "POSIX" }, "en"],
    [{ LANG: "zh_CN.UTF-8" }, "zh-Hans"],
    [{ LANG: "zh_SG.UTF-8" }, "zh-Hans"],
    [{ LANG: "zh_TW.UTF-8" }, "zh-Hant"],
    [{ LANG: "zh_HK.UTF-8" }, "zh-Hant"],
    [{ LANG: "zh_MO.UTF-8" }, "zh-Hant"],
    [{ LANG: "zh" }, "zh-Hans"], // bare zh → Simplified
    [{ LANG: "zh-Hans" }, "zh-Hans"], // BCP-47
    [{ LANG: "zh-Hant-TW" }, "zh-Hant"], // BCP-47 with script
    [{ LANG: "zh-Hant-CN" }, "zh-Hant"], // script subtag wins over region
  ];
  for (const [env, expected] of cases) {
    test(`${JSON.stringify(env)} → ${expected}`, () => {
      expect(detectSystemLanguage(env)).toBe(expected);
    });
  }

  test("respects precedence: LC_ALL > LC_MESSAGES > LANG > LANGUAGE", () => {
    expect(detectSystemLanguage({ LANG: "en_US", LC_ALL: "zh_CN" })).toBe("zh-Hans");
    expect(detectSystemLanguage({ LANG: "zh_CN", LC_MESSAGES: "en_US" })).toBe("en");
    expect(detectSystemLanguage({ LANGUAGE: "zh_TW" })).toBe("zh-Hant");
    expect(detectSystemLanguage({ LANG: "zh_TW", LANGUAGE: "en_US" })).toBe("zh-Hant");
  });
});
