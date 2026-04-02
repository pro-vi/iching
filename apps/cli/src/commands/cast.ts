import { Command } from "commander";
import {
  castHexagram,
  buildStructure,
  CryptoRandomSource,
  SeededRandomSource,
  GUA,
} from "@iching/core";
import {
  resolvePaths,
  JsonDailyCacheStore,
  JsonlJournalStore,
} from "@iching/storage";
import { formatCastPlain } from "../output/plain.js";
import { outputJson, castToJson } from "../output/json.js";
import { localToday } from "../util/today.js";

export function registerCastCommand(program: Command): void {
  program
    .command("cast")
    .description("Perform an I Ching casting")
    .argument("[question]", "question for the oracle")
    .action(async (question: string | undefined) => {
      const opts = program.opts();
      const seed = opts.seed ? Number(opts.seed) : undefined;
      const source =
        seed !== undefined
          ? new SeededRandomSource(seed)
          : new CryptoRandomSource();

      const cast = castHexagram(source);
      const primary = GUA[cast.primary - 1];
      const becoming = cast.becoming !== null ? GUA[cast.becoming - 1] : null;
      const structure = buildStructure(cast);

      // CLI cast is ephemeral — it never writes to cache or journal.
      // Only the interactive daily cast (home menu → [c]) records to storage.
      // This keeps `iching cast` safe to run anytime without side effects.

      // Output
      if (opts.json) {
        outputJson(castToJson(cast, primary, becoming, question));
      } else {
        console.log(formatCastPlain(cast, primary, structure, question));
      }
    });
}
