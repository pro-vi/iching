// Integration tests for the yarrow branch of the reading flow.

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Cast } from "@iching/core";
import { resolvePaths, JsonDailyCacheStore, JsonlJournalStore } from "@iching/storage";
import {
  IntentionScene,
  CastScene,
  YarrowScene,
  type Scene,
  type SceneSignal,
} from "@iching/terminal";
import { runReadingFlow, type ReadingFlowDeps } from "../app/reading-flow.ts";

type RunImpl = (scene: Scene) => Promise<SceneSignal | void>;

function makeDeps(dataDir: string, run: RunImpl): ReadingFlowDeps {
  const paths = resolvePaths({ dataDir });
  return {
    run,
    runRouter: async () => ({ shouldExit: false }),
    paths,
    cacheStore: new JsonDailyCacheStore(paths.cache),
    today: () => "2026-05-20",
    session: { cols: 80, rows: 24 },
    glyphConfig: { glyphAnim: "dots", glyphFont: "kaiti" },
    language: "zh-Hant",
    motion: "default",
  };
}

describe("runReadingFlow — yarrow source", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "iching-yarrow-flow-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("runs YarrowScene, persists the cast, and reveals via CastScene", async () => {
    const scenesRun: string[] = [];
    let yarrowCast: Cast | undefined;
    let castSceneCast: Cast | undefined;

    const run: RunImpl = async (scene) => {
      if (scene instanceof IntentionScene) {
        scenesRun.push("intention");
        return { type: "intentionConfirmed" };
      }
      if (scene instanceof YarrowScene) {
        scenesRun.push("yarrow");
        yarrowCast = scene.getModel().requireCast();
        return { type: "yarrowCompleted", cast: scene.getModel().requireCast() };
      }
      if (scene instanceof CastScene) {
        scenesRun.push("cast");
        castSceneCast = scene.getModel().cast;
        return { type: "home" };
      }
    };

    const deps = makeDeps(dataDir, run);
    const result = await runReadingFlow(deps, {
      purpose: "cast",
      source: { type: "yarrow" },
    });

    expect(result.shouldExit).toBe(false);
    expect(scenesRun).toEqual(["intention", "yarrow", "cast"]);
    // The yarrow cast flows unchanged into the shared reveal scene.
    expect(castSceneCast).toEqual(yarrowCast);

    const cache = await deps.cacheStore.read();
    expect(cache?.cast).toEqual(yarrowCast);
    expect(cache?.shown).toBe(true);
    // Cast-method provenance is recorded at persist time
    expect(cache?.method).toBe("yarrow");
    const journal = new JsonlJournalStore(deps.paths.state);
    const entry = await journal.latest();
    expect(entry?.method).toBe("yarrow");
    // The journal and the daily cache record the SAME cast — `iching today`
    // (cache) and the journal must agree on the day's reading. They share one
    // `cast` at persist time; lock that they don't drift apart.
    expect(entry?.cast).toEqual(yarrowCast);
    expect(entry?.cast).toEqual(cache?.cast);
  });

  test("auto (coin) casts record method provenance too", async () => {
    const run: RunImpl = async (scene) => {
      if (scene instanceof IntentionScene) return { type: "intentionConfirmed" };
      if (scene instanceof CastScene) return { type: "home" };
    };

    const deps = makeDeps(dataDir, run);
    const result = await runReadingFlow(deps, {
      purpose: "cast",
      source: { type: "auto" },
    });

    expect(result.shouldExit).toBe(false);
    const cache = await deps.cacheStore.read();
    expect(cache?.method).toBe("coin");
    const journal = new JsonlJournalStore(deps.paths.state);
    const entry = await journal.latest();
    expect(entry?.method).toBe("coin");
  });

  test("crypto (default) casts record rng provenance as plain crypto", async () => {
    const run: RunImpl = async (scene) => {
      if (scene instanceof IntentionScene) return { type: "intentionConfirmed" };
      if (scene instanceof CastScene) return { type: "home" };
    };

    const deps = makeDeps(dataDir, run); // no entropy key → crypto
    await runReadingFlow(deps, { purpose: "cast", source: { type: "auto" } });

    const cache = await deps.cacheStore.read();
    expect(cache?.rng).toEqual({ source: "crypto", intentionBound: false });
    const journal = new JsonlJournalStore(deps.paths.state);
    const entry = await journal.latest();
    expect(entry?.rng).toEqual({ source: "crypto", intentionBound: false });
  });

  test("bound entropy with an intention records intentionBound provenance", async () => {
    const ctx = { cols: 80, rows: 24, done: false, colorSupport: "none" as const };
    const run: RunImpl = async (scene) => {
      if (scene instanceof IntentionScene) {
        for (const ch of "will it rain?") scene.handleKey({ type: "char", char: ch }, ctx);
        return scene.handleKey({ type: "enter" }, ctx) ?? undefined;
      }
      if (scene instanceof CastScene) return { type: "home" };
    };

    const deps = { ...makeDeps(dataDir, run), entropy: "bound" as const };
    await runReadingFlow(deps, { purpose: "cast", source: { type: "auto" } });

    const cache = await deps.cacheStore.read();
    expect(cache?.rng).toEqual({ source: "bound", intentionBound: true });
    expect(cache?.intention).toBe("will it rain?");
    const journal = new JsonlJournalStore(deps.paths.state);
    const entry = await journal.latest();
    expect(entry?.rng).toEqual({ source: "bound", intentionBound: true });
  });

  test("bound entropy without an intention is bound to the moment only", async () => {
    const ctx = { cols: 80, rows: 24, done: false, colorSupport: "none" as const };
    const run: RunImpl = async (scene) => {
      if (scene instanceof IntentionScene) {
        return scene.handleKey({ type: "enter" }, ctx) ?? undefined; // empty intention
      }
      if (scene instanceof CastScene) return { type: "home" };
    };

    const deps = { ...makeDeps(dataDir, run), entropy: "bound" as const };
    await runReadingFlow(deps, { purpose: "cast", source: { type: "auto" } });

    const cache = await deps.cacheStore.read();
    expect(cache?.rng).toEqual({ source: "bound", intentionBound: false });
  });

  test("seeded auto casts record seed provenance in the cache (journal skipped)", async () => {
    const run: RunImpl = async (scene) => {
      if (scene instanceof IntentionScene) return { type: "intentionConfirmed" };
      if (scene instanceof CastScene) return { type: "home" };
    };

    const deps = { ...makeDeps(dataDir, run), entropy: "bound" as const };
    await runReadingFlow(deps, { purpose: "cast", source: { type: "auto", seed: 42 } });

    const cache = await deps.cacheStore.read();
    // --seed stays its own deterministic path — never reported as bound.
    expect(cache?.rng).toEqual({ source: "seed", intentionBound: false });
    const journal = new JsonlJournalStore(deps.paths.state);
    expect(await journal.latest()).toBeNull(); // seeded casts never reach the journal
  });

  test("replaying an existing reading reveals it without re-appending to the journal", async () => {
    // A replay (source 'existing') shows a past cast but persists nothing —
    // otherwise reopening a reading (from the journal, or `iching today`) would
    // silently duplicate it. Guards the !isReplay half of the persist gate.
    const run: RunImpl = async (scene) => {
      if (scene instanceof CastScene) return { type: "home" };
    };
    const deps = makeDeps(dataDir, run);
    const journal = new JsonlJournalStore(deps.paths.state);
    expect(await journal.latest()).toBeNull(); // empty to start
    const cast: Cast = {
      lines: [1, 2, 3, 4, 5, 6].map(() => ({ value: 7, isYang: true, isChanging: false })),
      primary: 1,
      becoming: null,
      changingPositions: [],
      nuclear: 2,
      polarity: 2,
      mirror: 1,
      diagonal: 2,
    };
    await runReadingFlow(deps, { purpose: "cast", source: { type: "existing", cast } });
    expect(await journal.latest()).toBeNull(); // the replay added nothing
  });

  test("quitting the ritual early persists nothing and does not reveal", async () => {
    const scenesRun: string[] = [];

    const run: RunImpl = async (scene) => {
      if (scene instanceof IntentionScene) {
        scenesRun.push("intention");
        return { type: "intentionConfirmed" };
      }
      if (scene instanceof YarrowScene) {
        scenesRun.push("yarrow");
        return { type: "home" }; // abandoned mid-ritual
      }
      if (scene instanceof CastScene) {
        scenesRun.push("cast");
        return { type: "home" };
      }
    };

    const deps = makeDeps(dataDir, run);
    const result = await runReadingFlow(deps, {
      purpose: "cast",
      source: { type: "yarrow" },
    });

    expect(result.shouldExit).toBe(false);
    expect(scenesRun).toEqual(["intention", "yarrow"]);
    const cache = await deps.cacheStore.read();
    expect(cache?.cast).toBeUndefined();
  });

  test("a read-only data dir does not crash the cast — it still reveals, with a warning", async () => {
    // Persistence runs BEFORE the reveal. Unguarded, a throw here (read-only or
    // full data dir) would lose the reading AND never show it — a crash at the
    // moment of revelation. Best-effort: warn and reveal anyway. Block the
    // journal path by making its parent a FILE, so mkdir(parent) → ENOTDIR.
    const scenesRun: string[] = [];
    const run: RunImpl = async (scene) => {
      if (scene instanceof IntentionScene) return { type: "intentionConfirmed" };
      if (scene instanceof CastScene) {
        scenesRun.push("cast");
        return { type: "home" };
      }
    };
    const deps = makeDeps(dataDir, run);
    const blocker = join(dataDir, "blocker");
    await writeFile(blocker, "x", "utf-8");
    deps.paths = { ...deps.paths, state: join(blocker, "nope", "history.jsonl") };

    const errors: string[] = [];
    const origErr = console.error;
    console.error = (...a: unknown[]) => {
      errors.push(a.map(String).join(" "));
    };
    let result;
    try {
      result = await runReadingFlow(deps, { purpose: "cast", source: { type: "auto" } });
    } finally {
      console.error = origErr;
    }

    expect(result.shouldExit).toBe(false);
    expect(scenesRun).toContain("cast"); // the reading still revealed…
    expect(errors.join("\n")).toMatch(/couldn't save this reading/i); // …with the calm warning
  });
});
