import { Command } from "commander";
import { resolvePaths } from "@iching/storage";
import { outputJson } from "../output/json.js";

export function registerPathsCommand(program: Command): void {
  program
    .command("paths")
    .description("Show all resolved file locations")
    .action(() => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );

      if (globalOpts.json) {
        outputJson(paths);
      } else {
        console.log(`Config:  ${paths.config}`);
        console.log(`State:   ${paths.state}`);
        console.log(`Cache:   ${paths.cache}`);
      }
    });
}
