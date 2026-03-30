import { Command } from "commander";
import { GUA } from "@iching/core";
import type { Style } from "@iching/core";
import { formatHexagramPlain } from "../output/plain.js";
import { outputJson, hexagramToJson } from "../output/json.js";

const VALID_STYLES = ["dx", "tu", "en", "te", "w"];

export function registerHexagramCommand(program: Command): void {
  program
    .command("hexagram")
    .description("Look up hexagram by King Wen number (1-64)")
    .argument("<n>", "hexagram number (1-64)")
    .option("--style <style>", "commentary style: dx|tu|en|te|w")
    .action((n: string, cmdOpts) => {
      const num = Number(n);
      if (!Number.isInteger(num) || num < 1 || num > 64) {
        console.error("Hexagram number must be an integer from 1 to 64.");
        process.exit(1);
      }

      const hex = GUA[num - 1];
      const globalOpts = program.opts();

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
