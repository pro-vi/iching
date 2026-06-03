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
    // option-value badges remain verbatim (canonical anchors per glossary)
    expect(text).toContain("繁");
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
