// TerminalSession — lifecycle management for alt screen, cursor, raw mode, cleanup

import {
  altScreenOn,
  altScreenOff,
  hideCursor,
  showCursor,
  clearScreen,
  cursorHome,
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

  /** Enter alt screen, hide cursor, enable raw mode, register signal handlers */
  enter(): void {
    if (this.active) return;
    this.active = true;

    // Enter alt screen and clear
    this.stdout.write(altScreenOn + clearScreen + cursorHome + hideCursor);

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
    this.stdout.write(showCursor + altScreenOff);

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

  /** Register a resize callback */
  onResize(cb: ResizeCallback): void {
    this.resizeCallbacks.push(cb);
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
