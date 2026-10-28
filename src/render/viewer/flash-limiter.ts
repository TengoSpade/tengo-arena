/**
 * The global flash limit (04 §9: no flashing above 3 per second; accessibility). Per fighter, flashes (a hit flash,
 * an impact burst, a heal pulse...) start at least 1000 / limit ms apart in WALL time, so they are spread evenly
 * (never a burst of three in 75 ms) and 4x playback cannot raise the rate: any closed one-second window holds at
 * most `limitPerSecond` flash starts. A refused flash is drawn dimmed by its caller, never dropped: the cue (and
 * its number) still reads. Presentation only: it never affects results.
 *
 * Flashes asked for in the same frame (the same wall-clock instant, within `JOIN_MS`) for one fighter are one flash (the token flash
 * and the impact burst of the same hit start together): they share the first one's decision and count once.
 */
export const JOIN_MS = 1;

interface FlashRecord {
  /** Wall time the last admitted flash started. */
  lastStart: number;
  /** When the last decision was taken, and what it was (for joining). */
  lastAt: number;
  lastResult: boolean;
}

export class FlashLimiter {
  private readonly records = new Map<number, FlashRecord>();

  constructor(private limitPerSecond: number) {}

  setLimit(limitPerSecond: number): void {
    this.limitPerSecond = limitPerSecond;
  }

  /** The least wall time between two flash starts of one fighter, ms. */
  get spacingMs(): number {
    const limit = Math.floor(this.limitPerSecond);
    return limit <= 0 ? Number.POSITIVE_INFINITY : Math.ceil(1000 / limit) + 1;
  }

  /** Try to start a flash for `key` at wall time `nowMs`. */
  admit(key: number, nowMs: number): boolean {
    const spacing = this.spacingMs;
    if (!Number.isFinite(spacing)) return false;
    let rec = this.records.get(key);
    if (!rec) {
      rec = { lastStart: Number.NEGATIVE_INFINITY, lastAt: Number.NEGATIVE_INFINITY, lastResult: false };
      this.records.set(key, rec);
    }
    const sinceDecision = nowMs - rec.lastAt;
    if (sinceDecision >= 0 && sinceDecision < JOIN_MS) return rec.lastResult;
    const ok = nowMs - rec.lastStart >= spacing || nowMs < rec.lastStart; // a clock that went backwards (new round) starts afresh
    if (ok) rec.lastStart = nowMs;
    rec.lastAt = nowMs;
    rec.lastResult = ok;
    return ok;
  }

  reset(): void {
    this.records.clear();
  }
}
