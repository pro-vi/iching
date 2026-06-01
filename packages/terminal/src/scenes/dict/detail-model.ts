// DetailModel — scroll position, focused section, selected derived link

import {
  type HexagramDetail,
  type GlyphEntry,
  type DerivedType,
  buildHexagramDetail,
} from "@iching/core";
import type { GlyphAnimator } from "../../glyph-anim/types.ts";

export type DetailFocus = "content" | "derived";

export interface DerivedLink {
  op: DerivedType;
  label: string;
  labelCn: string;
  kw: number;
  symbol: string;
  name: string;
  ename: string;
  oracle?: string;
  oracleEn?: string;
}

export class DetailModel {
  readonly detail: HexagramDetail;
  readonly derivedLinks: DerivedLink[];

  /** Scroll offset for content */
  scrollOffset: number;

  /** Which section has focus */
  focus: DetailFocus;

  /** Selected derived link index */
  derivedCursor: number;

  /** Total content lines (set after building content) */
  contentHeight: number;

  /** Viewport height for scrollable content */
  viewportHeight: number;

  /** History info (set externally) */
  castCount: number;
  lastCastDate: string | null;

  /** Large glyph animation */
  glyphAnimator: GlyphAnimator | null;
  glyphEntry: GlyphEntry | null;
  glyphAnimDone: boolean;

  constructor(kw: number) {
    this.detail = buildHexagramDetail(kw);
    this.scrollOffset = 0;
    this.focus = "content";
    this.derivedCursor = 0;
    this.contentHeight = 0;
    this.viewportHeight = 20;
    this.castCount = 0;
    this.lastCastDate = null;

    this.glyphAnimator = null;
    this.glyphEntry = null;
    this.glyphAnimDone = false;

    const d = this.detail;
    this.derivedLinks = [
      {
        op: "nuclear",
        label: "Nuclear",
        labelCn: "互卦",
        kw: d.nuclear.kw,
        symbol: d.nuclear.gua.u,
        name: d.nuclear.gua.n,
        ename: d.nuclear.gua.ename,
        oracle: d.nuclear.gua.gc,
        oracleEn: d.nuclear.gua.gcEn,
      },
      {
        op: "polarity",
        label: "Polarity",
        labelCn: "錯卦",
        kw: d.polarity.kw,
        symbol: d.polarity.gua.u,
        name: d.polarity.gua.n,
        ename: d.polarity.gua.ename,
        oracle: d.polarity.gua.gc,
        oracleEn: d.polarity.gua.gcEn,
      },
      {
        op: "mirror",
        label: "Mirror",
        labelCn: "綜卦",
        kw: d.mirror.kw,
        symbol: d.mirror.gua.u,
        name: d.mirror.gua.n,
        ename: d.mirror.gua.ename,
        oracle: d.mirror.gua.gc,
        oracleEn: d.mirror.gua.gcEn,
      },
      {
        op: "diagonal",
        label: "Diagonal",
        labelCn: "對角",
        kw: d.diagonal.kw,
        symbol: d.diagonal.gua.u,
        name: d.diagonal.gua.n,
        ename: d.diagonal.gua.ename,
        oracle: d.diagonal.gua.gc,
        oracleEn: d.diagonal.gua.gcEn,
      },
    ];
  }

  scrollUp(n = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - n);
  }

  scrollDown(n = 1): void {
    const max = Math.max(0, this.contentHeight - this.viewportHeight);
    this.scrollOffset = Math.min(max, this.scrollOffset + n);
  }

  pageUp(): void {
    this.scrollUp(this.viewportHeight);
  }

  pageDown(): void {
    this.scrollDown(this.viewportHeight);
  }

  derivedUp(): void {
    if (this.derivedCursor > 0) this.derivedCursor--;
  }

  derivedDown(): void {
    if (this.derivedCursor < this.derivedLinks.length - 1) this.derivedCursor++;
  }

  selectedDerivedKW(): number {
    return this.derivedLinks[this.derivedCursor].kw;
  }

  selectedShuoguaChapter(): number | undefined {
    const op = this.derivedLinks[this.derivedCursor].op;
    return this.detail.connections.shuoguaCitations.find(
      (citation) => citation.op === op,
    )?.chapter;
  }

  selectedShuoguaCitation(): { chapter: number; op: DerivedType } | undefined {
    const op = this.derivedLinks[this.derivedCursor].op;
    const chapter = this.selectedShuoguaChapter();
    return chapter === undefined ? undefined : { chapter, op };
  }
}
