// Scroll / viewport math shared by list and content views.
//
// Two patterns live here:
//   - free-scroll: a scroll offset over `contentLength` lines (ScrollableRegion,
//     detail content) — clamp the offset, render a page indicator.
//   - cursor-into-view: a focused index that must stay within a viewport window
//     (browse list, settings rows) — derive the offset/window from the cursor.

import { clamp } from "@iching/core";

/** The furthest a free-scroll region can scroll: the last offset that still fills
 *  the viewport, or 0 when the content fits. The ceiling clampOffset enforces, the
 *  page indicator's final page, and where "scroll to end" lands. */
export function maxOffset(contentLength: number, viewport: number): number {
  return Math.max(0, contentLength - viewport);
}

/** Clamp a scroll offset into the valid range `[0, maxOffset(contentLength, viewport)]`. */
export function clampOffset(offset: number, contentLength: number, viewport: number): number {
  return clamp(offset, 0, maxOffset(contentLength, viewport));
}

/** The highest valid index into a list of `length` items, or 0 when empty — the
 *  ceiling for a list cursor (never -1, so an empty list keeps the cursor at 0). */
export function lastIndex(length: number): number {
  return Math.max(0, length - 1);
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
  const start = clamp(cursor - viewport + 1, 0, total - viewport);
  return { start, end: start + viewport };
}

/** Page indicator like `"2/5"` for a free-scroll region; `"1/1"` when it all fits. */
export function pageIndicator(offset: number, contentLength: number, viewport: number): string {
  if (contentLength <= viewport) return "1/1";
  const pages = Math.ceil(contentLength / viewport);
  // Line-at-a-time scrolling lands at the last possible offset (content −
  // viewport), which need not be a whole-page multiple — so floor(offset/
  // viewport)+1 can never reach the final page. Snap to it once scrolled to the
  // bottom, where the last content row is already on screen.
  const ceiling = maxOffset(contentLength, viewport);
  const page = offset >= ceiling ? pages : Math.floor(offset / viewport) + 1;
  return `${page}/${pages}`;
}
