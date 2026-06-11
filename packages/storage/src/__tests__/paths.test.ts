import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolvePaths } from "../paths.js";

describe("resolvePaths", () => {
  const home = homedir();
  const savedEnv: Record<string, string | undefined> = {};

  const envKeys = [
    "ICHING_HOME",
    "XDG_CONFIG_HOME",
    "XDG_STATE_HOME",
    "XDG_CACHE_HOME",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  test("returns correct XDG defaults", () => {
    const paths = resolvePaths();

    expect(paths.config).toBe(join(home, ".config", "iching", "config.json"));
    expect(paths.state).toBe(
      join(home, ".local", "state", "iching", "history.jsonl"),
    );
    expect(paths.notes).toBe(
      join(home, ".local", "state", "iching", "notes.jsonl"),
    );
    expect(paths.cache).toBe(join(home, ".cache", "iching", "daily-cache.json"));
  });

  test("respects XDG env var overrides", () => {
    process.env.XDG_CONFIG_HOME = "/tmp/xdg-config";
    process.env.XDG_STATE_HOME = "/tmp/xdg-state";
    process.env.XDG_CACHE_HOME = "/tmp/xdg-cache";

    const paths = resolvePaths();

    expect(paths.config).toBe(
      join("/tmp/xdg-config", "iching", "config.json"),
    );
    expect(paths.state).toBe(
      join("/tmp/xdg-state", "iching", "history.jsonl"),
    );
    expect(paths.notes).toBe(
      join("/tmp/xdg-state", "iching", "notes.jsonl"),
    );
    expect(paths.cache).toBe(
      join("/tmp/xdg-cache", "iching", "daily-cache.json"),
    );
  });

  test("respects ICHING_HOME override", () => {
    process.env.ICHING_HOME = "/tmp/iching-home";

    const paths = resolvePaths();

    expect(paths.config).toBe(join("/tmp/iching-home", "config.json"));
    expect(paths.state).toBe(join("/tmp/iching-home", "history.jsonl"));
    expect(paths.notes).toBe(join("/tmp/iching-home", "notes.jsonl"));
    expect(paths.cache).toBe(join("/tmp/iching-home", "daily-cache.json"));
  });

  test("dataDir override takes precedence over ICHING_HOME", () => {
    process.env.ICHING_HOME = "/tmp/iching-home";
    const paths = resolvePaths({ dataDir: "/tmp/override" });

    expect(paths.config).toBe(join("/tmp/override", "config.json"));
    expect(paths.state).toBe(join("/tmp/override", "history.jsonl"));
    expect(paths.notes).toBe(join("/tmp/override", "notes.jsonl"));
    expect(paths.cache).toBe(join("/tmp/override", "daily-cache.json"));
  });

  test("uses os.homedir(), not ~", () => {
    const paths = resolvePaths();

    expect(paths.config).not.toContain("~");
    expect(paths.state).not.toContain("~");
    expect(paths.cache).not.toContain("~");
    expect(paths.config).toContain(home);
  });
});
