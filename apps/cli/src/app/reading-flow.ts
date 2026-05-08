// Reading flow — the unified Ask → Obtain → Persist → Reveal → Nav lifecycle
// for cast (real reading), play (sandbox toss), and replay (existing cast).
//
// Adding a new reading source means adding a `ReadingSource` variant; the
// downstream phases stay shared, which prevents the parity-skip bugs that
// previously lived in main.ts (manual real-casts forgetting to persist or
// rejoin post-cast nav).

import {
  buildStructure,
  castHexagram,
  type Cast,
  CryptoRandomSource,
  SeededRandomSource,
} from "@iching/core";
import {
  JsonDailyCacheStore,
  JsonlJournalStore,
  type ResolvedPaths,
} from "@iching/storage";
import {
  BrowseScene,
  CastScene,
  type CastGlyphInput,
  IntentionScene,
  JournalScene,
  type MotionPreset,
  type Scene,
  SceneRouter,
  type SceneSignal,
  TossScene,
} from "@iching/terminal";
import {
  loadJournalEntries,
  makeBrowseFactory,
  makeDetailScene,
  makeJournalFactory,
  type SessionDims,
} from "./scene-factories.ts";

export type ReadingSource =
  | { type: "auto"; seed?: number }
  | { type: "manual" }
  | { type: "existing"; cast: Cast; intention?: string };

export type ReadingPurpose = "cast" | "play" | "replay";

export interface ReadingFlowDeps {
  run: (scene: Scene) => Promise<SceneSignal | void>;
  runRouter: (router: SceneRouter) => Promise<void>;
  paths: ResolvedPaths;
  cacheStore: JsonDailyCacheStore;
  today: string;
  session: SessionDims;
  glyphConfig: CastGlyphInput;
  motion: MotionPreset;
}

/**
 * Run the full reading lifecycle for one ritual.
 *
 * Returns `{ shouldExit: true }` when the user pressed Ctrl+C in any inner
 * scene; the caller should break the home loop. Returns `{ shouldExit: false }`
 * for any normal completion or graceful cancellation (e.g. quitting the toss).
 */
export async function runReadingFlow(
  deps: ReadingFlowDeps,
  opts: { purpose: ReadingPurpose; source: ReadingSource },
): Promise<{ shouldExit: boolean }> {
  const isPlay = opts.purpose === "play";
  const isReplay = opts.source.type === "existing";

  // 1. Ask — intention prompt (skipped for play and for replay where intention is already known)
  let intention: string | undefined;
  if (opts.source.type === "existing") {
    intention = opts.source.intention;
  } else if (!isPlay) {
    const intentionScene = new IntentionScene();
    const intentionSignal = await deps.run(intentionScene);
    if (intentionSignal === "exit") return { shouldExit: true };
    intention = intentionScene.getIntention();
  }

  // 2. Obtain — branch on source; produces a Cast or returns early
  let cast: Cast;
  let usedSeed = false;
  if (opts.source.type === "manual") {
    const tossScene = new TossScene();
    const tossSignal = await deps.run(tossScene);
    if (tossSignal === "exit") return { shouldExit: true };
    const tossed = tossScene.getCast();
    const completed = tossed && typeof tossSignal === "object"
      && tossSignal !== null && "goto" in tossSignal
      && tossSignal.goto === "cast-reveal";
    if (!completed) return { shouldExit: false }; // user quit before completing 6 lines
    cast = tossed!;
  } else if (opts.source.type === "auto") {
    usedSeed = opts.source.seed !== undefined;
    const source = usedSeed
      ? new SeededRandomSource(opts.source.seed!)
      : new CryptoRandomSource();
    cast = castHexagram(source);
  } else {
    cast = opts.source.cast;
  }

  // 3. Persist — skipped for play and for replay; seeded auto casts skip the journal but still update the cache
  if (!isPlay && !isReplay) {
    const structure = buildStructure(cast);
    const timestamp = new Date().toISOString();
    if (!usedSeed) {
      const journal = new JsonlJournalStore(deps.paths.state);
      await journal.append({ date: deps.today, cast, intention, timestamp });
    }
    await deps.cacheStore.write({
      date: deps.today,
      cast,
      shown: true,
      structure,
      intention,
    });
  }

  // 4. Reveal — manual and replay skip the line-drawing timeline (lines are already known)
  const skipLineTimeline = opts.source.type === "manual" || opts.source.type === "existing";
  const castScene = new CastScene(
    cast,
    deps.motion,
    deps.session.cols,
    deps.glyphConfig,
    deps.session.rows,
    intention,
  );
  if (skipLineTimeline) castScene.skipToComplete(true);
  const castSignal = await deps.run(castScene);

  // 5. Post-cast navigation — skipped for play
  if (
    !isPlay
    && typeof castSignal === "object"
    && castSignal !== null
    && "goto" in castSignal
  ) {
    await runPostCastNavigation(deps, castSignal.goto);
  }

  return { shouldExit: false };
}

/**
 * Branch the post-cast navigation into the journal or dictionary explorer.
 * The cast scene emits `journal`, `dictionary`, or `detail:N` after the user
 * presses j/d or hits enter on the focused hexagram.
 */
async function runPostCastNavigation(
  deps: ReadingFlowDeps,
  goto: string,
): Promise<void> {
  if (goto === "journal") {
    const journal = new JsonlJournalStore(deps.paths.state);
    const entries = await loadJournalEntries(journal);
    const factoryDeps = {
      glyphConfig: deps.glyphConfig,
      journal,
      entries,
      session: deps.session,
    };
    const router = new SceneRouter(
      new JournalScene(entries),
      makeJournalFactory(factoryDeps),
    );
    await deps.runRouter(router);
  } else if (goto === "dictionary" || goto.startsWith("detail:")) {
    const journal = new JsonlJournalStore(deps.paths.state);
    const factoryDeps = { glyphConfig: deps.glyphConfig, journal };
    const startScene: Scene = goto.startsWith("detail:")
      ? (() => {
          const kw = Number(goto.slice(7));
          if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new BrowseScene();
          return makeDetailScene(kw, factoryDeps);
        })()
      : new BrowseScene();
    const router = new SceneRouter(startScene, makeBrowseFactory(factoryDeps));
    await deps.runRouter(router);
  }
}
