/**
 * The smoke's check logic: pure functions from measurements to CheckResults, unit-tested on recorded fixtures.
 * The journeys (browser) collect numbers; nothing here touches a browser.
 */
import type { Rgba } from './png';
import type { CheckResult, CheckStatus } from './report';
import { TARGETS, median, percentile, type HeapAnalysis, type IntervalSummary, type MainThreadLoad, type TraceAnalysis } from './stats';

const ms = (v: number): string => (Number.isFinite(v) ? `${v.toFixed(1)} ms` : 'n/a');
const fps = (v: number): string => (Number.isFinite(v) ? `${v.toFixed(1)} fps` : 'n/a');

/**
 * Performance numbers depend on the machine. On software WebGL (SwiftShader) they say little about the reference
 * machine, so a miss is a warning there, unless the run was asked to be strict.
 */
export interface PerfContext {
  softwareGl: boolean | null;
  strict: boolean;
}

function perfStatus(ok: boolean, ctx: PerfContext): CheckStatus {
  if (ok) return 'pass';
  return ctx.softwareGl === true && !ctx.strict ? 'warn' : 'fail';
}

const SOFTWARE_NOTE = 'Software WebGL: the targets apply to the reference machine with a GPU. Run with --gpu hardware, or --strict-perf to make this a failure.';

// ---- Frame rate (A10: 60 fps target, p95 interval <= 20 ms, never below 30 fps) ----------------------------

/** One line on what bounds the frame rate: the main thread's share, and so where to look. */
export function loadNote(load: MainThreadLoad | null): string | null {
  if (!load) return null;
  const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;
  const where = load.task < 0.6 ? 'the main thread has room, so the frame time is spent on the GPU or the compositor (draw cost, presenting the canvas), not in script, layout or style' : 'the main thread is busy: look at script, layout and style';
  return `Main thread busy ${pct(load.task)} of ${load.wallS.toFixed(1)} s (script ${pct(load.script)}, layout ${pct(load.layout)}, style ${pct(load.style)}): ${where}.`;
}

export function checkFrameRate(id: 'perf.fps-1x' | 'perf.fps-4x', speedLabel: string, s: IntervalSummary, ctx: PerfContext, load: MainThreadLoad | null = null): CheckResult {
  const enough = s.frames >= 60;
  const ok = enough && s.medianFps >= TARGETS.fpsMedianMin && s.p95Ms <= TARGETS.p95IntervalMsMax && s.over33 === 0;
  const status: CheckStatus = !enough ? 'fail' : perfStatus(ok, ctx);
  return {
    id,
    title: `Arena frame rate at ${speedLabel}`,
    status,
    ref: 'A10',
    expected: `median >= ${TARGETS.fpsMedianMin} fps, p95 interval <= ${TARGETS.p95IntervalMsMax} ms, none over ${TARGETS.maxIntervalMs} ms`,
    actual: `${s.frames} frames: median ${fps(s.medianFps)}, p95 ${ms(s.p95Ms)}, max ${ms(s.maxMs)}, ${s.over33} over ${TARGETS.maxIntervalMs} ms`,
    ...(!enough
      ? { detail: `Only ${s.frames} playing frames were recorded (at least 60 needed): the fight clock did not advance long enough.` }
      : status === 'warn'
        ? { detail: [SOFTWARE_NOTE, loadNote(load)].filter(Boolean).join(' ') }
        : status === 'fail' && loadNote(load)
          ? { detail: loadNote(load)! }
          : {}),
  };
}

export function checkCpuFrame(p95Ms: number | null, ctx: PerfContext): CheckResult {
  if (p95Ms === null || !Number.isFinite(p95Ms)) {
    return { id: 'perf.cpu-frame', title: 'Our CPU time per frame', status: 'skip', ref: 'A10', expected: `p95 <= ${TARGETS.cpuFrameMsP95Max} ms`, actual: 'viewer.stats() gave no frameMsP95' };
  }
  const status = perfStatus(p95Ms <= TARGETS.cpuFrameMsP95Max, ctx);
  return {
    id: 'perf.cpu-frame',
    title: 'Our CPU time per frame (clock, sampleAt, scene update)',
    status,
    ref: 'A10',
    expected: `p95 <= ${TARGETS.cpuFrameMsP95Max} ms`,
    actual: `p95 ${ms(p95Ms)}`,
    ...(status === 'warn' ? { detail: SOFTWARE_NOTE } : {}),
  };
}

/**
 * A10 "round load": the sim at record level full plus indexFightLog, median at most 15 ms and p99 at most 30 ms. It is CPU
 * work, measured in the browser's JavaScript engine over warm passes, so a GPU or software WebGL makes no difference and a miss
 * is a failure. The sim alone is only a lower bound of that budget, so without indexFightLog (the render model is not
 * implemented yet) the check is not made, and the run is blocked rather than passed on the lower bound.
 */
export function checkRoundLoad(t: { simMs: readonly number[]; indexMs: readonly number[] | null; loadMs: readonly number[] | null; indexProblem: string | null }, where: string): CheckResult {
  const base = { id: 'perf.round-load', title: `Round load: the sim at full plus indexFightLog, in ${where}`, ref: 'A10 round load', expected: `median <= ${TARGETS.roundLoadMedianMsMax} ms, p99 <= ${TARGETS.roundLoadP99MsMax} ms` };
  if (!t.loadMs || t.loadMs.length === 0) {
    const simMed = median(t.simMs);
    return { ...base, status: 'skip', actual: `indexFightLog could not be timed; the sim alone is ${ms(simMed)} median`, detail: `indexFightLog is not available (${t.indexProblem ?? 'no timings'}), so the budget (sim plus indexFightLog) cannot be checked; the sim alone (${ms(simMed)} median) is a lower bound and is not accepted for it. Delivered by WP-M2C (the render model).` };
  }
  const med = median(t.loadMs);
  const p99 = percentile(t.loadMs, 99);
  const ok = med <= TARGETS.roundLoadMedianMsMax && p99 <= TARGETS.roundLoadP99MsMax;
  return {
    ...base,
    status: ok ? 'pass' : 'fail',
    actual: `${t.loadMs.length} warm loads: median ${ms(med)}, p99 ${ms(p99)} (sim ${ms(median(t.simMs))} + index ${ms(median(t.indexMs ?? []))} median)`,
  };
}

export function checkFirstOpen(openMs: number | null, ctx: PerfContext): CheckResult {
  if (openMs === null) return { id: 'perf.first-open', title: 'First viewer open', status: 'skip', ref: 'A10', expected: `<= ${TARGETS.firstOpenMsMax} ms`, actual: 'not measured' };
  const status = perfStatus(openMs <= TARGETS.firstOpenMsMax, ctx);
  return {
    id: 'perf.first-open',
    title: 'First viewer open (lazy chunk, PixiJS init, prepare)',
    status,
    ref: 'A10',
    expected: `<= ${TARGETS.firstOpenMsMax} ms`,
    actual: ms(openMs),
    ...(status === 'warn' ? { detail: SOFTWARE_NOTE } : {}),
  };
}

// ---- The cursor-save trace (A11 test-first item 5) -----------------------------------------------------------

export function checkSaveTrace(t: TraceAnalysis, stopKind: 'auto' | 'manual', ctx: PerfContext): CheckResult {
  if (!t.complete) {
    return {
      id: 'perf.cursor-save-trace',
      title: 'Frame-time trace across a cursor save (stop, save, resume)',
      status: 'fail',
      ref: 'A11 test-first 5',
      expected: 'a trace with play, stop, save and resume',
      actual: `missing: ${t.missing.join(', ')}`,
      detail: 'The playback never reached a stop or never resumed, so the save was not traced.',
    };
  }
  const ok = t.over33 === 0;
  const status = perfStatus(ok, ctx);
  const worst = t.worst;
  return {
    id: 'perf.cursor-save-trace',
    title: `Frame-time trace at 4x across a cursor save (${stopKind === 'auto' ? 'auto-pause stop' : 'manual pause'}, the save, the resume)`,
    status,
    ref: 'A11 test-first 5',
    expected: `no frame over ${TARGETS.maxIntervalMs} ms`,
    actual: `${t.frames} frames over ${ms(t.windowMs)}, max ${ms(t.maxMs)}, ${t.over33} over ${TARGETS.maxIntervalMs} ms${worst ? `; worst in the "${worst.phase}" phase${worst.offsetFromStopMs !== null ? ` (${worst.offsetFromStopMs >= 0 ? '+' : ''}${worst.offsetFromStopMs.toFixed(0)} ms from the stop)` : ''}` : ''}`,
    ...(status === 'warn' ? { detail: SOFTWARE_NOTE } : stopKind === 'manual' ? { detail: 'No auto-pause stop came up within the traced span, so the stop was a manual pause (it saves the cursor the same way).' } : {}),
  };
}

// ---- Heap (A10: growth <= 50 MB while viewing; no growth over 20 consecutive rounds) -----------------------------

export function checkHeap(h: HeapAnalysis): CheckResult {
  const tooBig = h.growthMb > TARGETS.heapGrowthMbMax;
  const leak = h.slopeMbPerLoad > TARGETS.heapLeakMbPerLoad && h.growthMb > 5;
  const status: CheckStatus = tooBig ? 'fail' : leak ? 'warn' : 'pass';
  return {
    id: 'perf.heap',
    title: `JS heap over ${h.loads} consecutive round loads`,
    status,
    ref: 'A10',
    expected: `growth <= ${TARGETS.heapGrowthMbMax} MB and no steady climb (<= ${TARGETS.heapLeakMbPerLoad} MB per load)`,
    actual: `${h.baselineMb.toFixed(1)} -> ${h.finalMb.toFixed(1)} MB (growth ${h.growthMb.toFixed(1)} MB, slope ${h.slopeMbPerLoad.toFixed(3)} MB per load, peak ${h.maxMb.toFixed(1)} MB), after a forced GC at each sample`,
    ...(leak && !tooBig ? { detail: 'The heap keeps climbing with every round loaded although it stays under the cap: look for a visual or log that survives load().' } : {}),
  };
}

// ---- Hashes (vis-009: viewed = headless; 05 §10: Node and Chromium agree) ----------------------------------------

export function checkHashEqual(id: string, title: string, ref: string, viewed: string | null, reference: string | null, what: { viewedName: string; referenceName: string }): CheckResult {
  if (viewed === null || reference === null) {
    return { id, title, status: 'skip', ref, expected: `${what.viewedName} equals ${what.referenceName}`, actual: `${viewed === null ? what.viewedName : what.referenceName} not available` };
  }
  const ok = viewed === reference;
  return {
    id,
    title,
    status: ok ? 'pass' : 'fail',
    ref,
    expected: `${what.viewedName} equals ${what.referenceName}`,
    actual: ok ? `both ${viewed}` : `${what.viewedName} ${viewed}, ${what.referenceName} ${reference}`,
    ...(ok ? {} : { detail: 'A viewed round whose hash differs from the headless one is a determinism defect (vis-009, pillar 4), not a flaky check.' }),
  };
}

// ---- Console errors ---------------------------------------------------------------------------------------------

export interface ConsoleRecord {
  source: string;
  level: 'error' | 'warning';
  text: string;
  url?: string;
}

/** Messages that are not the game's fault: the browser asking for a favicon the static server does not have. */
export const DEFAULT_CONSOLE_ALLOW: readonly RegExp[] = [/favicon\.ico/i];

export function splitConsole(records: readonly ConsoleRecord[], allow: readonly RegExp[] = DEFAULT_CONSOLE_ALLOW): { errors: ConsoleRecord[]; warnings: number; ignored: number } {
  const errors: ConsoleRecord[] = [];
  let warnings = 0;
  let ignored = 0;
  for (const r of records) {
    if (r.level === 'warning') {
      warnings++;
      continue;
    }
    if (allow.some((re) => re.test(r.text) || (r.url ? re.test(r.url) : false))) {
      ignored++;
      continue;
    }
    errors.push(r);
  }
  return { errors, warnings, ignored };
}

export function checkConsole(errors: readonly ConsoleRecord[], ignored: number): CheckResult {
  return {
    id: 'console.errors',
    title: 'No console errors',
    status: errors.length === 0 ? 'pass' : 'fail',
    ref: 'A11',
    expected: '0 console errors or uncaught exceptions',
    actual: errors.length === 0 ? `0${ignored ? ` (${ignored} ignored by the allow list)` : ''}` : `${errors.length}: ${errors[0]!.text.slice(0, 160)}`,
  };
}

// ---- Pixels: the canvas is not blank, and the ten tokens are drawn with their ring colours ----------------------------

export type Rgb = [number, number, number];

export function parseCssColor(css: string): Rgb | null {
  const s = css.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return [parseInt(m[1]!.slice(0, 2), 16), parseInt(m[1]!.slice(2, 4), 16), parseInt(m[1]!.slice(4, 6), 16)];
  m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [parseInt(m[1]![0]!.repeat(2), 16), parseInt(m[1]![1]!.repeat(2), 16), parseInt(m[1]![2]!.repeat(2), 16)];
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/.exec(s);
  if (rgb) return [Math.round(Number(rgb[1])), Math.round(Number(rgb[2])), Math.round(Number(rgb[3]))];
  return null;
}

export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A rendered canvas has a floor, walls and ten tokens, so it holds several distinct colours and a real share of
 * pixels that differ from the dominant one. A cleared or never-drawn WebGL canvas fails both.
 */
export function canvasNotBlank(img: Rgba, rect: Rect): { ok: boolean; distinctColors: number; offModalShare: number } {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(img.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(img.height, Math.ceil(rect.y + rect.height));
  const counts = new Map<number, number>();
  let total = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const o = (y * img.width + x) * 4;
      // Quantise to 5 bits a channel so anti-aliasing noise does not inflate the count.
      const key = ((img.data[o]! >> 3) << 10) | ((img.data[o + 1]! >> 3) << 5) | (img.data[o + 2]! >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
  }
  const modal = Math.max(0, ...counts.values());
  const offModalShare = total > 0 ? 1 - modal / total : 0;
  const distinct = [...counts.values()].filter((n) => n >= 4).length;
  return { ok: distinct >= 4 && offModalShare >= 0.01, distinctColors: distinct, offModalShare };
}

export interface TokenProbe {
  unit: number;
  side: 0 | 1;
  standing: boolean;
  /** Screen position, CSS px (= screenshot px at device scale 1). */
  x: number;
  y: number;
}

export interface TokenCensus {
  expected: number;
  found: number;
  /** Per standing unit: the ring colour (candidate index) of its side when enough of it was found near the unit, else null; pixels = how many. */
  matches: { unit: number; side: 0 | 1; color: number | null; pixels: number }[];
  /** The candidate each side was assigned (home, away), or null when no assignment explained any token. The two always differ. */
  assignment: [number, number] | null;
  /** Both sides have an assigned ring colour of their own and every standing unit shows its side's. */
  sidesConsistent: boolean;
  missing: number[];
}

/**
 * For each standing unit, count the pixels within `radiusPx` of its projected centre that are near each candidate ring colour.
 * The picture decides which candidate belongs to which side: the pair (home colour, away colour), the two different, that
 * lets the most standing units show enough of their own side's colour. A unit is drawn when at least `minPixels` of its
 * side's colour are near it. Other colours near a token (the body, its trim, a zone disc, the other side's ring) do not count
 * for or against it, so two clubs whose trims share a hue cannot swap the sides. A downed token is flattened and faded
 * (asset-006), so only standing units are required. Tolerant by design: the projection the driver uses may be a few pixels
 * off the viewer's.
 */
export function tokenCensus(img: Rgba, probes: readonly TokenProbe[], candidates: readonly Rgb[], radiusPx: number, tolerance = 42, minPixels = 4): TokenCensus {
  const standing = probes.filter((p) => p.standing);
  const hits = standing.map((p) => {
    const h = new Array<number>(candidates.length).fill(0);
    const r = Math.ceil(radiusPx);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radiusPx * radiusPx) continue;
        const x = Math.round(p.x) + dx;
        const y = Math.round(p.y) + dy;
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
        const o = (y * img.width + x) * 4;
        const px: Rgb = [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!];
        candidates.forEach((c, i) => {
          if (colorDistance(px, c) <= tolerance) h[i]!++;
        });
      }
    }
    return h;
  });
  // The assignment that lets the most units show their side's colour (ties: the most ring pixels in all).
  let best: { pair: [number, number]; shown: number; pixels: number } | null = null;
  for (let home = 0; home < candidates.length; home++) {
    for (let away = 0; away < candidates.length; away++) {
      if (home === away) continue;
      let shown = 0;
      let pixels = 0;
      standing.forEach((p, i) => {
        const n = hits[i]![p.side === 0 ? home : away]!;
        pixels += n;
        if (n >= minPixels) shown++;
      });
      if (shown > 0 && (!best || shown > best.shown || (shown === best.shown && pixels > best.pixels))) best = { pair: [home, away], shown, pixels };
    }
  }
  const matches: TokenCensus['matches'] = standing.map((p, i) => {
    const color = best ? best.pair[p.side] : null;
    const n = color === null ? 0 : hits[i]![color]!;
    return { unit: p.unit, side: p.side, color: color !== null && n >= minPixels ? color : null, pixels: n };
  });
  const found = matches.filter((m) => m.color !== null).length;
  return {
    expected: matches.length,
    found,
    matches,
    assignment: best ? best.pair : null,
    sidesConsistent: best !== null && found === matches.length && matches.some((m) => m.side === 0) && matches.some((m) => m.side === 1),
    missing: matches.filter((m) => m.color === null).map((m) => m.unit),
  };
}

export function checkTokens(c: TokenCensus, label: string): CheckResult {
  const ok = c.expected >= 10 && c.found === c.expected && c.sidesConsistent;
  return {
    id: 'arena.tokens',
    title: `Ten tokens drawn with their side ring colours (${label})`,
    status: ok ? 'pass' : 'fail',
    ref: 'A11 checks',
    expected: '10 standing tokens, each with enough pixels of its own side\'s ring colour near it (the two sides\' colours differ)',
    actual: `${c.found} of ${c.expected} found${c.missing.length ? `, missing units ${c.missing.join(', ')}` : ''}${c.assignment ? `, ring colours: home candidate ${c.assignment[0]}, away candidate ${c.assignment[1]}` : ', no ring colour matched any token'}`,
    ...(!ok ? { detail: 'The ring colours are looked up in a small window around each unit\'s projected position (the viewer\'s own projection when the hook has one, else a letterbox of the canvas with the default camera padding).' } : {}),
  };
}

export function checkCanvas(r: { ok: boolean; distinctColors: number; offModalShare: number }, label: string): CheckResult {
  return {
    id: 'arena.canvas-nonblank',
    title: `The arena canvas is not blank (${label})`,
    status: r.ok ? 'pass' : 'fail',
    ref: 'A11 checks',
    expected: 'several distinct colours and at least 1% of pixels off the dominant colour',
    actual: `${r.distinctColors} distinct colours, ${(r.offModalShare * 100).toFixed(1)}% off the dominant colour`,
  };
}

// ---- Projection fallback ---------------------------------------------------------------------------------------

/**
 * World (cm) to canvas pixels for a letterboxed arena, as the camera contract describes it (05-technical-m2 §A5,
 * src/render/camera DEFAULT_CAMERA padding): the arena fits the canvas minus the padding at zoom 1 and is centred.
 * Used only when the test hook offers no projection of its own.
 */
export function letterboxProject(canvas: Rect, arenaCm: { width: number; height: number }, padding = { top: 56, right: 16, bottom: 72, left: 16 }): { project(xCm: number, yCm: number): { x: number; y: number }; pxPerCm: number } {
  const availW = canvas.width - padding.left - padding.right;
  const availH = canvas.height - padding.top - padding.bottom;
  const pxPerCm = Math.min(availW / arenaCm.width, availH / arenaCm.height);
  const ox = canvas.x + padding.left + (availW - arenaCm.width * pxPerCm) / 2;
  const oy = canvas.y + padding.top + (availH - arenaCm.height * pxPerCm) / 2;
  return { pxPerCm, project: (xCm, yCm) => ({ x: ox + xCm * pxPerCm, y: oy + yCm * pxPerCm }) };
}
