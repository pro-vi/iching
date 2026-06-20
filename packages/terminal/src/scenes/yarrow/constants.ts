// Shared yarrow-ritual dimensions used by both the auto preview and the manual
// scene. Per-scene values (SNAP_HOLD_MS, the sweep bounds, stalk/atom counts) stay
// in their scenes; these two must match so the aperture animates alike in both.

/** Aperture width in stalks — the moving gap the sweep animates across. */
export const APERTURE_WIDTH = 4;
/** Milliseconds per cell of aperture travel during a sweep. */
export const SWEEP_INTERVAL_MS = 150;
