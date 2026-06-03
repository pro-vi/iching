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
  type DisplayLanguage,
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
  YarrowScene,
  YarrowManualScene,
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
  | { type: "yarrow" }
  | { type: "yarrow-manual" }
  | { type: "existing"; cast: Cast; intention?: string };

export type ReadingPurpose = "cast" | "play" | "replay";

export interface ReadingFlowDeps {
  run: (scene: Scene) => Promise<SceneSignal | void>;
  runRouter: (router: SceneRouter) => Promise<{ shouldExit: boolean }>;
  paths: ResolvedPaths;
  cacheStore: JsonDailyCacheStore;
  today: string;
  session: SessionDims;
  glyphConfig: CastGlyphInput;
  language: DisplayLanguage;
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
    if (intentionSignal?.type === "exit") return { shouldExit: true };
    if (intentionSignal?.type !== "intentionConfirmed") return { shouldExit: false };
    intention = intentionScene.getIntention();
  }

  // 2. Obtain — branch on source; produces a Cast or returns early
  let cast: Cast;
  let usedSeed = false;
  if (opts.source.type === "manual") {
    const tossScene = new TossScene();
    const tossSignal = await deps.run(tossScene);
    if (tossSignal?.type === "exit") return { shouldExit: true };
    if (tossSignal?.type !== "tossCompleted") return { shouldExit: false }; // user quit before 6 lines
    cast = tossSignal.cast;
  } else if (opts.source.type === "yarrow") {
    const yarrowScene = new YarrowScene(deps.motion, undefined, deps.language);
    const yarrowSignal = await deps.run(yarrowScene);
    if (yarrowSignal?.type === "exit") return { shouldExit: true };
    if (yarrowSignal?.type !== "yarrowCompleted") return { shouldExit: false }; // user quit mid-ritual
    cast = yarrowSignal.cast;
  } else if (opts.source.type === "yarrow-manual") {
    const yarrowManualScene = new YarrowManualScene(deps.motion, undefined, deps.language);
    const yarrowSignal = await deps.run(yarrowManualScene);
    if (yarrowSignal?.type === "exit") return { shouldExit: true };
    if (yarrowSignal?.type !== "yarrowCompleted") return { shouldExit: false }; // user quit mid-ritual
    cast = yarrowSignal.cast;
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

  // 4. Reveal.
  // - manual / yarrow: lines are already drawn by their own ritual scene, so we
  //   pre-settle them and let the post-line reveal sequence (glow → glyph
  //   → split → morph → exploration) play naturally. Same end-state choreography
  //   as auto cast, just minus the line-by-line drawing.
  // - existing: replay of a saved reading — fully static, no animation.
  // - auto: full ritual from the opening breath onward.
  const drewOwnLines =
    opts.source.type === "manual" ||
    opts.source.type === "yarrow" ||
    opts.source.type === "yarrow-manual";
  const castScene = new CastScene(
    cast,
    deps.motion,
    deps.session.cols,
    deps.glyphConfig,
    deps.session.rows,
    intention,
    { skipLineDrawing: drewOwnLines },
  );
  if (isReplay) castScene.skipToComplete(false);
  const castSignal = await deps.run(castScene);

  if (castSignal?.type === "exit") return { shouldExit: true };

  // 5. Post-cast navigation — skipped for play
  if (!isPlay && castSignal) {
    return await runPostCastNavigation(deps, castSignal);
  }

  return { shouldExit: false };
}

/**
 * Branch the post-cast navigation into the journal or dictionary explorer.
 * The cast scene emits openJournal / openDictionary / openDetail after the
 * user presses j/d or hits enter on the focused hexagram. Propagates Ctrl+C
 * (router shouldExit) so the home loop can terminate the program.
 */
async function runPostCastNavigation(
  deps: ReadingFlowDeps,
  signal: SceneSignal,
): Promise<{ shouldExit: boolean }> {
  if (signal.type === "openJournal") {
    const journal = new JsonlJournalStore(deps.paths.state);
    const entries = await loadJournalEntries(journal);
    const factoryDeps = {
      glyphConfig: deps.glyphConfig,
      language: deps.language,
      journal,
      entries,
      session: deps.session,
    };
    const router = new SceneRouter(
      new JournalScene(entries),
      makeJournalFactory(factoryDeps),
    );
    return await deps.runRouter(router);
  }
  if (signal.type === "openDictionary" || signal.type === "openDetail") {
    const journal = new JsonlJournalStore(deps.paths.state);
    const factoryDeps = {
      glyphConfig: deps.glyphConfig,
      language: deps.language,
      journal,
    };
    const startScene: Scene = signal.type === "openDetail"
      ? makeDetailScene(signal.kw, factoryDeps)
      : new BrowseScene();
    const router = new SceneRouter(startScene, makeBrowseFactory(factoryDeps));
    return await deps.runRouter(router);
  }
  return { shouldExit: false };
}
