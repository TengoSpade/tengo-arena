/**
 * Acceptance A13 (WP-M2C): sampleAt p95 ≤ 1 ms per call in Node on a 1,500-tick round. The figures are written to
 * stdout so the package report can quote them. The 1,500-tick round is the fixture "long": a real simulator round that
 * ran to the hard cap (time-limit), 3,000+ events, overtime from tick 900.
 */
import { stdout } from 'node:process';
import { describe, expect, it } from 'vitest';
import { autoPauseStops, indexFightLog, keyMoments, sampleAt, samePrefix } from './index';
import { defaultContent, defaultCues, eventsOf, loadFixture, makeCtx } from './support.mts';

const percentile = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

describe('performance on a 1,500-tick round', () => {
  const content = defaultContent();
  const cues = defaultCues();
  const { log, meta } = loadFixture('long');
  const ctx = makeCtx(log, content);

  it('the round is the 1,500-tick time-limit round with thousands of events', () => {
    expect(meta.durationTicks).toBe(1500);
    expect(log.events.length).toBeGreaterThan(3000);
    expect(eventsOf(log, 'fight.end')[0]!.data!.reason).toBe('time-limit');
  });

  it('sampleAt p95 ≤ 1 ms per call (random ticks, all 10 units, effects, statuses, telegraphs)', () => {
    const index = indexFightLog(log, content, cues, 'replay');
    let seed = 12345;
    const random = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 300; i++) sampleAt(index, random() * 1499, ctx); // warm up the JIT
    const times: number[] = [];
    let busy = 0;
    for (let i = 0; i < 4000; i++) {
      const tick = random() * 1499;
      const t0 = performance.now();
      const s = sampleAt(index, tick, ctx);
      times.push(performance.now() - t0);
      busy += s.effects.length + s.telegraphs.length;
    }
    expect(busy).toBeGreaterThan(1000); // the samples were not trivially empty
    times.sort((a, b) => a - b);
    const p50 = percentile(times, 0.5);
    const p95 = percentile(times, 0.95);
    const p99 = percentile(times, 0.99);
    stdout.write(`[WP-M2C] sampleAt on a 1500-tick round (${log.events.length} events): p50 ${(p50 * 1000).toFixed(0)} us, p95 ${(p95 * 1000).toFixed(0)} us, p99 ${(p99 * 1000).toFixed(0)} us, max ${(times[times.length - 1]! * 1000).toFixed(0)} us over ${times.length} calls\n`);
    expect(p95).toBeLessThanOrEqual(1);
  });

  it('sampling a 1x playback in order is as cheap (every 1/3 tick, 60 fps)', () => {
    const index = indexFightLog(log, content, cues, 'replay');
    const times: number[] = [];
    for (let t = 0; t <= 1499; t += 1 / 3) {
      const t0 = performance.now();
      sampleAt(index, t, ctx);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    stdout.write(`[WP-M2C] sampleAt in playback order: p50 ${(percentile(times, 0.5) * 1000).toFixed(0)} us, p95 ${(percentile(times, 0.95) * 1000).toFixed(0)} us over ${times.length} calls\n`);
    expect(percentile(times, 0.95)).toBeLessThanOrEqual(1);
  });

  it('indexing the round and answering the bounded queries is cheap (round load budget: median 15 ms with the sim)', () => {
    const times: number[] = [];
    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      indexFightLog(log, content, cues, 'live');
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const index = indexFightLog(log, content, cues, 'replay');
    const q0 = performance.now();
    for (let i = 0; i < 200; i++) {
      keyMoments(index, ctx, 1500);
      autoPauseStops(index, { ownDowned: true, enemyDowned: true, ownCaptainDown: true, overtime: true, ownHpBelowPct: 50 }, ctx, 1500);
    }
    const queryMs = (performance.now() - q0) / 200;
    stdout.write(`[WP-M2C] indexFightLog: median ${percentile(times, 0.5).toFixed(2)} ms, p99 ${percentile(times, 0.99).toFixed(2)} ms; keyMoments + autoPauseStops: ${queryMs.toFixed(3)} ms per pair\n`);
    expect(percentile(times, 0.5)).toBeLessThan(15);
    expect(queryMs).toBeLessThan(2);
  });

  it('the live-call prefix check of two full rounds is a few milliseconds (log swap budget: 30 ms while paused)', () => {
    const a = indexFightLog(log, content, cues, 'live');
    const b = indexFightLog({ ...log, events: log.events.map((e) => ({ ...e })) }, content, cues, 'live');
    const times: number[] = [];
    for (let i = 0; i < 15; i++) {
      const t0 = performance.now();
      expect(samePrefix(a, b, 1500)).toBe(true);
      times.push(performance.now() - t0);
    }
    times.sort((x, y) => x - y);
    stdout.write(`[WP-M2C] samePrefix over ${log.events.length} events: median ${percentile(times, 0.5).toFixed(2)} ms, max ${times[times.length - 1]!.toFixed(2)} ms\n`);
    expect(percentile(times, 0.5)).toBeLessThan(10);
  });
});
