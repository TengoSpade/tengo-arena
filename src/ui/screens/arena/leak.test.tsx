/**
 * The fake-viewer leak test (05-technical-m2 §A11 test-first item 3; review B1; replaces the earlier "grep the winner"
 * idea). A viewer double wraps the render-state timeline over a live round with KNOWN later events (a down at tick 400,
 * overtime at 900, the end at 1,000). With the head at 200, the arena screen is rendered twice: once fed the full log,
 * once fed the same log cut after the head (no `fight.end`). The two DOM trees must be identical, and the double
 * records every value it hands out, each of which must be at or before the head: the scrubber maximum, the marks,
 * the feed items, `endTick`, the standing counts. A screen that reads anything past the head shows up as a DOM
 * difference.
 *
 * Run against the fake timeline always, and against the real src/render timeline once WP-M2C has merged (while it is
 * a stub the second scenario skips itself).
 */
import { cleanup, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import type { FightLog } from '../../../core/model';
import { fixtureContent } from '../../../core/testkit';
import { ok } from '../../../core/util';
import { NotImplementedError } from '../../../core/util';
import { simulateRound } from '../../../core/sim';
import { buildCueTable, timeline as realTimeline, type CueTable, type Timeline } from '../../../render';
import { installShortcuts } from '../../app/shortcuts';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { DEFAULT_SETTINGS, updateSettings } from '../../store/settings';
import type { GameEngine } from '../../store/engine';
import ArenaScreen, { resetLiveRoundCache } from './index';
import { resetRoundEnd } from './RoundEnd';
import { truncateLog } from './testing/fixture-log';
import { fakeTimeline } from './testing/fake-timeline';
import { createFakeViewerHarness, type FakeViewer } from './testing/fake-viewer';
import { createScriptedCore, liveWatchState, roundPlaybackOf, watchWorld } from '../../debug/arena-test-world';
import { ViewerFactoryContext } from './viewer-factory';

let content: ContentDB;
let dispose: (() => void) | null = null;
beforeEach(() => {
  content = fixtureContent();
  updateSettings({ ...DEFAULT_SETTINGS });
  location.hash = '#/arena';
});
afterEach(() => {
  cleanup();
  dispose?.();
  dispose = null;
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

interface Rendered {
  html: string;
  viewer: FakeViewer;
}

async function renderWith(log: FightLog, head: number, tl: Timeline, cues?: CueTable): Promise<Rendered> {
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
  t.store.replaceWorld(liveWatchState(w, { cursorTick: head }), content);
  const harness = createFakeViewerHarness(tl, content, { cues });
  dispose?.();
  dispose = installShortcuts(() => ({}));
  const { container } = render(
    <TestProviders store={t.store}>
      <ViewerFactoryContext.Provider value={harness.factory}>
        <ArenaScreen params={{}} />
      </ViewerFactoryContext.Provider>
    </TestProviders>,
  );
  await waitFor(() => expect(screen.getByTestId('screen-arena').getAttribute('data-status')).toBe('ready'));
  return { html: container.innerHTML, viewer: harness.current() };
}

function assertBounded(r: Rendered, head: number) {
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
  // The DOM shows the same: the scrubber stops at the head, no mark or feed item lies beyond it.
  const scrub = screen.getByTestId('arena-scrubber') as HTMLInputElement;
  expect(Number(scrub.max)).toBe(head);
  for (const mark of screen.getByTestId('arena-marks').querySelectorAll('[data-tick]')) expect(Number(mark.getAttribute('data-tick'))).toBeLessThanOrEqual(head);
  // Standing counts are those of the head's sample.
  const last = h.frames[h.frames.length - 1]!.frame;
  expect(screen.getByTestId('arena-standing').textContent).toBe(`${last.standing.home} v ${last.standing.away}`);
}

describe('no future leaks (review B1): the screen with the full log equals the screen with the log cut at the head', () => {
  it.each([200, 500])('fake timeline, head at tick %i', async (head) => {
    const w = watchWorld(content);
    const full = roundPlaybackOf(liveWatchState(w), content, 'live', 1).log;
    const cut = truncateLog(full, head);
    // The known later events exist in the full log and not in the cut one.
    expect(full.events.some((e) => e.type === 'fight.end')).toBe(true);
    expect(full.events.some((e) => e.type === 'overtime.start')).toBe(true);
    expect(cut.events.some((e) => e.type === 'fight.end' || e.type === 'overtime.start')).toBe(false);
    const a = await renderWith(full, head, fakeTimeline);
    const b = await renderWith(cut, head, fakeTimeline);
    expect(a.html).toBe(b.html);
    expect(a.html.length).toBeGreaterThan(1000);
    assertBounded(a, head);
    assertBounded(b, head);
    // Nothing of the later events is on screen: no overtime, and (at 200) no down.
    expect(a.html).not.toMatch(/Overtime/);
    if (head < 400) expect(a.html).not.toMatch(/downed/i);
    else expect(a.html).toMatch(/downed/i);
  });

  it.each([200, 500])('real timeline over a real sim log (once WP-M2C has merged), head at tick %i', async (head) => {
    const w = watchWorld(content);
    const input = w.prepared.input;
    const out = simulateRound({ round: 1, home: input.home, away: input.away }, 'leak-test-seed', content, { record: 'full' });
    const full = out.log;
    if (!full) throw new Error('the sim returned no log');
    const real = realTimelineOrNull(full);
    if (!real) return; // WP-M2C has not merged: the fake-timeline scenarios above stand in
    const cut = truncateLog(full, head);
    const a = await renderWith(full, head, real.timeline, real.cues);
    const b = await renderWith(cut, head, real.timeline, real.cues);
    expect(a.html).toBe(b.html);
    assertBounded(a, head);
    assertBounded(b, head);
  });

  it('the screen never hands the viewer anything but the round it was given, and reads no outcome of its own', async () => {
    const w = watchWorld(content);
    const full = roundPlaybackOf(liveWatchState(w), content, 'live', 1).log;
    const r = await renderWith(full, 200, fakeTimeline);
    // The viewer got the log by reference; the screen added nothing to it.
    expect(r.viewer.loadedLog).toBe(full);
    // RoundPlayback.result is null for a live round, so the HUD has nothing but the committed score to show.
    expect(screen.getByTestId('arena-score').textContent).toBe('0–0');
  });
});
