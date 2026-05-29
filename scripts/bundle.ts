#!/usr/bin/env bun
/**
 * Bundle the CLI into the single-file artifact published to npm
 * (`publish/iching.js`).
 *
 * Targets Node so the bundle runs under both `npx @pro-vi/iching` (Node) and
 * `bunx @pro-vi/iching` (Bun is a superset). Bun's bundler emits a
 * `#!/usr/bin/env bun` shebang even for `--target=node`, so we rewrite it to
 * `node` — that is what npm's bin shim honours on install.
 *
 * Usage: bun scripts/bundle.ts
 */
import { $ } from "bun";
import { chmod } from "node:fs/promises";

const ENTRY = "apps/cli/src/main.ts";
const OUT = "publish/iching.js";

// Keep stdout clean so `npm pack --silent` (which runs this via prepack) emits
// only the tarball name. Build progress and our log go to stderr.
const result = await $`bun build --target=node ${ENTRY} --outfile ${OUT} 1>&2`.nothrow();
if (result.exitCode !== 0) {
  console.error("Bundle failed");
  process.exit(1);
}

// Rewrite the shebang to node (see header). Prepend one if absent.
let code = await Bun.file(OUT).text();
code = code.startsWith("#!")
  ? code.replace(/^#!.*\n/, "#!/usr/bin/env node\n")
  : `#!/usr/bin/env node\n${code}`;
await Bun.write(OUT, code);
await chmod(OUT, 0o755);

console.error(`Bundled ${OUT} (node-target, node shebang) — runs under node and bun.`);
