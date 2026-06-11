// Terminal-safe text — the journal's quiet contract. Reflection notes are
// persisted verbatim and replayed to a terminal on every `journal show`; a
// note carrying ESC/OSC/C1 bytes (pasted, scripted, or hand-edited into the
// JSONL) would replay as live control sequences — retitling the window,
// repositioning the cursor, restyling everything after it. Text that enters
// or leaves the journal for display passes through here instead.

/** Tab/newline/CR fold to a single space — word separation survives. */
const WHITESPACE_CONTROLS = /[\t\n\r]+/g;

/**
 * C0 controls (incl. ESC/BEL), DEL, and C1 controls — everything a terminal
 * could interpret. Dropped outright; plain printable text, CJK, and other
 * non-control codepoints pass through untouched.
 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Strip terminal control characters from one line of display text. Applied
 * at both ends: when a reflection note is written (new records are clean at
 * rest) and when note text is rendered (legacy / hand-edited records replay
 * safely too). Idempotent; never throws.
 */
export function stripTerminalControls(text: string): string {
  return text.replace(WHITESPACE_CONTROLS, " ").replace(CONTROL_CHARS, "");
}
