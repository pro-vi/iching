import type { RngProvenance } from "@iching/core";

/**
 * Derive the entropy provenance recorded with a cast — the honest record of
 * where the bytes came from — from the resolved cast inputs. Shared by the CLI
 * `cast` command and the interactive reading flow so the two surfaces can never
 * disagree on what counts as seed / bound / crypto. `intentionBound` is true
 * only when a bound cast actually carried question/intention text; empty or
 * absent text records as unbound.
 *
 * Precedence (highest first): an explicit seed is its own deterministic path;
 * otherwise a bound cast mixes the question/moment into local entropy; otherwise
 * plain crypto. The interactive flow's manual-coin-toss case (always plain
 * crypto, regardless of the entropy setting) has no analogue in the CLI command,
 * so it stays an explicit guard at that one call site rather than a parameter
 * here — this helper owns only the shared three-way rule.
 */
export function rngProvenanceFor(opts: {
  seeded: boolean;
  bound: boolean;
  boundText?: string;
}): RngProvenance {
  if (opts.seeded) return { source: "seed", intentionBound: false };
  if (opts.bound) {
    return {
      source: "bound",
      intentionBound: opts.boundText !== undefined && opts.boundText !== "",
    };
  }
  return { source: "crypto", intentionBound: false };
}
