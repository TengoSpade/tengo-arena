/**
 * Journey: capture the vis-003 observer packets (05-technical-m2 §A11 vis-003 step 2). A seeded new career is played
 * through the real UI and the first N fights of the player's matches are watched at 1x; every fight is captured as a
 * sequence of screenshots (the spawn, a frame every few seconds, and around each down) together with what the screen
 * said at the same moment (text, live regions, role glyphs). The answer key comes from the fight log, by replaying the
 * page's state headless in Node. Then the automated evidence proxy is scored and the files for the observers are written.
 */
import { join } from 'node:path';
import type { ContentDB } from '../../../src/core/content';
import { liveRoundPlayback } from '../../../src/core/game';
import type { FightLog, GameState } from '../../../src/core/model';
import { NotImplementedError } from '../../../src/core/util';
import { PageDriver, SmokeFailure, sleep } from '../lib/page';
import { MATCHDAY_MAIN, ROUTE, SEL } from '../lib/selectors';
import { pressPlayIfPaused } from '../lib/arena-ui';
import { canvasInfo, frame, frameOrNull, logHash, pause, play, requireHook, setSpeed } from '../lib/viewer';
import { buildFightKey } from '../vis003/key';
import { writeVis003Files, frameFile, packetDir, type PacketFight } from '../vis003/packet';
import { planCaptures, type PlannedCapture } from '../vis003/plan';
import { scoreEvidence, summarizeEvidence } from '../vis003/evidence';
import type { Capture, FightKey, ScreenEvidence } from '../vis003/types';
import { continueState, newCareerToMatchday, playMatchAndWatch, resolveDecideFirst } from './career';
import { pageState } from './arena-steps';
import type { JourneyEnv } from './env';
import { writeFileSync } from 'node:fs';

/** Press Continue until the button says "Play match" (after a match: the report or Home, then the next week). */
export async function continueToPlayMatch(page: PageDriver, say: (s: string) => void = () => {}): Promise<void> {
  let decided = 0;
  for (let i = 0; i < 24; i++) {
    const c = await continueState(page);
    say(`  continue: "${c.main}" / "${c.sub}"`);
    if (MATCHDAY_MAIN.test(c.main)) return;
    if (/^Decide first$/i.test(c.main)) {
      await resolveDecideFirst(page, c.sub, decided++);
      continue;
    }
    if ((await page.locate({ css: SEL.continueConfirm })) !== null) await page.click(SEL.continueConfirmPrimary, 'the confirmation');
    else await page.click(SEL.continueButton, 'Continue');
    await sleep(500);
  }
  throw new SmokeFailure('career.no-matchday', 'Continue never reached the next day of a match ("Play match" or "Watch").');
}

/** The key of the round on screen: replay the page's state in Node (core/game) for its log, then read tanks, healers and downs off it. */
export function keyFromState(state: GameState, content: ContentDB, fight: number): { key: FightKey; log: FightLog } {
  const r = liveRoundPlayback(state, content);
  if (!r.ok) throw new SmokeFailure('vis003.no-log', `core/game could not replay the watched round: ${r.error.code}: ${r.error.message}`);
  const names: Record<string, string> = {};
  for (const [id, f] of Object.entries(state.fighters)) names[id] = f.name.full;
  const live = state.liveMatch!;
  const home = live.home.clubId;
  const playerClub = state.playerClubId;
  const ourSide = playerClub === home ? 0 : playerClub === live.away.clubId ? 1 : null;
  const key = buildFightKey(r.value.log, content, {
    fight,
    fixtureId: String(live.fixtureId),
    names,
    ourSide,
    clubNames: [state.clubs[home]?.name ?? 'Home', state.clubs[live.away.clubId]?.name ?? 'Away'],
  });
  return { key, log: r.value.log };
}

/**
 * The key is only the key of THIS fight when the log it came from is the log on screen: a stale auto-round save would key a
 * different fight. The viewer's hash must equal the key's, as in the arena.hash step.
 */
export function assertKeyIsOnScreen(viewed: string | null, key: FightKey, source: string): void {
  if (viewed === key.logHash) return;
  throw new SmokeFailure(
    'vis003.stale-key',
    `The viewer shows log ${viewed ?? 'none'} but the answer key was computed from log ${key.logHash} (${source}): the saved state is not the fight on screen, so the key would be for another fight. Nothing was captured.`,
  );
}

export interface CaptureRun {
  captures: Capture[];
  ended: boolean;
}

/**
 * Play the open round at 1x and take the planned captures (vis003/plan.ts): numbered screenshots on a fixed schedule for the
 * observer packet, and private text-only evidence around every down. Captures are taken when the clock reaches their tick (a
 * few ticks of lag at 1x); a stop (auto-pause) takes every capture planned up to the stop at once, then plays on. A stop
 * adds no capture of its own, so the packet's frame count never depends on the downs.
 */
export async function captureFight(page: PageDriver, key: FightKey, outRoot: string): Promise<CaptureRun> {
  const plan = planCaptures(key);
  const captures: Capture[] = [];
  const dir = packetDir(key.fight);
  let frames = 0;
  const take = async (item: PlannedCapture, tick: number): Promise<void> => {
    let frame: number | null = null;
    let file: string | null = null;
    if (item.packet) {
      frame = ++frames;
      const rel = frameFile(frame);
      await page.screenshot(join(outRoot, dir, rel));
      file = `${dir}/${rel}`;
    }
    const evidence = await page.probe<ScreenEvidence>('evidence').catch(() => null);
    captures.push({ index: captures.length + 1, tick: Math.round(tick), reason: item.reason, frame, file, evidence });
  };
  await setSpeed(page, 1);
  await play(page);
  const startedAt = Date.now();
  const limitMs = key.durationTicks * 50 + 90_000;
  let next = 0;
  let prevTick = -1;
  let still = 0;
  let ended = false;
  while (next < plan.length && Date.now() - startedAt < limitMs) {
    const tick = await page.probe<number>('tick');
    if (Number.isFinite(tick) && tick >= plan[next]!.tick) {
      await take(plan[next]!, tick);
      next++;
      continue;
    }
    still = tick === prevTick ? still + 1 : 0;
    prevTick = tick;
    if (still >= 12) {
      const f = await frame(page);
      // Stopped, by an auto-pause or at the end: whatever was planned up to here is on screen now.
      while (next < plan.length && plan[next]!.tick <= tick + 3) {
        await take(plan[next]!, tick);
        next++;
      }
      if (f.ended) {
        ended = true;
        break;
      }
      await play(page);
      still = 0;
    }
    await sleep(25);
  }
  if (!ended) ended = !!(await frameOrNull(page).catch(() => null))?.ended;
  await pause(page).catch(() => undefined);
  return { captures, ended };
}

/** Wait for the next watched round to be open and fresh (the previous one ended and its screen moved on). */
async function nextRoundOpen(page: PageDriver, env: JourneyEnv): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const hash = await page.eval<string>('location.hash');
    if (ROUTE.betweenRounds.test(hash)) {
      await page.click(SEL.betweenRoundsContinue, 'Continue on the between-rounds screen');
      await sleep(600);
    } else if (ROUTE.report.test(hash) || ROUTE.home.test(hash)) {
      await continueToPlayMatch(page, (s) => env.rec.say(s));
      await playMatchAndWatch(page);
    } else if (ROUTE.arena.test(hash)) {
      const f = await frame(page).catch(() => null);
      if (f && !f.ended && f.tick < 100) return;
      // The last round stopped by an auto-pause at its end tick: one more press of Play lets the round end (lib/arena-ui.ts).
      if (f?.ended) await pressPlayIfPaused(page).catch(() => undefined);
    }
    await sleep(300);
  }
  throw new SmokeFailure('vis003.no-next-round', 'The next round did not open in the arena within 90 s.');
}

export async function runVis003Capture(env: JourneyEnv): Promise<void> {
  const { rec, opts } = env;
  await rec.journey('vis003 capture', async () => {
    const page = await PageDriver.open(env.client, { width: 1280, height: 720, colorScheme: 'dark' });
    const root = join(env.outDir, 'vis003');
    const fights: PacketFight[] = [];
    try {
      await rec.step('vis003.career', `New career with seed "${opts.seed}" to the first match`, () => newCareerToMatchday(page, env.baseUrl, opts.seed, (s) => rec.say(s)));
      await rec.step('vis003.play-watch', 'Play match, then Watch', () => playMatchAndWatch(page));
      for (let n = 1; n <= opts.fights; n++) {
        await rec.step(`vis003.fight-${n}`, `Fight ${n}: watch at 1x and capture`, async () => {
          if (n > 1) await nextRoundOpen(page, env);
          const hook = await requireHook(page, { needFixture: false, timeoutMs: 20_000 });
          await page.waitFor('(() => { try { return window.__arena.viewer.frame().units.length === 10; } catch (e) { return false; } })()', 'the round to be drawn', { timeoutMs: 20_000, blocked: { code: 'smoke.viewer-no-frame' } });
          await canvasInfo(page);
          await pause(page);
          const read = await pageState(page, env, hook);
          if (!read.state) throw new SmokeFailure('smoke.state-missing', `The answer key is computed from the fight log, which needs the game state: ${read.problem}`, true);
          let keyed;
          try {
            keyed = keyFromState(read.state, env.content, n);
          } catch (e) {
            if (e instanceof NotImplementedError) throw new SmokeFailure('smoke.core-stub', `${e.message}: core/game's playback functions are not implemented yet (WP-M2B).`, true);
            throw e;
          }
          assertKeyIsOnScreen(await logHash(page), keyed.key, read.source);
          const run = await captureFight(page, keyed.key, root);
          rec.say(`  fight ${n}: ${run.captures.filter((c) => c.frame !== null).length} frames, ${keyed.key.downs.length} downs${run.ended ? '' : ' (did not see the end)'}`);
          fights.push({ key: keyed.key, captures: run.captures });
        });
      }
    } finally {
      env.collectConsole(page);
      await page.close();
      finish(env, root, fights);
    }
  });
}

/** Write the packet files and score the automated evidence proxy for whatever was captured. */
export function finish(env: JourneyEnv, root: string, fights: readonly PacketFight[]): void {
  const { rec } = env;
  if (fights.length === 0) {
    rec.skipCheck('vis003.evidence', 'vis-003 pre-check: roles and causes identifiable from the screen', 'no fight was captured (see the blocked or failed steps)', 'A11 vis-003');
    return;
  }
  writeVis003Files(root, fights, { seed: env.opts.seed, commit: env.commit, source: env.opts.selfTest ? 'mock' : 'game' });
  const results = fights.flatMap((f) => scoreEvidence(f.key, f.captures));
  const summary = summarizeEvidence(results);
  writeFileSync(join(root, 'evidence-score.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  rec.artifacts.push('vis003/manifest.json', 'vis003/sheets/', 'vis003/owner-tally.md', 'vis003/owner-answer-key.md', 'vis003/evidence-score.json');
  rec.measurements['vis003.evidence'] = { roles: summary.roles, causes: summary.causes, fights: fights.length, frames: fights.reduce((s, f) => s + f.captures.length, 0) };
  rec.check({
    id: 'vis003.roles-identifiable',
    title: 'Tank and healer of both sides are identifiable from what is on screen (glyphs agree with the classes)',
    status: summary.roles.identifiable === summary.roles.total ? 'pass' : 'fail',
    ref: 'A11 vis-003 (1)',
    expected: 'every tank and healer prompt identifiable',
    actual: `${summary.roles.identifiable} of ${summary.roles.total} over ${fights.length} fights`,
    ...(summary.roles.identifiable === summary.roles.total ? {} : { detail: summary.results.filter((r) => r.kind !== 'down' && !r.identifiable).slice(0, 4).map((r) => `fight ${r.fight} ${r.prompt}: ${r.why}`).join('; ') }),
  });
  rec.check({
    id: 'vis003.causes-named',
    title: 'The cause of every down is named on screen (callout or feed)',
    status: summary.causes.named === summary.causes.total ? 'pass' : 'fail',
    ref: 'A11 vis-003 (1)',
    expected: 'victim, killer and ability named within the callout life of every down',
    actual: `${summary.causes.named} of ${summary.causes.total} named (${summary.causes.persistent} still in the feed later)`,
    ...(summary.causes.named === summary.causes.total ? {} : { detail: summary.results.filter((r) => r.kind === 'down' && !r.identifiable).slice(0, 4).map((r) => `fight ${r.fight} ${r.prompt}: ${r.why}`).join('; ') }),
  });
  rec.skipCheck('vis003.agent-observer', 'vis-003 agent observer pre-check scored >= 90%', 'Capture done: give each packets/fight-N/observer-brief.md to an observer agent and score its answers with `npx tsx scripts/smoke/vis003/cli.ts score` (see scripts/smoke/README.md).', 'A11 vis-003 (2)', true);
}
