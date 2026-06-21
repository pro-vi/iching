import { describe, test, expect } from "bun:test";
import { mockStdout } from "../testing.ts";
import { CellBuffer } from "../render/buffer.ts";
import { DiffRenderer } from "../render/diff-render.ts";

/** Mock output that captures write calls */
describe("DiffRenderer", () => {
  test("identical buffers produce no output", () => {
    const out = mockStdout();
    const renderer = new DiffRenderer(out, "truecolor");
    const a = CellBuffer.create(10, 3);
    const b = CellBuffer.create(10, 3);
    renderer.present(a, b);
    expect(out.writes).toHaveLength(0);
  });

  test("single changed cell produces output", () => {
    const out = mockStdout();
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
    const out = mockStdout();
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
    const out = mockStdout();
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
    const out = mockStdout();
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
    const out = mockStdout();
    const renderer = new DiffRenderer(out, "256");
    const prev = CellBuffer.create(5, 1);
    const next = CellBuffer.create(5, 1);
    next.setCell(0, 0, { char: "A", fg: "#C89D4B" });
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    // Should contain 256-color SGR (38;5;NNN) instead of truecolor
    expect(out.writes[0]).toMatch(/38;5;\d+/);
  });

  // The renderer is the final output boundary: setCell bypasses writeText's
  // input sanitization, so a control char placed directly in a cell would be
  // emitted raw and EXECUTED by the terminal. (Render review, H5.)
  test("a control char in a cell is replaced, never emitted raw (H5)", () => {
    const out = mockStdout();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(3, 1);
    const next = CellBuffer.create(3, 1);
    next.setCell(0, 0, { char: "\x07" }); // BEL — bypasses writeText via setCell
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    const output = out.writes[0];
    expect(output).not.toContain("\x07"); // never transported to the terminal
    expect(output).toContain("�"); // replaced with the safe glyph
  });

  // clearToEndOfLine erases with the active SGR background, so the style must be
  // reset BEFORE the clear or a leftover bg paints the cleared span. (H2.)
  test("a row clear is preceded by a style reset (H2)", () => {
    const out = mockStdout();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(5, 1);
    const next = CellBuffer.create(5, 1);
    next.writeText(0, 0, "hi"); // plain text — no per-cell SGR resets to confound
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    // resetStyle (\x1b[0m) immediately before clearToEndOfLine (\x1b[0K).
    expect(out.writes[0]).toContain("\x1b[0m\x1b[0K");
  });

  // present() iterates only next.height; when the terminal shrinks, the rows the
  // taller previous frame painted below it must still be cleared. (H1.)
  test("a shorter next buffer clears the rows the old frame left below (H1)", () => {
    const out = mockStdout();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(5, 4);
    prev.writeText(2, 0, "gone");
    prev.writeText(3, 0, "gone");
    const next = CellBuffer.create(5, 2); // terminal shrank from 4 rows to 2
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    const output = out.writes[0];
    // Rows 2 and 3 (1-indexed 3 and 4) must be cleared.
    expect(output).toContain("\x1b[3;1H");
    expect(output).toContain("\x1b[4;1H");
  });

  // A wide (CJK) glyph occupies two columns; writeText lays it as the glyph in
  // column N and an empty continuation cell ({ char: "" }) in column N+1.
  // present() must SKIP that continuation cell — emitting a space there would
  // shift every subsequent character one column right. This is the only test
  // that feeds present() a wide char; without it the load-bearing
  // `cell.char === "" → continue` guard is unpinned (every other input is ASCII).
  test("a wide char's continuation cell is skipped, not emitted as a space", () => {
    const out = mockStdout();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(3, 1);
    const next = CellBuffer.create(3, 1);
    next.writeText(0, 0, "世a"); // 世 is width-2: col0=世, col1=continuation(""), col2=a
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    const output = out.writes[0];
    // Glyph emitted exactly once, immediately followed by the next real cell.
    // Deleting the continuation-skip in present() makes this "世 a".
    expect(output).toContain("世a");
    expect(output).not.toContain("世 a");
    expect(output.split("世").length - 1).toBe(1);
  });
});
