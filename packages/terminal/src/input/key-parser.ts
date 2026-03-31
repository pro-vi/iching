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

/**
 * Parse a raw byte buffer from stdin into a KeyEvent.
 * Returns null for unrecognized sequences.
 */
export function parseKey(buf: Uint8Array): KeyEvent | null {
  // Empty buffer
  if (buf.length === 0) return null;

  // Single byte
  if (buf.length === 1) {
    const byte = buf[0];

    // Enter (CR or LF)
    if (byte === 0x0d || byte === 0x0a) return { type: "enter" };

    // Escape (standalone)
    if (byte === 0x1b) return { type: "escape" };

    // Tab
    if (byte === 0x09) return { type: "tab" };

    // Backspace (DEL key)
    if (byte === 0x7f) return { type: "backspace" };

    // Ctrl characters (0x01-0x1a map to Ctrl-A through Ctrl-Z)
    if (byte >= 0x01 && byte <= 0x1a) {
      return { type: "ctrl", char: String.fromCharCode(byte + 0x60) };
    }

    // Printable ASCII
    if (byte >= 0x20 && byte <= 0x7e) {
      return { type: "char", char: String.fromCharCode(byte) };
    }

    return null;
  }

  // Multi-byte: check for escape sequences
  if (buf[0] === 0x1b) {
    // CSI sequences: ESC [ ...
    if (buf.length >= 3 && buf[1] === 0x5b) {
      const third = buf[2];
      // Arrow keys
      if (third === 0x41) return { type: "arrow", direction: "up" };
      if (third === 0x42) return { type: "arrow", direction: "down" };
      if (third === 0x43) return { type: "arrow", direction: "right" };
      if (third === 0x44) return { type: "arrow", direction: "left" };

      // Home (ESC [ H)
      if (third === 0x48) return { type: "home" };
      // End (ESC [ F)
      if (third === 0x46) return { type: "end" };

      // Extended sequences: ESC [ <n> ~
      if (buf.length >= 4 && buf[3] === 0x7e) {
        // PageUp (ESC [ 5 ~)
        if (third === 0x35) return { type: "page", direction: "up" };
        // PageDown (ESC [ 6 ~)
        if (third === 0x36) return { type: "page", direction: "down" };
        // Home (ESC [ 1 ~)
        if (third === 0x31) return { type: "home" };
        // End (ESC [ 4 ~)
        if (third === 0x34) return { type: "end" };
      }
    }

    // Two-byte ESC sequences that aren't CSI — treat as escape
    if (buf.length === 2) return { type: "escape" };
  }

  // Multi-byte UTF-8 character
  const decoded = new TextDecoder().decode(buf);
  if (decoded.length > 0 && buf[0] !== 0x1b) {
    return { type: "char", char: decoded };
  }

  return null;
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
      buf = new Uint8Array(this.pending.length + data.length);
      buf.set(this.pending);
      buf.set(data, this.pending.length);
      this.pending = null;
    } else {
      buf = data;
    }

    // If we have a lone ESC, wait briefly for more bytes (escape sequence)
    if (buf.length === 1 && buf[0] === 0x1b) {
      this.pending = buf;
      this.timer = setTimeout(() => {
        if (this.pending) {
          const event = parseKey(this.pending);
          this.pending = null;
          if (event) this.callback(event);
        }
      }, 50);
      return;
    }

    // If we have ESC + [ but no third byte, wait for it
    if (buf.length === 2 && buf[0] === 0x1b && buf[1] === 0x5b) {
      this.pending = buf;
      this.timer = setTimeout(() => {
        if (this.pending) {
          const event = parseKey(this.pending);
          this.pending = null;
          if (event) this.callback(event);
        }
      }, 50);
      return;
    }

    // If we have ESC [ <digit> but no ~ yet, wait for it (PageUp/Down/Home/End)
    if (
      buf.length === 3 &&
      buf[0] === 0x1b &&
      buf[1] === 0x5b &&
      buf[2] >= 0x31 && buf[2] <= 0x36
    ) {
      // Could be a 4-byte sequence like ESC [ 5 ~
      // Check if parseKey already handles it as a 3-byte sequence
      const immediate = parseKey(buf);
      if (immediate) {
        this.callback(immediate);
        return;
      }
      this.pending = buf;
      this.timer = setTimeout(() => {
        if (this.pending) {
          const event = parseKey(this.pending);
          this.pending = null;
          if (event) this.callback(event);
        }
      }, 50);
      return;
    }

    const event = parseKey(buf);
    if (event) this.callback(event);
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
