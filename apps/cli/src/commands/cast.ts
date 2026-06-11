import { Command } from "commander";
import {
  BoundRandomSource,
  castHexagram,
  buildStructure,
  CryptoRandomSource,
  type RandomSource,
  type RngProvenance,
  SeededRandomSource,
  GUA,
} from "@iching/core";
import { resolvePaths, JsonConfigStore } from "@iching/storage";
import { formatCastPlain } from "../output/plain.js";
import { outputJson, castToJson } from "../output/json.js";
import { parseSeed } from "../util/parse-seed.js";

export function registerCastCommand(program: Command): void {
  program
    .command("cast")
    .description("Perform an I Ching casting")
    .argument("[question]", "question for the oracle")
    .option("--bound", "bind the cast to the question and moment (local entropy)")
    .action(async (question: string | undefined, cmdOpts: { bound?: boolean }) => {
      const opts = program.opts();
      // --seed validation (stderr + exit 1 on garbage) lives in the shared
      // util/parse-seed.ts helper so the TUI entry refuses a bad seed the
      // same way this command does.
      const seed = parseSeed(opts.seed as string | undefined);

      // Entropy: an explicit --seed is its own deterministic path; otherwise
      // --bound (or the saved entropy config) mixes the question and moment
      // into local machine entropy — chance stays primary either way.
      let bound = cmdOpts.bound === true;
      if (!bound && seed === undefined) {
        const paths = resolvePaths(opts.dataDir ? { dataDir: opts.dataDir } : undefined);
        const cfg = await new JsonConfigStore(paths.config).load();
        bound = cfg.entropy === "bound";
      }
      let source: RandomSource;
      let rng: RngProvenance;
      if (seed !== undefined) {
        source = new SeededRandomSource(seed);
        rng = { source: "seed", intentionBound: false };
      } else if (bound) {
        source = new BoundRandomSource(question ?? "");
        rng = { source: "bound", intentionBound: question !== undefined && question !== "" };
      } else {
        source = new CryptoRandomSource();
        rng = { source: "crypto", intentionBound: false };
      }

      const cast = castHexagram(source);
      const primary = GUA[cast.primary - 1];
      const becoming = cast.becoming !== null ? GUA[cast.becoming - 1] : null;
      const structure = buildStructure(cast);

      // CLI cast is ephemeral — it never writes to cache or journal.
      // Only the interactive daily cast (home menu → [c]) records to storage.
      // This keeps `iching cast` safe to run anytime without side effects.

      // Output
      if (opts.json) {
        outputJson(castToJson(cast, primary, becoming, question, rng, seed));
      } else {
        console.log(formatCastPlain(cast, primary, structure, question, rng, seed));
      }
    });
}
