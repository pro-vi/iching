// optionLabel() contract: total resolution with canonical-token fallback, and
// hardened against prototype-chain key reaches (the PR #5 alias-lookup lesson —
// a hand-edited "constructor" must miss, not resolve an inherited member).
import { describe, expect, test } from "bun:test";
import { optionLabel } from "../i18n/option-labels.ts";

describe("optionLabel", () => {
  test("unknown (settingKey, token) falls back to the canonical token", () => {
    expect(optionLabel("zh-Hant", "settings.theme", "ink")).toBe("ink");
    expect(optionLabel("zh-Hans", "settings.nonsense", "whatever")).toBe("whatever");
  });

  test("prototype-chain keys miss instead of resolving inherited members", () => {
    for (const token of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
      expect(optionLabel("zh-Hant", "settings.font", token)).toBe(token);
    }
  });

  test("en mode returns the token-shaped label even when an entry exists", () => {
    // With the catalog empty this is the fallback; once entries land (U3/U4)
    // their en field must still equal the canonical token — locked there.
    expect(optionLabel("en", "settings.font", "kaiti")).toBe("kaiti");
  });
});
