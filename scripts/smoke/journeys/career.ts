/**
 * Journey: a seeded new career through the real UI, to the player's first match, then the match watched in the
 * arena (05-technical-m2 §A11: new game with a typed seed, pick a club, Play match, Watch, between rounds, report).
 * The UI steps use the M1.1 screens' own test ids (lib/selectors.ts); Watch is the M2 control WP-M2E adds. When
 * Play match does not offer Watch yet, the journey ends there as blocked with a message saying so.
 */
import { PageDriver, SmokeFailure, sleep } from '../lib/page';
import { MATCHDAY_MAIN, ROUTE, SEL } from '../lib/selectors';
import { watchedRoundSteps } from './arena-steps';
import type { JourneyEnv } from './env';

export interface ContinueState {
  main: string;
  sub: string;
}

export async function continueState(page: PageDriver): Promise<ContinueState> {
  return {
    main: (await page.probe<string | null>('textOfFirst', SEL.continueMain)) ?? '',
    sub: (await page.probe<string | null>('textOfFirst', SEL.continueSub)) ?? '',
  };
}

/** Title screen to the day of the first match: new career with a typed seed, first club of the lowest tier, preseason, kick-off, lineup. Ends with the Continue button on "Play match" (M1.1) or "Watch" (M2). */
export async function newCareerToMatchday(page: PageDriver, baseUrl: string, seed: string, say: (s: string) => void = () => {}): Promise<void> {
  await page.goto(`${baseUrl}/?theme=dark#/new-game`);
  await page.waitFor(`document.querySelector(${JSON.stringify(SEL.titleScreen)})`, 'the title screen');
  await page.click(SEL.advanced, 'the Advanced toggle on the title screen');
  await page.click(SEL.seedInput, 'the world seed field');
  await page.typeText(seed);
  await page.click(SEL.newCareer, 'New career');
  await page.waitForHash(ROUTE.clubSelect, 'the club select screen', 30_000);
  await page.click(SEL.clubCard, 'the first club card');
  await page.click(SEL.startCareer, 'Start career');
  await page.click(SEL.startCareerConfirm, 'the Start career confirmation');
  await page.waitForHash(ROUTE.home, 'the home screen');
  // Continue through the preseason weeks, the kick-off confirmation and the lineup stop, up to "Play match".
  for (let i = 0; i < 24; i++) {
    const c = await continueState(page);
    say(`  continue: "${c.main}" / "${c.sub}"`);
    if (MATCHDAY_MAIN.test(c.main)) return;
    if (/^Decide first$/i.test(c.main)) {
      throw new SmokeFailure('career.blocked-by-game', `The career stopped on "Decide first: ${c.sub}" before the first match. The smoke does not make decisions; pick a seed whose club starts clean (--seed) or extend the journey.`, true);
    }
    if ((await page.locate({ css: SEL.continueConfirm })) !== null) {
      await page.click(SEL.continueConfirmPrimary, 'the kick-off confirmation');
    } else {
      await page.click(SEL.continueButton, 'Continue');
    }
    await sleep(500);
  }
  throw new SmokeFailure('career.no-matchday', 'Continue never reached the day of the match ("Play match" or "Watch") within 24 presses.');
}

/**
 * Press Play match and get the match into the arena. Returns when #/arena is open. A build whose Play match simulates
 * the match straight away (the M1.1 flow) has no Watch yet: blocked.
 */
export async function playMatchAndWatch(page: PageDriver): Promise<void> {
  const now = await continueState(page);
  // M2: the primary button reads "Watch" and goes straight to the arena; when the preference simulates it reads "Simulate"
  // and Watch is the button beside it.
  if (/^Simulate$/i.test(now.main)) await page.click(SEL.continueOther, 'Watch (the other way to play the match)', { blocked: { code: 'smoke.watch-missing' } });
  else await page.click(SEL.continueButton, now.main || 'Play match');
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const hash = await page.eval<string>('location.hash');
    if (ROUTE.arena.test(hash)) return;
    if (ROUTE.betweenRounds.test(hash) || ROUTE.report.test(hash)) break;
    const watch = await page.locate(SEL.watch);
    if (watch && !watch.disabled) {
      await page.mouseClick(watch.x, watch.y);
      await page.waitForHash(ROUTE.arena, 'the arena after Watch', 20_000);
      return;
    }
    await sleep(120);
  }
  const hash = await page.eval<string>('location.hash');
  throw new SmokeFailure(
    'smoke.watch-missing',
    `Play match offered no Watch: the page is at ${hash} and no control starting with "Watch" is visible. In an M2 build Play match offers Watch (primary) and Simulate (Q54, 05-technical-m2 §A3); this build simulates the match at once (WP-M2E, the arena UI, is not in it).`,
    true,
  );
}

export async function runCareerJourney(env: JourneyEnv): Promise<void> {
  const { rec, opts } = env;
  await rec.journey('career', async () => {
    const page = await PageDriver.open(env.client, { width: 1920, height: 1080, colorScheme: 'dark' });
    try {
      await rec.step('career.new-game', `New career with seed "${opts.seed}", first club, preseason to the first match`, () => newCareerToMatchday(page, env.baseUrl, opts.seed, (s) => rec.say(s)));
      await rec.step('career.play-watch', 'Play match, then Watch', () => playMatchAndWatch(page));
      await watchedRoundSteps(page, env, { path: 'career' });
    } finally {
      env.collectConsole(page);
      await page.close();
    }
  });
}
