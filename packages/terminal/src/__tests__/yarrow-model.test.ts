import { describe, test, expect } from "bun:test";
import { castYarrowHexagram, SeededRandomSource } from "@iching/core";
import { YarrowModel } from "../scenes/yarrow/model.ts";

function model(seed = 1): YarrowModel {
  return new YarrowModel(castYarrowHexagram(new SeededRandomSource(seed)));
}

describe("YarrowModel", () => {
  test("initializes at the pre-ritual edge with a full field", () => {
    const m = model();
    expect(m.activeLine).toBe(-1);
    expect(m.activeRound).toBe(0);
    expect(m.beat).toBe("idle");
    expect(m.fieldCount).toBe(49);
    expect(m.lines).toHaveLength(6);
    expect(m.lines.every((l) => !l.settled && l.progress === 0)).toBe(true);
    expect(m.hexagramComplete).toBe(false);
  });

  test("carries the transcript and cast unchanged", () => {
    const yarrow = castYarrowHexagram(new SeededRandomSource(5));
    const m = new YarrowModel(yarrow);
    expect(m.transcript).toBe(yarrow.transcript);
    expect(m.cast).toBe(yarrow.cast);
    expect(m.transcript).toHaveLength(6);
  });

  test("currentRound is null at the edges and resolves mid-ritual", () => {
    const m = model(3);
    expect(m.currentRound()).toBeNull();

    m.activeLine = 2;
    m.activeRound = 1;
    expect(m.currentRound()).toBe(m.requireLineResult(2).rounds[1]);

    m.activeLine = -1;
    expect(m.currentRound()).toBeNull();
  });

  test("pace defaults to playing at 1x", () => {
    const m = model();
    expect(m.paused).toBe(false);
    expect(m.speed).toBe(1);
  });
});
