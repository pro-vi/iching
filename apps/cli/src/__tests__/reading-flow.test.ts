// Integration tests for the yarrow branch of the reading flow.

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Cast } from "@iching/core";
import { resolvePaths, JsonDailyCacheStore } from "@iching/storage";
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
    today: "2026-05-20",
    session: { cols: 80, rows: 24 },
    glyphConfig: { glyphAnim: "dots", glyphFont: "kaiti" },
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
});
