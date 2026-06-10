import { rename, mkdir, open, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Atomically write JSON data to `path`.
 *
 * 1. Ensure parent directory exists
 * 2. Write to a temp file in the same directory
 * 3. fsync the temp file
 * 4. rename over the target (atomic on same filesystem)
 *
 * The parent directory is NOT fsync'd after the rename, so the rename itself
 * is not crash-durable — acceptable for a config file (worst case: the
 * previous config survives a power loss).
 */
export async function atomicWriteJson(
  path: string,
  data: unknown,
): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });

  const suffix = randomBytes(6).toString("hex");
  const tmp = join(dir, `${path.split("/").pop()}.${suffix}.tmp`);

  const json = JSON.stringify(data, null, 2) + "\n";

  try {
    // Write, fsync, close
    const handle = await open(tmp, "w");
    try {
      await handle.writeFile(json, "utf-8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    // Atomic rename
    await rename(tmp, path);
  } catch (err) {
    // Mid-write failure (ENOSPC/EIO) or failed rename: don't leak the temp —
    // repeated failed saves would otherwise accumulate orphans in the data dir.
    await unlink(tmp).catch(() => {});
    throw err;
  }
}
