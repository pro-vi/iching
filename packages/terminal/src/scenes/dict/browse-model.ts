// BrowseModel — cursor position, search state, filtered hexagram list

import type { Hexagram } from "@iching/core";
import { GUA, searchHexagrams } from "@iching/core";
import { offsetToShow } from "../../widgets/scroll.ts";

export class BrowseModel {
  /** All 64 hexagrams */
  readonly all: Hexagram[];

  /** Currently filtered list */
  filtered: Hexagram[];

  /** Cursor index within filtered list */
  cursor: number;

  /** Scroll offset (first visible row) */
  scrollOffset: number;

  /** Current search query */
  query: string;

  /** Whether search input is active */
  searchActive: boolean;

  /** Viewport height for list area (set by scene) */
  viewportHeight: number;

  constructor() {
    this.all = GUA;
    this.filtered = [...GUA];
    this.cursor = 0;
    this.scrollOffset = 0;
    this.query = "";
    this.searchActive = false;
    this.viewportHeight = 20;
  }

  /** Update search query and re-filter */
  setQuery(query: string): void {
    this.query = query;
    this.filtered = query.length > 0 ? searchHexagrams(query) : [...this.all];
    // Clamp cursor
    if (this.cursor >= this.filtered.length) {
      this.cursor = Math.max(0, this.filtered.length - 1);
    }
    // Reset scroll to keep cursor visible
    this.ensureCursorVisible();
  }

  /** Move cursor up, clamping at top */
  cursorUp(): void {
    if (this.cursor > 0) {
      this.cursor--;
      this.ensureCursorVisible();
    }
  }

  /** Move cursor down, clamping at bottom */
  cursorDown(): void {
    if (this.cursor < this.filtered.length - 1) {
      this.cursor++;
      this.ensureCursorVisible();
    }
  }

  /** Page up — move cursor by viewport height */
  pageUp(): void {
    this.cursor = Math.max(0, this.cursor - this.viewportHeight);
    this.ensureCursorVisible();
  }

  /** Page down — move cursor by viewport height */
  pageDown(): void {
    this.cursor = Math.min(
      this.filtered.length - 1,
      this.cursor + this.viewportHeight,
    );
    this.ensureCursorVisible();
  }

  /** Get the currently selected hexagram */
  selectedHexagram(): Hexagram | undefined {
    return this.filtered[this.cursor];
  }

  /** Get the KW number (1-based) of the selected hexagram */
  selectedKW(): number | undefined {
    const hex = this.selectedHexagram();
    if (!hex) return undefined;
    return this.all.indexOf(hex) + 1;
  }

  /** Ensure cursor is within visible scroll window */
  private ensureCursorVisible(): void {
    this.scrollOffset = offsetToShow(this.cursor, this.scrollOffset, this.viewportHeight);
  }
}
