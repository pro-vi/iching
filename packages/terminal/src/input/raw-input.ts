// Enable raw mode on stdin, read bytes

import { KeyParser, type KeyEvent } from "./key-parser.ts";

/**
 * Enable raw mode on stdin for direct key reading.
 * Returns a cleanup function to restore normal mode.
 */
export function enableRawMode(
  stdin: typeof process.stdin = process.stdin,
): () => void {
  if (stdin.isTTY) {
    stdin.setRawMode(true);
  }
  stdin.resume();

  return () => {
    if (stdin.isTTY) {
      stdin.setRawMode(false);
    }
    stdin.pause();
  };
}

/**
 * Start reading keys from stdin.
 * Returns a cleanup function that stops reading and restores stdin.
 */
export function readKeys(
  callback: (event: KeyEvent) => void,
  stdin: typeof process.stdin = process.stdin,
): () => void {
  const parser = new KeyParser(callback);
  const disableRaw = enableRawMode(stdin);

  const onData = (data: Buffer) => {
    parser.feed(new Uint8Array(data));
  };

  stdin.on("data", onData);

  return () => {
    stdin.off("data", onData);
    parser.dispose();
    disableRaw();
  };
}
