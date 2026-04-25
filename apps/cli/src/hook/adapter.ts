import {
  castHexagram,
  buildStructure,
  selectDisplay,
  CryptoRandomSource,
} from "@iching/core";
import type { Cast, Structure } from "@iching/core";
import {
  resolvePaths,
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

  const source = new CryptoRandomSource();
  const paths = resolvePaths();
  const cacheStore = new JsonDailyCacheStore(paths.cache);
  const journal = new JsonlJournalStore(paths.state);

  const today = localToday();

  let cast: Cast;
  let structure: Structure;
  let shown: boolean;
  let intention: string | undefined;

  // Check cache
  const cached = await cacheStore.read();
  if (cached && cached.date === today) {
    cast = cached.cast;
    structure = cached.structure;
    shown = cached.shown;
    intention = cached.intention;
  } else {
    // Fresh cast
    cast = castHexagram(source);
    structure = buildStructure(cast);
    shown = false;
  }

  // Select display
  const display = selectDisplay(cast, structure, shown, source);

  // Journal first — if interrupted, failure is a recoverable duplicate
  // (vs cache-first where journal entry is permanently lost)
  if (!shown) {
    const timestamp = new Date().toISOString();
    await journal.append({ date: today, cast, timestamp });
  }

  // Then update cache (preserve intention from TUI if present)
  await cacheStore.write({
    date: today,
    cast,
    shown: true,
    structure,
    intention,
  });

  // Output
  if (display) {
    console.log(display);
  }
}
