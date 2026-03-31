// ScrollableRegion — virtual content with viewport windowing

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
    this.scrollOffset = Math.max(0, this.scrollOffset - n);
  }

  /** Scroll down by n lines (default 1) */
  scrollDown(n = 1): void {
    this.scrollOffset = Math.min(this.maxOffset(), this.scrollOffset + n);
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
    this.scrollOffset = this.maxOffset();
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
    const total = this.contentLines.length;
    if (total <= this.viewportHeight) return "1/1";
    const page = Math.floor(this.scrollOffset / this.viewportHeight) + 1;
    const totalPages = Math.ceil(total / this.viewportHeight);
    return `${page}/${totalPages}`;
  }

  /** Maximum valid scroll offset */
  private maxOffset(): number {
    return Math.max(0, this.contentLines.length - this.viewportHeight);
  }
}
