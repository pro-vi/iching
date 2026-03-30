// Easing functions — Robert Penner style, normalized 0-1

export type EasingFn = (t: number) => number;

/** Linear interpolation: no acceleration. */
export const linear: EasingFn = (t) => t;

/** Quadratic ease-in: accelerating from zero velocity. */
export const easeIn: EasingFn = (t) => t * t;

/** Quadratic ease-out: decelerating to zero velocity. */
export const easeOut: EasingFn = (t) => 1 - (1 - t) * (1 - t);

/** Quadratic ease-in-out: acceleration until halfway, then deceleration. */
export const easeInOut: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
