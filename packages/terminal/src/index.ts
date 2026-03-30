// @iching/terminal — ANSI renderer, animation engine, scenes

// ANSI escape codes
export {
  cursorTo,
  cursorUp,
  cursorDown,
  cursorForward,
  cursorBack,
  cursorHome,
  hideCursor,
  showCursor,
  clearScreen,
  clearLine,
  clearToEndOfLine,
  altScreenOn,
  altScreenOff,
} from "./ansi/codes.ts";

// SGR color/style
export {
  fgColor,
  bgColor,
  boldStyle,
  dimStyle,
  resetStyle,
} from "./ansi/sgr.ts";

// Color detection
export { detectColorSupport, type ColorSupport } from "./color/detect.ts";

// Temple Night palette
export {
  TEMPLE_NIGHT,
  TEMPLE_NIGHT_256,
  type TempleNightColor,
} from "./color/themes/temple-night.ts";

// Render: cell, buffer, diff
export { type StyledCell, EMPTY_CELL, cellsEqual } from "./render/cell.ts";
export { CellBuffer } from "./render/buffer.ts";
export { DiffRenderer } from "./render/diff-render.ts";
export { centerBlock, writeBlockCentered } from "./render/rasterize.ts";

// Input
export { type KeyEvent, parseKey, KeyParser } from "./input/key-parser.ts";
export { enableRawMode, readKeys } from "./input/raw-input.ts";

// Layout
export { stringWidth, centerPad } from "./layout/measure.ts";

// Session
export { TerminalSession } from "./session/terminal-session.ts";
