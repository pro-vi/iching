import { readFile } from "node:fs/promises";
import type { UserConfig } from "../types.js";
import type { ConfigStore } from "../config-store.js";
import { atomicWriteJson } from "./atomic-write.js";

const MOTION_OPTIONS = ["default", "brisk", "deep", "reduced"] as const;
const LANGUAGE_OPTIONS = ["en", "zh-Hant", "zh-Hans"] as const;
const THEME_OPTIONS = ["ink", "bone", "cinnabar", "jade", "river"] as const;
const COLOR_OPTIONS = ["auto", "always", "never"] as const;
const GLYPH_ANIM_OPTIONS = ["noise", "dots", "radial", "sand"] as const;
const GLYPH_FONT_OPTIONS = ["kaiti", "libian", "heiti"] as const;
const TAIJITU_STYLE_OPTIONS = ["dots", "dense"] as const;
const CAST_METHOD_OPTIONS = ["coin", "yarrow"] as const;
const CAST_MODE_OPTIONS = ["auto", "manual"] as const;

const DEFAULT_CONFIG: UserConfig = {
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
};

// Old castMode strings (pre split into castMethod+castMode) → new pair.
const LEGACY_CAST_MODE: Record<string, { method: UserConfig["castMethod"]; mode: UserConfig["castMode"] }> = {
  "auto": { method: "coin", mode: "auto" },
  "manual": { method: "coin", mode: "manual" },
  "yarrow": { method: "yarrow", mode: "auto" },
  "yarrow-manual": { method: "yarrow", mode: "manual" },
};

// Legacy theme names → current canonical names.
const THEME_ALIASES: Record<string, UserConfig["theme"]> = {
  "temple-night": "cinnabar",
  "lantern": "cinnabar",
  "dawn": "bone",
};

// User-visible aliases are accepted for hand-edited config files; the CLI
// writes stable BCP-47-ish values.
const LANGUAGE_ALIASES: Record<string, UserConfig["language"]> = {
  "简": "zh-Hans",
  "簡": "zh-Hans",
  "simplified": "zh-Hans",
  "繁": "zh-Hant",
  "traditional": "zh-Hant",
  "EN": "en",
  "english": "en",
};

/**
 * Best-effort system display-language from the POSIX locale environment. Used
 * ONLY to seed the first-boot default (see `loadOrSeed`) — it is a one-time
 * seed, never a live binding: once a config exists, the saved choice wins and
 * the locale is never consulted again.
 *
 * Precedence follows GNU gettext for the *display/message* language: the
 * effective locale comes from LC_ALL > LC_MESSAGES > LANG, but a present
 * LANGUAGE (a colon-separated priority list, e.g. "zh_TW:en") OUTRANKS it —
 * EXCEPT in the C/POSIX (or unset) locale, where localization is off and
 * LANGUAGE is ignored. Handles POSIX ("zh_CN.UTF-8", "zh_TW") and BCP-47
 * ("zh-Hant-TW") forms; an explicit script subtag wins over region. Anything
 * non-Chinese — including empty / "C" / "POSIX" — falls back to English.
 */
export function detectSystemLanguage(
  env: Record<string, string | undefined> = process.env,
): UserConfig["language"] {
  // Effective locale (LANGUAGE excluded — it only selects the message language).
  const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || "";
  const localeLang = locale.split(/[.@]/)[0].toLowerCase();
  // Not localized (C / POSIX / unset): no language intent, and GNU LANGUAGE is
  // disabled in the C locale → English.
  if (localeLang === "" || localeLang === "c" || localeLang === "posix") return "en";
  // LANGUAGE (colon priority list) chooses the display language and outranks the
  // locale when localization is on; take its first entry. Strip codeset/modifier;
  // "zh-Hant-TW" / "zh_TW:en" → normalized parts ["zh","hant","tw"] etc.
  const raw = env.LANGUAGE || locale;
  const parts = raw.split(/[.@:]/)[0].replace(/_/g, "-").toLowerCase().split("-");
  if (parts[0] !== "zh") return "en";
  if (parts.includes("hant")) return "zh-Hant"; // script subtag wins over region
  if (parts.includes("hans")) return "zh-Hans";
  const region = parts[1];
  if (region === "tw" || region === "hk" || region === "mo") return "zh-Hant";
  // zh-CN / zh-SG / zh-MY and bare "zh" → Simplified (ICU resolves zh→zh-Hans).
  return "zh-Hans";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<const T extends readonly string[]>(
  options: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && options.includes(value as T[number]);
}

function stringValue(
  record: Record<string, unknown>,
  key: keyof UserConfig,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeConfig(parsed: unknown): UserConfig {
  const merged: UserConfig = { ...DEFAULT_CONFIG };
  if (!isRecord(parsed)) return merged;

  if (isOneOf(MOTION_OPTIONS, parsed.motion)) merged.motion = parsed.motion;

  const rawLanguage = stringValue(parsed, "language");
  if (isOneOf(LANGUAGE_OPTIONS, rawLanguage)) {
    merged.language = rawLanguage;
  } else if (rawLanguage && LANGUAGE_ALIASES[rawLanguage]) {
    merged.language = LANGUAGE_ALIASES[rawLanguage];
  }

  const rawTheme = stringValue(parsed, "theme");
  if (isOneOf(THEME_OPTIONS, rawTheme)) {
    merged.theme = rawTheme;
  } else if (rawTheme && THEME_ALIASES[rawTheme]) {
    merged.theme = THEME_ALIASES[rawTheme];
  }

  if (isOneOf(COLOR_OPTIONS, parsed.color)) merged.color = parsed.color;
  if (typeof parsed.timezone === "string") merged.timezone = parsed.timezone;
  if (isOneOf(GLYPH_ANIM_OPTIONS, parsed.glyphAnim)) merged.glyphAnim = parsed.glyphAnim;
  if (isOneOf(GLYPH_FONT_OPTIONS, parsed.glyphFont)) merged.glyphFont = parsed.glyphFont;

  const rawTaijituStyle = stringValue(parsed, "taijituStyle");
  if (isOneOf(TAIJITU_STYLE_OPTIONS, rawTaijituStyle)) {
    merged.taijituStyle = rawTaijituStyle;
  } else if (rawTaijituStyle) {
    merged.taijituStyle = rawTaijituStyle.toLowerCase().includes("dense") ? "dense" : "dots";
  }

  const rawCastMethod = stringValue(parsed, "castMethod");
  const rawCastMode = stringValue(parsed, "castMode");
  if (rawCastMode && rawCastMethod === undefined) {
    const split = LEGACY_CAST_MODE[rawCastMode];
    if (split) {
      merged.castMethod = split.method;
      merged.castMode = split.mode;
    }
  } else {
    if (isOneOf(CAST_METHOD_OPTIONS, rawCastMethod)) merged.castMethod = rawCastMethod;
    if (isOneOf(CAST_MODE_OPTIONS, rawCastMode)) {
      merged.castMode = rawCastMode;
    } else if (rawCastMode) {
      const split = LEGACY_CAST_MODE[rawCastMode];
      if (split) {
        merged.castMethod = split.method;
        merged.castMode = split.mode;
      }
    }
  }

  return merged;
}

export class JsonConfigStore implements ConfigStore {
  constructor(private readonly path: string) {}

  /**
   * First-boot seed retained in memory when it could not be persisted (read-only
   * / full data dir). Lets the rest of THIS session — e.g. reopening Settings,
   * which reloads config — see the detected language instead of flipping back to
   * defaults. Shadowed the moment a real config file exists.
   */
  private seededInMemory: UserConfig | null = null;

  /**
   * Read + parse the config file, tolerating a present-but-corrupt file the
   * same way `normalizeConfig` tolerates a structurally-invalid one: a
   * `JSON.parse` failure (truncated / hand-edited / empty) falls back to
   * defaults rather than crashing every entry point. Returns `null` only when
   * the file is genuinely absent (ENOENT); real I/O faults (EACCES/EIO) still
   * propagate so they stay visible.
   */
  private async readExisting(): Promise<UserConfig | null> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    try {
      return normalizeConfig(JSON.parse(raw) as unknown);
    } catch {
      return { ...DEFAULT_CONFIG }; // unparseable on disk → tolerant defaults
    }
  }

  async load(): Promise<UserConfig> {
    const existing = await this.readExisting();
    if (existing) return existing;
    // No file on disk: fall back to a deferred in-memory seed if first boot
    // couldn't persist (so the session stays in its detected language), else defaults.
    return this.seededInMemory ? { ...this.seededInMemory } : { ...DEFAULT_CONFIG };
  }

  /**
   * Like `load()`, but on first boot (no config file yet) it seeds the display
   * language from the system locale and PERSISTS the config — freezing the
   * choice so later launches read the saved value and never re-consult the
   * locale. Used at interactive startup; `load()` stays a pure read so config
   * subcommands and test fixtures don't write files.
   */
  async loadOrSeed(): Promise<UserConfig> {
    const existing = await this.readExisting();
    if (existing) return existing;
    const seeded: UserConfig = {
      ...DEFAULT_CONFIG,
      language: detectSystemLanguage(),
    };
    // Best-effort persist: a read-only / full data dir must NOT block startup —
    // run with the detected language in memory this session and persist (freeze)
    // on a later launch when the write succeeds.
    try {
      await this.save(seeded);
    } catch {
      this.seededInMemory = seeded; // deferred: keep it for this session's reloads
    }
    return seeded;
  }

  async save(config: UserConfig): Promise<void> {
    await atomicWriteJson(this.path, config);
    this.seededInMemory = null; // persisted — the file is now the source of truth
  }
}
