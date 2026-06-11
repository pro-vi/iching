import {
  BoundRandomSource,
  castHexagram,
  buildStructure,
  selectDisplay,
  CryptoRandomSource,
} from "@iching/core";
import type { Cast, CastMethod, RandomSource, RngProvenance, Structure } from "@iching/core";
import {
  resolvePaths,
  JsonConfigStore,
  JsonDailyCacheStore,
  JsonlJournalStore,
} from "@iching/storage";
import { localToday } from "../util/today.js";

/** Read all of stdin with a timeout (5s default) */
async function readStdin(timeoutMs = 5000): Promise<string> {
  return new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      process.stdin.removeAllListeners("data");
      process.stdin.removeAllListeners("end");
      resolve(Buffer.concat(chunks).toString("utf-8"));
    }, timeoutMs);

    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
  });
}

/**
 * Hook adapter: runs the daily reading flow.
 *
 * 1. Read stdin (Claude Code hook payload — we don't use its contents currently)
 * 2. Check daily cache — if already cast today, use cached cast
 * 3. Otherwise cast fresh
 * 4. Select display via probability cascade
 * 5. Output to stdout
 * 6. Save cache + append journal
 */
export async function runHookAdapter(): Promise<void> {
  // Consume stdin (hook payload)
  const _payload = await readStdin();

  const paths = resolvePaths();
  const cacheStore = new JsonDailyCacheStore(paths.cache);
  const journal = new JsonlJournalStore(paths.state);

  const today = localToday();

  let cast: Cast;
  let structure: Structure;
  let shown: boolean;
  let intention: string | undefined;
  let method: CastMethod | undefined;
  let rng: RngProvenance | undefined;
  let source: RandomSource;

  // Check cache
  const cached = await cacheStore.read();
  if (cached && cached.date === today) {
    cast = cached.cast;
    structure = cached.structure;
    shown = cached.shown;
    intention = cached.intention;
    method = cached.method;
    // Carry the day's entropy provenance through the rewrite — a hook run
    // after a bound/seeded TUI cast must not strip the honest source story.
    rng = cached.rng;
    // No new cast: entropy is only needed for the display cascade.
    source = new CryptoRandomSource();
  } else {
    // Fresh cast — instant coins, recorded as such. Honor the saved entropy
    // config like commands/cast.ts does; the hook carries no intention, so a
    // bound cast salts with the empty moment only (intentionBound stays false
    // — chance is primary either way).
    const config = await new JsonConfigStore(paths.config).load();
    if (config.entropy === "bound") {
      source = new BoundRandomSource("");
      rng = { source: "bound", intentionBound: false };
    } else {
      source = new CryptoRandomSource();
      rng = { source: "crypto", intentionBound: false };
    }
    cast = castHexagram(source);
    structure = buildStructure(cast);
    shown = false;
    method = "coin";
  }

  // Select display
  const display = selectDisplay(cast, structure, shown, source);

  // Journal first — if interrupted, failure is a recoverable duplicate
  // (vs cache-first where journal entry is permanently lost)
  if (!shown) {
    const timestamp = new Date().toISOString();
    await journal.append({ date: today, cast, timestamp, method, rng });
  }

  // Then update cache (preserve intention/method/rng from TUI if present)
  await cacheStore.write({
    date: today,
    cast,
    shown: true,
    structure,
    intention,
    method,
    rng,
  });

  // Output
  if (display) {
    console.log(display);
  }
}
