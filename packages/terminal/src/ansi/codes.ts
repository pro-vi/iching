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
