/**
 * The steps that run once a live watched round is open in the arena (after the real UI path, or on the mock in the
 * self-test): the render checks, the viewed-equals-headless hash, the cursor-save frame trace, and playing the match on
 * to its report.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../../../src/core/model';
import { checkCanvas, checkHashEqual, checkSaveTrace, checkTokens, canvasNotBlank, tokenCensus } from '../lib/checks';
import { headlessRoundHash } from '../lib/headless';
import { readGameState } from '../lib/saves';
import { decodePng } from '../lib/png';
import { SmokeFailure, sleep, type PageDriver } from '../lib/page';
import { ROUTE, SEL } from '../lib/selectors';
import { analyzeSaveTrace } from '../lib/stats';
import { canvasInfo, frame, frameOrNull, logHash, pause, play, projectUnits, requireHook, setSpeed, sideColors, stats, traceCursorSave, type CanvasInfo, type HookInfo } from '../lib/viewer';
import type { JourneyEnv } from './env';

export interface WatchedOptions {
  /** 'career': the real UI path (the match is played on to its report). 'mock': the self-test page (no routes). */
  path: 'career' | 'mock';
}

/**
 * The game state of the page: the round autosave in its IndexedDB parsed in Node (what a reload would load; exists in
 * every build), else window.__arena.state() when the build has one. null with the reason when neither works.
 */
export async function pageState(page: PageDriver, env: JourneyEnv, hook: HookInfo): Promise<{ state: GameState; source: string } | { state: null; problem: string }> {
  return await readGameState(page, env.content, hook.hasState);
}

export async function watchedRoundSteps(page: PageDriver, env: JourneyEnv, opts: WatchedOptions): Promise<void> {
  const { rec } = env;
  let hook!: HookInfo;
  let canvas!: CanvasInfo;

  await rec.step('arena.hook', 'The test hook and the viewer are there, the first frame is drawn', async () => {
    hook = await requireHook(page, { needFixture: false, timeoutMs: 20_000 });
    await page.waitFor('(() => { try { return window.__arena.viewer.frame().units.length === 10; } catch (e) { return false; } })()', 'the viewer to draw a frame of ten units', {
      timeoutMs: 20_000,
      blocked: { code: 'smoke.viewer-no-frame' },
    });
    const c = await canvasInfo(page);
    if (!c) throw new SmokeFailure('arena.no-canvas', 'There is no canvas on the arena screen.');
    canvas = c;
  });

  await rec.step('arena.render', 'WebGL context, non-blank canvas, ten ringed tokens', async () => {
    await pause(page);
    const st = await stats(page);
    rec.measurements['viewer.stats.open'] = st;
    const glOk = canvas.webgl && canvas.contextLost !== true && (st.renderer === 'webgl' || st.renderer === 'webgpu');
    rec.check({
      id: 'arena.webgl',
      title: 'The arena has a WebGL context',
      status: glOk ? 'pass' : 'fail',
      ref: 'A11 checks',
      expected: 'a live WebGL canvas (viewer.stats().renderer = webgl)',
      actual: `renderer ${st.renderer}, canvas webgl ${canvas.webgl}, context lost ${canvas.contextLost}, ${canvas.pixelWidth}x${canvas.pixelHeight} px`,
    });
    const f = await frame(page);
    const shot = await page.screenshot(join(env.outDir, 'shots', `${opts.path}-arena-open.png`));
    rec.screenshots.push({ file: `shots/${opts.path}-arena-open.png`, label: 'Arena as opened (live round)', width: page.viewport.width, height: page.viewport.height, tags: { path: opts.path, tick: f.tick } });
    const img = decodePng(shot);
    rec.check(checkCanvas(canvasNotBlank(img, canvas.rect), `${opts.path}, tick ${Math.round(f.tick)}`));
    const sc = await sideColors(page, env.opts.ringColors);
    const proj = await projectUnits(page, f, canvas);
    rec.check(checkTokens(tokenCensus(img, proj.probes, sc.colors, proj.radiusPx), `${opts.path}; colours ${sc.names.join(', ')}; projection ${proj.method}`));
  });

  await rec.step('arena.hash', 'The viewed round hashes like the headless round (vis-009)', async () => {
    const viewed = await logHash(page);
    const read = await pageState(page, env, hook);
    if (!read.state) {
      const why = `No game state to replay headless in Node: ${read.problem}`;
      rec.skipCheck('hash.viewed-eq-headless', 'Viewed round hash equals the headless round hash', why, 'vis-009');
      // Not a pass and not a failure: the comparison could not be made, so the run is blocked until the state can be read.
      rec.block('smoke.state-missing', why, 'arena.hash');
      return;
    }
    const headless = env.headless ? env.headless(read.state) : headlessRoundHash(read.state, env.content);
    rec.measurements['hash.viewed'] = { viewed, headless: headless.hash, recomputed: headless.recomputed, source: headless.source, state: read.source };
    if (headless.problem?.kind === 'stub') {
      rec.skipCheck('hash.viewed-eq-headless', 'Viewed round hash equals the headless round hash', headless.problem.message, 'vis-009');
      rec.block('smoke.core-stub', headless.problem.message, 'arena.hash');
      return;
    }
    if (headless.problem) {
      rec.check({ id: 'hash.viewed-eq-headless', title: 'Viewed round hash equals the headless round hash', status: 'fail', ref: 'vis-009', actual: `${headless.source}: ${headless.problem.message}` });
      return;
    }
    rec.check(checkHashEqual('hash.viewed-eq-headless', 'Viewed round hash equals the headless round hash', 'vis-009', viewed, headless.hash, { viewedName: 'the viewer\'s logHash()', referenceName: `Node's ${headless.source}` }));
    rec.check(checkHashEqual('hash.recomputed', 'The log hash equals hashEventStream over its events', 'vis-009', headless.hash, headless.recomputed, { viewedName: 'FightLog.hash', referenceName: 'hashEventStream(header, events)' }));
  });

  await rec.step('arena.trace', 'Frame-time trace at 4x across a cursor save (auto-pause stop, save, resume)', async () => {
    let run;
    try {
      run = await traceCursorSave(page, { hasState: hook.hasState });
    } catch (e) {
      if (e instanceof SmokeFailure) {
        rec.check({ id: 'perf.cursor-save-trace', title: 'Frame-time trace across a cursor save', status: 'fail', ref: 'A11 test-first 5', actual: e.message });
        return;
      }
      throw e;
    }
    const analysis = analyzeSaveTrace(run.series, run.marks);
    rec.check(checkSaveTrace(analysis, run.stopKind, env.perf));
    rec.measurements['perf.cursorSaveTrace'] = { ...analysis, stopKind: run.stopKind, stopTick: run.stopTick, marks: run.marks };
    const file = 'cursor-save-trace.json';
    writeFileSync(join(env.outDir, file), `${JSON.stringify({ stopKind: run.stopKind, stopTick: run.stopTick, marks: run.marks, t: run.series.t.map((v) => Math.round(v * 100) / 100), tick: run.series.tick }, null, 0)}\n`, 'utf8');
    rec.artifacts.push(file);
    // The cursor must have been persisted at the stop (match.watch + auto-round): read it back once the trace is over.
    const read = await pageState(page, env, hook);
    const cursor = read.state?.liveMatch?.watch?.cursorTick;
    if (cursor === undefined) {
      rec.skipCheck('save.cursor-persisted', 'The cursor was persisted at the stop', read.state ? 'liveMatch.watch.cursorTick is not set in the saved state (save v5, WP-M2B).' : `no saved state to read: ${read.problem}`, 'A3 tech-019');
    } else {
      const ok = cursor >= Math.floor(run.stopTick) - 2;
      rec.check({
        id: 'save.cursor-persisted',
        title: 'The cursor was persisted at the stop',
        status: ok ? 'pass' : 'fail',
        ref: 'A3 tech-019',
        expected: `liveMatch.watch.cursorTick >= the stop tick (${Math.floor(run.stopTick)})`,
        actual: `cursorTick ${cursor}`,
      });
    }
  });

  if (opts.path === 'career') {
    await rec.step('arena.finish', 'Play the match on at 4x to its report (between rounds, then the report)', () => finishMatch(page, env));
  }
}

/** After the last round pacing may take the player Home with a result toast instead of the report; the toast appears a moment after the route changes. */
const TOAST_GRACE_MS = 6_000;

/**
 * Keep the match playing at 4x through the rounds until its report opens: the report itself, or Home with the result toast whose
 * action opens it. Home with neither is not an end the contract allows, so it fails.
 */
export async function finishMatch(page: PageDriver, env: JourneyEnv, graceMs = TOAST_GRACE_MS): Promise<void> {
  const { rec } = env;
  const deadline = Date.now() + 6 * 60_000;
  let rounds = 1;
  let lastHash = '';
  let homeSince = 0;
  while (Date.now() < deadline) {
    const hash = await page.eval<string>('location.hash');
    if (ROUTE.report.test(hash)) break;
    if (ROUTE.home.test(hash)) {
      homeSince = homeSince || Date.now();
      const toast = await page.locate(SEL.openReportToast);
      if (toast) {
        await page.mouseClick(toast.x, toast.y);
        await page.waitForHash(ROUTE.report, 'the match report', 10_000);
        break;
      }
      if (Date.now() - homeSince > graceMs) break;
    } else {
      homeSince = 0;
      if (ROUTE.betweenRounds.test(hash)) {
        if (hash !== lastHash) rec.say(`  between rounds after round ${rounds}`);
        await page.click(SEL.betweenRoundsContinue, 'Continue on the between-rounds screen');
        rounds++;
        await sleep(500);
      } else if (ROUTE.arena.test(hash)) {
        if (hash !== lastHash) rec.say(`  arena, round ${rounds}`);
        // Keep it playing: an auto-pause stop waits for the player.
        const f = await frameOrNull(page).catch(() => null);
        if (f && !f.ended) {
          await setSpeed(page, 4).catch(() => undefined);
          await play(page).catch(() => undefined);
        }
      }
    }
    lastHash = hash;
    await sleep(400);
  }
  const end = await page.eval<string>('location.hash');
  await sleep(600);
  await page.screenshot(join(env.outDir, 'shots', 'career-after-match.png'));
  rec.screenshots.push({ file: 'shots/career-after-match.png', label: 'After the match', width: page.viewport.width, height: page.viewport.height, tags: { path: 'career', hash: end } });
  rec.measurements['career.rounds'] = rounds;
  if (!ROUTE.report.test(end)) {
    throw new SmokeFailure(
      'career.no-report',
      ROUTE.home.test(end)
        ? `The match ended at Home with neither the report nor the result toast that opens it (${rounds} round(s) seen).`
        : `The match did not reach its report within 6 minutes (the page is at ${end}, ${rounds} round(s) seen).`,
    );
  }
  rec.check({
    id: 'career.watch-flow',
    title: 'Play match, Watch, the rounds, between rounds and the report',
    status: 'pass',
    ref: 'A11',
    expected: 'the watched match commits and reaches its report',
    actual: `${rounds} round(s) watched, report at ${end}`,
  });
}
