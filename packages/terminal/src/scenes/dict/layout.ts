// Shared dict-scene layout dimensions.

/**
 * The dict footer occupies two terminal rows — a separator line plus the
 * keybinding/status line. Browse and detail both subtract this from the terminal
 * row count to size their scroll viewports, so the three dict surfaces must agree
 * on it; keep it here, not copied per file. (HEADER_ROWS stays local to browse —
 * only one surface has a header.)
 */
export const FOOTER_ROWS = 2;
