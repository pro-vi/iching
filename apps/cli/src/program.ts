import { Command } from "commander";
import { registerCastCommand } from "./commands/cast.js";
import { registerJournalCommand } from "./commands/journal.js";
import { registerHexagramCommand } from "./commands/hexagram.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerPathsCommand } from "./commands/paths.js";
import { registerDoctorCommand } from "./commands/doctor.js";

const pkg = { name: "iching", version: "0.1.0" };

export const program = new Command()
  .name(pkg.name)
  .version(pkg.version)
  .option("--json", "structured JSON output")
  .option("--theme <name>", "color theme", "temple-night")
  .option("--motion <preset>", "animation preset", "default")
  .option("--ansi <mode>", "color mode: auto|always|never", "auto")
  .option("--seed <n>", "deterministic RNG seed")
  .option("--data-dir <path>", "override data directory");

registerCastCommand(program);
registerJournalCommand(program);
registerHexagramCommand(program);
registerConfigCommand(program);
registerPathsCommand(program);
registerDoctorCommand(program);
