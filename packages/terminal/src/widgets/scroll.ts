// Scroll / viewport math shared by list and content views.
//
// Two patterns live here:
//   - free-scroll: a scroll offset over `contentLength` lines (ScrollableRegion,
//     detail content) — clamp the offset, render a page indicator.
//   - cursor-into-view: a focused index that must stay within a viewport window
//     (browse list, settings rows) — derive the offset/window from the cursor.

/** Clamp a scroll offset into the valid range `[0, max(0, contentLength - viewport)]`. */
export function clampOffset(offset: number, contentLength: number, viewport: number): number {
  return Math.max(0, Math.min(offset, Math.max(0, contentLength - viewport)));
}

/**
 * New scroll offset that keeps `cursor` within a `viewport`-sized window,
 * scrolling only when the cursor leaves the window (stateful list navigation).
 */
export function offsetToShow(cursor: number, offset: number, viewport: number): number {
  if (cursor < offset) return cursor;
  if (cursor >= offset + viewport) return cursor - viewport + 1;
  return offset;
}

/**
 * Stateless visible window `[start, end)` of at most `viewport` items over
 * `total`, positioned to include `cursor` with minimal scrolling. Used where the
 * offset isn't retained between renders (e.g. the settings rows).
 */
export function windowFor(
  cursor: number,
  viewport: number,
  total: number,
): { start: number; end: number } {
  if (viewport >= total) return { start: 0, end: total };
  const start = Math.max(0, Math.min(cursor - viewport + 1, total - viewport));
  return { start, end: start + viewport };
}

/** Page indicator like `"2/5"` for a free-scroll region; `"1/1"` when it all fits. */
export function pageIndicator(offset: number, contentLength: number, viewport: number): string {
  if (contentLength <= viewport) return "1/1";
  return `${Math.floor(offset / viewport) + 1}/${Math.ceil(contentLength / viewport)}`;
}
