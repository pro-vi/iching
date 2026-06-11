import { Command } from "commander";
import { GUA, searchHexagrams } from "@iching/core";
import type { Hexagram, Style } from "@iching/core";
import { formatHexagramPlain } from "../output/plain.js";
import { outputJson, hexagramToJson } from "../output/json.js";

const VALID_STYLES = ["dx", "tu", "en", "te", "w"];

/**
 * Resolution of a hexagram CLI argument. Shared by `hexagram` and `dict`:
 *   - "kw":      a usable King Wen number (integer in range, or a unique search hit)
 *   - "matches": several hexagrams answer the query
 *   - "none":    nothing answers
 *   - "invalid": an integer outside 1-64 (kept distinct so the classic range
 *                error still fires instead of a futile search)
 */
export type HexagramQueryResolution =
  | { kind: "kw"; kw: number }
  | { kind: "matches"; matches: Hexagram[] }
  | { kind: "none" }
  | { kind: "invalid" };

/**
 * Resolve a hexagram argument: a King Wen number, or anything core
 * searchHexagrams understands (Chinese name, pinyin, English name,
 * trigram tokens / "X over Y" pairs).
 */
export function resolveHexagramQuery(arg: string): HexagramQueryResolution {
  const trimmed = arg.trim();
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (num < 1 || num > 64) return { kind: "invalid" };
    return { kind: "kw", kw: num };
  }
  const matches = searchHexagrams(trimmed);
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "kw", kw: GUA.indexOf(matches[0]) + 1 };
  return { kind: "matches", matches };
}

export function registerHexagramCommand(program: Command): void {
  program
    .command("hexagram")
    .description("Look up hexagram by King Wen number, name, pinyin, or English name")
    .argument("<query>", "hexagram number (1-64), name, pinyin, or English name")
    .option("--style <style>", "commentary style: dx|tu|en|te|w")
    .action((query: string, cmdOpts) => {
      const globalOpts = program.opts();
      const resolution = resolveHexagramQuery(query);

      if (resolution.kind === "invalid") {
        console.error("Hexagram number must be an integer from 1 to 64.");
        process.exit(1);
      }
      if (resolution.kind === "none") {
        console.error(`No hexagram matches "${query}".`);
        process.exit(1);
      }
      if (resolution.kind === "matches") {
        // Several hexagrams answer — print the brief shortlist and exit 0.
        if (globalOpts.json) {
          outputJson({
            query,
            matches: resolution.matches.map((hex) => ({
              number: GUA.indexOf(hex) + 1,
              name: hex.n,
              pinyin: hex.p,
              ename: hex.ename,
              symbol: hex.u,
            })),
          });
        } else {
          console.log(`Multiple matches for "${query}":`);
          for (const hex of resolution.matches) {
            const kw = GUA.indexOf(hex) + 1;
            console.log(`  ${String(kw).padStart(2)}  ${hex.u} ${hex.n} (${hex.p}) — ${hex.ename}`);
          }
        }
        return;
      }

      const num = resolution.kw;
      const hex = GUA[num - 1];

      const style = cmdOpts.style as Style | undefined;
      if (style && !VALID_STYLES.includes(style)) {
        console.error(
          `Invalid style "${style}". Choose from: ${VALID_STYLES.join(", ")}`,
        );
        process.exit(1);
      }

      if (globalOpts.json) {
        outputJson(hexagramToJson(num, hex));
      } else {
        console.log(formatHexagramPlain(num, hex, style));
      }
    });
}
