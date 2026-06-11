import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UserConfig } from "../types.js";
import { JsonConfigStore, detectSystemLanguage } from "../json/json-config.js";

const LOCALE_VARS = ["LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"] as const;
/** Set locale env vars deterministically (clearing the rest) and return a restorer. */
function withLocaleEnv(vars: Partial<Record<(typeof LOCALE_VARS)[number], string>>): () => void {
  const prev = Object.fromEntries(LOCALE_VARS.map((k) => [k, process.env[k]]));
  for (const k of LOCALE_VARS) {
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return () => {
    for (const k of LOCALE_VARS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  };
}

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
      entropy: "crypto",
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
      entropy: "bound",
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
      entropy: "crypto",
    });
  });

  test("load defaults invalid entropy values to crypto", async () => {
    await writeFile(join(dir, "config.json"), JSON.stringify({ entropy: "quantum" }), "utf-8");
    const loaded = await store.load();
    expect(loaded.entropy).toBe("crypto");
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

  // Regression: alias/legacy lookups walked the prototype chain, so inherited
  // names (constructor/__proto__/toString) resolved to functions on the config.
  test("inherited prototype names as values do NOT resolve via alias maps", async () => {
    for (const key of ["language", "theme", "castMode"]) {
      for (const bad of ["constructor", "__proto__", "toString"]) {
        await writeFile(join(dir, "config.json"), JSON.stringify({ [key]: bad }), "utf-8");
        const cfg = await store.load();
        expect(typeof cfg.language).toBe("string");
        expect(typeof cfg.theme).toBe("string");
        expect(cfg.castMethod === "coin" || cfg.castMethod === "yarrow").toBe(true);
        expect(cfg.castMode === "auto" || cfg.castMode === "manual").toBe(true);
      }
    }
  });

  test("language matching is case-insensitive (BCP-47)", async () => {
    for (const [raw, want] of [["zh-hans", "zh-Hans"], ["ZH-HANT", "zh-Hant"], ["En", "en"]] as const) {
      await writeFile(join(dir, "config.json"), JSON.stringify({ language: raw }), "utf-8");
      expect((await store.load()).language).toBe(want);
    }
  });

  test("unknown own-keys survive a load→save round-trip (schemas only expand)", async () => {
    await writeFile(join(dir, "config.json"), JSON.stringify({ theme: "ink", futureKey: "keepme" }), "utf-8");
    const cfg = await store.load();
    expect((cfg as unknown as Record<string, unknown>).futureKey).toBe("keepme");
    await store.save(cfg);
    const reloaded = JSON.parse(await readFile(join(dir, "config.json"), "utf-8"));
    expect(reloaded.futureKey).toBe("keepme"); // not stripped by the whitelist
  });

  test("a corrupt config is backed up to .corrupt before falling to defaults", async () => {
    const path = join(dir, "config.json");
    await writeFile(path, "{ broken json", "utf-8");
    const cfg = await store.load();
    expect(cfg.language).toBe("en"); // degraded to defaults
    expect(await readFile(`${path}.corrupt`, "utf-8")).toBe("{ broken json"); // recoverable
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
    const restore = withLocaleEnv({ LC_ALL: "zh_CN.UTF-8" }); // LANGUAGE/LANG/etc cleared
    try {
      const first = await store.loadOrSeed();
      expect(first.language).toBe("zh-Hans"); // seeded Simplified from the locale

      process.env.LC_ALL = "en_US.UTF-8"; // user later moves to an English shell
      const second = await store.loadOrSeed();
      expect(second.language).toBe("zh-Hans"); // …but the saved choice is frozen
    } finally {
      restore();
    }
  });

  // ── resilience (gate findings) ──

  test("load() degrades to defaults on a corrupt config file — does not throw", async () => {
    await writeFile(join(dir, "config.json"), "{ not valid json", "utf-8");
    const cfg = await store.load();
    expect(cfg.language).toBe("en");
    expect(cfg.theme).toBe("bone"); // full defaults, not a crash
  });

  // PIN FLIP (review P1/P2): the recoverable copy is .corrupt — leaving the live
  // file unreadable caused a silent settings-reset at the NEXT save, repeated
  // warnings every load, and an English session for zh-locale users. loadOrSeed
  // now treats corrupt like a re-seed: heal the file (locale included) once the
  // bytes are safely backed up.
  test("loadOrSeed() re-seeds and heals a corrupt config (original kept in .corrupt)", async () => {
    const restore = withLocaleEnv({ LC_ALL: "zh_TW.UTF-8" });
    try {
      const path = join(dir, "config.json");
      await writeFile(path, "{ corrupt", "utf-8");
      const cfg = await store.loadOrSeed();
      expect(cfg.language).toBe("zh-Hant"); // locale honored, not bare defaults
      // healed: the live file is valid again and round-trips the seeded language
      const healed = JSON.parse(await readFile(path, "utf-8"));
      expect(healed.language).toBe("zh-Hant");
      // the unreadable original survives for hand-recovery
      expect(await readFile(`${path}.corrupt`, "utf-8")).toBe("{ corrupt");
    } finally {
      restore();
    }
  });

  test("a failed save() keeps the live config in memory for session reloads", async () => {
    // X1 (cross-model finding): when "save & back" can't persist, a later
    // load() in the same session must return the user's edits, not stale disk.
    // `blocker` is a FILE, so mkdir/open under it fails with ENOTDIR.
    await writeFile(join(dir, "blocker"), "not a dir", "utf-8");
    const store2 = new JsonConfigStore(join(dir, "blocker", "config.json"));
    const edited: UserConfig = { ...(await store.load()), theme: "jade", language: "zh-Hant" };
    await expect(store2.save(edited)).rejects.toThrow(); // the write still fails…
    const reloaded = await store2.load();
    expect(reloaded.theme).toBe("jade"); // …but the session sees the edits
    expect(reloaded.language).toBe("zh-Hant");
  });

  test("unknown keys that shadow prototype names are preserved (hasOwn, not `in`)", async () => {
    const path = join(dir, "config.json");
    await writeFile(path, JSON.stringify({ theme: "jade", toString: "future-value" }), "utf-8");
    const cfg = await store.load();
    expect(cfg.theme).toBe("jade");
    // `"toString" in DEFAULT_CONFIG` is true via the prototype chain — the old
    // guard silently dropped a legitimate future key on rewrite.
    expect(Object.hasOwn(cfg, "toString")).toBe(true);
    expect((cfg as unknown as Record<string, unknown>)["toString"]).toBe("future-value");
  });

  test("prototype-chain keys in the config file are dropped and never pollute", async () => {
    const path = join(dir, "config.json");
    await writeFile(
      path,
      '{"theme":"jade","__proto__":{"polluted":1},"constructor":{"c":1},"prototype":{"p":1}}',
      "utf-8",
    );
    const cfg = await store.load();
    expect(cfg.theme).toBe("jade");
    expect(Object.getPrototypeOf(cfg)).toBe(Object.prototype); // proto not swapped
    expect(({} as Record<string, unknown>).polluted).toBeUndefined(); // no global pollution
    for (const k of ["__proto__", "constructor", "prototype"]) {
      expect(Object.hasOwn(cfg, k)).toBe(false); // explicitly dropped, not carried
    }
  });

  test("the .corrupt backup is never clobbered by a later corruption", async () => {
    const path = join(dir, "config.json");
    await writeFile(path, "{ original user data", "utf-8");
    await store.load(); // creates the backup
    await writeFile(path, "xx", "utf-8"); // a second, worse corruption
    await new JsonConfigStore(path).load();
    // the first backup (the recoverable one) survives
    expect(await readFile(`${path}.corrupt`, "utf-8")).toBe("{ original user data");
  });

  test("the corrupt warning prints once per store instance, not per load", async () => {
    const path = join(dir, "config.json");
    await writeFile(path, "{ corrupt", "utf-8");
    const calls: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void calls.push(args);
    try {
      await store.load();
      await store.load(); // e.g. reopening Settings while the TUI owns the screen
      await store.load();
    } finally {
      console.error = original;
    }
    expect(calls.length).toBe(1);
  });

  test("loadOrSeed() does not crash when persisting the first-boot seed fails", async () => {
    // First-boot scenario where the file is absent (ENOENT → seed) but the
    // persist fails (read-only / full data dir). Stub save() to reject so the
    // test is deterministic and permission-model independent (root-proof).
    class FailingSaveStore extends JsonConfigStore {
      override async save(): Promise<void> {
        throw Object.assign(new Error("EACCES: read-only"), { code: "EACCES" });
      }
    }
    const path = join(dir, "config.json");
    const store2 = new FailingSaveStore(path); // no file → ENOENT → seed → save throws
    const cfg = await store2.loadOrSeed(); // must resolve, not reject
    expect(["en", "zh-Hant", "zh-Hans"]).toContain(cfg.language); // ran with detected lang
    // persist failed, so nothing was frozen to disk this session
    await expect(readFile(path, "utf-8")).rejects.toThrow();
  });

  test("a deferred (unwritable) seed is retained in memory for same-session reloads", async () => {
    // Comment-2 fix: when the seed can't be persisted, a later config reload in
    // the same session (e.g. opening Settings) must NOT flip back to defaults.
    class FailingSaveStore extends JsonConfigStore {
      override async save(): Promise<void> {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      }
    }
    const restore = withLocaleEnv({ LC_ALL: "zh_TW.UTF-8" }); // deterministic detected language
    try {
      const store2 = new FailingSaveStore(join(dir, "config.json"));
      const seeded = await store2.loadOrSeed();
      expect(seeded.language).toBe("zh-Hant");
      const reloaded = await store2.load(); // same store, same session
      expect(reloaded.language).toBe("zh-Hant"); // not "en" — seed retained in memory
    } finally {
      restore();
    }
  });

  test("loadOrSeed seeds the language for a pre-language upgrade config (no language key)", async () => {
    const restore = withLocaleEnv({ LC_ALL: "zh_TW.UTF-8" });
    try {
      // a config from before the language field existed: settings but no `language`
      await writeFile(join(dir, "config.json"), JSON.stringify({ theme: "ink", motion: "brisk" }), "utf-8");
      const cfg = await store.loadOrSeed();
      expect(cfg.language).toBe("zh-Hant"); // seeded from the locale
      expect(cfg.theme).toBe("ink"); // existing settings preserved
      expect(cfg.motion).toBe("brisk");
      process.env.LC_ALL = "en_US.UTF-8"; // now a language key exists → frozen
      expect((await store.loadOrSeed()).language).toBe("zh-Hant");
    } finally {
      restore();
    }
  });

  test("loadOrSeed does NOT re-seed when a language key is already present", async () => {
    const restore = withLocaleEnv({ LC_ALL: "zh_TW.UTF-8" });
    try {
      await writeFile(join(dir, "config.json"), JSON.stringify({ language: "en", theme: "ink" }), "utf-8");
      expect((await store.loadOrSeed()).language).toBe("en"); // honors the stored choice
    } finally {
      restore();
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

  test("locale precedence for the effective locale: LC_ALL > LC_MESSAGES > LANG", () => {
    expect(detectSystemLanguage({ LANG: "en_US", LC_ALL: "zh_CN" })).toBe("zh-Hans");
    expect(detectSystemLanguage({ LANG: "zh_CN", LC_MESSAGES: "en_US" })).toBe("en");
  });

  // GNU gettext: LANGUAGE (colon priority list) selects the *display* language
  // and outranks LANG/LC_MESSAGES/LC_ALL when a real locale is active.
  test("LANGUAGE outranks the locale when localization is on (first supported entry wins)", () => {
    // bilingual setup — English locale for formatting, Chinese for messages
    expect(detectSystemLanguage({ LANG: "en_US.UTF-8", LANGUAGE: "zh_TW:en" })).toBe("zh-Hant");
    expect(detectSystemLanguage({ LANG: "en_US.UTF-8", LANGUAGE: "zh_Hant:zh_CN" })).toBe("zh-Hant");
    expect(detectSystemLanguage({ LANG: "zh_TW", LANGUAGE: "zh_CN:zh_TW" })).toBe("zh-Hans");
    expect(detectSystemLanguage({ LANG: "zh_TW", LANGUAGE: "en_US" })).toBe("en");
    expect(detectSystemLanguage({ LC_ALL: "en_US", LANGUAGE: "zh_TW" })).toBe("zh-Hant");
  });

  // LANGUAGE is a fallback list: scan past entries this app can't honor.
  test("LANGUAGE scans past unsupported entries to the first supported one", () => {
    expect(detectSystemLanguage({ LANG: "en_US.UTF-8", LANGUAGE: "ja:zh_CN" })).toBe("zh-Hans"); // ja unsupported → zh_CN
    expect(detectSystemLanguage({ LANG: "en_US", LANGUAGE: "ja:en:zh_TW" })).toBe("en"); // en before zh_TW wins
    expect(detectSystemLanguage({ LANG: "zh_CN", LANGUAGE: "ko:fr" })).toBe("zh-Hans"); // none supported → fall to locale
    expect(detectSystemLanguage({ LANG: "en_US", LANGUAGE: "ja:ko" })).toBe("en"); // none supported → fall to locale
  });

  test("LANGUAGE is ignored in the C/POSIX/unset locale (gettext rule)", () => {
    expect(detectSystemLanguage({ LANG: "C", LANGUAGE: "zh_TW" })).toBe("en");
    expect(detectSystemLanguage({ LANG: "POSIX", LANGUAGE: "zh_TW:en" })).toBe("en");
    expect(detectSystemLanguage({ LANGUAGE: "zh_TW" })).toBe("en"); // no locale → C
  });
});
