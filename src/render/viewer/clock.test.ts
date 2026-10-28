import { describe, expect, it } from 'vitest';
import { MAX_DT_MS, PlaybackClock, TICK_MS } from './clock';

describe('PlaybackClock', () => {
  it('advances tick += dt x speed / 50 at 1x, 2x and 4x', () => {
    for (const speed of [1, 2, 4] as const) {
      const c = new PlaybackClock('replay', 0, 1000);
      c.setSpeed(speed);
      c.play();
      expect(c.plan(50)).toBeCloseTo(speed, 10);
      expect(c.plan(100)).toBeCloseTo(2 * speed, 10);
    }
    expect(TICK_MS).toBe(50);
  });

  it('clamps one frame to 100 ms (no jump after a hidden tab) and never moves backwards', () => {
    const c = new PlaybackClock('replay', 10, 1000);
    c.play();
    expect(c.plan(60_000)).toBeCloseTo(10 + MAX_DT_MS / TICK_MS, 10);
    expect(c.plan(-5)).toBe(10);
    expect(c.plan(Number.NaN)).toBe(10);
  });

  it('caps a replay at its end and reports it', () => {
    const c = new PlaybackClock('replay', 1195, 1200);
    c.setSpeed(4);
    expect(c.plan(100)).toBe(1200);
    c.commit(1200);
    expect(c.atEnd).toBe(true);
    expect(c.end).toBe(1200);
    expect(c.head).toBe(1200);
  });

  it('seeks anywhere in a replay, clamped to [0, end], and leaves the play state alone', () => {
    const c = new PlaybackClock('replay', 0, 1200);
    c.play();
    expect(c.seek(600)).toBe(600);
    expect(c.playing).toBe(true);
    expect(c.seek(-40)).toBe(0);
    expect(c.seek(5000)).toBe(1200);
    expect(c.seek(Number.NaN)).toBe(0);
    c.pause();
    expect(c.seek(33.5)).toBe(33.5);
    expect(c.playing).toBe(false);
  });

  it('a live clock never seeks past the head, and the end is unknown until marked', () => {
    const c = new PlaybackClock('live', 200, null);
    expect(c.end).toBeNull();
    expect(c.head).toBe(200);
    expect(c.seek(900)).toBe(200);
    c.commit(260);
    expect(c.head).toBe(260);
    expect(c.seek(900)).toBe(260);
    expect(c.seek(10)).toBe(10);
    expect(c.rewound).toBe(true);
    c.commit(40);
    expect(c.head).toBe(260); // the head only moves forward
    c.markEnd(500);
    expect(c.end).toBe(500);
  });

  it('a live plan is open-ended (the end is not known to the clock)', () => {
    const c = new PlaybackClock('live', 0, null);
    c.setSpeed(4);
    expect(c.plan(100)).toBeCloseTo(8, 10);
  });

  it('only 1, 2 and 4 are speeds', () => {
    const c = new PlaybackClock('replay', 0, 100);
    c.setSpeed(2);
    expect(c.speed).toBe(2);
    c.setSpeed(3 as never);
    expect(c.speed).toBe(1);
  });

  it('starts a replay at its end-bounded start tick, with the head at the end', () => {
    const c = new PlaybackClock('replay', 5000, 1200);
    expect(c.tick).toBe(1200);
    expect(c.head).toBe(1200);
  });
});
