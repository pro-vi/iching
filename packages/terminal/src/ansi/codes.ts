// ANSI escape sequences: cursor movement, screen control, alt buffer

const ESC = "\x1b";
const CSI = `${ESC}[`;

// Cursor movement
export const cursorTo = (row: number, col: number): string =>
  `${CSI}${row + 1};${col + 1}H`;

export const cursorUp = (n = 1): string => `${CSI}${n}A`;
export const cursorDown = (n = 1): string => `${CSI}${n}B`;
export const cursorForward = (n = 1): string => `${CSI}${n}C`;
export const cursorBack = (n = 1): string => `${CSI}${n}D`;

export const cursorHome = `${CSI}H`;

// Cursor visibility
export const hideCursor = `${CSI}?25l`;
export const showCursor = `${CSI}?25h`;

// Screen clearing
export const clearScreen = `${CSI}2J`;
export const clearLine = `${CSI}2K`;
export const clearToEndOfLine = `${CSI}0K`;

// Alternate screen buffer
export const altScreenOn = `${CSI}?1049h`;
export const altScreenOff = `${CSI}?1049l`;

// Bracketed paste mode (DEC 2004) — terminals without support ignore these
export const bracketedPasteOn = `${CSI}?2004h`;
export const bracketedPasteOff = `${CSI}?2004l`;

// Synchronized output (DEC 2026) — atomic frame presentation, ignored when unsupported
export const syncOutputOn = `${CSI}?2026h`;
export const syncOutputOff = `${CSI}?2026l`;

// Mouse reporting (DEC 1000 button events) with SGR extended encoding (1006).
// We enable it so the WHEEL arrives as mouse reports we map to scroll — without
// it, terminals "alternate-scroll" the wheel into arrow keys, and horizontal
// trackpad drift becomes ←/→ that get read as navigation. Terminals without
// support ignore these. (Text selection then needs the usual modifier, e.g.
// Option on macOS — the standard full-screen-TUI trade.)
export const mouseOn = `${CSI}?1000h${CSI}?1006h`;
export const mouseOff = `${CSI}?1006l${CSI}?1000l`;
