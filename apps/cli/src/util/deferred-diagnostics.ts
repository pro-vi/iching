/**
 * Diagnostics raised while the persistent alt screen is up — corrupt-cache
 * quarantine notes from storage, the settings save-failure warning — go to
 * stderr, which the alt screen repaints over within a frame and discards on
 * exit. The user never sees them. While the alt screen is held, console.error
 * is rerouted into this buffer; after session.exit() the buffer is replayed
 * to the real stderr, where it lands in scrollback and survives.
 *
 * Deliberately minimal: a module-scoped array and two functions, not a
 * logging framework. Hook and command modes never call deferDiagnostics, so
 * their stderr behavior is untouched.
 */
const buffered: string[] = [];
const realError = console.error.bind(console);

/** Reroute console.error into the buffer (call right after session.enter()). */
export function deferDiagnostics(): void {
  console.error = (...args: unknown[]) => {
    buffered.push(
      args
        .map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a)))
        .join(" "),
    );
  };
}

/**
 * Restore console.error and replay anything captured. Call after
 * session.exit() — on the fatal path too, before printing the error, so a
 * crash report is never swallowed by the buffer it is trying to explain.
 */
export function flushDiagnostics(): void {
  console.error = realError;
  for (const msg of buffered) realError(msg);
  buffered.length = 0;
}
