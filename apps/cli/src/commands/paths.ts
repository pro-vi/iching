import { Command } from "commander";
import { resolvePathsFor } from "../util/paths.js";
import { outputJson } from "../output/json.js";

export function registerPathsCommand(program: Command): void {
  program
    .command("paths")
    .description("Show all resolved file locations")
    .action(() => {
      const globalOpts = program.opts();
      const paths = resolvePathsFor(globalOpts.dataDir);

      if (globalOpts.json) {
        outputJson(paths);
      } else {
        console.log(`Config:  ${paths.config}`);
        console.log(`State:   ${paths.state}`);
        console.log(`Cache:   ${paths.cache}`);
      }
    });
}
