// Terminal-safe text helpers. Pure string normalization only: no ANSI, no I/O.

/** Tab/newline/CR fold to a single space so word separation survives. */
const WHITESPACE_CONTROLS = /[\t\n\r]+/g;

/**
 * C0 controls (including ESC/BEL), DEL, and C1 controls. Plain printable text,
 * CJK, and other non-control codepoints pass through untouched.
 */
const TERMINAL_CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Strip terminal control characters from one line of display/input text.
 * Idempotent; never throws.
 */
export function stripTerminalControls(text: string): string {
  return text.replace(WHITESPACE_CONTROLS, " ").replace(TERMINAL_CONTROLS, "");
}
