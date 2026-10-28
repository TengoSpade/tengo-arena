/**
 * Driving the arena through its test hook (05-technical-m2 §A7 "Test hook", tech-027): window.__arena.viewer with
 * frame(), seek(t), play(), pause(), setSpeed(s), stats(), logHash() and loadFixtureRound(). The hook exists in dev
 * builds and in the `smoke` build mode only. Everything here fails with a *blocked* SmokeFailure when the hook or
 * the viewer is not there yet, naming the package that delivers it.
 */
import type { ArenaFrameState, ViewerStats } from '../../../src/render';
import { letterboxProject, parseCssColor, type Rect, type Rgb, type TokenProbe } from './checks';
import { SmokeFailure, sleep, type PageDriver } from './page';
import { mainThreadLoad, playingIntervals, stoppedAtEnd, type FrameSeries, type MainThreadLoad } from './stats';

export const REQUIRED_METHODS = ['frame', 'seek', 'play', 'pause', 'setSpeed', 'stats', 'logHash'] as const;

export interface HookInfo {
  arena: boolean;
  arenaKeys: string[];
  viewer: boolean;
  methods: Record<string, boolean>;
  extras: string[];
  hasState: boolean;
}

const MISSING_HOOK = 'The test hook window.__arena.viewer is not in this build. The `smoke` build mode must compile it in (05-technical-m2 §A7, tech-027); it arrives with WP-M2E (and the viewer it drives with WP-M2D).';

/** Wait for the hook to appear after the app boots; throw a blocked failure naming what is missing. */
export async function requireHook(page: PageDriver, opts: { needFixture: boolean; timeoutMs?: number }): Promise<HookInfo> {
  const deadline = Date.now() + (opts.timeoutMs ?? 8_000);
  let info = await page.probe<HookInfo>('hookInfo');
  while (!info.viewer && Date.now() < deadline) {
    await sleep(150);
    info = await page.probe<HookInfo>('hookInfo');
  }
  if (!info.arena) throw new SmokeFailure('smoke.hook-missing', `window.__arena is not defined. ${MISSING_HOOK}`, true);
  if (!info.viewer) throw new SmokeFailure('smoke.hook-missing', `window.__arena exists (keys: ${info.arenaKeys.join(', ') || 'none'}) but has no .viewer. ${MISSING_HOOK}`, true);
  const need = [...REQUIRED_METHODS, ...(opts.needFixture ? (['loadFixtureRound'] as const) : [])];
  const missing = need.filter((m) => !info.methods[m]);
  if (missing.length) throw new SmokeFailure('smoke.hook-incomplete', `window.__arena.viewer lacks ${missing.join(', ')} (contract: frame, seek, play, pause, setSpeed, stats, logHash, loadFixtureRound). Delivered by WP-M2E.`, true);
  return info;
}

const V = 'window.__arena.viewer';

export async function viewerCall<T = unknown>(page: PageDriver, call: string, timeoutMs = 30_000): Promise<T> {
  return await page.eval<T>(`${V}.${call}`, timeoutMs);
}

/** The hook's frame, or null when no viewer is mounted (the contract's hook returns null then). */
export async function frameOrNull(page: PageDriver): Promise<ArenaFrameState | null> {
  return await viewerCall<ArenaFrameState | null>(page, 'frame()');
}

export async function frame(page: PageDriver): Promise<ArenaFrameState> {
  const f = await frameOrNull(page);
  if (!f) throw new SmokeFailure('smoke.viewer-no-frame', 'window.__arena.viewer.frame() gave no frame: no viewer is mounted or it has not drawn yet.');
  return f;
}

export async function stats(page: PageDriver): Promise<ViewerStats> {
  const s = await viewerCall<ViewerStats | null>(page, 'stats()');
  if (!s) throw new SmokeFailure('smoke.viewer-no-frame', 'window.__arena.viewer.stats() gave nothing: no viewer is mounted.');
  return s;
}

export async function logHash(page: PageDriver): Promise<string | null> {
  const h = await viewerCall<unknown>(page, 'logHash()');
  return typeof h === 'string' && h.length > 0 ? h : null;
}

export const setSpeed = (page: PageDriver, speed: 1 | 2 | 4): Promise<unknown> => viewerCall(page, `setSpeed(${speed})`);
export const play = (page: PageDriver): Promise<unknown> => viewerCall(page, 'play()');
export const pause = (page: PageDriver): Promise<unknown> => viewerCall(page, 'pause()');
export const seek = (page: PageDriver, tick: number): Promise<unknown> => viewerCall(page, `seek(${JSON.stringify(tick)})`);

/** Two animation frames: whatever the last command changed has been drawn. */
export async function settle(page: PageDriver, frames = 2): Promise<void> {
  await page.eval(`new Promise((res) => { let n = ${frames}; const f = () => (--n <= 0 ? res(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
}

/**
 * Load the dev world's fixed round (hook) and wait until a viewer shows it. The hook opens #/replay/__fixture__ and returns
 * at once; the screen mounts the viewer after it. Loading again from the same route would not remount, so the page first
 * leaves the replay route and waits for the viewer to go (when the hook can say: `ready()`), which also makes the heap
 * check a true mount and unmount per round. Returns the time from the call until the first frame was drawn (A10 "first open").
 */
export async function loadFixtureRound(page: PageDriver): Promise<{ ms: number; info: unknown }> {
  return await page.eval<{ ms: number; info: unknown }>(
    `(async () => {
      const v = ${V};
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const ready = () => (typeof v.ready === 'function' ? !!v.ready() : true);
      const drawn = () => { try { const f = v.frame(); return !!f && Array.isArray(f.units) && f.units.length === 10; } catch { return false; } };
      if (location.hash.startsWith('#/replay/') && typeof v.ready === 'function') {
        location.hash = '#/home';
        for (let i = 0; i < 200 && ready(); i++) await sleep(20);
      }
      const t0 = performance.now();
      const info = await v.loadFixtureRound();
      for (let i = 0; i < 600 && !(ready() && drawn()); i++) await sleep(20);
      if (!drawn()) throw new Error('the fixed round did not appear: no viewer drew a frame of ten units within 12 s');
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      return { ms: performance.now() - t0, info: info === undefined ? null : info };
    })()`,
    60_000,
  );
}

export interface CanvasInfo {
  rect: Rect;
  pixelWidth: number;
  pixelHeight: number;
  count: number;
  webgl: boolean;
  contextLost: boolean | null;
  label: string | null;
  role: string | null;
}

export async function canvasInfo(page: PageDriver): Promise<CanvasInfo | null> {
  return await page.probe<CanvasInfo | null>('canvas');
}

/** Resolve the side ring colours the arena draws with, read from the page's own CSS tokens (04 §3, asset-006). */
export async function sideColors(page: PageDriver, extra: readonly string[] = []): Promise<{ colors: Rgb[]; names: string[] }> {
  const resolved = await page.probe<Record<string, string>>('palette', ['--c-side-us', '--c-side-them']);
  const colors: Rgb[] = [];
  const names: string[] = [];
  for (const [name, css] of Object.entries(resolved)) {
    const c = parseCssColor(css);
    if (c) {
      colors.push(c);
      names.push(name);
    }
  }
  for (const hex of extra) {
    const c = parseCssColor(hex);
    if (c) {
      colors.push(c);
      names.push(hex);
    }
  }
  // The hook may know the match's own colours (club colours between other clubs): a colors() method, an array of 0xRRGGBB or css strings.
  const hooked = await page.eval<unknown>(`(() => { const v = ${V}; try { const c = typeof v.colors === 'function' ? v.colors() : v.colors; return c === undefined ? null : c; } catch (e) { return null; } })()`);
  const flat: unknown[] = Array.isArray(hooked) ? hooked : hooked && typeof hooked === 'object' ? Object.values(hooked) : [];
  for (const v of flat) {
    const css = typeof v === 'number' ? `#${v.toString(16).padStart(6, '0')}` : typeof v === 'string' ? v : null;
    const c = css ? parseCssColor(css) : null;
    if (c) {
      colors.push(c);
      names.push(`hook:${css}`);
    }
  }
  return { colors, names };
}

/**
 * Screen positions of the ten units of a frame. Uses the hook's own projection when it has one (project(x, y) or
 * viewTransform().toScreen), else a letterbox of the canvas with the camera contract's default padding; the ring
 * search window absorbs a few pixels of difference.
 */
export async function projectUnits(page: PageDriver, f: ArenaFrameState, canvas: CanvasInfo, arenaCm = { width: 3200, height: 1800 }): Promise<{ probes: TokenProbe[]; radiusPx: number; method: string }> {
  const pts = f.units.map((u) => [u.x, u.y]);
  const hooked = await page.eval<{ points: { x: number; y: number }[] | null; pxPerMetre: number | null; method: string }>(`(() => {
    const v = ${V}; const pts = ${JSON.stringify(pts)};
    try {
      if (typeof v.project === 'function') return { points: pts.map((p) => v.project(p[0], p[1])), pxPerMetre: null, method: 'hook.project' };
      const t = typeof v.viewTransform === 'function' ? v.viewTransform() : v.viewTransform;
      if (t && typeof t.toScreen === 'function') return { points: pts.map((p) => t.toScreen(p[0], p[1])), pxPerMetre: typeof t.pxPerMetre === 'number' ? t.pxPerMetre : null, method: 'hook.viewTransform' };
    } catch (e) { /* fall through to the letterbox */ }
    return { points: null, pxPerMetre: null, method: 'letterbox' };
  })()`);
  const lb = letterboxProject(canvas.rect, arenaCm);
  const points = hooked.points ?? pts.map((p) => lb.project(p[0]!, p[1]!));
  const pxPerCm = hooked.pxPerMetre !== null ? hooked.pxPerMetre / 100 : lb.pxPerCm;
  const probes: TokenProbe[] = f.units.map((u, i) => ({ unit: u.unit, side: u.side, standing: u.standing, x: points[i]!.x, y: points[i]!.y }));
  // The body is 0.5 m radius; the ring sits at its edge: search a little beyond it.
  return { probes, radiusPx: Math.max(8, 50 * pxPerCm * 1.6), method: hooked.method };
}

// ---- Playback runs -----------------------------------------------------------------------------------------

export interface PlayRunResult {
  series: FrameSeries;
  marks: { name: string; t: number }[];
  restarts: number;
  resumes: number;
  playingFrames: number;
  /** The page's main-thread load over the run, when the browser reported it. */
  load: MainThreadLoad | null;
}

/**
 * Play at `speed` for `seconds` of wall time while recording every animation frame. A fight that ends is loaded again
 * (`reload`); an auto-pause stop (the viewer stopped before the end) is resumed. Frame statistics are taken later over
 * the steady-play frames only, so stops and restarts do not count as slow frames.
 */
export async function playFor(page: PageDriver, opts: { speed: 1 | 2 | 4; seconds: number; reload: () => Promise<unknown> }): Promise<PlayRunResult> {
  await setSpeed(page, opts.speed);
  const m0 = await page.perfMetrics().catch(() => null);
  await page.probe('rafStart');
  await page.probe('rafMark', `play@${opts.speed}x`);
  await play(page);
  const startedAt = Date.now();
  let restarts = 0;
  let resumes = 0;
  let prevTick = NaN;
  let still = 0;
  while (Date.now() - startedAt < opts.seconds * 1000) {
    await sleep(250);
    const peek = await page.probe<{ frames: number; lastTick: number | null }>('rafPeek');
    const tick = peek.lastTick ?? NaN;
    still = tick === prevTick ? still + 1 : 0;
    prevTick = tick;
    if (still >= 2) {
      const f = await frameOrNull(page);
      if (f?.ended) {
        await opts.reload();
        await setSpeed(page, opts.speed);
        await page.probe('rafMark', 'restart');
        restarts++;
      } else {
        await page.probe('rafMark', 'resume');
        resumes++;
      }
      await play(page);
      still = 0;
    }
  }
  const m1 = await page.perfMetrics().catch(() => null);
  const raw = await page.probe<{ t: number[]; tick: (number | null)[]; marks: { name: string; t: number }[] }>('rafStop');
  const series: FrameSeries = { t: raw.t, tick: raw.tick.map((k) => k ?? NaN) };
  await pause(page);
  return { series, marks: raw.marks, restarts, resumes, playingFrames: playingIntervals(series, 5).length, load: m0 && m1 ? mainThreadLoad(m0, m1) : null };
}

// ---- The cursor-save trace -----------------------------------------------------------------------------------------

export interface SaveTraceRun {
  series: FrameSeries;
  marks: { name: string; t: number }[];
  stopKind: 'auto' | 'manual';
  stopTick: number;
  savedConfirmed: boolean | null;
}

/**
 * Test-first item 5: play at 4x until an auto-pause stop (our fighter or captain down, overtime: on by default), let the
 * cursor save happen, resume, and keep recording. If no stop comes by `manualAfterMs` the playback is paused by hand,
 * which saves the cursor the same way. Marks: play, stopped, saved, resume, end.
 */
export async function traceCursorSave(page: PageDriver, opts: { hasState: boolean; saveWaitMs?: number; manualAfterMs?: number; resumeMs?: number }): Promise<SaveTraceRun> {
  const manualAfterMs = opts.manualAfterMs ?? 20_000;
  await setSpeed(page, 4);
  await page.probe('rafStart');
  await page.probe('rafMark', 'play');
  await play(page);
  const t0 = Date.now();
  let stopKind: 'auto' | 'manual' = 'auto';
  let series: FrameSeries = { t: [], tick: [] };
  for (;;) {
    await sleep(100);
    const raw = await page.probe<{ t: number[]; tick: (number | null)[] }>('rafPeekSeries').catch(() => null);
    if (raw) series = { t: raw.t, tick: raw.tick.map((k) => k ?? NaN) };
    const moved = series.tick.some((k) => k > (series.tick[0] ?? 0) + 1);
    if (series.t.length > 10 && moved && stoppedAtEnd(series, 300)) {
      const f = await frameOrNull(page);
      if (f?.ended) throw new SmokeFailure('trace.round-ended', 'The round ended before any stop came up, so there was no stop to trace. (Auto-pause is off, or nobody went down in the first rounds.) Use a longer fight or pause by hand.');
      break;
    }
    if (Date.now() - t0 > manualAfterMs) {
      stopKind = 'manual';
      await pause(page);
      await sleep(150);
      break;
    }
  }
  const stopTick = (await frame(page)).tick;
  await page.probe('rafMark', 'stopped');
  await sleep(opts.saveWaitMs ?? 600);
  await page.probe('rafMark', 'saved');
  await page.probe('rafMark', 'resume');
  await play(page);
  await sleep(opts.resumeMs ?? 2_000);
  await page.probe('rafMark', 'end');
  const raw = await page.probe<{ t: number[]; tick: (number | null)[]; marks: { name: string; t: number }[] }>('rafStop');
  await pause(page);
  const finalSeries: FrameSeries = { t: raw.t, tick: raw.tick.map((k) => k ?? NaN) };
  // The 'stopped' mark is where the clock actually stopped (the last advancing frame), not when the poll noticed.
  const marks = raw.marks.map((m) => (m.name === 'stopped' ? { name: m.name, t: lastAdvancingTime(finalSeries, m.t) } : m));
  return { series: finalSeries, marks, stopKind, stopTick, savedConfirmed: null };
}

/** The timestamp of the last frame before `before` at which the tick was still advancing. */
export function lastAdvancingTime(series: FrameSeries, before: number): number {
  let last = before;
  for (let i = 1; i < series.t.length; i++) {
    if (series.t[i]! >= before) break;
    if (series.tick[i]! > series.tick[i - 1]! + 1e-9) last = series.t[i]!;
  }
  return last;
}

