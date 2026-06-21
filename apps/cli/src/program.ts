import { Command } from "commander";
import { registerCastCommand } from "./commands/cast.js";
import { registerTodayCommand } from "./commands/today.js";
import { registerJournalCommand } from "./commands/journal.js";
import { registerHexagramCommand } from "./commands/hexagram.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerPathsCommand } from "./commands/paths.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerDictCommand } from "./commands/dict.js";

import pkg from "../package.json" with { type: "json" };

// The binary users invoke is `iching` — never the workspace package name
// (`@iching/cli` made `--help` print "Usage: @iching/cli"). Version still
// derives from package.json so a release bump is a one-file change.
export const program = new Command()
  .name("iching")
  .version(pkg.version ?? "0.1.0")
  .option("--json", "structured JSON output")
  .option("--seed <n>", "deterministic RNG seed (cast command)")
  .option("--data-dir <path>", "override data directory")
  .option("--dev", "enable dev mode (coin toss playground, etc.)");

registerCastCommand(program);
registerTodayCommand(program);
registerJournalCommand(program);
registerHexagramCommand(program);
registerConfigCommand(program);
registerPathsCommand(program);
registerDoctorCommand(program);
registerDictCommand(program);
