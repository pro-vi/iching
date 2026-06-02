import { readFile } from "node:fs/promises";
import type { UserConfig } from "../types.js";
import type { ConfigStore } from "../config-store.js";
import { atomicWriteJson } from "./atomic-write.js";

const MOTION_OPTIONS = ["default", "brisk", "deep", "reduced"] as const;
const LANGUAGE_OPTIONS = ["zh-Hans", "zh-Hant", "en"] as const;
const THEME_OPTIONS = ["ink", "bone", "cinnabar", "jade", "river"] as const;
const COLOR_OPTIONS = ["auto", "always", "never"] as const;
const GLYPH_ANIM_OPTIONS = ["noise", "dots", "radial", "sand"] as const;
const GLYPH_FONT_OPTIONS = ["kaiti", "libian", "heiti"] as const;
const TAIJITU_STYLE_OPTIONS = ["dots", "dense"] as const;
const CAST_METHOD_OPTIONS = ["coin", "yarrow"] as const;
const CAST_MODE_OPTIONS = ["auto", "manual"] as const;

const DEFAULT_CONFIG: UserConfig = {
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

  async load(): Promise<UserConfig> {
    try {
      const raw = await readFile(this.path, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      return normalizeConfig(parsed);
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
