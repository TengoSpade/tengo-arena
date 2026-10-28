import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TARGETS, analyzeHeap, analyzeSaveTrace, intervalsOf, median, percentile, playingIntervals, stoppedAtEnd, summarizeIntervals, type FrameSeries, type TraceMark } from './stats';

/** A steady 60 Hz series whose tick advances 3 per frame (4x) until `stopAtMs`, holds, then advances again from `resumeAtMs`. */
function series(opts: { frames: number; stopAtMs?: number; resumeAtMs?: number; hitchAtMs?: number; hitchMs?: number; tickEveryFrames?: number }): FrameSeries {
  const t: number[] = [];
  const tick: number[] = [];
  let now = 1000;
  let k = 0;
  for (let i = 0; i < opts.frames; i++) {
    const rel = now - 1000;
    t.push(now);
    const stopped = opts.stopAtMs !== undefined && rel >= opts.stopAtMs && (opts.resumeAtMs === undefined || rel < opts.resumeAtMs);
    if (!stopped) k += 3;
    // A HUD-fed tick (at most 10 Hz) only changes every few frames; the stop is seen at the next update.
    const every = opts.tickEveryFrames ?? 1;
    tick.push(i % every === 0 || stopped ? k : (tick[i - 1] ?? k));
    now += 1000 / 60;
    if (opts.hitchAtMs !== undefined && rel < opts.hitchAtMs && rel + 1000 / 60 >= opts.hitchAtMs) now += opts.hitchMs ?? 0;
  }
  return { t, tick };
}

describe('percentiles and summaries', () => {
  it('nearest-rank percentile and median', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
    expect(percentile([5, 1, 3, 2, 4], 20)).toBe(1);
    expect(median([10, 20])).toBe(10);
    expect(Number.isNaN(percentile([], 50))).toBe(true);
  });

  it('summarizes a 60 fps series', () => {
    const iv = intervalsOf(series({ frames: 301 }).t);
    const s = summarizeIntervals(iv);
    expect(s.frames).toBe(300);
    expect(s.fps).toBeCloseTo(60, 1);
    expect(s.medianFps).toBeCloseTo(60, 1);
    expect(s.p95Ms).toBeCloseTo(16.67, 1);
    expect(s.over20).toBe(0);
    expect(s.over33).toBe(0);
  });

  it('counts the slow frames', () => {
    const s = summarizeIntervals([16, 16, 25, 40, 16]);
    expect(s.over20).toBe(2);
    expect(s.over33).toBe(1);
    expect(s.maxMs).toBe(40);
  });

  it('tolerates one skipped vsync but not two (33.5 ms limit)', () => {
    expect(summarizeIntervals([33.4]).over33).toBe(0);
    expect(summarizeIntervals([50]).over33).toBe(1);
    expect(TARGETS.maxIntervalMs).toBeGreaterThan(33.34);
  });
});

describe('steady-play intervals', () => {
  it('leaves out the stop and the restart', () => {
    const s = series({ frames: 400, stopAtMs: 2000, resumeAtMs: 3000 });
    const all = intervalsOf(s.t).length;
    const playing = playingIntervals(s, 5);
    expect(playing.length).toBeLessThan(all - 55);
    expect(playing.every((v) => v < 18)).toBe(true);
  });

  it('works on a tick that only updates every 6th frame (the HUD frame, 10 Hz)', () => {
    const s = series({ frames: 400, stopAtMs: 2000, resumeAtMs: 3000, tickEveryFrames: 6 });
    const playing = playingIntervals(s, 5);
    expect(playing.length).toBeGreaterThan(150);
    expect(playing.length).toBeLessThan(intervalsOf(s.t).length - 40);
    expect(playing.every((v) => v < 18)).toBe(true);
  });

  it('a series that never advances has no playing intervals', () => {
    const t = [0, 16, 33, 50, 66];
    expect(playingIntervals({ t, tick: [7, 7, 7, 7, 7] }).length).toBe(0);
  });

  it('detects a stop at the end of a series, by time', () => {
    expect(stoppedAtEnd(series({ frames: 200, stopAtMs: 1000 }), 300)).toBe(true);
    expect(stoppedAtEnd(series({ frames: 200 }), 300)).toBe(false);
    expect(stoppedAtEnd({ t: [0, 1], tick: [NaN, NaN] }, 1)).toBe(false);
  });

  it('does not take the gap between two 10 Hz updates for a stop', () => {
    const s = series({ frames: 200, tickEveryFrames: 6 });
    for (let n = 30; n < 200; n++) expect(stoppedAtEnd({ t: s.t.slice(0, n), tick: s.tick.slice(0, n) }, 300)).toBe(false);
  });

  it('a series shorter than the window cannot be called stopped', () => {
    expect(stoppedAtEnd({ t: [0, 16, 33], tick: [5, 5, 5] }, 300)).toBe(false);
  });
});

describe('cursor-save trace analysis (A11 test-first item 5)', () => {
  const marks = (s: FrameSeries, stop: number, resume: number): TraceMark[] => [
    { name: 'play', t: s.t[0]! },
    { name: 'stopped', t: 1000 + stop },
    { name: 'saved', t: 1000 + resume - 1 },
    { name: 'resume', t: 1000 + resume },
    { name: 'end', t: s.t[s.t.length - 1]! },
  ];

  it('passes a clean trace across a stop and a resume', () => {
    const s = series({ frames: 300, stopAtMs: 1500, resumeAtMs: 2500 });
    const a = analyzeSaveTrace(s, marks(s, 1500, 2500));
    expect(a.complete).toBe(true);
    expect(a.over33).toBe(0);
    expect(a.maxMs).toBeLessThan(18);
    expect(a.phases.stopped.frames).toBeGreaterThan(50);
    expect(a.phases.playing.frames).toBeGreaterThan(50);
    expect(a.phases.resumed.frames).toBeGreaterThan(50);
  });

  it('finds a save hitch in the stopped phase and says where it was', () => {
    const s = series({ frames: 300, stopAtMs: 1500, resumeAtMs: 2500, hitchAtMs: 1700, hitchMs: 45 });
    const a = analyzeSaveTrace(s, marks(s, 1500, 2500));
    expect(a.over33).toBe(1);
    expect(a.worst?.phase).toBe('stopped');
    expect(a.worst?.ms).toBeGreaterThan(55);
    expect(a.worst?.offsetFromStopMs).toBeGreaterThan(150);
    expect(a.worst?.offsetFromStopMs).toBeLessThan(300);
  });

  it('finds a hitch on the resume', () => {
    const s = series({ frames: 300, stopAtMs: 1500, resumeAtMs: 2500, hitchAtMs: 2520, hitchMs: 60 });
    const a = analyzeSaveTrace(s, marks(s, 1500, 2500));
    expect(a.worst?.phase).toBe('resumed');
    expect(a.over33).toBe(1);
  });

  it('reports which marks are missing when the playback never stopped', () => {
    const s = series({ frames: 100 });
    const a = analyzeSaveTrace(s, [{ name: 'play', t: s.t[0]! }]);
    expect(a.complete).toBe(false);
    expect(a.missing).toEqual(['stopped', 'resume', 'end']);
  });

  it('reads a trace recorded from the mock arena (auto-pause stop, 12 ms save, resume)', () => {
    const rec = JSON.parse(readFileSync(new URL('../fixtures/cursor-save-trace.mock.json', import.meta.url), 'utf8')) as { t: number[]; tick: number[]; marks: TraceMark[]; stopKind: string };
    const a = analyzeSaveTrace({ t: rec.t, tick: rec.tick }, rec.marks);
    expect(rec.stopKind).toBe('auto');
    expect(a.complete).toBe(true);
    expect(a.frames).toBeGreaterThan(200);
    expect(a.over33).toBe(0);
    expect(a.phases.stopped.frames).toBeGreaterThan(20);
  });
});

describe('heap analysis', () => {
  const mb = (n: number): number => n * 1024 * 1024;

  it('a flat heap has no growth and no slope', () => {
    const h = analyzeHeap(Array.from({ length: 20 }, () => mb(40)));
    expect(h.growthMb).toBeCloseTo(0, 6);
    expect(h.slopeMbPerLoad).toBeCloseTo(0, 6);
    expect(h.loads).toBe(20);
  });

  it('measures a steady climb after the warm-up loads', () => {
    const h = analyzeHeap(Array.from({ length: 20 }, (_, i) => mb(40 + i * 2)));
    expect(h.baselineMb).toBeCloseTo(46, 5);
    expect(h.finalMb).toBeCloseTo(78, 5);
    expect(h.growthMb).toBeCloseTo(32, 5);
    expect(h.slopeMbPerLoad).toBeCloseTo(2, 5);
  });

  it('copes with fewer samples than the warm-up', () => {
    const h = analyzeHeap([mb(10), mb(11)]);
    expect(h.loads).toBe(2);
    expect(Number.isFinite(h.finalMb)).toBe(true);
  });
});
