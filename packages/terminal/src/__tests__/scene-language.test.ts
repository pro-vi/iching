// AC-004 — scenes honor DisplayLanguage with NO bilingual stacking.
// English mode must not leak Chinese product-ui labels; Chinese modes must not
// leak the English label they replace. Grows one describe-block per wired scene.
import { describe, expect, test } from "bun:test";
import { SettingsScene, type SettingsValues } from "../scenes/settings/settings-scene.ts";
import { HomeScene } from "../scenes/home/home-scene.ts";
import { IntentionScene } from "../scenes/intention/intention-scene.ts";
import { YarrowScene } from "../scenes/yarrow/yarrow-scene.ts";
import { CastScene } from "../scenes/cast/cast-scene.ts";
import { BrowseScene } from "../scenes/dict/browse-scene.ts";
import { JournalScene } from "../scenes/journal/journal-scene.ts";
import { renderDetail } from "../scenes/dict/detail-renderer.ts";
import { stringWidth } from "../layout/measure.ts";
import { DetailScene } from "../scenes/dict/detail-scene.ts";
import { DetailModel } from "../scenes/dict/detail-model.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";
import type { Cast, Line, HistoryEntry, DisplayLanguage } from "@iching/core";

function makeLine(value: 7 | 8): Line {
  return { value, isYang: value === 7, isChanging: false };
}

const ctx: SceneContext = { cols: 80, rows: 24, done: false, colorSupport: "none" };
function ctxFor(language: DisplayLanguage): SceneContext {
  return { cols: 80, rows: 24, done: false, colorSupport: "none", language };
}

function bufferText(buf: CellBuffer): string {
  return Array.from({ length: buf.height }, (_, row) =>
    buf.getRow(row).map((cell) => cell.char).join(""),
  ).join("\n");
}

function renderScene(
  scene: { render: (buf: CellBuffer, ctx: SceneContext) => void },
  language: DisplayLanguage,
): string {
  const buf = CellBuffer.create(80, 24);
  scene.render(buf, ctxFor(language));
  return bufferText(buf);
}

function settingsText(language: DisplayLanguage): string {
  const values: SettingsValues = {
    theme: "bone",
    language,
    taijituStyle: "dots",
    glyphAnim: "dots",
    glyphFont: "kaiti",
    castMethod: "coin",
    castMode: "auto",
  };
  const scene = new SettingsScene(values);
  const buf = CellBuffer.create(ctx.cols, ctx.rows);
  scene.render(buf, ctx);
  return bufferText(buf);
}

describe("SettingsScene — no bilingual stacking", () => {
  test("English mode shows English labels, no Chinese product-ui labels", () => {
    const text = settingsText("en");
    expect(text).toContain("Settings");
    expect(text).toContain("Theme");
    expect(text).toContain("Language");
    // no Chinese label leakage in English mode
    expect(text).not.toContain("設定");
    expect(text).not.toContain("語言");
    expect(text).not.toContain("主題");
  });

  test("Traditional mode shows 繁體 labels, no stray English labels", () => {
    const text = settingsText("zh-Hant");
    expect(text).toContain("設定"); // title / Settings
    expect(text).toContain("語言"); // Language
    expect(text).toContain("主題"); // Theme
    expect(text).not.toContain("Theme");
    expect(text).not.toContain("Language");
    // Option-value chips: STORED tokens stay canonical; display labels come from
    // the option-labels catalog and fall back to the canonical token where no
    // label is ratified (glossary §Settings option-chip display labels). The
    // language chips are endonym badges, invariant across display languages.
    expect(text).toContain("繁");
    expect(text).toContain("ink"); // theme labels deferred → canonical fallback
  });

  test("Simplified mode shows 简体 labels, no stray English or Traditional residue", () => {
    const text = settingsText("zh-Hans");
    expect(text).toContain("设定"); // title
    expect(text).toContain("语言"); // Language
    expect(text).toContain("主题"); // Theme
    expect(text).not.toContain("Theme");
    expect(text).not.toContain("設定"); // no Traditional residue
    expect(text).toContain("简");
  });

  // Regression (Codex P3): moving the Language row with ←/→ must re-localize the
  // scene immediately. render() previously read this.values.language (the saved
  // snapshot, refreshed only on Escape), so the UI stayed in the old language
  // until save + reopen. It now reads the live getValues().language.
  test("changing the Language row re-localizes the scene live, before save", () => {
    const values: SettingsValues = {
      theme: "bone",
      language: "en",
      taijituStyle: "dots",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      castMethod: "coin",
      castMode: "auto",
    };
    const scene = new SettingsScene(values);
    scene.handleKey({ type: "arrow", direction: "down" }, ctx); // focus Language row
    scene.handleKey({ type: "arrow", direction: "right" }, ctx); // en → zh-Hant
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const text = bufferText(buf);
    expect(text).toContain("設定"); // live-localized title (zh-Hant), not the saved "en"
    expect(text).not.toContain("Settings"); // old language no longer shown
  });

  // U3 — font row display labels (glossary-ratified): zh modes show 楷體/隸變/
  // 黑體 chips while the STORED token stays the pinyin (kaiti/libian/heiti).
  test("font chips localize in zh-Hant; persisted token stays canonical", () => {
    const text = settingsText("zh-Hant");
    // Selected kaiti chip with double-width CJK label, 2-space chip gaps —
    // contiguous on one row pins bracket/width placement (cf. "[EN]  繁  简").
    expect(text).toContain("[楷體]  隸變  黑體");
    expect(text).not.toContain("kaiti"); // label replaces the token in zh

    const values: SettingsValues = {
      theme: "bone", language: "zh-Hant", taijituStyle: "dots", glyphAnim: "dots",
      glyphFont: "kaiti", castMethod: "coin", castMode: "auto",
    };
    const scene = new SettingsScene(values);
    expect(scene.getValues().glyphFont).toBe("kaiti");
    // Toggle the Font row: persisted value is the next TOKEN, never a label.
    for (let i = 0; i < 4; i++) scene.handleKey({ type: "arrow", direction: "down" }, ctx);
    scene.handleKey({ type: "arrow", direction: "right" }, ctx);
    expect(scene.getValues().glyphFont).toBe("libian");
  });

  test("font chips localize in zh-Hans with Simplified forms", () => {
    const text = settingsText("zh-Hans");
    expect(text).toContain("[楷体]  隶变  黑体");
    expect(text).not.toContain("楷體"); // no Traditional residue
  });

  test("en mode keeps canonical font tokens", () => {
    const text = settingsText("en");
    expect(text).toContain("[kaiti]  libian  heiti");
    expect(text).not.toContain("楷體");
  });

  // Live re-localization extends to chips: flipping the Language row swaps the
  // font labels in the same frame (labels are derived at render, not stored).
  test("flipping Language re-labels font chips immediately, before save", () => {
    const values: SettingsValues = {
      theme: "bone", language: "en", taijituStyle: "dots", glyphAnim: "dots",
      glyphFont: "kaiti", castMethod: "coin", castMode: "auto",
    };
    const scene = new SettingsScene(values);
    scene.handleKey({ type: "arrow", direction: "down" }, ctx); // focus Language
    scene.handleKey({ type: "arrow", direction: "right" }, ctx); // en → zh-Hant
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const text = bufferText(buf);
    expect(text).toContain("楷體"); // chip re-labeled live
    expect(text).not.toContain("kaiti");
    expect(scene.getValues().glyphFont).toBe("kaiti"); // value untouched
  });

  // U4 — wave-2 chips: castMethod keeps the canonical token as an in-label
  // hint (no transliteration bridge to the CLI value); castMode/taijitu/anim
  // are literal words, label-only. Token-keyed: 噪點 = noise, 點陣 = dots.
  test("wave-2 chips localize in zh-Hant; castMethod carries canonical hint", () => {
    const text = settingsText("zh-Hant");
    expect(text).toContain("[銅錢 (coin)]  蓍草 (yarrow)");
    expect(text).toContain("[自動]  手動");
    expect(text).toContain("[點陣]  密實"); // taijitu
    expect(text).toContain("[點陣]  噪點  放射  沙化"); // anim (order = ANIM_OPTIONS)
  });

  test("wave-2 chips localize in zh-Hans with Simplified forms", () => {
    const text = settingsText("zh-Hans");
    expect(text).toContain("[铜钱 (coin)]  蓍草 (yarrow)");
    expect(text).toContain("[自动]  手动");
    expect(text).toContain("[点阵]  密实");
    expect(text).toContain("[点阵]  噪点  放射  沙化");
    expect(text).not.toContain("銅錢"); // no Traditional residue
  });

  test("en mode keeps canonical wave-2 tokens", () => {
    const text = settingsText("en");
    expect(text).toContain("[coin]  yarrow");
    expect(text).toContain("[auto]  manual");
    expect(text).toContain("[dots]  noise  radial  sand");
    expect(text).not.toContain("銅錢");
  });

  // Width budget: the widest localized chip row must stay under the en theme
  // row (36 cols), the proven-to-fit baseline at 80 cols (plan U4 scenario).
  test("widest zh chip row stays inside the en theme-row width budget", () => {
    const castMethodRow = "[銅錢 (coin)]  蓍草 (yarrow)";
    expect(stringWidth(castMethodRow)).toBeLessThan(36);
  });

  // Persistence: zh-mode selections still write canonical tokens (the chain
  // CLI tests pin from the other side: `config get castMethod` prints "coin").
  test("zh-Hant selections persist canonical wave-2 tokens", () => {
    const values: SettingsValues = {
      theme: "bone", language: "zh-Hant", taijituStyle: "dots", glyphAnim: "dots",
      glyphFont: "kaiti", castMethod: "coin", castMode: "auto",
    };
    const scene = new SettingsScene(values);
    for (let i = 0; i < 5; i++) scene.handleKey({ type: "arrow", direction: "down" }, ctx); // Cast Method
    scene.handleKey({ type: "arrow", direction: "right" }, ctx);
    expect(scene.getValues().castMethod).toBe("yarrow");
    expect(scene.getValues().castMode).toBe("auto");
  });

  // Regression (Codex P2): the yarrow preview strip in Settings rendered its
  // captions in English because renderPreview() called renderYarrowFieldStrip
  // without the selected language. It now passes vals.language.
  test("yarrow preview in Settings localizes its captions (zh-Hant, no English leak)", () => {
    const values: SettingsValues = {
      theme: "bone",
      language: "zh-Hant",
      taijituStyle: "dots",
      glyphAnim: "dots",
      glyphFont: "kaiti",
      castMethod: "yarrow",
      castMode: "auto",
    };
    const scene = new SettingsScene(values);
    // focus the Cast Method row (index 5) so the preview becomes the yarrow strip
    for (let i = 0; i < 5; i++) scene.handleKey({ type: "arrow", direction: "down" }, ctx);
    // tall buffer so the preview pane actually has room to render (it's skipped
    // when previewAvailRows < MIN_PREVIEW_ROWS, e.g. at 80x24)
    const buf = CellBuffer.create(80, 44);
    let text = "";
    // sample densely across several preview phases (gather / cut / narrate)
    for (let ms = 0; ms < 6000; ms += 100) {
      scene.update(ms, 100, ctx);
      scene.render(buf, ctx);
      text += bufferText(buf) + "\n";
    }
    expect(text).toContain("策"); // localized yarrow caption (策 / 奇策 / 餘策)
    expect(text).not.toContain("stalks"); // no English caption leak in zh-Hant Settings
    expect(text).not.toContain("set aside");
  });
});

describe("HomeScene — no bilingual stacking", () => {
  const home = () => new HomeScene({ todayCast: null, taijituStyle: "dots" });

  test("English mode shows English menu labels", () => {
    const text = renderScene(home(), "en");
    expect(text).toContain("Cast");
    expect(text).toContain("Dictionary");
    expect(text).toContain("No cast today");
    expect(text).not.toContain("起卦");
    expect(text).not.toContain("卦典");
  });

  test("Traditional mode shows 繁體 menu labels, no stray English", () => {
    const text = renderScene(home(), "zh-Hant");
    expect(text).toContain("起卦"); // Cast
    expect(text).toContain("卦典"); // Dictionary
    expect(text).toContain("今日未占"); // No cast today
    expect(text).not.toContain("Cast");
    expect(text).not.toContain("Dictionary");
  });

  test("Simplified mode shows 简体 menu labels", () => {
    const text = renderScene(home(), "zh-Hans");
    expect(text).toContain("起卦");
    expect(text).toContain("卦典");
    expect(text).not.toContain("Dictionary");
  });
});

describe("IntentionScene — localized hint, canonical 問 in all languages", () => {
  test("問 prompt shows in every language (canonical anchor)", () => {
    for (const lang of ["en", "zh-Hant", "zh-Hans"] as const) {
      expect(renderScene(new IntentionScene(), lang)).toContain("問");
    }
  });
  test("English hint, no Chinese verbs", () => {
    const text = renderScene(new IntentionScene(), "en");
    expect(text).toContain("confirm");
    expect(text).toContain("back");
    expect(text).not.toContain("確認");
  });
  test("Traditional hint localizes verbs, no stray English", () => {
    const text = renderScene(new IntentionScene(), "zh-Hant");
    expect(text).toContain("確認");
    expect(text).toContain("返回");
    expect(text).not.toContain("confirm");
  });
});

describe("YarrowScene — localized ritual captions + footer (teach-once)", () => {
  // Advance the auto ritual through its narrated beats, collecting captions.
  function captionsFor(language: DisplayLanguage): string {
    const scene = new YarrowScene("default", undefined, language);
    const seen: string[] = [];
    for (let ms = 0; ms < 6000; ms += 200) {
      scene.update(ms, 200, ctxFor(language));
      const buf = CellBuffer.create(80, 24);
      scene.render(buf, ctxFor(language));
      const cap = (scene as unknown as { model: { caption: string } }).model.caption;
      if (cap) seen.push(cap);
    }
    return seen.join("\n");
  }

  test("English captions use English ritual words", () => {
    const text = captionsFor("en");
    expect(text).toContain("stalks");
    expect(text).toContain("Round");
    expect(text).not.toContain("策");
    expect(text).not.toContain("變");
  });

  test("Traditional captions use 繁體 ritual terms, no stray English", () => {
    const text = captionsFor("zh-Hant");
    expect(text).toContain("策"); // stalks
    expect(text).toContain("變"); // Round / 變
    expect(text).not.toContain("stalks");
    expect(text).not.toContain("Round");
  });

  test("Simplified captions use 简体 ritual terms", () => {
    const text = captionsFor("zh-Hans");
    expect(text).toContain("策");
    expect(text).toContain("变"); // simplified 變
    expect(text).not.toContain("變"); // no Traditional residue
    expect(text).not.toContain("stalks");
  });
});

describe("CastScene reveal — hexagram name honors language (KW58 兌)", () => {
  // Hexagram 58 (兌 / The Joyous): both trigrams Lake, no becoming → centered
  // reveal. This is the P1-a path the structural oracle missed.
  const cast58: Cast = {
    lines: [makeLine(7), makeLine(7), makeLine(8), makeLine(7), makeLine(7), makeLine(8)],
    primary: 58,
    becoming: null,
    changingPositions: [],
    nuclear: 1,
    polarity: 1,
    mirror: 1,
    diagonal: 1,
  };

  function revealText(language: DisplayLanguage): string {
    const scene = new CastScene(cast58, "reduced", 80);
    scene.skipToComplete(false); // fast-forward to the fully revealed title
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctxFor(language));
    return bufferText(buf);
  }

  test("English reveal: Chinese name anchor + English gloss + 'above' connective", () => {
    const text = revealText("en");
    expect(text).toContain("兌"); // canonical name anchor (shown in all modes)
    expect(text).toContain("above"); // structure connective (en)
    expect(text).toContain("Lakes joined"); // English gloss present in en mode
  });

  test("Traditional reveal: 兌 + 上 connective, no English gloss/connective", () => {
    const text = revealText("zh-Hant");
    expect(text).toContain("兌");
    expect(text).toContain("上"); // catalog cast.trigramConnective → 上
    expect(text).not.toContain("兑"); // no Simplified residue
    expect(text).not.toContain("above"); // no English connective
    expect(text).not.toContain("Joyous"); // English gloss dropped
  });

  test("Simplified reveal: 兌→兑, no Traditional residue, no English", () => {
    const text = revealText("zh-Hans");
    expect(text).toContain("兑");
    expect(text).toContain("上");
    expect(text).not.toContain("兌"); // converted, no Traditional residue
    expect(text).not.toContain("above");
    expect(text).not.toContain("Joyous");
  });
});

describe("BrowseScene rows — name conversion + no English in Chinese modes (KW58)", () => {
  // KW58 (兌) lives below the default viewport; scroll it into view.
  function browseAtKw58(language: DisplayLanguage): string {
    const scene = new BrowseScene();
    const model = scene.getModel();
    model.cursor = 57; // KW58 → index 57
    model.scrollOffset = 50;
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctxFor(language));
    return bufferText(buf);
  }

  test("English rows show Chinese name + English ename", () => {
    const text = browseAtKw58("en");
    expect(text).toContain("兌");
    expect(text).toContain("The Joyous");
  });

  test("Simplified rows convert the name and drop the English ename", () => {
    const text = browseAtKw58("zh-Hans");
    expect(text).toContain("兑");
    expect(text).not.toContain("兌"); // converted
    expect(text).not.toContain("The Joyous"); // no stray English in 简 mode
  });
});

describe("JournalScene rows — name conversion (KW20 觀)", () => {
  const entry: HistoryEntry = {
    date: "2026-06-02",
    cast: {
      lines: [makeLine(8), makeLine(8), makeLine(8), makeLine(8), makeLine(7), makeLine(7)],
      primary: 20, // 觀 / Contemplation
      becoming: null,
      changingPositions: [],
      nuclear: 1,
      polarity: 1,
      mirror: 1,
      diagonal: 1,
    },
  };

  function journalText(language: DisplayLanguage): string {
    const scene = new JournalScene([entry]);
    scene.enter(ctxFor(language));
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctxFor(language));
    return bufferText(buf);
  }

  test("English/Traditional journal shows 觀", () => {
    expect(journalText("en")).toContain("觀");
    expect(journalText("zh-Hant")).toContain("觀");
  });

  test("Simplified journal converts 觀→观, no Traditional residue", () => {
    const text = journalText("zh-Hans");
    expect(text).toContain("观");
    expect(text).not.toContain("觀");
  });

  test("English footer uses English nav verbs", () => {
    const text = journalText("en");
    expect(text).toContain("navigate");
    expect(text).toContain("view");
    expect(text).toContain("dictionary");
  });

  test("Simplified footer localizes nav verbs, no English leak", () => {
    const text = journalText("zh-Hans");
    expect(text).toContain("导览"); // navigate
    expect(text).toContain("检视"); // view
    expect(text).toContain("卦典"); // dictionary
    expect(text).toContain("返回"); // back
    expect(text).not.toContain("navigate");
    expect(text).not.toContain("view");
    expect(text).not.toContain("dictionary");
  });
});

describe("DetailScene footer — nav verbs honor language", () => {
  function detailText(language: DisplayLanguage): string {
    const model = new DetailModel(20); // 觀 / Contemplation
    const buf = CellBuffer.create(80, 24);
    renderDetail(buf, model, ctxFor(language), { language });
    return bufferText(buf);
  }

  test("English footer: scroll/derived/open/back", () => {
    const text = detailText("en");
    expect(text).toContain("scroll");
    expect(text).toContain("derived");
    expect(text).toContain("open");
    expect(text).toContain("back");
  });

  test("Simplified footer localizes, no English leak", () => {
    const text = detailText("zh-Hans");
    expect(text).toContain("卷动"); // scroll
    expect(text).toContain("衍卦"); // derived
    expect(text).toContain("开启"); // open
    expect(text).toContain("返回"); // back
    expect(text).not.toContain("scroll");
    expect(text).not.toContain("derived");
    expect(text).not.toContain("open");
  });

  test("Traditional footer localizes, no Simplified residue", () => {
    const text = detailText("zh-Hant");
    expect(text).toContain("捲動"); // scroll (Traditional)
    expect(text).toContain("衍卦"); // derived
    expect(text).not.toContain("scroll");
    expect(text).not.toContain("卷动"); // no Simplified residue
  });
});

// Regression (Codex P2 ×2): the large braille glyph was composed from the
// Traditional name even in zh-Hans, so a Traditional 兌 rendered above Simplified
// 兑 text. The atlas now carries Simplified name glyphs, and both the dictionary
// detail (DetailScene.enter) and the cast reveal (timeline buildGlyphReveal)
// compose from the Simplified name in zh-Hans. KW58 兌→兑 has a distinct glyph.
describe("Glyph composition honors language — Simplified glyphs in zh-Hans", () => {
  const glyphCfg = { glyphAnim: "dots", glyphFont: "kaiti" } as const;

  function detailGlyph(language: DisplayLanguage): string[] | undefined {
    const s = new DetailScene(58, glyphCfg, language);
    s.enter(ctxFor(language));
    return (s as unknown as { model: { glyphEntry: { rows: string[] } | null } }).model
      .glyphEntry?.rows;
  }

  test("dictionary detail glyph in zh-Hans differs from zh-Hant (兑 not 兌)", () => {
    const hant = detailGlyph("zh-Hant");
    const hans = detailGlyph("zh-Hans");
    expect(hant).toBeDefined();
    expect(hans).toBeDefined();
    expect(hans).not.toEqual(hant);
  });

  const cast58: Cast = {
    lines: [makeLine(7), makeLine(7), makeLine(8), makeLine(7), makeLine(7), makeLine(8)],
    primary: 58,
    becoming: null,
    changingPositions: [],
    nuclear: 1,
    polarity: 1,
    mirror: 1,
    diagonal: 1,
  };
  function castGlyph(language: DisplayLanguage): string[] | undefined {
    const s = new CastScene(cast58, "reduced", 80, glyphCfg, 24, undefined, { language });
    s.skipToComplete(false);
    return (s as unknown as { model: { primaryGlyphEntry: { rows: string[] } | null } }).model
      .primaryGlyphEntry?.rows;
  }

  test("cast reveal glyph in zh-Hans differs from zh-Hant", () => {
    const hant = castGlyph("zh-Hant");
    const hans = castGlyph("zh-Hans");
    expect(hant).toBeDefined();
    expect(hans).toBeDefined();
    expect(hans).not.toEqual(hant);
  });
});
