// Coin physics primitives — shared between TossScene and settings preview.

export const GRAVITY = 55;       // rows per second²
export const INITIAL_VY = -22;   // launch velocity (upward)
export const BOUNCE_DECAY = 0.42;
export const MAX_BOUNCES = 1;
export const FLIP_RATE = 9;      // full rotations per second while airborne

export const FLIP_FRAMES = ["◉", "◑", "│", "◐", "○", "◐", "│", "◑"];
export const SPIN_FRAMES = ["◉", "◑", "◐", "○", "◐", "◑"];

export interface CoinState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flipAngle: number;
  result: boolean;
  phase: "flying" | "bouncing" | "spinning" | "settled";
  bounces: number;
  landY: number;
  spinRate: number;
  spinDecay: number;
}

/** Advance one coin by dt milliseconds. Mutates coin in place. */
export function stepCoin(coin: CoinState, dt: number): void {
  if (coin.phase === "settled") return;

  const dtSec = dt / 1000;

  if (coin.phase === "spinning") {
    coin.flipAngle += coin.spinRate * dtSec * Math.PI * 2;
    coin.spinRate *= Math.pow(coin.spinDecay, dt / 16.67);
    if (coin.spinRate < 0.5) coin.phase = "settled";
    return;
  }

  coin.vy += GRAVITY * dtSec;
  coin.x += coin.vx * dtSec;
  coin.y += coin.vy * dtSec;
  coin.flipAngle += FLIP_RATE * dtSec * Math.PI * 2;

  if (coin.y >= coin.landY) {
    coin.y = coin.landY;
    if (coin.bounces < MAX_BOUNCES && Math.abs(coin.vy) > 3) {
      coin.phase = "bouncing";
      coin.vy *= -BOUNCE_DECAY;
      coin.vx *= 0.6;
      coin.bounces++;
    } else {
      const longSpin = Math.random() < 0.35;
      coin.phase = "spinning";
      coin.spinRate = FLIP_RATE * (0.45 + Math.random() * 0.2);
      coin.spinDecay = longSpin ? 0.97 : 0.85;
      coin.vy = 0;
      coin.vx = 0;
    }
  }
}

/** Horizontal offsets for a 3-coin spread around center. */
export const COIN_OFFSETS = [-5, 0, 5] as const;

/** Launch 3 coins simultaneously from cx, landing at landY. */
export function launchCoinSet(cx: number, landY: number): CoinState[] {
  return COIN_OFFSETS.map((dx, i) => ({
    x: cx + dx + (Math.random() - 0.5),
    y: landY - 1,
    vx: dx * 0.4 + (Math.random() - 0.5) * 1.5,
    vy: INITIAL_VY + (Math.random() - 0.5) * 6,
    flipAngle: i * (Math.PI * 2 / 3),
    result: Math.random() < 0.5,
    phase: "flying" as const,
    bounces: 0,
    landY,
    spinRate: 0,
    spinDecay: 0.9,
  }));
}

/** Returns the glyph character for the coin's current animation frame. */
export function coinFrame(coin: CoinState): string {
  if (coin.phase === "settled") return coin.result ? "◉" : "○";
  const frames = coin.phase === "spinning" ? SPIN_FRAMES : FLIP_FRAMES;
  return frames[
    Math.floor(((coin.flipAngle % (Math.PI * 2)) / (Math.PI * 2)) * frames.length) % frames.length
  ]!;
}
