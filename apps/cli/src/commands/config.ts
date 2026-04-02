import { Command } from "commander";
import { resolvePaths, JsonConfigStore } from "@iching/storage";
import type { UserConfig } from "@iching/storage";
import { outputJson, configToJson } from "../output/json.js";

const CONFIG_SCHEMA: Record<string, { values?: string[]; description: string }> = {
  theme:     { values: ["temple-night", "ink", "dawn", "jade"], description: "Color theme" },
  motion:    { values: ["default", "brisk", "deep", "reduced"], description: "Casting animation speed" },
  color:     { values: ["auto", "always", "never"], description: "ANSI color mode" },
  timezone:  { description: "Timezone (\"system\" or IANA name)" },
  glyphAnim: { values: ["noise", "dots", "radial", "sand"], description: "Glyph reveal animation" },
  glyphFont: { values: ["kaiti", "libian", "heiti"], description: "Glyph font" },
  glyphSize: { values: ["32", "48", "64"], description: "Glyph render size" },
};

const VALID_KEYS = Object.keys(CONFIG_SCHEMA);

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
          const value = cfg[key as keyof UserConfig];
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

      if (!VALID_KEYS.includes(key)) {
        console.error(`Unknown key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`);
        process.exit(1);
      }

      const value = cfg[key as keyof UserConfig];
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
      const cfg = await store.load();

      if (!VALID_KEYS.includes(key)) {
        console.error(`Unknown key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`);
        process.exit(1);
      }

      // Validate value against allowed values
      const schema = CONFIG_SCHEMA[key];
      if (schema.values && !schema.values.includes(value)) {
        console.error(`Invalid value "${value}" for ${key}. Valid: ${schema.values.join(", ")}`);
        process.exit(1);
      }

      // Coerce glyphSize to number
      const coerced = key === "glyphSize" ? Number(value) : value;
      (cfg as Record<string, unknown>)[key] = coerced;
      await store.save(cfg);

      if (globalOpts.json) {
        outputJson(configToJson(key, coerced));
      } else {
        console.log(`${key} = ${value}`);
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
