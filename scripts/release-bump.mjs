// One-shot release version bump (preserves file formatting via targeted replace).
import { readFileSync, writeFileSync } from "fs";
const FROM = process.argv[2] ?? "0.4.0";
const TO = process.argv[3] ?? "0.5.0";
function bumpVersion(f) {
  const s = readFileSync(f, "utf8");
  const out = s.replace(`"version": "${FROM}"`, `"version": "${TO}"`);
  if (out === s) throw new Error(`no "version": "${FROM}" in ${f}`);
  writeFileSync(f, out);
  console.log(`  ${f}: ${FROM} -> ${TO}`);
}
bumpVersion("package.json");
bumpVersion("apps/cli/package.json");
bumpVersion("publish/package.json");
// Engines: commander@^14 requires Node 20+; the published manifest claimed >=18.
const pf = "publish/package.json";
const p = readFileSync(pf, "utf8");
const p2 = p.replace('"node": ">=18"', '"node": ">=20"');
if (p2 === p) throw new Error('engines node ">=18" not found in publish/package.json');
writeFileSync(pf, p2);
console.log(`  ${pf}: engines node >=18 -> >=20`);
console.log("release-bump done");
