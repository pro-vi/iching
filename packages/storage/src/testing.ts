// Test support for storage's __tests__ — imported relatively (the storage analogue
// of @iching/core/testing). Not part of the package's public surface.

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Create a fresh OS temp directory for a test, `prefix`-tagged for debuggability. */
export async function freshTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `${prefix}-`));
}
