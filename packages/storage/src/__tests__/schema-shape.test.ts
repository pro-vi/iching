import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Cast, Structure, HistoryEntry, ReflectionNote } from "@iching/core";
import type { DailyCacheRecord, UserConfig } from "../types.js";
import { JsonConfigStore } from "../json/json-config.js";
import { JsonDailyCacheStore } from "../json/json-daily-cache.js";
import { JsonlJournalStore } from "../json/jsonl-journal.js";
import { SCHEMA_KEYS } from "../schema-keys.js";

// Schemas only expand. These tests pin the shape so renames/removes fail CI.
// Adding a key requires editing schema-keys.ts (visible in PR review).

const FIXTURE_CAST: Cast = {
  primary: 1,
  becoming: null,
  changingPositions: [],
  lines: [
    { value: 7, isYang: true, isChanging: false },
    { value: 7, isYang: true, isChanging: false },
    { value: 7, isYang: true, isChanging: false },
    { value: 7, isYang: true, isChanging: false },
    { value: 7, isYang: true, isChanging: false },
    { value: 7, isYang: true, isChanging: false },
  ],
  // Hexagram 1 derivations: nuclear/mirror = self (1), polarity/diagonal = 2 (Kun).
  // Exact values aren't asserted by schema-shape tests — they just need to type-check.
  nuclear: 1,
  polarity: 2,
  mirror: 1,
  diagonal: 2,
};

const FIXTURE_STRUCTURE: Structure = {
  upper: { sym: "☰", n: "乾", img: "heaven" },
  lower: { sym: "☰", n: "乾", img: "heaven" },
  becoming: null,
};

function assertShape(
  actualKeys: string[],
  shape: { required: readonly string[]; optional: readonly string[] },
) {
  for (const k of shape.required) {
    expect(actualKeys).toContain(k);
  }
  const allowed = new Set([...shape.required, ...shape.optional]);
  const extras = actualKeys.filter((k) => !allowed.has(k));
  expect(extras).toEqual([]);
}

describe("schema shape — config", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "schema-config-"));
  });

  test("default config keys match SCHEMA_KEYS.config", async () => {
    const store = new JsonConfigStore(join(dir, "config.json"));
    const cfg = await store.load();
    assertShape(Object.keys(cfg), SCHEMA_KEYS.config);
    expect(Object.keys(cfg).length).toBe(SCHEMA_KEYS.config.required.length);
  });

  test("round-tripped config keys match SCHEMA_KEYS.config", async () => {
    const store = new JsonConfigStore(join(dir, "config.json"));
    const written: UserConfig = {
      motion: "brisk",
      language: "en",
      theme: "cinnabar",
      color: "always",
      timezone: "America/Los_Angeles",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      taijituStyle: "dense",
      castMethod: "yarrow",
      castMode: "manual",
      entropy: "bound",
    };
    await store.save(written);
    const onDisk = JSON.parse(await readFile(join(dir, "config.json"), "utf-8"));
    assertShape(Object.keys(onDisk), SCHEMA_KEYS.config);
  });
});

describe("schema shape — cache", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "schema-cache-"));
  });

  test("required-only record keys match SCHEMA_KEYS.cache", async () => {
    const store = new JsonDailyCacheStore(join(dir, "cache.json"));
    const record: DailyCacheRecord = {
      date: "2026-04-26",
      cast: FIXTURE_CAST,
      shown: true,
      structure: FIXTURE_STRUCTURE,
    };
    await store.write(record);
    const onDisk = JSON.parse(await readFile(join(dir, "cache.json"), "utf-8"));
    assertShape(Object.keys(onDisk), SCHEMA_KEYS.cache);
    expect(Object.keys(onDisk).sort()).toEqual([...SCHEMA_KEYS.cache.required].sort());
  });

  test("with-optional record keys match SCHEMA_KEYS.cache", async () => {
    const store = new JsonDailyCacheStore(join(dir, "cache.json"));
    const record: DailyCacheRecord = {
      date: "2026-04-26",
      cast: FIXTURE_CAST,
      shown: true,
      structure: FIXTURE_STRUCTURE,
      intention: "ship it?",
      method: "yarrow",
      rng: { source: "bound", intentionBound: true },
    };
    await store.write(record);
    const onDisk = JSON.parse(await readFile(join(dir, "cache.json"), "utf-8"));
    assertShape(Object.keys(onDisk), SCHEMA_KEYS.cache);
    expect(Object.keys(onDisk).sort()).toEqual(
      [...SCHEMA_KEYS.cache.required, ...SCHEMA_KEYS.cache.optional].sort(),
    );
  });
});

describe("schema shape — history", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "schema-history-"));
  });

  test("required-only entry keys match SCHEMA_KEYS.history", async () => {
    const store = new JsonlJournalStore(join(dir, "history.jsonl"));
    const entry: HistoryEntry = { date: "2026-04-26", cast: FIXTURE_CAST };
    await store.append(entry);
    const text = await readFile(join(dir, "history.jsonl"), "utf-8");
    const onDisk = JSON.parse(text.trim());
    assertShape(Object.keys(onDisk), SCHEMA_KEYS.history);
    expect(Object.keys(onDisk).sort()).toEqual([...SCHEMA_KEYS.history.required].sort());
  });

  test("with-all-optional entry keys match SCHEMA_KEYS.history", async () => {
    const store = new JsonlJournalStore(join(dir, "history.jsonl"));
    const entry: HistoryEntry = {
      date: "2026-04-26",
      cast: FIXTURE_CAST,
      intention: "ship it?",
      timestamp: "2026-04-26T09:30:00.000Z",
      method: "coin-manual",
      rng: { source: "crypto", intentionBound: false },
    };
    await store.append(entry);
    const text = await readFile(join(dir, "history.jsonl"), "utf-8");
    const onDisk = JSON.parse(text.trim());
    assertShape(Object.keys(onDisk), SCHEMA_KEYS.history);
    expect(Object.keys(onDisk).sort()).toEqual(
      [...SCHEMA_KEYS.history.required, ...SCHEMA_KEYS.history.optional].sort(),
    );
  });
});

describe("schema shape — note", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "schema-note-"));
  });

  test("note record keys match SCHEMA_KEYS.note", async () => {
    const store = new JsonlJournalStore(join(dir, "history.jsonl"));
    const note: ReflectionNote = {
      kind: "note",
      ref: "2026-04-26T09:30:00.000Z",
      date: "2026-04-26",
      timestamp: "2026-04-26T21:14:00.000Z",
      text: "what happened after",
    };
    await store.appendNote(note);
    // Notes land in the notes.jsonl sidecar, never in history.jsonl.
    const text = await readFile(join(dir, "notes.jsonl"), "utf-8");
    const onDisk = JSON.parse(text.trim());
    assertShape(Object.keys(onDisk), SCHEMA_KEYS.note);
    expect(Object.keys(onDisk).sort()).toEqual([...SCHEMA_KEYS.note.required].sort());
    // The discriminator is what keeps legacy in-journal notes out of entry reads
    expect(onDisk.kind).toBe("note");
  });
});
