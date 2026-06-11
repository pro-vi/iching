// DiffRenderer synchronized output (DEC 2026) — frames present atomically.

import { describe, test, expect } from "bun:test";
import { CellBuffer } from "../render/buffer.ts";
import { DiffRenderer } from "../render/diff-render.ts";

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

describe("DiffRenderer — synchronized output", () => {
  test("non-empty frames are wrapped in DEC 2026 begin/end guards", () => {
    const out = mockOutput();
    const renderer = new DiffRenderer(out, "truecolor");
    const prev = CellBuffer.create(10, 3);
    const next = CellBuffer.create(10, 3);
    next.writeText(1, 0, "frame");
    renderer.present(prev, next);
    expect(out.writes).toHaveLength(1);
    const output = out.writes[0];
    expect(output.startsWith("\x1b[?2026h")).toBe(true);
    expect(output.endsWith("\x1b[?2026l")).toBe(true);
  });

  test("identical buffers emit nothing — no empty sync wrappers", () => {
    const out = mockOutput();
    const renderer = new DiffRenderer(out, "truecolor");
    const a = CellBuffer.create(10, 3);
    const b = CellBuffer.create(10, 3);
    renderer.present(a, b);
    expect(out.writes).toHaveLength(0);
  });
});
