import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWriteJson } from "../json/atomic-write.js";

describe("atomicWriteJson", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "atomic-test-"));
  });

  test("writes file atomically (file exists after write)", async () => {
    const path = join(dir, "test.json");
    const data = { hello: "world", num: 42 };

    await atomicWriteJson(path, data);

    const raw = await readFile(path, "utf-8");
    expect(JSON.parse(raw)).toEqual(data);
  });

  test("creates parent directories", async () => {
    const path = join(dir, "deep", "nested", "test.json");
    const data = { created: true };

    await atomicWriteJson(path, data);

    const raw = await readFile(path, "utf-8");
    expect(JSON.parse(raw)).toEqual(data);
  });

  test("no partial writes visible (tmp file cleaned up)", async () => {
    const path = join(dir, "clean.json");
    await atomicWriteJson(path, { value: 1 });

    // After write completes, directory should only contain the target file
    const files = await readdir(dir);
    expect(files).toEqual(["clean.json"]);
  });

  test("overwrites existing file", async () => {
    const path = join(dir, "overwrite.json");
    await atomicWriteJson(path, { version: 1 });
    await atomicWriteJson(path, { version: 2 });

    const raw = await readFile(path, "utf-8");
    expect(JSON.parse(raw)).toEqual({ version: 2 });
  });
});
