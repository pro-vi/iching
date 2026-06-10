// DetailModel — scroll position, focused section, selected derived link

import { type HexagramDetail, type GlyphEntry, buildHexagramDetail } from "@iching/core";
import type { GlyphAnimator } from "../../glyph-anim/types.ts";
import { clampOffset } from "../../widgets/scroll.ts";

export type DetailFocus = "content" | "derived";

export interface DerivedLink {
  label: string;
  labelCn: string;
  kw: number;
  symbol: string;
  name: string;
  ename: string;
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
        label: "Nuclear",
        labelCn: "互卦",
        kw: d.nuclear.kw,
        symbol: d.nuclear.gua.u,
        name: d.nuclear.gua.n,
        ename: d.nuclear.gua.ename,
      },
      {
        label: "Polarity",
        labelCn: "錯卦",
        kw: d.polarity.kw,
        symbol: d.polarity.gua.u,
        name: d.polarity.gua.n,
        ename: d.polarity.gua.ename,
      },
      {
        label: "Mirror",
        labelCn: "綜卦",
        kw: d.mirror.kw,
        symbol: d.mirror.gua.u,
        name: d.mirror.gua.n,
        ename: d.mirror.gua.ename,
      },
      {
        label: "Diagonal",
        labelCn: "對角",
        kw: d.diagonal.kw,
        symbol: d.diagonal.gua.u,
        name: d.diagonal.gua.n,
        ename: d.diagonal.gua.ename,
      },
    ];
  }

  scrollUp(n = 1): void {
    this.scrollOffset = clampOffset(this.scrollOffset - n, this.contentHeight, this.viewportHeight);
  }

  scrollDown(n = 1): void {
    this.scrollOffset = clampOffset(this.scrollOffset + n, this.contentHeight, this.viewportHeight);
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
}
