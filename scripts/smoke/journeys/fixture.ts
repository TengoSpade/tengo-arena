/**
 * Journey: the dev world's fixed round through the test hook (05-technical-m2 §A11 "Two paths", first). Seek to fixed
 * ticks, screenshots in both themes at two sizes, with reduced motion and under four colour-vision deficiencies;
 * fps and our frame time at 1x and 4x; the heap over consecutive round loads; the hash of the loaded log.
 */
import { join } from 'node:path';
import { decodePng } from '../lib/png';
import { checkCanvas, checkCpuFrame, checkFirstOpen, checkFrameRate, checkHashEqual, checkHeap, checkTokens, canvasNotBlank, tokenCensus } from '../lib/checks';
import { PageDriver, SmokeFailure, type VisionDeficiency } from '../lib/page';
import { analyzeHeap, playingIntervals, summarizeIntervals } from '../lib/stats';
import { canvasInfo, frame, loadFixtureRound, logHash, playFor, projectUnits, requireHook, seek, settle, sideColors, stats, type CanvasInfo } from '../lib/viewer';
import type { JourneyEnv } from './env';

interface Shot {
  name: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
  reducedMotion: boolean;
  vision: VisionDeficiency;
  tick: number;
}

/** The screenshot matrix: two sizes x two themes, reduced motion at both sizes, four deficiencies at 1920, plus the spawn frame. */
export function screenshotPlan(midTick: number): Shot[] {
  const base = { reducedMotion: false, vision: 'none' as VisionDeficiency };
  const plan: Shot[] = [];
  const sizes = [
    [1280, 720],
    [1920, 1080],
  ] as const;
  // Dark first, then light: the page is reloaded once for the theme change.
  for (const [width, height] of sizes) {
    plan.push({ ...base, name: `${width}x${height}-dark-t${midTick}`, width, height, theme: 'dark', tick: midTick });
    plan.push({ ...base, name: `${width}x${height}-dark-reduced-motion-t${midTick}`, width, height, theme: 'dark', reducedMotion: true, tick: midTick });
  }
  plan.push({ ...base, name: '1920x1080-dark-t10-spawn', width: 1920, height: 1080, theme: 'dark', tick: 10 });
  for (const vision of ['deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia'] as const) {
    plan.push({ ...base, name: `1920x1080-dark-${vision}-t${midTick}`, width: 1920, height: 1080, theme: 'dark', vision, tick: midTick });
  }
  for (const [width, height] of sizes) plan.push({ ...base, name: `${width}x${height}-light-t${midTick}`, width, height, theme: 'light', tick: midTick });
  return plan;
}

async function openPage(env: JourneyEnv, theme: 'dark' | 'light', width = 1920, height = 1080): Promise<PageDriver> {
  const page = await PageDriver.open(env.client, { width, height, colorScheme: theme });
  await page.goto(`${env.baseUrl}/?theme=${theme}#/home`);
  await page.waitFor("document.querySelector('#app') && document.querySelector('#app').children.length > 0", 'the app to start', { timeoutMs: 30_000 });
  return page;
}

export async function runFixtureJourney(env: JourneyEnv): Promise<void> {
  const { rec, opts } = env;
  await rec.journey('fixture', async () => {
    let page = await openPage(env, 'dark');
    try {
      await rec.step('fixture.hook', 'The test hook is in the build', async () => {
        await requireHook(page, { needFixture: true });
      });

      let canvas!: CanvasInfo;
      let endTick = 0;
      await rec.step('fixture.open', 'Load the fixed round (first viewer open)', async () => {
        const opened = await loadFixtureRound(page);
        rec.measurements['fixture.firstOpen'] = opened;
        rec.check(checkFirstOpen(opened.ms, env.perf));
        const c = await canvasInfo(page);
        if (!c) throw new SmokeFailure('arena.no-canvas', 'loadFixtureRound() finished but the page has no canvas.');
        canvas = c;
        const f = await frame(page);
        if (f.units.length !== 10) throw new SmokeFailure('arena.units', `The fixture round shows ${f.units.length} units, not ten.`);
        // Replay: the viewer knows the end; a live-style viewer does not. Either way keep to a tick inside the fight.
        const v = await page.eval<number | null>('(() => { const v = window.__arena.viewer; const e = typeof v.endTick === "function" ? v.endTick() : v.endTick; return typeof e === "number" ? e : null; })()');
        endTick = v ?? 700;
      });

      const midTick = Math.max(40, Math.min(240, Math.floor(endTick / 2)));

      await rec.step('fixture.render', 'WebGL context, non-blank canvas, ten ringed tokens', async () => {
        const st = await stats(page);
        const glOk = canvas.webgl && canvas.contextLost !== true && (st.renderer === 'webgl' || st.renderer === 'webgpu');
        rec.check({
          id: 'arena.webgl',
          title: 'The arena has a WebGL context',
          status: glOk ? 'pass' : 'fail',
          ref: 'A11 checks',
          expected: 'a live WebGL canvas (viewer.stats().renderer = webgl)',
          actual: `renderer ${st.renderer}, canvas webgl ${canvas.webgl}, context lost ${canvas.contextLost}, ${canvas.pixelWidth}x${canvas.pixelHeight} px, resolution ${st.resolution}`,
        });
        await seek(page, 10);
        await settle(page);
        const f = await frame(page);
        const shot = await page.screenshot(null);
        const img = decodePng(shot);
        rec.check(checkCanvas(canvasNotBlank(img, canvas.rect), `fixture, tick ${Math.round(f.tick)}`));
        const sc = await sideColors(page, opts.ringColors);
        const proj = await projectUnits(page, f, canvas);
        rec.check(checkTokens(tokenCensus(img, proj.probes, sc.colors, proj.radiusPx), `fixture, tick ${Math.round(f.tick)}; colours ${sc.names.join(', ')}; projection ${proj.method}`));
      });

      if (!opts.noShots) {
        await rec.step('fixture.screenshots', 'Screenshots: sizes, themes, reduced motion, colour-vision deficiencies', async () => {
          const plan = screenshotPlan(midTick);
          let blank = 0;
          let currentTheme: 'dark' | 'light' = 'dark';
          for (const s of plan) {
            if (s.theme !== currentTheme) {
              env.collectConsole(page);
              await page.close();
              page = await openPage(env, s.theme, s.width, s.height);
              await requireHook(page, { needFixture: true });
              await loadFixtureRound(page);
              currentTheme = s.theme;
            }
            await page.setViewport(s.width, s.height, 1);
            await page.setMedia({ colorScheme: s.theme, reducedMotion: s.reducedMotion });
            await page.setVision(s.vision);
            await loadFixtureRound(page);
            await seek(page, s.tick);
            await settle(page, 3);
            const file = `shots/${s.name}.png`;
            const buf = await page.screenshot(join(env.outDir, file));
            const c = (await canvasInfo(page)) ?? canvas;
            const ok = canvasNotBlank(decodePng(buf), c.rect).ok;
            if (!ok) blank++;
            rec.screenshots.push({ file, label: s.name, width: s.width, height: s.height, tags: { theme: s.theme, reducedMotion: s.reducedMotion, vision: s.vision, tick: s.tick } });
          }
          await page.setVision('none');
          await page.setMedia({ colorScheme: 'dark', reducedMotion: false });
          await page.setViewport(1920, 1080, 1);
          rec.check({
            id: 'arena.screenshots',
            title: `${plan.length} screenshots (two sizes, both themes, reduced motion, four deficiencies) are not blank`,
            status: blank === 0 ? 'pass' : 'fail',
            ref: 'A9, A11',
            expected: 'every screenshot shows a drawn arena',
            actual: blank === 0 ? `${plan.length} drawn` : `${blank} of ${plan.length} blank`,
          });
          await loadFixtureRound(page);
        });
      }

      await rec.step('fixture.fps', `Frame rate and frame time at 1x and 4x (${opts.seconds} s each)`, async () => {
        const cpu: number[] = [];
        for (const speed of [1, 4] as const) {
          await loadFixtureRound(page);
          const run = await playFor(page, { speed, seconds: opts.seconds, reload: () => loadFixtureRound(page) });
          const intervals = playingIntervals(run.series, 5);
          const summary = summarizeIntervals(intervals);
          const st = await stats(page);
          rec.measurements[`perf.fps-${speed}x`] = { ...summary, restarts: run.restarts, resumes: run.resumes, viewerStats: st };
          rec.check(checkFrameRate(`perf.fps-${speed}x` as 'perf.fps-1x' | 'perf.fps-4x', `${speed}x`, summary, env.perf));
          if (Number.isFinite(st.frameMsP95)) cpu.push(st.frameMsP95);
        }
        rec.check(checkCpuFrame(cpu.length ? Math.max(...cpu) : null, env.perf));
      });

      await rec.step('fixture.heap', `JS heap over ${opts.heapLoads} consecutive round loads`, async () => {
        const samples: number[] = [];
        for (let i = 0; i < opts.heapLoads; i++) {
          await loadFixtureRound(page);
          await seek(page, 60);
          await settle(page);
          samples.push(await page.heapUsed(true));
        }
        const analysis = analyzeHeap(samples);
        rec.measurements['perf.heap'] = { ...analysis, samplesMb: samples.map((b) => Math.round((b / 1048576) * 10) / 10) };
        rec.check(checkHeap(analysis));
      });

      await rec.step('fixture.hash', 'The fixed round hashes the same every time it is loaded', async () => {
        await loadFixtureRound(page);
        const a = await logHash(page);
        await loadFixtureRound(page);
        const b = await logHash(page);
        rec.measurements['hash.fixture'] = { first: a, second: b };
        rec.check(checkHashEqual('hash.fixture-stable', 'The fixed round hashes the same on every load', 'vis-009', a, b, { viewedName: 'the first load\'s logHash()', referenceName: 'the second load\'s logHash()' }));
      });
    } finally {
      env.collectConsole(page);
      await page.close();
    }
  });
}

