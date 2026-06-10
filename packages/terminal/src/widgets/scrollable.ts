// ScrollableRegion — virtual content with viewport windowing.
// Scroll math lives in ./scroll.ts so list views (browse/settings) share it.

import { clampOffset, offsetToShow, pageIndicator } from "./scroll.ts";

export class ScrollableRegion {
  contentLines: string[];
  scrollOffset: number;
  viewportHeight: number;

  constructor(viewportHeight: number, contentLines: string[] = []) {
    this.viewportHeight = viewportHeight;
    this.contentLines = contentLines;
    this.scrollOffset = 0;
  }

  /** Scroll up by n lines (default 1) */
  scrollUp(n = 1): void {
    this.scrollOffset = clampOffset(this.scrollOffset - n, this.contentLines.length, this.viewportHeight);
  }

  /** Scroll down by n lines (default 1) */
  scrollDown(n = 1): void {
    this.scrollOffset = clampOffset(this.scrollOffset + n, this.contentLines.length, this.viewportHeight);
  }

  /** Scroll up by one page */
  pageUp(): void {
    this.scrollUp(this.viewportHeight);
  }

  /** Scroll down by one page */
  pageDown(): void {
    this.scrollDown(this.viewportHeight);
  }

  /** Scroll to the first line */
  scrollToTop(): void {
    this.scrollOffset = 0;
  }

  /** Scroll to the last page */
  scrollToBottom(): void {
    this.scrollOffset = clampOffset(Infinity, this.contentLines.length, this.viewportHeight);
  }

  /** Adjust the offset to keep a cursor index within the viewport (list navigation). */
  ensureVisible(cursor: number): void {
    this.scrollOffset = offsetToShow(cursor, this.scrollOffset, this.viewportHeight);
  }

  /** Return the visible slice of content */
  visibleLines(): string[] {
    return this.contentLines.slice(
      this.scrollOffset,
      this.scrollOffset + this.viewportHeight,
    );
  }

  /** Scroll position indicator, e.g. "3/42" */
  scrollIndicator(): string {
    return pageIndicator(this.scrollOffset, this.contentLines.length, this.viewportHeight);
  }
}
