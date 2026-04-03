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
  | { type: "backspace" };

export interface ParseResult {
  event: KeyEvent;
  consumed: number;
}

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
 * Parse a single key event from the front of a byte buffer.
 * Returns the event and the number of bytes consumed, or null if unparseable.
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
      if (buf.length < 3) {
        // Incomplete CSI — treat as escape (2 bytes consumed)
        return { event: { type: "escape" }, consumed: 2 };
      }

      const third = buf[2];

      // Arrow keys (3 bytes)
      if (third === 0x41) return { event: { type: "arrow", direction: "up" }, consumed: 3 };
      if (third === 0x42) return { event: { type: "arrow", direction: "down" }, consumed: 3 };
      if (third === 0x43) return { event: { type: "arrow", direction: "right" }, consumed: 3 };
      if (third === 0x44) return { event: { type: "arrow", direction: "left" }, consumed: 3 };

      // Home (ESC [ H) / End (ESC [ F)
      if (third === 0x48) return { event: { type: "home" }, consumed: 3 };
      if (third === 0x46) return { event: { type: "end" }, consumed: 3 };

      // Extended sequences: ESC [ <n> ~ (4 bytes)
      if (buf.length >= 4 && buf[3] === 0x7e) {
        if (third === 0x35) return { event: { type: "page", direction: "up" }, consumed: 4 };
        if (third === 0x36) return { event: { type: "page", direction: "down" }, consumed: 4 };
        if (third === 0x31) return { event: { type: "home" }, consumed: 4 };
        if (third === 0x34) return { event: { type: "end" }, consumed: 4 };
      }

      // Unrecognized CSI — consume ESC [ and the third byte
      return { event: { type: "escape" }, consumed: 3 };
    }

    // Two-byte ESC + something that isn't CSI
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

/**
 * KeyParser accumulates bytes and emits KeyEvents.
 * Handles incomplete escape sequences by buffering.
 */
export class KeyParser {
  private pending: Uint8Array | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callback: (event: KeyEvent) => void;

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
      // Concatenate pending + new data
      const merged = new Uint8Array(this.pending.length + data.length);
      merged.set(this.pending);
      merged.set(data, this.pending.length);
      this.pending = null;
      buf = merged;
    } else {
      buf = data;
    }

    while (buf.length > 0) {
      // Check for incomplete escape sequences at the tail — buffer them
      if (buf[0] === 0x1b) {
        // Lone ESC — wait for possible CSI follow-up
        if (buf.length === 1) {
          this.pending = buf;
          this.timer = setTimeout(() => {
            if (this.pending) {
              this.pending = null;
              this.callback({ type: "escape" });
            }
          }, 50);
          return;
        }

        // ESC [ without third byte — wait for it
        if (buf.length === 2 && buf[1] === 0x5b) {
          this.pending = buf;
          this.timer = setTimeout(() => {
            if (this.pending) {
              const result = parseKeyWithLength(this.pending);
              this.pending = null;
              if (result) this.callback(result.event);
            }
          }, 50);
          return;
        }

        // ESC [ <digit> without ~ — could be a 4-byte sequence
        if (
          buf.length === 3 &&
          buf[1] === 0x5b &&
          buf[2] >= 0x31 && buf[2] <= 0x36
        ) {
          // Check if parseKeyWithLength already handles it as a 3-byte sequence
          const immediate = parseKeyWithLength(buf);
          if (immediate && immediate.consumed === 3) {
            this.callback(immediate.event);
            buf = buf.subarray(3);
            continue;
          }
          // Otherwise buffer for the 4th byte
          this.pending = buf;
          this.timer = setTimeout(() => {
            if (this.pending) {
              const result = parseKeyWithLength(this.pending);
              this.pending = null;
              if (result) this.callback(result.event);
            }
          }, 50);
          return;
        }
      }

      const result = parseKeyWithLength(buf);
      if (!result) {
        // Unparseable byte — skip it to avoid infinite loop
        buf = buf.subarray(1);
        continue;
      }
      this.callback(result.event);
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
  }
}
