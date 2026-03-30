import { Command } from "commander";
import { resolvePaths, JsonConfigStore } from "@iching/storage";
import type { UserConfig } from "@iching/storage";
import { outputJson, configToJson } from "../output/json.js";

const VALID_KEYS: (keyof UserConfig)[] = [
  "motion",
  "theme",
  "color",
  "timezone",
];

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage configuration");

  config
    .command("get")
    .description("Read a config value")
    .argument("<key>", "config key")
    .action(async (key: string) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonConfigStore(paths.config);
      const cfg = await store.load();

      if (!VALID_KEYS.includes(key as keyof UserConfig)) {
        console.error(
          `Unknown config key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`,
        );
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

      if (!VALID_KEYS.includes(key as keyof UserConfig)) {
        console.error(
          `Unknown config key "${key}". Valid keys: ${VALID_KEYS.join(", ")}`,
        );
        process.exit(1);
      }

      (cfg as Record<string, unknown>)[key] = value;
      await store.save(cfg);

      if (globalOpts.json) {
        outputJson(configToJson(key, value));
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
