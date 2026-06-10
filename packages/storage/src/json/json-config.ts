import { readFile, writeFile } from "node:fs/promises";
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
 * LANGUAGE (a colon-separated PRIORITY LIST, e.g. "ja:zh_CN") OUTRANKS it —
 * EXCEPT in the C/POSIX (or unset) locale, where localization is off and
 * LANGUAGE is ignored. LANGUAGE entries are tried in order and the first one
 * this app supports (en / zh-Hant / zh-Hans) wins, falling through to the
 * locale. Handles POSIX ("zh_CN.UTF-8", "zh_TW") and BCP-47 ("zh-Hant-TW")
 * forms; an explicit script subtag wins over region. Anything non-Chinese —
 * including empty / "C" / "POSIX" — falls back to English.
 */
/** Map one locale token to a supported display language, or null if unsupported. */
function mapLocaleToken(token: string): UserConfig["language"] | null {
  const parts = token.split(/[.@]/)[0].replace(/_/g, "-").toLowerCase().split("-");
  const lang = parts[0];
  if (lang === "en") return "en"; // app supports English — stop scanning
  if (lang !== "zh") return null; // unsupported language → try the next candidate
  if (parts.includes("hant")) return "zh-Hant"; // script subtag wins over region
  if (parts.includes("hans")) return "zh-Hans";
  const region = parts[1];
  if (region === "tw" || region === "hk" || region === "mo") return "zh-Hant";
  return "zh-Hans"; // zh-CN / zh-SG / zh-MY and bare "zh"
}

export function detectSystemLanguage(
  env: Record<string, string | undefined> = process.env,
): UserConfig["language"] {
  // Effective locale (LANGUAGE excluded — it only selects the message language).
  const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || "";
  const localeLang = locale.split(/[.@]/)[0].toLowerCase();
  // Not localized (C / POSIX / unset): no language intent, and GNU LANGUAGE is
  // disabled in the C locale → English.
  if (localeLang === "" || localeLang === "c" || localeLang === "posix") return "en";
  // GNU gettext: LANGUAGE is a colon-separated priority list tried in order and
  // outranks the locale. Honor the first candidate this app supports — LANGUAGE's
  // entries first, then the locale itself.
  const candidates = [...(env.LANGUAGE ? env.LANGUAGE.split(":") : []), locale];
  for (const token of candidates) {
    const mapped = mapLocaleToken(token);
    if (mapped) return mapped;
  }
  return "en";
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
  if (rawLanguage) {
    // BCP-47 tags are case-insensitive (RFC 5646 §2.1.1): match the canonical
    // option case-folded so "zh-hans" / "ZH-HANT" / "EN" resolve instead of
    // silently falling through to English.
    const folded = rawLanguage.trim().toLowerCase();
    const canon = LANGUAGE_OPTIONS.find((o) => o.toLowerCase() === folded);
    if (canon) merged.language = canon;
    // Aliases (hand-edited files): OWN-property lookup only — never the prototype
    // chain, so "constructor"/"__proto__"/"toString" can't resolve to a function.
    else if (Object.hasOwn(LANGUAGE_ALIASES, rawLanguage))
      merged.language = LANGUAGE_ALIASES[rawLanguage];
  }

  const rawTheme = stringValue(parsed, "theme");
  if (isOneOf(THEME_OPTIONS, rawTheme)) {
    merged.theme = rawTheme;
  } else if (rawTheme && Object.hasOwn(THEME_ALIASES, rawTheme)) {
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
    const split = Object.hasOwn(LEGACY_CAST_MODE, rawCastMode) ? LEGACY_CAST_MODE[rawCastMode] : undefined;
    if (split) {
      merged.castMethod = split.method;
      merged.castMode = split.mode;
    }
  } else {
    if (isOneOf(CAST_METHOD_OPTIONS, rawCastMethod)) merged.castMethod = rawCastMethod;
    if (isOneOf(CAST_MODE_OPTIONS, rawCastMode)) {
      merged.castMode = rawCastMode;
    } else if (rawCastMode) {
      const split = Object.hasOwn(LEGACY_CAST_MODE, rawCastMode) ? LEGACY_CAST_MODE[rawCastMode] : undefined;
      if (split) {
        merged.castMethod = split.method;
        merged.castMode = split.mode;
      }
    }
  }

  // Forward-compat (schema-keys: "schemas only expand"): carry through unknown
  // OWN keys written by a newer version / parallel install, so a settings save
  // from this version doesn't destroy them. `k in DEFAULT_CONFIG` skips both the
  // known keys and inherited prototype names (constructor/toString/…).
  for (const k of Object.keys(parsed)) {
    if (!(k in DEFAULT_CONFIG)) {
      (merged as unknown as Record<string, unknown>)[k] = parsed[k];
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
   * Read + JSON.parse the config file. Returns the parsed object, `null` when the
   * file is genuinely absent (ENOENT), or `"corrupt"` when it exists but won't
   * parse — in which case the unreadable file is first copied aside to .corrupt
   * (best-effort, with a stderr warning) so a later save can't silently clobber
   * it. Real I/O faults (EACCES/EIO) propagate so they stay visible.
   */
  private async readRaw(): Promise<Record<string, unknown> | null | "corrupt"> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        await writeFile(`${this.path}.corrupt`, raw, "utf-8");
        console.error(
          `iching: config at ${this.path} is unreadable; backed up to ${this.path}.corrupt, using defaults.`,
        );
      } catch {
        /* read-only / full: nothing more we can do */
      }
      return "corrupt";
    }
    return isRecord(parsed) ? parsed : {};
  }

  async load(): Promise<UserConfig> {
    // A deferred in-memory seed (first boot couldn't persist) is authoritative for
    // the session, so a same-session reload stays in its detected language.
    if (this.seededInMemory) return { ...this.seededInMemory };
    const raw = await this.readRaw();
    if (raw === null || raw === "corrupt") return { ...DEFAULT_CONFIG };
    return normalizeConfig(raw);
  }

  /**
   * Like `load()`, but seeds the display language from the system locale and
   * PERSISTS it when the user has NOT chosen one — first boot (no file) OR an
   * upgrade from a pre-language version (a config that exists but has never had a
   * `language` key). After that the saved choice wins and the locale is never
   * re-consulted. Used at interactive startup; `load()` stays a pure read so
   * config subcommands and test fixtures don't write files.
   */
  async loadOrSeed(): Promise<UserConfig> {
    const raw = await this.readRaw();
    if (raw === "corrupt") return { ...DEFAULT_CONFIG };
    // The user already has a stored language choice → honor it, don't re-seed.
    if (raw !== null && Object.hasOwn(raw, "language")) return normalizeConfig(raw);
    // No choice yet (first boot, or pre-language upgrade): seed from the locale,
    // preserving any other existing settings, and persist (best-effort).
    const base = raw === null ? DEFAULT_CONFIG : normalizeConfig(raw);
    const seeded: UserConfig = { ...base, language: detectSystemLanguage() };
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
