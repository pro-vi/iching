/**
 * A warn-once sink for corrupt-file notices: returns a function that logs its
 * message to stderr the first time it's called (unless quiet) and stays silent
 * after, so a repeated read of a bad file doesn't spam. Both JSON stores hold one;
 * the message (which file, what recovery) stays the caller's to phrase.
 */
export function createCorruptWarner(quiet: boolean): (message: string) => void {
  let warned = false;
  return (message: string) => {
    if (warned) return;
    warned = true;
    if (!quiet) console.error(message);
  };
}
