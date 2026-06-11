// Decode raw stdin bytes into structured KeyEvent types

export type KeyEvent =
  | { type: "char"; char: string }
  | { type: "enter" }
  | { type: "escape" }
  | { type: "arrow"; direction: "up" | "down" | "left" | "right" }
  | { type: "ctrl"; char: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "page"; direction: "up" | "down" }
  | { type: "home" }
  | { type: "end" }
  | { type: "tab" }
  | { type: "backspace" }
  | { type: "delete" }
  | { type: "paste"; text: string };

export interface ParseResult {
  /**
   * The decoded event, or null when the sequence was consumed but
   * intentionally swallowed (unknown CSI/SS3 sequences, F-keys). Swallowing
   * matters: emitting a spurious escape for an unknown sequence would cancel
   * the active scene.
   */
  event: KeyEvent | null;
  consumed: number;
}

// Bracketed paste markers: ESC [ 200 ~ ... ESC [ 201 ~
const PASTE_START = new Uint8Array([0x1b, 0x5b, 0x32, 0x30, 0x30, 0x7e]);
const PASTE_END = new Uint8Array([0x1b, 0x5b, 0x32, 0x30, 0x31, 0x7e]);

// How long to wait for the rest of an escape sequence before flushing.
const ESC_TIMEOUT_MS = 50;

/**
 * Determine the byte length of a single UTF-8 character from its leading byte.
 */
function utf8CharLen(leadByte: number): number {
  if (leadByte < 0x80) return 1;
  if ((leadByte & 0xe0) === 0xc0) return 2;
  if ((leadByte & 0xf0) === 0xe0) return 3;
  if ((leadByte & 0xf8) === 0xf0) return 4;
  return 1; // invalid leading byte — consume 1 to avoid infinite loop
}

/**
 * Find the index of the CSI final byte (0x40–0x7E) for a buffer starting with
 * ESC [. Parameter bytes (0x30–0x3F) and intermediate bytes (0x20–0x2F) are
 * skipped. Returns -1 when the sequence is still incomplete (no final byte in
 * the buffer yet).
 */
function csiFinalIndex(buf: Uint8Array): number {
  let i = 2;
  while (i < buf.length && buf[i] >= 0x20 && buf[i] <= 0x3f) i++;
  return i < buf.length ? i : -1;
}

/** Map a complete CSI sequence (final byte at `finalIdx`) to a ParseResult. */
function parseCSI(buf: Uint8Array, finalIdx: number): ParseResult {
  const final = buf[finalIdx];
  const consumed = finalIdx + 1;

  // Arrow keys — plain (ESC [ A) or modified (ESC [ 1 ; 5 C etc.)
  if (final === 0x41) return { event: { type: "arrow", direction: "up" }, consumed };
  if (final === 0x42) return { event: { type: "arrow", direction: "down" }, consumed };
  if (final === 0x43) return { event: { type: "arrow", direction: "right" }, consumed };
  if (final === 0x44) return { event: { type: "arrow", direction: "left" }, consumed };

  // Home (ESC [ H) / End (ESC [ F), with or without modifiers
  if (final === 0x48) return { event: { type: "home" }, consumed };
  if (final === 0x46) return { event: { type: "end" }, consumed };

  // VT-style sequences: ESC [ <n> [;<mod>] ~
  if (final === 0x7e) {
    let n = 0;
    for (let i = 2; i < finalIdx && buf[i] >= 0x30 && buf[i] <= 0x39; i++) {
      n = n * 10 + (buf[i] - 0x30);
    }
    if (n === 1 || n === 7) return { event: { type: "home" }, consumed };
    if (n === 3) return { event: { type: "delete" }, consumed };
    if (n === 4 || n === 8) return { event: { type: "end" }, consumed };
    if (n === 5) return { event: { type: "page", direction: "up" }, consumed };
    if (n === 6) return { event: { type: "page", direction: "down" }, consumed };
    // Insert (2), F-keys (11–24), paste markers (200/201) — swallow
    return { event: null, consumed };
  }

  // Any other final byte (F-keys, mouse, device reports) — swallow silently
  return { event: null, consumed };
}

/**
 * Parse a single key event from the front of a byte buffer.
 * Returns the event and the number of bytes consumed, or null if unparseable.
 *
 * Truncated escape sequences (no final byte in the buffer) resolve to escape,
 * consuming the whole tail — this is the timeout-flush behavior. Mid-stream,
 * KeyParser.feed buffers incomplete sequences instead of calling this.
 */
export function parseKeyWithLength(buf: Uint8Array): ParseResult | null {
  if (buf.length === 0) return null;

  const byte = buf[0];

  // Escape sequences
  if (byte === 0x1b) {
    // Lone ESC
    if (buf.length === 1) return { event: { type: "escape" }, consumed: 1 };

    // CSI sequences: ESC [ ...
    if (buf[1] === 0x5b) {
      const finalIdx = csiFinalIndex(buf);
      if (finalIdx === -1) {
        // Truncated CSI — flush as escape, consuming everything
        return { event: { type: "escape" }, consumed: buf.length };
      }
      return parseCSI(buf, finalIdx);
    }

    // SS3 sequences: ESC O <final> (application cursor keys, F1–F4)
    if (buf[1] === 0x4f) {
      if (buf.length < 3) {
        // Truncated SS3 — flush as escape
        return { event: { type: "escape" }, consumed: buf.length };
      }
      const final = buf[2];
      if (final === 0x41) return { event: { type: "arrow", direction: "up" }, consumed: 3 };
      if (final === 0x42) return { event: { type: "arrow", direction: "down" }, consumed: 3 };
      if (final === 0x43) return { event: { type: "arrow", direction: "right" }, consumed: 3 };
      if (final === 0x44) return { event: { type: "arrow", direction: "left" }, consumed: 3 };
      if (final === 0x48) return { event: { type: "home" }, consumed: 3 };
      if (final === 0x46) return { event: { type: "end" }, consumed: 3 };
      // F1–F4 (P Q R S) and anything else — swallow
      return { event: null, consumed: 3 };
    }

    // Two-byte ESC + something that isn't CSI/SS3 (e.g. Alt+key)
    return { event: { type: "escape" }, consumed: 2 };
  }

  // Single-byte keys
  if (byte === 0x0d || byte === 0x0a) return { event: { type: "enter" }, consumed: 1 };
  if (byte === 0x09) return { event: { type: "tab" }, consumed: 1 };
  if (byte === 0x7f) return { event: { type: "backspace" }, consumed: 1 };
  if (byte >= 0x01 && byte <= 0x1a) return { event: { type: "ctrl", char: String.fromCharCode(byte + 0x60) }, consumed: 1 };
  if (byte >= 0x20 && byte <= 0x7e) return { event: { type: "char", char: String.fromCharCode(byte) }, consumed: 1 };

  // Multi-byte UTF-8 character
  if (byte >= 0x80) {
    const charLen = utf8CharLen(byte);
    if (buf.length < charLen) return null; // incomplete UTF-8 — need more bytes
    const charBuf = buf.subarray(0, charLen);
    const decoded = new TextDecoder().decode(charBuf);
    if (decoded.length > 0) {
      return { event: { type: "char", char: decoded }, consumed: charLen };
    }
  }

  return null;
}

/**
 * Parse a raw byte buffer from stdin into a KeyEvent.
 * Returns null for unrecognized sequences.
 *
 * Legacy single-event API — preserved for backward compatibility.
 */
export function parseKey(buf: Uint8Array): KeyEvent | null {
  const result = parseKeyWithLength(buf);
  return result ? result.event : null;
}

/** True when the buffer starts with the full byte sequence `seq`. */
function startsWithSeq(buf: Uint8Array, seq: Uint8Array): boolean {
  if (buf.length < seq.length) return false;
  for (let i = 0; i < seq.length; i++) {
    if (buf[i] !== seq[i]) return false;
  }
  return true;
}

/** Index of the first occurrence of `seq` in `buf`, or -1. */
function indexOfSeq(buf: Uint8Array, seq: Uint8Array): number {
  outer: for (let i = 0; i + seq.length <= buf.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (buf[i + j] !== seq[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Concatenate two byte buffers into a fresh Uint8Array. */
function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const merged = new Uint8Array(a.length + b.length);
  merged.set(a);
  merged.set(b, a.length);
  return merged;
}

/**
 * True when the buffer is an escape sequence whose final byte hasn't arrived
 * yet — the parser should wait for more bytes rather than misread the prefix.
 */
function isIncompleteEscape(buf: Uint8Array): boolean {
  if (buf[0] !== 0x1b) return false;
  if (buf.length === 1) return true; // lone ESC — CSI/SS3 may follow
  if (buf[1] === 0x5b) return csiFinalIndex(buf) === -1;
  if (buf[1] === 0x4f) return buf.length < 3;
  return false;
}

/**
 * KeyParser accumulates bytes and emits KeyEvents.
 * Handles incomplete escape sequences, bracketed paste blocks, and UTF-8
 * characters split across reads by buffering.
 */
export class KeyParser {
  private pending: Uint8Array | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callback: (event: KeyEvent) => void;
  /** Non-null while inside an ESC[200~ ... ESC[201~ bracketed paste block. */
  private pasteData: Uint8Array | null = null;

  constructor(callback: (event: KeyEvent) => void) {
    this.callback = callback;
  }

  /** Feed raw bytes from stdin */
  feed(data: Uint8Array): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    let buf: Uint8Array;
    if (this.pending) {
      buf = concatBytes(this.pending, data);
      this.pending = null;
    } else {
      buf = data;
    }

    while (buf.length > 0) {
      // Inside a bracketed paste — accumulate until the end marker arrives.
      if (this.pasteData !== null) {
        const merged = concatBytes(this.pasteData, buf);
        const end = indexOfSeq(merged, PASTE_END);
        if (end === -1) {
          this.pasteData = merged;
          return;
        }
        const raw = new TextDecoder().decode(merged.subarray(0, end));
        this.pasteData = null;
        // Normalize line endings — terminals paste \r for newlines
        const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        this.callback({ type: "paste", text });
        buf = merged.subarray(end + PASTE_END.length);
        continue;
      }

      if (buf[0] === 0x1b) {
        // Bracketed paste start — switch to accumulation mode
        if (startsWithSeq(buf, PASTE_START)) {
          this.pasteData = new Uint8Array(0);
          buf = buf.subarray(PASTE_START.length);
          continue;
        }

        // Escape sequence still missing its final byte — buffer and wait.
        // The timeout flushes a lone ESC (or truncated sequence) as escape.
        if (isIncompleteEscape(buf)) {
          this.pending = buf.slice();
          this.timer = setTimeout(() => {
            if (this.pending) {
              const flush = this.pending;
              this.pending = null;
              const result = parseKeyWithLength(flush);
              if (result?.event) this.callback(result.event);
            }
          }, ESC_TIMEOUT_MS);
          return;
        }
      }

      // UTF-8 multibyte character split across reads — buffer the tail
      if (buf[0] >= 0x80 && buf.length < utf8CharLen(buf[0])) {
        this.pending = buf.slice();
        return;
      }

      const result = parseKeyWithLength(buf);
      if (!result) {
        // Unparseable byte — skip it to avoid infinite loop
        buf = buf.subarray(1);
        continue;
      }
      if (result.event) this.callback(result.event);
      buf = buf.subarray(result.consumed);
    }
  }

  /** Clean up timers */
  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
    this.pasteData = null;
  }
}
