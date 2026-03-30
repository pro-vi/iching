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

      // Save to storage
      const paths = resolvePaths(
        opts.dataDir ? { dataDir: opts.dataDir } : undefined,
      );
      const today = new Date().toISOString().slice(0, 10);

      const cacheStore = new JsonDailyCacheStore(paths.cache);
      await cacheStore.write({
        date: today,
        cast,
        shown: true,
        structure,
      });

      const journal = new JsonlJournalStore(paths.state);
      await journal.append({ date: today, cast });

      // Output
      if (opts.json) {
        outputJson(castToJson(cast, primary, becoming, question));
      } else {
        console.log(formatCastPlain(cast, primary, structure, question));
      }
    });
}
