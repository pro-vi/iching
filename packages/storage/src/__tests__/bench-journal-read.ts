// Benchmark the journal read path at scale. NOT a *.test.ts — the suite ignores
// it; run it on demand:  bun packages/storage/src/__tests__/bench-journal-read.ts
//
// Measures a full stream() drain (parse + isCastShaped → assembleCast per entry)
// over a synthetic journal of growing size, so the integrity-check cost on the
// read path is a number, not a guess. See plans/002 for the budget + decision.
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { castHexagram, SeededRandomSource } from "@iching/core";
import { JsonlJournalStore } from "../json/jsonl-journal.js";

const SIZES = [1_000, 10_000, 50_000, 100_000];
const RUNS = 3;

async function makeJournal(dir: string, n: number): Promise<string> {
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const cast = castHexagram(new SeededRandomSource(i + 1)); // consistent → not torn on read
    const date = `2020-01-${String((i % 28) + 1).padStart(2, "0")}`;
    lines.push(JSON.stringify({ date, cast, timestamp: `${date}T09:00:00.000Z` }));
  }
  const path = join(dir, `journal-${n}.jsonl`);
  await writeFile(path, lines.join("\n") + "\n", "utf-8");
  return path;
}

async function drain(store: JsonlJournalStore): Promise<number> {
  let count = 0;
  for await (const _ of store.stream()) count++;
  return count;
}

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "iching-bench-"));
  try {
    console.log("journal read (full stream() drain) — parse + isCastShaped/assembleCast per entry\n");
    for (const n of SIZES) {
      const path = await makeJournal(dir, n);
      const store = new JsonlJournalStore(path);
      await drain(store); // warm-up
      const times: number[] = [];
      for (let r = 0; r < RUNS; r++) {
        const t0 = performance.now();
        const count = await drain(store);
        times.push(performance.now() - t0);
        if (count !== n) throw new Error(`expected ${n} entries, drained ${count} (some were torn?)`);
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const us = (avg * 1000) / n;
      console.log(`  ${String(n).padStart(7)} entries:  ${avg.toFixed(1).padStart(7)} ms   (${us.toFixed(2)} µs/entry)`);
    }
    console.log("\nbudget: a full-stream command stays < ~150ms at the realistic ceiling (~50k).");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

await main();
