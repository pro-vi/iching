// Clock — injectable time source for testability

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

/** Real clock — uses performance.now() and setTimeout (works under Bun and Node). */
export class RealClock implements Clock {
  now(): number {
    return performance.now();
  }

  async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Manual clock for deterministic testing. */
export class ManualClock implements Clock {
  private time = 0;

  now(): number {
    return this.time;
  }

  async sleep(_ms: number): Promise<void> {
    // no-op — test code advances time explicitly
  }

  /** Advance time by the given number of milliseconds. */
  advance(ms: number): void {
    this.time += ms;
  }
}
