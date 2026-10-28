import { describe, expect, it } from 'vitest';
import {
  canvasNotBlank,
  checkCanvas,
  checkConsole,
  checkCpuFrame,
  checkFirstOpen,
  checkFrameRate,
  checkHashEqual,
  checkHeap,
  checkRoundLoad,
  checkSaveTrace,
  loadNote,
  checkTokens,
  colorDistance,
  letterboxProject,
  parseCssColor,
  splitConsole,
  tokenCensus,
  type TokenProbe,
} from './checks';
import { makeImage, paintRing } from './png';
import { analyzeHeap, summarizeIntervals, type TraceAnalysis } from './stats';

const gpu = { softwareGl: false, strict: false };
const soft = { softwareGl: true, strict: false };

const steady = (n: number, ms = 16.67): number[] => Array.from({ length: n }, () => ms);

describe('frame-rate check (A10)', () => {
  it('passes a steady 60 fps run', () => {
    const c = checkFrameRate('perf.fps-1x', '1x', summarizeIntervals(steady(600)), gpu);
    expect(c.status).toBe('pass');
    expect(c.id).toBe('perf.fps-1x');
  });

  it('fails a slow run on a GPU, warns on software GL, fails again when strict', () => {
    const slow = summarizeIntervals(steady(600, 25));
    expect(checkFrameRate('perf.fps-4x', '4x', slow, gpu).status).toBe('fail');
    const warn = checkFrameRate('perf.fps-4x', '4x', slow, soft);
    expect(warn.status).toBe('warn');
    expect(warn.detail).toMatch(/Software WebGL/);
    expect(checkFrameRate('perf.fps-4x', '4x', slow, { softwareGl: true, strict: true }).status).toBe('fail');
  });

  it('fails a run with one long frame', () => {
    const s = summarizeIntervals([...steady(600), 70]);
    const c = checkFrameRate('perf.fps-1x', '1x', s, gpu);
    expect(c.status).toBe('fail');
    expect(c.actual).toMatch(/1 over/);
  });

  it('fails when too few playing frames were recorded, whatever the machine', () => {
    const c = checkFrameRate('perf.fps-1x', '1x', summarizeIntervals(steady(20)), soft);
    expect(c.status).toBe('fail');
    expect(c.detail).toMatch(/at least 60/);
  });

  it('cpu per frame and first open', () => {
    expect(checkCpuFrame(3.2, gpu).status).toBe('pass');
    expect(checkCpuFrame(6, gpu).status).toBe('fail');
    expect(checkCpuFrame(null, gpu).status).toBe('skip');
    expect(checkFirstOpen(300, gpu).status).toBe('pass');
    expect(checkFirstOpen(900, gpu).status).toBe('fail');
    expect(checkFirstOpen(null, gpu).status).toBe('skip');
  });
});

describe('cursor-save trace check (A11 test-first item 5)', () => {
  const base: TraceAnalysis = {
    frames: 250,
    windowMs: 4000,
    maxMs: 17,
    over33: 0,
    worst: { ms: 17, phase: 'playing', atMs: 800, offsetFromStopMs: -300 },
    phases: { playing: summarizeIntervals(steady(100)), stopped: summarizeIntervals(steady(50)), resumed: summarizeIntervals(steady(100)) },
    complete: true,
    missing: [],
  };

  it('passes with no frame over 33 ms', () => {
    expect(checkSaveTrace(base, 'auto', gpu).status).toBe('pass');
  });

  it('fails with a hitch, and says the phase', () => {
    const c = checkSaveTrace({ ...base, over33: 1, maxMs: 52, worst: { ms: 52, phase: 'stopped', atMs: 1800, offsetFromStopMs: 120 } }, 'auto', gpu);
    expect(c.status).toBe('fail');
    expect(c.actual).toMatch(/"stopped" phase/);
    expect(c.actual).toMatch(/\+120 ms from the stop/);
  });

  it('fails an incomplete trace regardless of the machine', () => {
    const c = checkSaveTrace({ ...base, complete: false, missing: ['stopped', 'resume'] }, 'auto', soft);
    expect(c.status).toBe('fail');
    expect(c.actual).toMatch(/stopped, resume/);
  });

  it('notes a manual pause', () => {
    expect(checkSaveTrace(base, 'manual', gpu).detail).toMatch(/manual pause/);
  });
});

describe('heap check (A10)', () => {
  const mb = (n: number): number => n * 1024 * 1024;
  it('passes a flat heap', () => {
    expect(checkHeap(analyzeHeap(Array.from({ length: 20 }, () => mb(30)))).status).toBe('pass');
  });
  it('fails growth over 50 MB', () => {
    expect(checkHeap(analyzeHeap(Array.from({ length: 20 }, (_, i) => mb(30 + i * 5)))).status).toBe('fail');
  });
  it('warns on a steady climb that stays under the cap', () => {
    const c = checkHeap(analyzeHeap(Array.from({ length: 20 }, (_, i) => mb(30 + i * 0.8))));
    expect(c.status).toBe('warn');
    expect(c.detail).toMatch(/keeps climbing/);
  });
});

describe('hash checks', () => {
  const names = { viewedName: 'viewer', referenceName: 'Node' };
  it('equal hashes pass', () => {
    expect(checkHashEqual('h', 't', 'vis-009', 'abc', 'abc', names).status).toBe('pass');
  });
  it('different hashes fail and say so', () => {
    const c = checkHashEqual('h', 't', 'vis-009', 'abc', 'abd', names);
    expect(c.status).toBe('fail');
    expect(c.actual).toMatch(/viewer abc, Node abd/);
    expect(c.detail).toMatch(/determinism defect/);
  });
  it('a missing side is a skip, not a pass', () => {
    expect(checkHashEqual('h', 't', 'vis-009', null, 'abd', names).status).toBe('skip');
    expect(checkHashEqual('h', 't', 'vis-009', 'abc', null, names).status).toBe('skip');
  });
});

describe('console errors', () => {
  const rec = (text: string, level: 'error' | 'warning' = 'error', url?: string) => ({ source: 'console', level, text, ...(url ? { url } : {}) });
  it('splits errors from warnings and ignores the favicon', () => {
    const s = splitConsole([rec('boom'), rec('careful', 'warning'), rec('Failed to load resource: 404', 'error', 'http://127.0.0.1:1/favicon.ico')]);
    expect(s.errors.map((e) => e.text)).toEqual(['boom']);
    expect(s.warnings).toBe(1);
    expect(s.ignored).toBe(1);
  });
  it('an extra allow pattern ignores more', () => {
    const s = splitConsole([rec('ResizeObserver loop limit')], [/ResizeObserver/]);
    expect(s.errors).toHaveLength(0);
  });
  it('the check fails on any error', () => {
    expect(checkConsole([], 0).status).toBe('pass');
    expect(checkConsole([rec('x')], 0).status).toBe('fail');
  });
});

describe('colours', () => {
  it('parses css colours', () => {
    expect(parseCssColor('#c9a24a')).toEqual([201, 162, 74]);
    expect(parseCssColor('#fa0')).toEqual([255, 170, 0]);
    expect(parseCssColor('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
    expect(parseCssColor('rgba(10 20 30 / 0.5)')).toEqual([10, 20, 30]);
    expect(parseCssColor('not a colour')).toBeNull();
  });
  it('distance', () => {
    expect(colorDistance([0, 0, 0], [3, 4, 0])).toBe(5);
  });
});

describe('pixel checks', () => {
  it('a flat image is blank, a drawn one is not', () => {
    const flat = makeImage(200, 120, [40, 40, 40]);
    expect(canvasNotBlank(flat, { x: 0, y: 0, width: 200, height: 120 }).ok).toBe(false);
    const drawn = makeImage(200, 120, [40, 40, 40]);
    paintRing(drawn, 60, 60, 30, 0, [200, 160, 70]);
    paintRing(drawn, 140, 60, 30, 0, [70, 120, 170]);
    paintRing(drawn, 100, 60, 12, 0, [220, 220, 220]);
    paintRing(drawn, 100, 100, 10, 0, [10, 200, 10]);
    expect(canvasNotBlank(drawn, { x: 0, y: 0, width: 200, height: 120 }).ok).toBe(true);
    expect(checkCanvas(canvasNotBlank(flat, { x: 0, y: 0, width: 200, height: 120 }), 't').status).toBe('fail');
  });

  const brass: [number, number, number] = [201, 162, 74];
  const steel: [number, number, number] = [74, 120, 168];

  function arena(opts: { drop?: number; swapOne?: boolean } = {}): { img: ReturnType<typeof makeImage>; probes: TokenProbe[] } {
    const img = makeImage(640, 360, [100, 95, 85]);
    const probes: TokenProbe[] = [];
    for (let i = 0; i < 10; i++) {
      const side = i < 5 ? 0 : 1;
      const x = 80 + (i % 5) * 110;
      const y = side === 0 ? 120 : 240;
      probes.push({ unit: i, side, standing: true, x, y });
      if (i === opts.drop) continue;
      const colour = opts.swapOne && i === 2 ? steel : side === 0 ? brass : steel;
      paintRing(img, x, y, 20, 15, colour);
      paintRing(img, x, y, 14, 0, [60, 50, 30]);
    }
    return { img, probes };
  }

  it('finds all ten ringed tokens, with a projection a few pixels off', () => {
    const { img, probes } = arena();
    const off = probes.map((p) => ({ ...p, x: p.x + 4, y: p.y - 3 }));
    const c = tokenCensus(img, off, [brass, steel], 28);
    expect(c.found).toBe(10);
    expect(c.sidesConsistent).toBe(true);
    expect(checkTokens(c, 'test').status).toBe('pass');
  });

  it('misses a token that is not drawn', () => {
    const { img, probes } = arena({ drop: 7 });
    const c = tokenCensus(img, probes, [brass, steel], 28);
    expect(c.found).toBe(9);
    expect(c.missing).toEqual([7]);
    expect(checkTokens(c, 'test').status).toBe('fail');
  });

  it('flags a ring in the wrong side colour: that token shows none of its own side\'s', () => {
    const { img, probes } = arena({ swapOne: true });
    const c = tokenCensus(img, probes, [brass, steel], 28);
    expect(c.assignment).toEqual([0, 1]);
    expect(c.found).toBe(9);
    expect(c.missing).toEqual([2]);
    expect(c.sidesConsistent).toBe(false);
    expect(checkTokens(c, 'test').status).toBe('fail');
  });

  it('two clubs whose trims share the ring hue do not swap the sides (the opponent\'s trim is brass-coloured)', () => {
    const { img, probes } = arena();
    // The opponent's tokens carry a thick brass trim inside their steel ring: more brass pixels than steel ones.
    for (const p of probes.filter((q) => q.side === 1)) paintRing(img, p.x, p.y, 14, 9, brass);
    const c = tokenCensus(img, probes, [brass, steel], 28);
    expect(c.assignment).toEqual([0, 1]);
    expect(c.found).toBe(10);
    expect(c.sidesConsistent).toBe(true);
    expect(checkTokens(c, 'test').status).toBe('pass');
  });

  it('works whichever candidate belongs to which side, and with extra candidates', () => {
    const { img, probes } = arena();
    const other: [number, number, number] = [10, 200, 10];
    const c = tokenCensus(img, probes, [other, steel, brass], 28);
    expect(c.assignment).toEqual([2, 1]);
    expect(c.found).toBe(10);
  });

  it('nothing matching is no assignment and no token found', () => {
    const { img, probes } = arena();
    const c = tokenCensus(img, probes, [[255, 0, 255], [0, 255, 255]], 28);
    expect(c.assignment).toBeNull();
    expect(c.found).toBe(0);
    expect(c.sidesConsistent).toBe(false);
  });

  it('does not require downed tokens', () => {
    const { img, probes } = arena({ drop: 3 });
    probes[3] = { ...probes[3]!, standing: false };
    const c = tokenCensus(img, probes, [brass, steel], 28);
    expect(c.expected).toBe(9);
    expect(c.found).toBe(9);
    // Nine tokens are not the ten the check wants.
    expect(checkTokens(c, 'test').status).toBe('fail');
  });

  it('projects the arena letterboxed inside the camera padding', () => {
    // 1920 x 1080 canvas, padding 56 / 16 / 72 / 16: 1888 x 952 available, 3200 x 1800 cm arena.
    const lb = letterboxProject({ x: 0, y: 0, width: 1920, height: 1080 }, { width: 3200, height: 1800 });
    expect(lb.pxPerCm * 100).toBeCloseTo(52.9, 1);
    const topLeft = lb.project(0, 0);
    const bottomRight = lb.project(3200, 1800);
    expect(topLeft.y).toBeCloseTo(56, 5);
    expect(bottomRight.y).toBeCloseTo(1080 - 72, 5);
    expect(topLeft.x + (1920 - bottomRight.x)).toBeCloseTo(2 * topLeft.x, 5);
  });
});

describe('round load (A10: the sim at full plus indexFightLog, median 15 ms, p99 30 ms)', () => {
  const t = (sim: number[], index: number[] | null, problem: string | null = null) => ({ simMs: sim, indexMs: index, loadMs: index ? sim.map((v, i) => v + index[i]!) : null, indexProblem: problem });

  it('passes a load within both numbers', () => {
    const c = checkRoundLoad(t(Array(24).fill(8), Array(24).fill(3)), 'Chromium');
    expect(c.status).toBe('pass');
    expect(c.id).toBe('perf.round-load');
    expect(c.actual).toMatch(/median 11\.0 ms/);
  });

  it('fails a slow median, and a slow tail', () => {
    expect(checkRoundLoad(t(Array(24).fill(12), Array(24).fill(6)), 'Chromium').status).toBe('fail');
    const tail = [...Array(23).fill(8), 40];
    expect(checkRoundLoad(t(tail, Array(24).fill(3)), 'Chromium').status).toBe('fail');
  });

  it('is a CPU measurement: software WebGL does not turn a miss into a warning', () => {
    expect(checkRoundLoad(t(Array(24).fill(30), Array(24).fill(10)), 'Chromium').status).toBe('fail');
  });

  it('without indexFightLog the sim alone is a lower bound and is not accepted: the check is not made', () => {
    const c = checkRoundLoad(t(Array(24).fill(4), null, 'Not implemented yet: render.indexFightLog'), 'Chromium');
    expect(c.status).toBe('skip');
    expect(c.pending).toBeUndefined();
    expect(c.detail).toMatch(/lower bound/);
    expect(c.detail).toMatch(/render.indexFightLog/);
  });
});

describe('what bounds a slow frame rate', () => {
  const slow = summarizeIntervals(steady(600, 17.6));
  const quiet = { wallS: 10, task: 0.3, script: 0.15, layout: 0.01, style: 0.02 };
  const busy = { wallS: 10, task: 0.9, script: 0.6, layout: 0.1, style: 0.1 };

  it('a miss with a quiet main thread says the time goes to the GPU or the compositor', () => {
    const c = checkFrameRate('perf.fps-1x', '1x', slow, gpu, quiet);
    expect(c.status).toBe('fail');
    expect(c.detail).toMatch(/Main thread busy 30%/);
    expect(c.detail).toMatch(/GPU or the compositor/);
  });

  it('a miss with a busy main thread points at script, layout and style', () => {
    expect(checkFrameRate('perf.fps-1x', '1x', slow, gpu, busy).detail).toMatch(/look at script, layout and style/);
  });

  it('a pass carries no note, and no load measured gives no note', () => {
    expect(checkFrameRate('perf.fps-1x', '1x', summarizeIntervals(steady(600)), gpu, quiet).detail).toBeUndefined();
    expect(checkFrameRate('perf.fps-1x', '1x', slow, gpu, null).detail).toBeUndefined();
    expect(loadNote(null)).toBeNull();
  });
});
