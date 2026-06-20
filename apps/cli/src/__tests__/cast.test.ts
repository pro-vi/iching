import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { runCli as spawnCli } from "../testing.ts";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  castHexagram,
  buildStructure,
  SeededRandomSource,
  GUA,
  readingTexts,
} from "@iching/core";
import { JsonDailyCacheStore, JsonlJournalStore } from "@iching/storage";
import { castToJson } from "../output/json.js";
import { formatCastPlain } from "../output/plain.js";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "iching-cast-test-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("cast command", () => {
  test("cast with --seed produces deterministic output", () => {
    const source1 = new SeededRandomSource(42);
    const cast1 = castHexagram(source1);

    const source2 = new SeededRandomSource(42);
    const cast2 = castHexagram(source2);

    expect(cast1.primary).toBe(cast2.primary);
    expect(cast1.becoming).toBe(cast2.becoming);
    expect(cast1.lines).toEqual(cast2.lines);
    expect(cast1.nuclear).toBe(cast2.nuclear);
    expect(cast1.polarity).toBe(cast2.polarity);
    expect(cast1.mirror).toBe(cast2.mirror);
    expect(cast1.diagonal).toBe(cast2.diagonal);
  });

  test("cast with --json outputs valid JSON structure", () => {
    const source = new SeededRandomSource(42);
    const cast = castHexagram(source);
    const primary = GUA[cast.primary - 1];
    const becoming = cast.becoming !== null ? GUA[cast.becoming - 1] : null;

    const json = castToJson(cast, primary, becoming, "test question");

    expect(json.question).toBe("test question");
    expect(json.primary).toBeDefined();
    expect((json.primary as Record<string, unknown>).number).toBe(
      cast.primary,
    );
    expect((json.primary as Record<string, unknown>).name).toBe(primary.n);
    expect((json.primary as Record<string, unknown>).pinyin).toBe(primary.p);
    expect((json.primary as Record<string, unknown>).symbol).toBe(primary.u);
    expect(json.commentary).toBeDefined();
    expect(json.derived).toBeDefined();

    // Verify it roundtrips as JSON string
    const str = JSON.stringify(json);
    const parsed = JSON.parse(str);
    expect(parsed.primary.number).toBe(cast.primary);
  });

  test("cast saves to daily cache", async () => {
    const source = new SeededRandomSource(99);
    const cast = castHexagram(source);
    const structure = buildStructure(cast);
    const today = new Date().toISOString().slice(0, 10);

    const cachePath = join(dataDir, "daily-cache.json");
    const cacheStore = new JsonDailyCacheStore(cachePath);

    await cacheStore.write({ date: today, cast, shown: true, structure });

    const cached = await cacheStore.read();
    expect(cached).not.toBeNull();
    expect(cached!.date).toBe(today);
    expect(cached!.cast.primary).toBe(cast.primary);
  });

  test("cast appends to journal", async () => {
    const source = new SeededRandomSource(99);
    const cast = castHexagram(source);
    const today = new Date().toISOString().slice(0, 10);

    const journalPath = join(dataDir, "history.jsonl");
    const journal = new JsonlJournalStore(journalPath);

    await journal.append({ date: today, cast });

    const latest = await journal.latest();
    expect(latest).not.toBeNull();
    expect(latest!.date).toBe(today);
    expect(latest!.cast.primary).toBe(cast.primary);
  });

  test("plain text output includes hexagram info", () => {
    const source = new SeededRandomSource(42);
    const cast = castHexagram(source);
    const primary = GUA[cast.primary - 1];
    const structure = buildStructure(cast);

    const text = formatCastPlain(cast, primary, structure);

    // Should contain the hexagram symbol, name, and pinyin
    expect(text).toContain(primary.u);
    expect(text).toContain(primary.n);
    expect(text).toContain(primary.p);
    expect(text).toContain("Commentary:");
  });
});

describe("cast output oracle texts", () => {
  /** Seed 7: hexagram 47 → 62, changing lines [2, 3, 5]. */
  function makeSeededCast() {
    const cast = castHexagram(new SeededRandomSource(7));
    const primary = GUA[cast.primary - 1];
    const becoming = cast.becoming !== null ? GUA[cast.becoming - 1] : null;
    return { cast, primary, becoming };
  }

  test("castToJson includes the judgment for primary and becoming", () => {
    const { cast, primary, becoming } = makeSeededCast();
    const json = castToJson(cast, primary, becoming);

    const p = json.primary as Record<string, unknown>;
    expect(p.ename).toBe(primary.ename);
    expect(p.judgment).toEqual({ gc: primary.gc, gcEn: primary.gcEn });
    const b = json.becoming as Record<string, unknown>;
    expect(b.judgment).toEqual({ gc: becoming!.gc, gcEn: becoming!.gcEn });
  });

  test("castToJson includes the changing lines' texts with positions", () => {
    const { cast, primary, becoming } = makeSeededCast();
    const json = castToJson(cast, primary, becoming);

    const changing = json.changingLines as Array<Record<string, unknown>>;
    expect(changing).toHaveLength(cast.changingPositions.length);
    for (let i = 0; i < changing.length; i++) {
      const pos = cast.changingPositions[i];
      expect(changing[i]).toEqual({
        position: pos,
        yao: primary.yao[pos - 1],
        yaoEn: primary.yaoEn[pos - 1],
      });
    }
  });

  test("castToJson extra is null unless all six lines move on hex 1/2", () => {
    const { cast, primary, becoming } = makeSeededCast();
    const json = castToJson(cast, primary, becoming);
    expect(json.extra).toBeNull();

    // Synthesize the all-moving 乾 cast: 用九 governs
    const allMoving = {
      ...cast,
      primary: 1,
      becoming: 2,
      changingPositions: [1, 2, 3, 4, 5, 6],
      lines: Array.from({ length: 6 }, () => ({
        value: 9 as const,
        isYang: true,
        isChanging: true,
      })),
    };
    const yongJson = castToJson(allMoving, GUA[0], GUA[1]);
    expect(yongJson.extra).toEqual({
      name: "用九",
      text: "見群龍無首，吉。",
      textEn: GUA[0].extra!.textEn,
    });
  });

  test("formatCastPlain shows the judgment and the 啟蒙 reading", () => {
    const { cast, primary } = makeSeededCast();
    const structure = buildStructure(cast);
    const text = formatCastPlain(cast, primary, structure);

    // The hexagram's own 卦辭 always appears in its reference block.
    expect(text).toContain(`Judgment (gc): ${primary.gc}`);
    expect(text).toContain(`Judgment (gcEn): ${primary.gcEn}`);

    // The reading itself follows the shared 啟蒙 rule (readingTexts), NOT the raw
    // moving lines — seed 7 moves three lines, so the reading is both judgments
    // (本卦 47 and 之卦 62), never the 爻辭 of lines 2/3/5.
    expect(text).toContain("Reading (啟蒙):");
    for (const part of readingTexts(cast)) {
      const g = GUA[part.kw - 1];
      if (part.kind === "judgment") {
        // The reading speaks Wilhelm (gcEnW), the displayed register — not the
        // Legge anchor (gcEn), which only the standalone reference block carries.
        expect(text).toContain(`  ${g.u} ${g.n} 卦辭: ${g.gc}`);
        expect(text).toContain(`     ${g.gcEnW}`);
      } else if (part.kind === "line") {
        expect(text).toContain(`  ${g.u} ${g.n} 爻${part.position}: ${g.yao[part.position - 1]}`);
        expect(text).toContain(`     ${g.yaoEn[part.position - 1]}`);
      } else if (g.extra) {
        expect(text).toContain(`  ${g.extra.name}: ${g.extra.text}`);
        expect(text).toContain(`     ${g.extra.textEn}`);
      }
    }
  });

  test("formatCastPlain singularizes 'line' when exactly one moves", () => {
    // ~36% of moving casts have exactly one changing line; "[lines 6]" reads
    // wrong there (cf. the journal's "1 active day" fix). The reading header is
    // now the rule-neutral "Reading (啟蒙):", so only the inline Becoming
    // indicator carries the singular/plural distinction.
    const { cast, primary } = makeSeededCast();
    const oneMoving = {
      ...cast,
      becoming: 47,
      changingPositions: [6],
      lines: cast.lines.map((l, i) =>
        i === 5
          ? { value: 9 as const, isYang: true, isChanging: true }
          : { ...l, isChanging: false, value: (l.isYang ? 7 : 8) as 7 | 8 },
      ),
    };
    const text = formatCastPlain(oneMoving, primary, buildStructure(oneMoving));
    expect(text).toContain("[line 6]"); // singular inline indicator…
    expect(text).not.toContain("[lines 6]");
    // …and at one moving line the reading turns on that line's 爻辭, not a judgment.
    expect(text).toContain(`爻6: ${primary.yao[5]}`);
  });

  test("formatCastPlain omits the changing-lines block when none move", () => {
    // Force an unchanging cast by stripping the changing flags
    const { cast, primary } = makeSeededCast();
    const unchanging = {
      ...cast,
      becoming: null,
      changingPositions: [],
      lines: cast.lines.map((l) => ({
        ...l,
        isChanging: false,
        value: (l.isYang ? 7 : 8) as 7 | 8,
      })),
    };
    const text = formatCastPlain(unchanging, primary, buildStructure(unchanging));
    expect(text).not.toContain("Changing lines:");
    expect(text).toContain("Judgment (gc):");
  });
});

describe("cast entropy provenance output", () => {
  function makeSeededCast() {
    const cast = castHexagram(new SeededRandomSource(7));
    const primary = GUA[cast.primary - 1];
    const becoming = cast.becoming !== null ? GUA[cast.becoming - 1] : null;
    return { cast, primary, becoming };
  }

  test("castToJson carries the rng block (bound)", () => {
    const { cast, primary, becoming } = makeSeededCast();
    const json = castToJson(cast, primary, becoming, "q", {
      source: "bound",
      intentionBound: true,
    });
    expect(json.rng).toEqual({ source: "bound", intentionBound: true });
  });

  test("castToJson carries the rng block (crypto)", () => {
    const { cast, primary, becoming } = makeSeededCast();
    const json = castToJson(cast, primary, becoming, undefined, {
      source: "crypto",
      intentionBound: false,
    });
    expect(json.rng).toEqual({ source: "crypto", intentionBound: false });
  });

  test("castToJson echoes the seed for deterministic replays", () => {
    const { cast, primary, becoming } = makeSeededCast();
    const json = castToJson(
      cast,
      primary,
      becoming,
      undefined,
      { source: "seed", intentionBound: false },
      42,
    );
    expect(json.rng).toEqual({ source: "seed", intentionBound: false, seed: 42 });
  });

  test("castToJson rng is null when no provenance is supplied (back-compat)", () => {
    const { cast, primary, becoming } = makeSeededCast();
    const json = castToJson(cast, primary, becoming);
    expect(json.rng).toBeNull();
  });

  test("formatCastPlain prints the quiet bound line only when bound", () => {
    const { cast, primary } = makeSeededCast();
    const structure = buildStructure(cast);

    const bound = formatCastPlain(cast, primary, structure, "q", {
      source: "bound",
      intentionBound: true,
    });
    expect(bound).toContain(
      "Entropy: local machine entropy, bound to the intention and moment.",
    );

    const boundNoIntention = formatCastPlain(cast, primary, structure, undefined, {
      source: "bound",
      intentionBound: false,
    });
    expect(boundNoIntention).toContain(
      "Entropy: local machine entropy, bound to the moment.",
    );

    // Plain crypto is the unremarkable default — silence is calmer.
    const crypto = formatCastPlain(cast, primary, structure, undefined, {
      source: "crypto",
      intentionBound: false,
    });
    expect(crypto).not.toContain("Entropy:");
  });

  test("formatCastPlain names the seed for deterministic replays", () => {
    const { cast, primary } = makeSeededCast();
    const structure = buildStructure(cast);
    const text = formatCastPlain(
      cast,
      primary,
      structure,
      undefined,
      { source: "seed", intentionBound: false },
      42,
    );
    expect(text).toContain("Entropy: deterministic replay from seed 42.");
  });
});

// Regression: Number("abc") is NaN and NaN|0 collapsed the PRNG to a constant
// state — `cast --seed abc` exited 0 with the same plausible-looking cast
// forever. Non-numeric seeds must fail loudly.
describe("cast --seed validation (subprocess)", () => {

    const runCast = (seed: string) => spawnCli(["--seed", seed, "cast"]);

  test("non-numeric seed errors on stderr and exits 1", async () => {
    const { exitCode, stdout, stderr } = await runCast("abc");
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid --seed "abc"');
    expect(stdout).toBe("");
  }, 20_000);

  test("empty seed is rejected (Number('') would silently become 0)", async () => {
    const { exitCode, stderr } = await runCast("");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid --seed");
  }, 20_000);

  test("numeric seed still works and stays deterministic", async () => {
    const a = await runCast("42");
    const b = await runCast("42");
    expect(a.exitCode).toBe(0);
    expect(a.stdout).toBe(b.stdout);
  }, 20_000);
});

// One-shot `iching cast` honors the entropy config and the --bound flag,
// binding the question argument as the intention. Provenance lands in the
// JSON rng block; --seed remains its own deterministic path.
describe("cast --bound / entropy config (subprocess)", () => {

    const runCli = (args: string[]) => spawnCli(args, { dataDir });

  test("default cast reports crypto provenance in --json", async () => {
    const { exitCode, stdout } = await runCli(["--json", "cast"]);
    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.rng).toEqual({ source: "crypto", intentionBound: false });
  }, 20_000);

  test("--bound with a question reports intention-bound provenance", async () => {
    const { exitCode, stdout } = await runCli(["--json", "cast", "should I?", "--bound"]);
    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.rng).toEqual({ source: "bound", intentionBound: true });
    expect(json.question).toBe("should I?");
  }, 20_000);

  test("--bound without a question binds the moment only", async () => {
    const { exitCode, stdout } = await runCli(["--json", "cast", "--bound"]);
    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.rng).toEqual({ source: "bound", intentionBound: false });
  }, 20_000);

  test("entropy=bound in config binds without the flag; plain output gets the quiet line", async () => {
    const set = await runCli(["config", "set", "entropy", "bound"]);
    expect(set.exitCode).toBe(0);

    const json = await runCli(["--json", "cast", "still water?"]);
    expect(JSON.parse(json.stdout).rng).toEqual({ source: "bound", intentionBound: true });

    const plain = await runCli(["cast", "still water?"]);
    expect(plain.stdout).toContain(
      "Entropy: local machine entropy, bound to the intention and moment.",
    );
  }, 20_000);

  test("--seed overrides the bound config — deterministic replay provenance", async () => {
    const set = await runCli(["config", "set", "entropy", "bound"]);
    expect(set.exitCode).toBe(0);
    const { exitCode, stdout } = await runCli(["--json", "--seed", "42", "cast", "q"]);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout).rng).toEqual({ source: "seed", intentionBound: false, seed: 42 });
  }, 20_000);
});
