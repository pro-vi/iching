import { Command } from "commander";
import { resolvePaths, JsonConfigStore, canonicalLanguage } from "@iching/storage";
import type { UserConfig } from "@iching/storage";
import { outputJson, configToJson } from "../output/json.js";

type ConfigEntry = {
  values?: readonly string[];
  description: string;
  /** Canonicalize a raw CLI value before validation (e.g. accept 繁/EN/zh-hant for language). */
  normalize?: (value: string) => string;
  set: (cfg: UserConfig, value: string) => boolean;
};

function isOneOf<const T extends readonly string[]>(
  options: T,
  value: string,
): value is T[number] {
  return options.includes(value as T[number]);
}

const THEME_VALUES = ["ink", "bone", "cinnabar", "jade", "river"] as const;
const MOTION_VALUES = ["default", "brisk", "deep", "reduced"] as const;
const COLOR_VALUES = ["auto", "always", "never"] as const;
const LANGUAGE_VALUES = ["en", "zh-Hant", "zh-Hans"] as const;
const GLYPH_ANIM_VALUES = ["noise", "dots", "radial", "sand"] as const;
const GLYPH_FONT_VALUES = ["kaiti", "libian", "heiti"] as const;
const TAIJITU_STYLE_VALUES = ["dots", "dense"] as const;
const CAST_METHOD_VALUES = ["coin", "yarrow"] as const;
const CAST_MODE_VALUES = ["auto", "manual"] as const;

const CONFIG_SCHEMA: Record<keyof UserConfig, ConfigEntry> = {
  theme: {
    values: THEME_VALUES,
    description: "Color theme",
    set: (cfg, value) => {
      if (!isOneOf(THEME_VALUES, value)) return false;
      cfg.theme = value;
      return true;
    },
  },
  motion: {
    values: MOTION_VALUES,
    description: "Casting animation speed",
    set: (cfg, value) => {
      if (!isOneOf(MOTION_VALUES, value)) return false;
      cfg.motion = value;
      return true;
    },
  },
  language: {
    values: LANGUAGE_VALUES,
    description: "Display language (English, 繁, or 简)",
    // Accept the UI labels (繁/简/EN) and case variants, matching the file loader.
    normalize: (value) => canonicalLanguage(value) ?? value,
    set: (cfg, value) => {
      if (!isOneOf(LANGUAGE_VALUES, value)) return false;
      cfg.language = value;
      return true;
    },
  },
  color: {
    values: COLOR_VALUES,
    description: "ANSI color mode",
    set: (cfg, value) => {
      if (!isOneOf(COLOR_VALUES, value)) return false;
      cfg.color = value;
      return true;
    },
  },
  timezone: {
    description: "Timezone (\"system\" or IANA name)",
    set: (cfg, value) => {
      cfg.timezone = value;
      return true;
    },
  },
  glyphAnim: {
    values: GLYPH_ANIM_VALUES,
    description: "Glyph reveal animation",
    set: (cfg, value) => {
      if (!isOneOf(GLYPH_ANIM_VALUES, value)) return false;
      cfg.glyphAnim = value;
      return true;
    },
  },
  glyphFont: {
    values: GLYPH_FONT_VALUES,
    description: "Glyph font",
    set: (cfg, value) => {
      if (!isOneOf(GLYPH_FONT_VALUES, value)) return false;
      cfg.glyphFont = value;
      return true;
    },
  },
  taijituStyle: {
    values: TAIJITU_STYLE_VALUES,
    description: "Home-screen taijitu style",
    set: (cfg, value) => {
      if (!isOneOf(TAIJITU_STYLE_VALUES, value)) return false;
      cfg.taijituStyle = value;
      return true;
    },
  },
  castMethod: {
    values: CAST_METHOD_VALUES,
    description: "Cast method (coin or yarrow stalk ritual)",
    set: (cfg, value) => {
      if (!isOneOf(CAST_METHOD_VALUES, value)) return false;
      cfg.castMethod = value;
      return true;
    },
  },
  castMode: {
    values: CAST_MODE_VALUES,
    description: "Cast mode (auto or operator-guided)",
    set: (cfg, value) => {
      if (!isOneOf(CAST_MODE_VALUES, value)) return false;
      cfg.castMode = value;
      return true;
    },
  },
};

const VALID_KEYS = Object.keys(CONFIG_SCHEMA) as Array<keyof typeof CONFIG_SCHEMA>;

function isConfigKey(key: string): key is keyof typeof CONFIG_SCHEMA {
  // own-property check, NOT `key in CONFIG_SCHEMA` — the `in` operator walks the
  // prototype chain, so inherited names (toString/constructor/valueOf/__proto__)
  // would falsely pass the guard and crash `set` / mis-print `get`.
  return Object.hasOwn(CONFIG_SCHEMA, key);
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage configuration");

  config
    .command("list")
    .description("Show all configuration values")
    .action(async () => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonConfigStore(paths.config);
      const cfg = await store.load();

      if (globalOpts.json) {
        outputJson(cfg);
      } else {
        for (const key of VALID_KEYS) {
          const value = cfg[key];
          const schema = CONFIG_SCHEMA[key];
          const valid = schema.values ? ` (${schema.values.join("|")})` : "";
          console.log(`  ${key.padEnd(12)} = ${value}${valid}`);
        }
      }
    });

  config
    .command("get")
    .description("Read a config value")
    .argument("<key>", `config key (${VALID_KEYS.join(", ")})`)
    .action(async (key: string) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonConfigStore(paths.config);
      const cfg = await store.load();

      if (!isConfigKey(key)) {
        console.error(`Unknown key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`);
        process.exit(1);
      }

      const value = cfg[key];
      if (globalOpts.json) {
        outputJson(configToJson(key, value));
      } else {
        console.log(value);
      }
    });

  config
    .command("set")
    .description("Write a config value")
    .argument("<key>", "config key")
    .argument("<value>", "config value")
    .action(async (key: string, value: string) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonConfigStore(paths.config);
      // `set` WRITES the config, so on first boot it must seed the display
      // language first — otherwise persisting the defaulted "en" would freeze
      // the locale seed before the user ever launches the TUI. (get/list stay
      // pure load() — they don't write.)
      const cfg = await store.loadOrSeed();

      if (!isConfigKey(key)) {
        console.error(`Unknown key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`);
        process.exit(1);
      }

      // Canonicalize the raw value (e.g. the 繁/简/EN labels the Settings UI
      // shows for `language`), then validate against allowed values.
      const schema = CONFIG_SCHEMA[key];
      const resolved = schema.normalize ? schema.normalize(value) : value;
      if (schema.values && !schema.values.includes(resolved)) {
        console.error(`Invalid value "${value}" for ${key}. Valid: ${schema.values.join(", ")}`);
        process.exit(1);
      }

      if (!schema.set(cfg, resolved)) {
        console.error(`Invalid value "${value}" for ${key}. Valid: ${schema.values?.join(", ") ?? "any string"}`);
        process.exit(1);
      }
      try {
        await store.save(cfg);
      } catch {
        // A write command must fail when it can't persist — but cleanly, not
        // with a raw EACCES stack trace (cf. the TUI settings-save hardening).
        console.error(`Couldn't write config to ${paths.config} (read-only or full data dir?).`);
        process.exit(1);
      }

      if (globalOpts.json) {
        outputJson(configToJson(key, resolved));
      } else {
        console.log(`${key} = ${resolved}`);
      }
    });

  config
    .command("path")
    .description("Show config file location")
    .action(() => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      if (globalOpts.json) {
        outputJson({ path: paths.config });
      } else {
        console.log(paths.config);
      }
    });
}
