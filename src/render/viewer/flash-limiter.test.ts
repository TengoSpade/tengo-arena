import { describe, expect, it } from 'vitest';
import { FlashLimiter, JOIN_MS } from './flash-limiter';

describe('FlashLimiter (04 §9: at most 3 flashes a second)', () => {
  it('spaces flashes at least a third of a second apart', () => {
    const l = new FlashLimiter(3);
    expect(l.spacingMs).toBe(335);
    expect(l.admit(1, 0)).toBe(true);
    expect(l.admit(1, 100)).toBe(false);
    expect(l.admit(1, 334)).toBe(false);
    expect(l.admit(1, 335)).toBe(true);
    expect(l.admit(1, 670)).toBe(true);
    expect(l.admit(1, 1000)).toBe(false);
    expect(l.admit(1, 1005)).toBe(true);
  });

  it('counts per fighter', () => {
    const l = new FlashLimiter(3);
    expect(l.admit(1, 0)).toBe(true);
    expect(l.admit(1, 50)).toBe(false);
    expect(l.admit(2, 50)).toBe(true);
  });

  it('never exceeds the limit in any closed 1000 ms window, whatever the ask rate (4x playback)', () => {
    for (const askEvery of [7, 16, 25, 50, 90, 333]) {
      const l = new FlashLimiter(3);
      const admitted: number[] = [];
      for (let t = 0; t < 20_000; t += askEvery) if (l.admit(7, t)) admitted.push(t);
      for (const t0 of admitted) expect(admitted.filter((t) => t >= t0 && t <= t0 + 1000).length).toBeLessThanOrEqual(3);
      expect(admitted.length).toBeGreaterThan(25); // it still lets flashes through, evenly
    }
  });

  it('treats asks within JOIN_MS (one frame) as one flash: the token flash and the impact of the same hit', () => {
    const l = new FlashLimiter(3);
    expect(l.admit(1, 0)).toBe(true);
    expect(l.admit(1, JOIN_MS - 1)).toBe(true); // joined, not counted
    expect(l.admit(1, 100)).toBe(false);
    expect(l.admit(1, 100 + JOIN_MS - 1)).toBe(false); // a joined refusal stays refused
    expect(l.admit(1, 335)).toBe(true);
  });

  it('honours a lower limit and a limit of zero', () => {
    const l = new FlashLimiter(1);
    expect(l.admit(1, 0)).toBe(true);
    expect(l.admit(1, 500)).toBe(false);
    expect(l.admit(1, 1001)).toBe(true);
    l.setLimit(0);
    expect(l.admit(2, 0)).toBe(false);
  });

  it('forgets everything on reset and starts afresh if the clock goes backwards', () => {
    const l = new FlashLimiter(1);
    expect(l.admit(1, 5000)).toBe(true);
    expect(l.admit(1, 100)).toBe(true); // a new round's clock
    l.reset();
    expect(l.admit(1, 101)).toBe(true);
  });
});
