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

/** Read all of stdin as a string */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
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

  const today = new Date().toISOString().slice(0, 10);

  let cast: Cast;
  let structure: Structure;
  let shown: boolean;

  // Check cache
  const cached = await cacheStore.read();
  if (cached && cached.date === today) {
    cast = cached.cast;
    structure = cached.structure;
    shown = cached.shown;
  } else {
    // Fresh cast
    cast = castHexagram(source);
    structure = buildStructure(cast);
    shown = false;
  }

  // Select display
  const display = selectDisplay(cast, structure, shown, source);

  // Update cache
  await cacheStore.write({
    date: today,
    cast,
    shown: true,
    structure,
  });

  // Append to journal only on first cast of the day
  if (!shown) {
    await journal.append({ date: today, cast });
  }

  // Output
  if (display) {
    console.log(display);
  }
}
