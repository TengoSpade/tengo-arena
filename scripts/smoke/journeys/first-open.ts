/**
 * Journey: the first viewer open as a player meets it (05-technical-m2 §A10 "first open", 500 ms; A5 tech-025 the idle
 * prefetch). Three fresh pages, each: a seeded new career through the real UI to the day of the match (so the app sits on
 * Home or Squad with a match next, where the idle prefetch is armed), a wait for the idle prefetch to have fetched the
 * viewer chunks, then Watch. The time runs from the click on Watch to the first frame of ten units drawn (the test hook's
 * ready() and frame(), or, in a build without the hook, a sized canvas) plus two animation frames.
 *
 * The first page is the cold open (nothing of the game cached in the browser session yet); the other two are warm. In a
 * `smoke` build the test hook also starts the same prefetch at boot, so that build shows what a warm open costs; a
 * `--build-mode production` build has no hook, so only the real idle trigger can have fetched the chunks, which is what
 * the "prefetch seen" check proves.
 */
import { checkFirstOpen } from '../lib/checks';
import type { CheckResult } from '../lib/report';
import { PageDriver, SmokeFailure, sleep } from '../lib/page';
import { newCareerToMatchday, playMatchAndWatch } from './career';
import type { JourneyEnv } from './env';

/** The chunks PixiJS and the viewer fetch when a viewer is created (dist asset names without the hash): what the prefetch is to warm. */
export const VIEWER_CHUNKS = ['viewer', 'browserAll', 'WebGLRenderer'] as const;
export const OPENS = 3;

export interface ChunkSeen {
  /** How long before the end of the wait the chunk's request started and finished (ms), and its transfer size. */
  startedAgoMs: number;
  endedAgoMs: number;
  kB: number;
}

export interface PrefetchSeen {
  chunks: Record<string, ChunkSeen | null>;
  /** How long the wait lasted. */
  waitedMs: number;
}

/** Wait (at most 10 s) for the viewer chunks to appear in the resource timing, then a second for an idle callback to finish. */
export const WAIT_FOR_PREFETCH = `(async () => {
  const names = ${JSON.stringify(VIEWER_CHUNKS)};
  const find = (n) => performance.getEntriesByType('resource').find((e) => { const p = e.name.split('?')[0]; return p.includes('/assets/' + n + '-') && p.endsWith('.js'); });
  const t0 = performance.now();
  while (performance.now() - t0 < 10000) {
    if (names.every((n) => { const e = find(n); return !!e && e.responseEnd > 0; })) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await new Promise((r) => setTimeout(r, 1000));
  const now = performance.now();
  const chunks = {};
  for (const n of names) {
    const e = find(n);
    chunks[n] = e ? { startedAgoMs: Math.round(now - e.startTime), endedAgoMs: Math.round(now - e.responseEnd), kB: Math.round((e.encodedBodySize || 0) / 1024) } : null;
  }
  return { chunks, waitedMs: Math.round(now - t0) };
})()`;

/** Stamp the click on Watch and time the viewer to its first drawn frame. Returns which signal it reads ('hook' or 'dom'). */
export const ARM_OPEN_TIMER = `(() => {
  const w = window;
  w.__open = { t0: null, ms: null };
  const hook = () => { const a = w.__arena; return a && a.viewer && typeof a.viewer.ready === 'function' ? a.viewer : null; };
  const drawn = () => {
    const h = hook();
    if (h) { try { const f = h.frame(); return !!h.ready() && !!f && Array.isArray(f.units) && f.units.length === 10; } catch (e) { return false; } }
    const c = document.querySelector('canvas');
    return !!c && c.width > 0 && c.height > 0;
  };
  document.addEventListener('click', () => {
    if (w.__open.t0 !== null) return;
    w.__open.t0 = performance.now();
    const tick = () => {
      if (drawn()) { requestAnimationFrame(() => requestAnimationFrame(() => { w.__open.ms = performance.now() - w.__open.t0; })); return; }
      if (performance.now() - w.__open.t0 > 20000) { w.__open.ms = -1; return; }
      requestAnimationFrame(tick);
    };
    tick();
  }, { capture: true });
  return hook() ? 'hook' : 'dom';
})()`;

/** Pure: did the idle prefetch have the viewer chunks fetched, in every page, before Watch was pressed? */
export function checkPrefetchSeen(pages: readonly PrefetchSeen[], signal: string): CheckResult {
  const base = { id: 'perf.first-open-prefetch', title: 'The viewer chunks were prefetched before Watch', ref: 'A5 tech-025', expected: `${VIEWER_CHUNKS.join(', ')} fetched while the player was on Home or Squad` };
  if (pages.length === 0) return { ...base, status: 'skip', actual: 'no page measured' };
  const missing: string[] = [];
  pages.forEach((p, i) => {
    for (const n of VIEWER_CHUNKS) if (!p.chunks[n]) missing.push(`page ${i + 1}: ${n}`);
  });
  const first = pages[0]!;
  const list = VIEWER_CHUNKS.map((n) => {
    const c = first.chunks[n];
    return c ? `${n} ${c.kB} kB, done ${(c.endedAgoMs / 1000).toFixed(1)} s before the click` : `${n} not fetched`;
  }).join('; ');
  if (missing.length > 0) return { ...base, status: 'fail', actual: `not fetched before Watch: ${missing.join(', ')}`, detail: `The wait for the idle prefetch ended with these chunks still unfetched, so the open measured was a cold one. ${list}.` };
  const trigger = signal === 'hook' ? 'the smoke build\'s test hook also prefetches at boot, so this shows a warm open, not which trigger fired' : 'a build without the test hook: only the UI\'s idle prefetch can have fetched them';
  return { ...base, status: 'pass', actual: `all ${VIEWER_CHUNKS.length} chunks fetched before Watch in ${pages.length} of ${pages.length} pages (page 1: ${list})`, detail: `Read from the resource timing of each page; ${trigger}.` };
}

export async function runFirstOpenJourney(env: JourneyEnv): Promise<void> {
  const { rec, opts } = env;
  await rec.journey('open', async () => {
    const samples: number[] = [];
    const seen: PrefetchSeen[] = [];
    let signal = '';
    for (let i = 1; i <= OPENS; i++) {
      const page = await PageDriver.open(env.client, { width: 1920, height: 1080, colorScheme: 'dark' });
      try {
        await rec.step(`open.career-${i}`, `Open ${i} of ${OPENS}${i === 1 ? ' (cold)' : ''}: new career "${opts.seed}" to the day of the match`, () => newCareerToMatchday(page, env.baseUrl, opts.seed, (s) => rec.say(s)));
        const pre = await rec.step(`open.idle-${i}`, 'Stay on the screen while the idle prefetch runs', () => page.eval<PrefetchSeen>(WAIT_FOR_PREFETCH, 20_000));
        seen.push(pre);
        const ms = await rec.step(`open.watch-${i}`, 'Press Watch and time the viewer to its first drawn frame', async () => {
          signal = await page.eval<string>(ARM_OPEN_TIMER);
          await playMatchAndWatch(page);
          const deadline = Date.now() + 25_000;
          while (Date.now() < deadline) {
            const v = await page.eval<number | null>('window.__open && window.__open.ms');
            if (typeof v === 'number') {
              if (v < 0) throw new SmokeFailure('open.never-drawn', 'Watch was pressed but no viewer drew a frame within 20 s.');
              return v;
            }
            await sleep(100);
          }
          throw new SmokeFailure('open.no-timing', 'The open timer never reported.');
        });
        samples.push(ms);
        rec.say(`  open ${i}: ${ms.toFixed(0)} ms`);
      } finally {
        env.collectConsole(page);
        await page.close();
      }
    }
    rec.measurements['open.firstOpen'] = { samplesMs: samples, signal, buildMode: opts.buildMode, prefetch: seen };
    rec.check(checkPrefetchSeen(seen, signal));
    rec.check(
      checkFirstOpen(samples, env.perf, {
        id: 'perf.first-open-real',
        title: 'First viewer open from Watch, after the idle prefetch (real path)',
        coldNote: 'This is the player\'s path: a career, Home or Squad with a match next, the idle prefetch, then Watch.',
      }),
    );
  });
}
