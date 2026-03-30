import { describe, test, expect } from "bun:test";
import { CellBuffer } from "../render/buffer.ts";
import { DiffRenderer } from "../render/diff-render.ts";

/** Mock output that captures write calls */
function mockOutput() {
  const writes: string[] = [];
  return {
    write(data: string) {
      writes.push(data);
      return true;
    },
    writes,
  };
}

describe("DiffRenderer", () => {
  test("identical buffers produce no output", () => {
    const out = mockOutput();
    const renderer = new DiffRenderer(out, "truecolor");
    const a = CellBuffer.create(10, 3);
    const b = CellBuffer.create(10, 3);
    renderer.present(a, b);
    expect(out.writes).toHaveLength(0);
  });

  test("single changed cell produces output", () => {
    const out = mockOutput();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(10, 3);
    const next = CellBuffer.create(10, 3);
    next.setCell(1, 5, { char: "X", fg: "#C89D4B" });
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    // Output should contain the character and SGR codes
    expect(out.writes[0]).toContain("X");
    // Should contain truecolor SGR for #C89D4B (200, 157, 75)
    expect(out.writes[0]).toContain("38;2;200;157;75");
  });

  test("changed row emits cursor-move + styled text", () => {
    const out = mockOutput();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(10, 5);
    const next = CellBuffer.create(10, 5);
    next.writeText(3, 0, "hello", { fg: "#E8DECE" });
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    const output = out.writes[0];
    // Should contain cursor move to row 3 (1-indexed = 4)
    expect(output).toContain("\x1b[4;1H");
    expect(output).toContain("h");
    expect(output).toContain("e");
    expect(output).toContain("l");
    expect(output).toContain("o");
  });

  test("collects output into a single write call", () => {
    const out = mockOutput();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(10, 5);
    const next = CellBuffer.create(10, 5);
    // Change multiple rows
    next.writeText(0, 0, "row zero");
    next.writeText(2, 0, "row two");
    next.writeText(4, 0, "row four");
    renderer.present(prev, next);
    // Should be exactly one write call
    expect(out.writes).toHaveLength(1);
  });

  test("unchanged rows are not emitted", () => {
    const out = mockOutput();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(10, 5);
    prev.writeText(0, 0, "same");
    prev.writeText(2, 0, "same");
    const next = CellBuffer.create(10, 5);
    next.writeText(0, 0, "same");
    next.writeText(1, 0, "changed"); // only row 1 differs
    next.writeText(2, 0, "same");
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    const output = out.writes[0];
    // Should contain cursor move to row 1 (1-indexed = 2) but not row 0 or 2
    expect(output).toContain("\x1b[2;1H");
    expect(output).not.toContain("\x1b[1;1H");
    expect(output).not.toContain("\x1b[3;1H");
  });

  test("generates 256-color fallback when configured", () => {
    const out = mockOutput();
    const renderer = new DiffRenderer(out, "256");
    const prev = CellBuffer.create(5, 1);
    const next = CellBuffer.create(5, 1);
    next.setCell(0, 0, { char: "A", fg: "#C89D4B" });
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    // Should contain 256-color SGR (38;5;NNN) instead of truecolor
    expect(out.writes[0]).toMatch(/38;5;\d+/);
  });
});
