/**
 * The fake-viewer leak test (05-technical-m2 §A11 test-first item 3; review B1; replaces the earlier "grep the winner"
 * idea). A viewer double wraps the render-state timeline over a live round with KNOWN later events (a down at tick 400,
 * overtime at 900, the end at 1,000). The arena screen is rendered twice: once fed the full log, once fed the same log
 * cut after the head (no `fight.end`). The two DOM trees must be identical, and the double records every value it hands
 * out, each of which must be at or before the head: the scrubber's playhead, the marks, the feed items, `endTick`, the
 * standing counts. A screen that reads anything past the head shows up as a DOM difference.
 *
 * Several states are compared, not one: the paused screen at the resume point, with the INSPECTOR open on a fighter,
 * with the ROUND-END CARD showing (its saving phase, which is all a live round may show before the commit), and again
 * after the round has played on and stopped (playing ticks, then a pause), each with the log cut at that state's head.
 *
 * Run against the fake timeline AND the real src/render timeline (WP-M2C). The real-timeline scenarios are a hard gate
 * (REAL_TIMELINE_REQUIRED): they fail, never skip, if the real timeline is missing or a stub.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import type { FightLog } from '../../../core/model';
import { fixtureContent } from '../../../core/testkit';
import { ok } from '../../../core/util';
import { NotImplementedError } from '../../../core/util';
import { simulateRound } from '../../../core/sim';
import { buildCueTable, timeline as realTimeline, type CueTable, type Timeline } from '../../../render';
import { createScriptedCore, liveWatchState, roundPlaybackOf, watchWorld } from '../../debug/arena-test-world';
import { TestProviders, createTestStore } from '../../debug/test-store';
import type { GameEngine } from '../../store/engine';
import { DEFAULT_SETTINGS, updateSettings } from '../../store/settings';
import ArenaScreen, { resetLiveRoundCache } from './index';
import { resetRoundEnd, roundEnd } from './RoundEnd';
import { truncateLog } from './testing/fixture-log';
import { fakeTimeline } from './testing/fake-timeline';
import { createFakeViewerHarness, type FakeViewer } from './testing/fake-viewer';
import { ViewerFactoryContext } from './viewer-factory';

/** A hard gate since integration (m2/integration contains WP-M2C): the real-timeline scenarios cannot skip. */
const REAL_TIMELINE_REQUIRED = true;

let content: ContentDB;
beforeEach(() => {
  content = fixtureContent();
  // Let the round run: the comparison drives time itself.
  updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, autoPause: { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null } } });
  location.hash = '#/arena';
});
afterEach(() => {
  cleanup();
  resetRoundEnd();
});

/** The real timeline when WP-M2C has landed; null while it is a stub. */
function realTimelineOrNull(log: FightLog): { timeline: Timeline; cues: CueTable } | null {
  try {
    const cues = buildCueTable(content);
    realTimeline.indexFightLog(log, content, cues, 'live');
    return { timeline: realTimeline, cues };
  } catch (e) {
    if (e instanceof NotImplementedError) return null;
    throw e;
  }
}

/** A scenario: the screen resumed at `startHead`, with `steps` run in order; the DOM after each step. */
interface Run {
  /** The DOM after the initial load and after each step. */
  html: string[];
  viewer: FakeViewer;
}

async function run(log: FightLog, startHead: number, tl: Timeline, cues: CueTable | undefined, steps: ((v: FakeViewer) => Promise<void>)[] = []): Promise<Run> {
  cleanup();
  resetLiveRoundCache();
  resetRoundEnd();
  const w = watchWorld(content);
  const core = createScriptedCore(w);
  const engine: GameEngine = {
    ...core.engine,
    liveRoundPlayback: ((state, c) => ok({ ...roundPlaybackOf(state, c, 'live', 1), log })) as GameEngine['liveRoundPlayback'],
  };
  const t = createTestStore({ world: 'none', engine });
  t.store.replaceWorld(liveWatchState(w, { cursorTick: startHead }), content);
  const harness = createFakeViewerHarness(tl, content, { cues });
  const { container } = render(
    <TestProviders store={t.store}>
      <ViewerFactoryContext.Provider value={harness.factory}>
        <ArenaScreen params={{}} />
      </ViewerFactoryContext.Provider>
    </TestProviders>,
  );
  await waitFor(() => expect(screen.getByTestId('screen-arena').getAttribute('data-status')).toBe('ready'));
  const viewer = harness.current();
  const html = [container.innerHTML];
  for (const step of steps) {
    await step(viewer);
    html.push(container.innerHTML);
  }
  return { html, viewer };
}

const openInspector = async () => {
  await act(async () => {
    screen.getByTestId('strip-unit-0').focus(); // focus is selection; paused, so the inspector opens
  });
  await waitFor(() => expect(screen.getByTestId('arena-inspector')).toBeTruthy());
  await waitFor(() => expect(screen.getByTestId('inspector-now')).toBeTruthy());
  await waitFor(() => expect(screen.queryByTestId('inspector-now-rule') ?? screen.queryByTestId('inspector-blocked')).toBeTruthy());
};

/** What a live round may show of its end before the commit: the card's saving phase (the outcome is in committed state only). */
const showSavingCard = async () => {
  await act(async () => {
    roundEnd.value = { phase: 'saving', round: 1, bestOf: 3, result: null, next: null, retry: null };
  });
  expect(screen.getByTestId('arena-overlay').getAttribute('data-phase')).toBe('saving');
};

function assertBounded(r: Run, head: number) {
  const h = r.viewer.handed;
  // Everything the viewer handed out is at or before the head; the end is unknown.
  for (const m of h.moments) for (const x of m.moments) expect(x.tick).toBeLessThanOrEqual(m.head);
  for (const m of h.moments) expect(m.head).toBeLessThanOrEqual(head);
  for (const f of h.frames) {
    expect(f.frame.tick).toBeLessThanOrEqual(f.head);
    expect(f.frame.ended).toBe(false);
    expect(f.frame.endTick).toBeNull();
  }
  for (const e of h.ends) expect(e).toBeNull();
  for (const x of h.heads) expect(x).toBeLessThanOrEqual(head);
  // The DOM shows the same: the live track is a fixed 0 to 75 s (its length tells nothing about the round), the playhead
  // is at or before the head, and no mark or feed item lies beyond it.
  const scrub = screen.getByTestId('arena-scrubber');
  expect(Number(scrub.getAttribute('aria-valuemax'))).toBe(75);
  expect(Number(scrub.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(Math.ceil(head * 0.05));
  for (const mark of screen.getByTestId('arena-marks').querySelectorAll('[data-tick]')) expect(Number(mark.getAttribute('data-tick'))).toBeLessThanOrEqual(head);
  // Standing counts are those of the head's sample.
  const last = h.frames[h.frames.length - 1]!.frame;
  expect(screen.getByTestId('hud-left-standing').textContent).toBe(`${last.standing.home} of 5 standing`);
  expect(screen.getByTestId('hud-right-standing').textContent).toBe(`${last.standing.away} of 5 standing`);
}

/** The scenarios, run for a timeline. */
function scenarios(name: string, source: () => { full: FightLog; tl: Timeline; cues?: CueTable } | null) {
  // A visible skip while the real timeline is a stub; a failure once it is required.
  const need = (ctx: { skip: (note?: string) => never }) => {
    const s = source();
    if (!s) {
      if (REAL_TIMELINE_REQUIRED) throw new Error(`${name}: the real timeline is required here but is still a stub`);
      ctx.skip(`${name} is not available yet (WP-M2C has not merged)`);
    }
    return s!;
  };

  it.for([200, 500])(`${name}: paused at the head, with the inspector open and the round-end card up (head at tick %i)`, async (head, ctx) => {
    const s = need(ctx);
    const cut = truncateLog(s.full, head);
    const steps = [openInspector, showSavingCard];
    const a = await run(s.full, head, s.tl, s.cues, steps.map((f) => async () => f()));
    const b = await run(cut, head, s.tl, s.cues, steps.map((f) => async () => f()));
    // The initial state, the inspector's, and the card's: identical with the full log and with the log cut at the head.
    expect(a.html).toHaveLength(3);
    for (let i = 0; i < a.html.length; i++) expect(a.html[i], `state ${i}`).toBe(b.html[i]);
    expect(a.html[0]!.length).toBeGreaterThan(1000);
    expect(a.html[1]).toContain('ainspect');
    assertBounded(a, head);
    assertBounded(b, head);
    // Nothing of the later events is on screen: no overtime, and (before tick 400) no down.
    for (const h of a.html) expect(h).not.toMatch(/data-overtime="true"|ahud__ot/);
    if (head < 400) expect(a.html[0]).not.toMatch(/downed/i);
    else expect(a.html[0]).toMatch(/downed/i);
  });

  it(`${name}: after the round has played on and stopped (playing ticks, then a pause), still identical`, async (ctx) => {
    const s = need(ctx);
    const play = async (v: FakeViewer) => {
      await act(async () => {
        v.play();
        v.advanceTo(300);
      });
    };
    // The player's own pause, through the screen (it saves the cursor, which the inspector's probe waits for).
    const pause = async (v: FakeViewer) => {
      await act(async () => {
        fireEvent.click(screen.getByTestId('arena-play'));
      });
      expect(v.playing).toBe(false);
    };
    // The head moves 200 -> 300 -> paused at 300; the cut log ends at the furthest tick the player has been shown.
    const cut = truncateLog(s.full, 300);
    const a = await run(s.full, 200, s.tl, s.cues, [play, pause, openInspector]);
    const b = await run(cut, 200, s.tl, s.cues, [play, pause, openInspector]);
    // The first state (resumed at 200) is not compared: the cut log holds events up to 300 there by construction.
    for (let i = 1; i < a.html.length; i++) expect(a.html[i], `state ${i}`).toBe(b.html[i]);
    assertBounded(a, 300);
    assertBounded(b, 300);
  });
}

describe('no future leaks (review B1): the screen with the full log equals the screen with the log cut at the head', () => {
  const synthetic = () => {
    const w = watchWorld(content);
    return { full: roundPlaybackOf(liveWatchState(w), content, 'live', 1).log, tl: fakeTimeline };
  };
  scenarios('fake timeline', synthetic);

  it('the known later events exist in the full log and not in the cut one', () => {
    const { full } = synthetic();
    const cut = truncateLog(full, 200);
    expect(full.events.some((e) => e.type === 'fight.end')).toBe(true);
    expect(full.events.some((e) => e.type === 'overtime.start')).toBe(true);
    expect(cut.events.some((e) => e.type === 'fight.end' || e.type === 'overtime.start')).toBe(false);
  });

  // The real src/render timeline over a real sim log: a visible skip until WP-M2C merges, a hard gate at integration.
  scenarios('real timeline', () => {
    const w = watchWorld(content);
    const input = w.prepared.input;
    const full = simulateRound({ round: 1, home: input.home, away: input.away }, 'leak-test-seed', content, { record: 'full' }).log;
    if (!full) throw new Error('the sim returned no log');
    const real = realTimelineOrNull(full);
    return real ? { full, tl: real.timeline, cues: real.cues } : null;
  });

  it('the screen never hands the viewer anything but the round it was given, and reads no outcome of its own', async () => {
    const w = watchWorld(content);
    const full = roundPlaybackOf(liveWatchState(w), content, 'live', 1).log;
    const r = await run(full, 200, fakeTimeline, undefined);
    // The viewer got the log by reference; the screen added nothing to it.
    expect(r.viewer.loadedLog).toBe(full);
    // RoundPlayback.result is null for a live round, so the HUD has nothing but the committed rounds won to show.
    expect(screen.getByTestId('hud-left-pips').getAttribute('aria-label')).toBe('Rounds won: 0 of 2');
    fireEvent.keyDown(screen.getByTestId('arena-host'), { key: 'Home' });
  });
});
