// TerminalSession — lifecycle management for alt screen, cursor, raw mode, cleanup

import {
  altScreenOn,
  altScreenOff,
  hideCursor,
  showCursor,
  clearScreen,
  cursorHome,
  bracketedPasteOn,
  bracketedPasteOff,
} from "../ansi/codes.ts";
import { enableRawMode } from "../input/raw-input.ts";

type ResizeCallback = (cols: number, rows: number) => void;

export class TerminalSession {
  private active = false;
  private disableRaw: (() => void) | null = null;
  private resizeCallbacks: ResizeCallback[] = [];
  private signalHandlers: Map<string, () => void> = new Map();
  private resizeHandler: (() => void) | null = null;
  private stdout: { write(data: string): boolean; columns: number; rows: number };
  private stdin: typeof process.stdin;

  constructor(
    stdout?: { write(data: string): boolean; columns: number; rows: number },
    stdin?: typeof process.stdin,
  ) {
    this.stdout = stdout ?? process.stdout;
    this.stdin = stdin ?? process.stdin;
  }

  /** Get terminal width */
  get cols(): number {
    return this.stdout.columns;
  }

  /** Get terminal height */
  get rows(): number {
    return this.stdout.rows;
  }

  /**
   * Whether the session currently holds the terminal (alt screen + raw mode).
   * Callers use this for ownership: an outer holder (e.g. the interactive
   * home loop) enters once, and inner scene runs leave the session alone.
   */
  get isActive(): boolean {
    return this.active;
  }

  /** Enter alt screen, hide cursor, enable raw mode, register signal handlers. Idempotent. */
  enter(): void {
    if (this.active) return;
    this.active = true;

    // Enter alt screen, clear, and enable bracketed paste
    this.stdout.write(altScreenOn + clearScreen + cursorHome + hideCursor + bracketedPasteOn);

    // Enable raw mode
    this.disableRaw = enableRawMode(this.stdin);

    // Listen for resize (SIGWINCH)
    this.resizeHandler = () => {
      const c = this.cols;
      const r = this.rows;
      for (const cb of this.resizeCallbacks) {
        cb(c, r);
      }
    };
    process.on("SIGWINCH", this.resizeHandler);

    // Register cleanup signal handlers
    const cleanup = () => this.exit();
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      const handler = () => {
        cleanup();
        process.exit(0);
      };
      this.signalHandlers.set(sig, handler);
      process.on(sig, handler);
    }
  }

  /** Restore alt screen, show cursor, disable raw mode, remove handlers */
  exit(): void {
    if (!this.active) return;
    this.active = false;

    // Restore terminal
    this.stdout.write(bracketedPasteOff + showCursor + altScreenOff);

    // Disable raw mode
    if (this.disableRaw) {
      this.disableRaw();
      this.disableRaw = null;
    }

    // Remove resize handler
    if (this.resizeHandler) {
      process.off("SIGWINCH", this.resizeHandler);
      this.resizeHandler = null;
    }

    // Remove signal handlers
    for (const [sig, handler] of this.signalHandlers) {
      process.off(sig, handler);
    }
    this.signalHandlers.clear();
  }

  /**
   * Clear the screen and home the cursor. Used between scenes while one
   * persistent session stays active, and for full repaints after a resize.
   */
  clear(): void {
    if (!this.active) return;
    this.stdout.write(clearScreen + cursorHome);
  }

  /** Register a resize callback */
  onResize(cb: ResizeCallback): void {
    this.resizeCallbacks.push(cb);
  }

  /** Remove a resize callback */
  offResize(cb: ResizeCallback): void {
    const idx = this.resizeCallbacks.indexOf(cb);
    if (idx !== -1) this.resizeCallbacks.splice(idx, 1);
  }

  /** Run a function within the terminal session, ensuring cleanup on exit or error */
  async run<T>(fn: () => T | Promise<T>): Promise<T> {
    this.enter();
    try {
      return await fn();
    } finally {
      this.exit();
    }
  }
}
