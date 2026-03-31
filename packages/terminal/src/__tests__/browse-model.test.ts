import { describe, test, expect } from "bun:test";
import { BrowseModel } from "../scenes/dict/browse-model.ts";

describe("BrowseModel", () => {
  test("starts with all 64 hexagrams", () => {
    const model = new BrowseModel();
    expect(model.filtered).toHaveLength(64);
    expect(model.cursor).toBe(0);
  });

  test("cursorDown moves cursor", () => {
    const model = new BrowseModel();
    model.cursorDown();
    expect(model.cursor).toBe(1);
    model.cursorDown();
    expect(model.cursor).toBe(2);
  });

  test("cursorUp clamps at 0", () => {
    const model = new BrowseModel();
    model.cursorUp();
    expect(model.cursor).toBe(0);
  });

  test("cursorDown clamps at end", () => {
    const model = new BrowseModel();
    for (let i = 0; i < 100; i++) model.cursorDown();
    expect(model.cursor).toBe(63);
  });

  test("setQuery filters hexagrams", () => {
    const model = new BrowseModel();
    model.setQuery("creative");
    expect(model.filtered.length).toBeGreaterThan(0);
    expect(model.filtered[0].ename).toBe("The Creative");
  });

  test("setQuery empty restores all", () => {
    const model = new BrowseModel();
    model.setQuery("creative");
    model.setQuery("");
    expect(model.filtered).toHaveLength(64);
  });

  test("setQuery clamps cursor when results shrink", () => {
    const model = new BrowseModel();
    model.cursor = 50;
    model.setQuery("creative");
    expect(model.cursor).toBeLessThan(model.filtered.length);
  });

  test("selectedHexagram returns current", () => {
    const model = new BrowseModel();
    const hex = model.selectedHexagram();
    expect(hex).toBeDefined();
    expect(hex!.n).toBe("乾");
  });

  test("selectedKW returns 1-based index", () => {
    const model = new BrowseModel();
    expect(model.selectedKW()).toBe(1);
    model.cursorDown();
    expect(model.selectedKW()).toBe(2);
  });

  test("pageDown moves by viewport height", () => {
    const model = new BrowseModel();
    model.viewportHeight = 10;
    model.pageDown();
    expect(model.cursor).toBe(10);
  });

  test("pageUp moves back", () => {
    const model = new BrowseModel();
    model.viewportHeight = 10;
    model.cursor = 20;
    model.scrollOffset = 15;
    model.pageUp();
    expect(model.cursor).toBe(10);
  });

  test("scroll adjusts to keep cursor visible", () => {
    const model = new BrowseModel();
    model.viewportHeight = 5;
    for (let i = 0; i < 10; i++) model.cursorDown();
    expect(model.scrollOffset).toBeGreaterThan(0);
    expect(model.cursor).toBeGreaterThanOrEqual(model.scrollOffset);
    expect(model.cursor).toBeLessThan(model.scrollOffset + model.viewportHeight);
  });

  test("search by KW number works", () => {
    const model = new BrowseModel();
    model.setQuery("11");
    expect(model.filtered.length).toBeGreaterThan(0);
    // Hexagram 11 (泰, Peace) should be in results
    const kwNumbers = model.filtered.map((h) => model.all.indexOf(h) + 1);
    expect(kwNumbers).toContain(11);
  });
});
