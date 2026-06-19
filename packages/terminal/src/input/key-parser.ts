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
  | { type: "deleteWord" }
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

// An escape sequence whose final byte never arrives must not buffer stdin
// without limit (cf. PASTE_MAX_BYTES for paste). The flush timer is cleared on
// every feed(), so a steady stream of incomplete-CSI bytes (ESC[ followed by
// endless param/intermediate bytes, no final byte) would otherwise grow the
// pending buffer forever. Real CSI/SS3 sequences are tens of bytes at most;
// past this cap the buffer is malformed input that will never complete, so it
// is flushed as escape and normal parsing resumes.
const MAX_ESCAPE_BYTES = 256;

// Bracketed-paste guards. Paste accumulation must stay bounded: a lost
// ESC[201~ terminator would otherwise buffer stdin forever (and look like a
// dead app). The cap is generous for an intention; past it the paste event
// is delivered with what was collected and normal parsing resumes. A paste
// left dangling (no terminator, no further bytes) flushes after a quiet
// gap, the same way the lone-ESC timeout does.
const PASTE_MAX_BYTES = 64 * 1024;
const PASTE_TIMEOUT_MS = 500;

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

/**
 * Map a CSI/SS3 final byte to a cursor-key event — arrow (A–D), Home (H), or
 * End (F) — or null if it's not one of those. Shared by the CSI and SS3 paths,
 * which encode these identically (ESC [ A vs ESC O A).
 */
function cursorEventForFinal(final: number): KeyEvent | null {
  switch (final) {
    case 0x41: return { type: "arrow", direction: "up" };
    case 0x42: return { type: "arrow", direction: "down" };
    case 0x43: return { type: "arrow", direction: "right" };
    case 0x44: return { type: "arrow", direction: "left" };
    case 0x48: return { type: "home" };
    case 0x46: return { type: "end" };
    default: return null;
  }
}

/** Map a complete CSI sequence (final byte at `finalIdx`) to a ParseResult. */
function parseCSI(buf: Uint8Array, finalIdx: number): ParseResult {
  const final = buf[finalIdx];
  const consumed = finalIdx + 1;

  // Arrows (ESC [ A, or modified ESC [ 1 ; 5 C), Home (H) / End (F).
  const cursor = cursorEventForFinal(final);
  if (cursor) return { event: cursor, consumed };

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

  // Any other final byte (F-keys, device reports) — swallow silently
  return { event: null, consumed };
}

/**
 * Map a mouse button code (the Cb field) to a scroll arrow. Wheel events set
 * bit 6 (0x40); the low two bits give direction (0=up, 1=down, 2=left, 3=right).
 * Vertical wheel becomes an up/down arrow so it scrolls like the keys do;
 * horizontal wheel and all clicks/drags/releases return null (swallowed) so a
 * mouse report never leaks as a key or as ←/→ navigation.
 */
function mouseWheelArrow(cb: number): KeyEvent | null {
  if ((cb & 0x40) === 0) return null; // not a wheel event
  const dir = cb & 0x03;
  if (dir === 0) return { type: "arrow", direction: "up" };
  if (dir === 1) return { type: "arrow", direction: "down" };
  return null; // horizontal wheel — ignored
}

/** Read the leading decimal number in buf[start..end). */
function parseDecimal(buf: Uint8Array, start: number, end: number): number {
  let n = 0;
  for (let i = start; i < end && buf[i] >= 0x30 && buf[i] <= 0x39; i++) {
    n = n * 10 + (buf[i] - 0x30);
  }
  return n;
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
      // X10 mouse report: ESC [ M Cb Cx Cy — exactly 6 bytes, and the three
      // coordinate bytes are RAW (not digits), so the generic CSI scan would
      // stop at 'M' and leave Cb/Cx/Cy to be misread as character keys (a stray
      // 'h'/'l' would even navigate). Consume all 6; map the wheel to a scroll
      // arrow, swallow clicks. (Incomplete reports are buffered by feed().)
      if (buf[2] === 0x4d) {
        if (buf.length < 6) return { event: null, consumed: buf.length };
        return { event: mouseWheelArrow(buf[3] - 32), consumed: 6 };
      }

      const finalIdx = csiFinalIndex(buf);
      if (finalIdx === -1) {
        // Truncated CSI — flush as escape, consuming everything
        return { event: { type: "escape" }, consumed: buf.length };
      }
      const csiFinal = buf[finalIdx];
      if (csiFinal < 0x40 || csiFinal > 0x7e) {
        // Malformed CSI: the scan stopped at a byte that is neither a parameter/
        // intermediate nor a VALID final (0x40–0x7E) — e.g. a new ESC or a C0
        // control. Treating it as the final would swallow a following real
        // sequence (ESC [ ESC [ A would eat the arrow). Abort: drop the ESC [ …
        // prefix and leave the offending byte to be re-parsed as its own start.
        return { event: null, consumed: finalIdx };
      }

      // SGR mouse report: ESC [ < Cb ; Cx ; Cy (M=press | m=release). Map the
      // wheel to a scroll arrow on press; swallow releases, clicks, and the
      // horizontal wheel so no mouse report leaks as a key or navigation.
      if (buf[2] === 0x3c) {
        const event = csiFinal === 0x4d ? mouseWheelArrow(parseDecimal(buf, 3, finalIdx)) : null;
        return { event, consumed: finalIdx + 1 };
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
      if (final < 0x40 || final > 0x7e) {
        // Malformed SS3: the "final" is a control byte (e.g. a new ESC), not a
        // valid SS3 final. Don't consume it — drop ESC O and let the byte
        // re-parse, so a following sequence (ESC O ESC [ A) isn't eaten.
        return { event: null, consumed: 2 };
      }
      const cursor = cursorEventForFinal(final);
      if (cursor) return { event: cursor, consumed: 3 };
      // F1–F4 (P Q R S) and anything else — swallow
      return { event: null, consumed: 3 };
    }

    // ESC + <byte> is the terminal convention for Alt/Option + that key (Meta
    // prefix), NOT a press of Escape — so it must never eject the scene.
    // Option+Backspace (macOS sends ESC DEL, some send ESC BS) deletes a word;
    // every other Alt-combo we don't bind is swallowed (a no-op), not escaped.
    if (buf[1] === 0x7f || buf[1] === 0x08) {
      return { event: { type: "deleteWord" }, consumed: 2 };
    }
    return { event: null, consumed: 2 };
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
    // Verify the trailing bytes are continuation bytes (0b10xxxxxx). A valid lead
    // followed by a non-continuation is a TRUNCATED multibyte — e.g. a lead byte
    // cut off by a read boundary, then an ESC sequence. Decoding charLen bytes
    // anyway would swallow that sequence (and a raw ESC) into one bogus char and
    // eat the keypress. Instead, emit ONE replacement char for the lead and
    // consume just it, so the following bytes (the real sequence) re-parse.
    for (let i = 1; i < charLen; i++) {
      if ((buf[i] & 0xc0) !== 0x80) {
        return { event: { type: "char", char: "�" }, consumed: 1 };
      }
    }
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
  if (buf[1] === 0x5b) {
    // X10 mouse (ESC [ M …) is a fixed 6 bytes; its raw coordinate bytes can
    // look like a CSI final, so wait for all 6 rather than parse early.
    if (buf.length >= 3 && buf[2] === 0x4d) return buf.length < 6;
    return csiFinalIndex(buf) === -1;
  }
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
        const prevLen = this.pasteData.length;
        const merged = concatBytes(this.pasteData, buf);
        // The end marker can only NEWLY appear at the boundary onward — everything
        // before prevLen was already scanned on earlier feeds. Start a marker-length
        // back so a terminator split across the chunk boundary is still found. This
        // keeps a paste delivered across many chunks linear in total size instead of
        // re-scanning the whole accumulated buffer on every chunk (was O(N²)).
        const scanFrom = Math.max(0, prevLen - (PASTE_END.length - 1));
        const rel = indexOfSeq(merged.subarray(scanFrom), PASTE_END);
        const end = rel === -1 ? -1 : scanFrom + rel;
        if (end === -1) {
          if (merged.length > PASTE_MAX_BYTES) {
            // The terminator never came within the cap — deliver what was
            // collected and return to normal parsing.
            this.pasteData = null;
            this.emitPaste(merged);
            return;
          }
          this.pasteData = merged;
          this.armPasteFlush();
          return;
        }
        this.pasteData = null;
        this.emitPaste(merged.subarray(0, end));
        buf = merged.subarray(end + PASTE_END.length);
        continue;
      }

      if (buf[0] === 0x1b) {
        // Bracketed paste start — switch to accumulation mode
        if (startsWithSeq(buf, PASTE_START)) {
          this.pasteData = new Uint8Array(0);
          buf = buf.subarray(PASTE_START.length);
          if (buf.length === 0) this.armPasteFlush();
          continue;
        }

        // Escape sequence still missing its final byte — buffer and wait.
        // The timeout flushes a lone ESC (or truncated sequence) as escape.
        if (isIncompleteEscape(buf)) {
          // Bound the wait: a "pending escape" longer than any real sequence is
          // malformed input that will never complete. Flush it as escape and
          // resume instead of buffering stdin without limit — the timer is
          // cleared on every feed(), so a steady stream would never flush.
          if (buf.length > MAX_ESCAPE_BYTES) {
            const flushed = parseKeyWithLength(buf);
            if (flushed?.event) this.callback(flushed.event);
            return;
          }
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

  /** Decode paste bytes, normalize line endings, emit the paste event. */
  private emitPaste(data: Uint8Array): void {
    const raw = new TextDecoder().decode(data);
    // Normalize line endings — terminals paste \r for newlines
    const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    this.callback({ type: "paste", text });
  }

  /**
   * Arm the dangling-paste flush: if no further bytes arrive (feed() clears
   * the timer on entry), the unterminated paste is delivered as-is and the
   * parser leaves paste mode.
   */
  private armPasteFlush(): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.pasteData === null) return;
      const data = this.pasteData;
      this.pasteData = null;
      if (data.length > 0) this.emitPaste(data);
    }, PASTE_TIMEOUT_MS);
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
