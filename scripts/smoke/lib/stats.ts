/**
 * Frame-time statistics and trace analysis. Pure functions (unit-tested on recorded fixtures); the page records
 * requestAnimationFrame timestamps and the viewer tick per frame, this file turns them into numbers.
 */

/** The working targets of 05-technical-m2 §A10 (all TUNABLE there; the reference machine is OPEN until Q35). */
export const TARGETS = {
  /** 60 fps target: the median frame rate may sit a little under it (timer jitter); 58 = a 17.2 ms median interval. */
  fpsMedianMin: 58,
  /** p95 frame interval at 1x and 4x. */
  p95IntervalMsMax: 20,
  /** "Never below 30 fps, including across a cursor save and the resume": no interval over 33 ms. One skipped vsync at 60 Hz is 33.3 ms (and timer jitter makes it 33.4), which is still 30 fps; two skipped vsyncs are not. */
  maxIntervalMs: 33.5,
  /** Our CPU per frame (clock + sampleAt + scene update), p95. */
  cpuFrameMsP95Max: 4,
  /** First viewer open (lazy chunk + PixiJS init + prepare), local files. */
  firstOpenMsMax: 500,
  /** JS heap growth while viewing (20 round loads). */
  heapGrowthMbMax: 50,
  /** A steady climb over the 20 loads is a leak even when the total stays under the cap. */
  heapLeakMbPerLoad: 0.25,
  /** GPU textures. Not measurable from the page; listed for the report. */
  textureMbMax: 32,
} as const;

export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((s, v) => s + v, 0) / values.length;
}

/** Nearest-rank percentile (p in 0..100) of an unsorted list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1]!;
}

export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

/** Differences between consecutive timestamps. */
export function intervalsOf(times: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < times.length; i++) out.push(times[i]! - times[i - 1]!);
  return out;
}

export interface IntervalSummary {
  frames: number;
  /** Sum of the intervals, ms. */
  durationMs: number;
  /** Mean frames per second over the whole span. */
  fps: number;
  medianMs: number;
  /** 1000 / median interval. */
  medianFps: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  /** Intervals over 20 ms (below 50 fps) and over 33 ms (below 30 fps). */
  over20: number;
  over33: number;
}

export function summarizeIntervals(intervalsMs: readonly number[]): IntervalSummary {
  const duration = intervalsMs.reduce((s, v) => s + v, 0);
  const med = median(intervalsMs);
  return {
    frames: intervalsMs.length,
    durationMs: duration,
    fps: duration > 0 ? (intervalsMs.length * 1000) / duration : NaN,
    medianMs: med,
    medianFps: med > 0 ? 1000 / med : NaN,
    p95Ms: percentile(intervalsMs, 95),
    p99Ms: percentile(intervalsMs, 99),
    maxMs: intervalsMs.length ? Math.max(...intervalsMs) : NaN,
    over20: intervalsMs.filter((v) => v > 20).length,
    over33: intervalsMs.filter((v) => v > TARGETS.maxIntervalMs).length,
  };
}

/** What the page records per animation frame. */
export interface FrameSeries {
  /** rAF timestamps, ms (performance.now() timebase). */
  t: number[];
  /** The viewer's tick at each frame (NaN when unreadable). */
  tick: number[];
}

/**
 * How many frames the tick is compared across to call the clock "advancing". The tick the page can read is either the
 * viewer's own (every frame) or the HUD's latest frame (at most 10 Hz, 05-technical-m2 §A5): across 12 frames (200 ms
 * at 60 Hz) a running clock has moved either way.
 */
export const CLOCK_WINDOW_FRAMES = 12;

/**
 * Intervals between consecutive frames while the fight clock was advancing (a steady play: the clock moved over the
 * last window and the one before it), so pauses, the stop and the restart do not pollute the playing numbers. The few
 * frames just after a stop still count as playing (the window has not slid past it): conservative, never lenient.
 * `skipFrames` drops the first frames of the series (the viewer warming up after play()).
 */
export function playingIntervals(series: FrameSeries, skipFrames = 0, window = CLOCK_WINDOW_FRAMES): number[] {
  const out: number[] = [];
  const moved = (i: number): boolean => i - window >= 0 && series.tick[i]! > series.tick[i - window]! + 1e-9;
  for (let i = 2 * window + skipFrames; i < series.t.length; i++) {
    if (moved(i) && moved(i - window)) out.push(series.t[i]! - series.t[i - 1]!);
  }
  return out;
}

/**
 * The clock has not moved for the last `ms` of the series (a stop). Time-based so that a tick updated at 10 Hz is not
 * mistaken for a stop between two updates.
 */
export function stoppedAtEnd(series: FrameSeries, ms: number): boolean {
  const n = series.tick.length;
  if (n < 2) return false;
  const last = series.tick[n - 1]!;
  if (!Number.isFinite(last)) return false;
  const tEnd = series.t[n - 1]!;
  if (tEnd - series.t[0]! < ms) return false;
  for (let i = n - 1; i >= 0 && tEnd - series.t[i]! <= ms; i--) if (series.tick[i] !== last) return false;
  return true;
}

// ---- The cursor-save trace (test-first item 5: an auto-pause stop, the save, the resume; no frame over 33 ms) --

export interface TraceMark {
  name: 'play' | 'stopped' | 'saved' | 'resume' | 'end' | string;
  /** performance.now() timebase, like FrameSeries.t. */
  t: number;
}

export type TracePhase = 'playing' | 'stopped' | 'resumed';

export interface TraceAnalysis {
  /** Intervals considered (from `play` + warm-up to `end`). */
  frames: number;
  windowMs: number;
  maxMs: number;
  over33: number;
  /** The worst interval: how long, in which phase, and where relative to the `stopped` mark. */
  worst: { ms: number; phase: TracePhase; atMs: number; offsetFromStopMs: number | null } | null;
  phases: Record<TracePhase, IntervalSummary>;
  /** Marks present, so a trace that never reached a stop or a resume says so. */
  complete: boolean;
  missing: string[];
}

export function analyzeSaveTrace(series: FrameSeries, marks: readonly TraceMark[], warmupMs = 250): TraceAnalysis {
  const at = (name: string): number | null => marks.find((m) => m.name === name)?.t ?? null;
  const play = at('play');
  const stopped = at('stopped');
  const resume = at('resume');
  const end = at('end');
  const missing = ['play', 'stopped', 'resume', 'end'].filter((n) => at(n) === null);
  const from = (play ?? series.t[0] ?? 0) + warmupMs;
  const to = end ?? series.t[series.t.length - 1] ?? 0;
  const phaseOf = (time: number): TracePhase => (resume !== null && time >= resume ? 'resumed' : stopped !== null && time >= stopped ? 'stopped' : 'playing');
  const byPhase: Record<TracePhase, number[]> = { playing: [], stopped: [], resumed: [] };
  const all: number[] = [];
  let worst: TraceAnalysis['worst'] = null;
  for (let i = 1; i < series.t.length; i++) {
    const time = series.t[i]!;
    if (time < from || time > to) continue;
    const ms = time - series.t[i - 1]!;
    all.push(ms);
    const phase = phaseOf(time);
    byPhase[phase].push(ms);
    if (!worst || ms > worst.ms) worst = { ms, phase, atMs: time - (play ?? series.t[0] ?? 0), offsetFromStopMs: stopped !== null ? time - stopped : null };
  }
  const summary = summarizeIntervals(all);
  return {
    frames: all.length,
    windowMs: summary.durationMs,
    maxMs: summary.maxMs,
    over33: summary.over33,
    worst,
    phases: { playing: summarizeIntervals(byPhase.playing), stopped: summarizeIntervals(byPhase.stopped), resumed: summarizeIntervals(byPhase.resumed) },
    complete: missing.length === 0,
    missing,
  };
}

// ---- Heap -----------------------------------------------------------------------------------------------

export interface HeapAnalysis {
  loads: number;
  baselineMb: number;
  finalMb: number;
  maxMb: number;
  /** final - baseline (baseline = the sample after the warm-up loads). */
  growthMb: number;
  /** Least-squares slope after the warm-up, MB per load. */
  slopeMbPerLoad: number;
}

const MB = 1024 * 1024;

/** `samplesBytes[i]` = JS heap in use (after a forced GC) once load i has finished. */
export function analyzeHeap(samplesBytes: readonly number[], warmupLoads = 3): HeapAnalysis {
  const warm = Math.min(Math.max(0, warmupLoads), Math.max(0, samplesBytes.length - 2));
  const used = samplesBytes.slice(warm).map((b) => b / MB);
  const n = used.length;
  const xs = used.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(used);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (used[i]! - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return {
    loads: samplesBytes.length,
    baselineMb: used[0] ?? NaN,
    finalMb: used[n - 1] ?? NaN,
    maxMb: n ? Math.max(...used) : NaN,
    growthMb: n ? used[n - 1]! - used[0]! : NaN,
    slopeMbPerLoad: den > 0 ? num / den : 0,
  };
}
