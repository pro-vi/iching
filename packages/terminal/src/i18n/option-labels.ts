// Settings option-chip display labels — the SEPARATE catalog layer sanctioned by
// docs/language-glossary.md §Settings option-chip display labels. Labels localize
// the *presentation* of canonical enum tokens; they never mutate the stored token,
// and no label is ever accepted as config input (no aliases — config set and
// hand-edited files stay canonical-only). zh-Hans is authored explicitly in the
// same literary register, never derived via toSimplified().
//
// The Language row's EN/繁/简 endonym badges are NOT in this catalog — they are
// deliberately invariant across display languages (see LANGUAGE_LABELS in
// settings-scene.ts). Theme names are absent on purpose: their semantics ruling
// (brand vs literal) is deferred; chips render the stored tokens meanwhile.
import type { DisplayLanguage } from "@iching/core";
import type { Message } from "./messages.ts";

/**
 * Token-keyed entries, namespaced by the row's catalog key:
 * `${settingKey}.${token}` (e.g. "settings.font.kaiti").
 * A Map so a hand-reached token like "constructor" can never resolve an
 * inherited Object.prototype member — unknown keys miss, they don't alias.
 */
const OPTION_LABELS = new Map<string, Message>([
  // Entries per glossary ratification — en is ALWAYS the canonical token
  // (the en UI shows tokens; labels exist for the zh modes).
  // Font: tokens are the pinyin of the labels, so the CLI mental bridge
  // (config set glyphFont kaiti) survives without a canonical hint.
  ["settings.font.kaiti", { en: "kaiti", zhHant: "楷體", zhHans: "楷体" }],
  ["settings.font.libian", { en: "libian", zhHant: "隸變", zhHans: "隶变" }],
  ["settings.font.heiti", { en: "heiti", zhHant: "黑體", zhHans: "黑体" }],
]);

/**
 * Display label for a canonical option token. Total by design: an unknown
 * (settingKey, token) pair returns the token itself, so rendering degrades to
 * the canonical value — it never throws, and nothing resolved here is ever
 * written back to config.
 */
export function optionLabel(
  language: DisplayLanguage,
  settingKey: string,
  token: string,
): string {
  const m = OPTION_LABELS.get(`${settingKey}.${token}`);
  if (!m) return token;
  return language === "en" ? m.en : language === "zh-Hant" ? m.zhHant : m.zhHans;
}
