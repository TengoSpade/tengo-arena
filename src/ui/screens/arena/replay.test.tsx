/**
 * The replay screen and the Replay entries (05-technical-m2 §A3, §A4, §A7): round tabs, free seeking, the start tick of a
 * key moment, the availability reasons as tooltips, a replay that does not reproduce reported as a defect.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import type { ReplayAvailability } from '../../../core/game';
import type { FixtureId, GameState } from '../../../core/model';
import { fixtureContent } from '../../../core/testkit';
import { engineError, err } from '../../../core/util';
import { resetToasts } from '../../components';
import { TestProviders, createTestStore } from '../../debug/test-store';
import type { GameEngine } from '../../store/engine';
import { DEFAULT_SETTINGS, updateSettings } from '../../store/settings';
import { hookSlot } from './hook-registry';
import { ReplayButton, REPLAY_LEAD_TICKS, replayHref } from './ReplayLink';
import ReplayScreen from './replay';
import { fakeTimeline } from './testing/fake-timeline';
import { createFakeViewerHarness, type FakeViewer } from './testing/fake-viewer';
import { createScriptedCore, liveWatchState, roundPlaybackOf, watchWorld, type WatchWorld } from '../../debug/arena-test-world';
import { ViewerFactoryContext } from './viewer-factory';

let content: ContentDB;
let dispose: (() => void) | null = null;
beforeEach(() => {
  resetToasts();
  content = fixtureContent();
  updateSettings({ ...DEFAULT_SETTINGS });
  hookSlot.fixture = null;
});
afterEach(() => {
  cleanup();
  dispose?.();
  dispose = null;
});

function mountReplay(params: Record<string, string>, over: (e: GameEngine, w: WatchWorld) => Partial<GameEngine> = () => ({}), tweak?: (s: GameState) => void) {
  const w = watchWorld(content);
  const core = createScriptedCore(w);
  const engine = { ...core.engine, ...over(core.engine, w) };
  const t = createTestStore({ world: 'none', engine });
  // Round 3 is being watched; rounds 1 (won) and 2 (lost) are committed and replayable.
  const st = liveWatchState(w, { round: 3, wins: ['home', 'away'] });
  tweak?.(st);
  t.store.replaceWorld(st, content);
  const harness = createFakeViewerHarness(fakeTimeline, content);
  render(
    <TestProviders store={t.store}>
      <ViewerFactoryContext.Provider value={harness.factory}>
        <ReplayScreen params={{ fixtureId: w.fixtureId, ...params }} />
      </ViewerFactoryContext.Provider>
    </TestProviders>,
  );
  return { w, core, harness, t, viewer: (): FakeViewer => harness.current() };
}

async function ready() {
  await waitFor(() => expect(screen.getByTestId('screen-replay').getAttribute('data-status')).toBe('ready'));
}
const text = (id: string) => screen.getByTestId(id).textContent ?? '';
const key = (k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(screen.getByTestId('arena-host'), { key: k, ...init });

describe('replay screen', () => {
  it('lists the committed rounds as tabs (the round being watched is not replayable) and plays the requested one from the start', async () => {
    const m = mountReplay({ round: '2' });
    await ready();
    const tabs = screen.getByTestId('arena-round-tabs');
    const labels = [...tabs.querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());
    expect(labels).toEqual(['R1 W', 'R2 L']);
    expect(tabs.querySelector('[aria-selected="true"]')!.textContent).toContain('R2');
    expect(text('arena-mode')).toBe('Replay');
    expect(m.viewer().loadedLog!.header.round).toBe(2);
    // A replay auto-plays; its score before the round is shown.
    expect(m.viewer().calls).toContain('play');
    expect(screen.getByTestId('hud-left-pips').getAttribute('aria-label')).toBe('Rounds won: 1 of 2');
    expect(screen.getByTestId('hud-right-pips').getAttribute('aria-label')).toBe('Rounds won: 0 of 2');
  });

  it('a key moment opens it at the tick in the link, 2 s before the moment', async () => {
    expect(replayHref('fx-1', 2, 340 - REPLAY_LEAD_TICKS)).toBe('#/replay/fx-1?round=2&tick=300');
    const m = mountReplay({ round: '1', tick: '360' });
    await ready();
    expect(m.viewer().tick).toBe(360);
    // Free seeking: the scrubber spans the whole round and any tick can be picked.
    const scrub = screen.getByTestId('arena-scrubber');
    expect(scrub.getAttribute('aria-valuemax')).toBe('50');
    expect(scrub.getAttribute('data-span')).toBe('1000');
    // A pointer on the track picks the tick (the track spans the whole round).
    scrub.getBoundingClientRect = () => ({ left: 100, width: 1000, top: 0, height: 20, right: 1100, bottom: 20, x: 100, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.pointerDown(scrub, { clientX: 100 + 900, pointerId: 1 });
    expect(m.viewer().tick).toBe(900);
    key(' '); // pause
    await waitFor(() => expect(m.viewer().playing).toBe(false));
    key('ArrowLeft', { shiftKey: true });
    expect(m.viewer().tick).toBe(880);
    // The whole round's key moments are on the scrubber from the start.
    expect(screen.getByTestId('arena-marks').querySelectorAll('[data-kind="down"]')).toHaveLength(1);
    expect(screen.getByTestId('arena-marks').querySelectorAll('[data-kind="overtime"]')).toHaveLength(1);
  });

  it('switches round from the tabs or Alt plus the round number, and ends with a panel and the score including the round', async () => {
    updateSettings({ arena: { ...DEFAULT_SETTINGS.arena, autoPause: { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null } } });
    const m = mountReplay({ round: '1' });
    await ready();
    key('2', { altKey: true });
    await waitFor(() => expect(m.viewer().loadedLog!.header.round).toBe(2));
    await ready();
    await act(async () => {
      m.viewer().advanceTo(2000);
    });
    // The recorded winner of round 2 is away: 1–0 before, 1–1 after.
    await waitFor(() => expect(screen.getByTestId('replay-end')).toBeTruthy());
    expect(screen.getByTestId('hud-left-pips').getAttribute('aria-label')).toBe('Rounds won: 1 of 2');
    expect(screen.getByTestId('hud-right-pips').getAttribute('aria-label')).toBe('Rounds won: 1 of 2');
    expect(screen.queryByTestId('replay-next')).toBeNull(); // round 2 is the last committed round
    fireEvent.click(screen.getByTestId('replay-again'));
    expect(m.viewer().tick).toBe(0);
  });

  it('a replayed round of the match still being played goes back to the match (Esc and the button), not to a report that does not exist yet', async () => {
    // Between rounds (the between-round screen is where "Replay round n" is offered).
    const between = mountReplay({ round: '1' }, undefined, (s) => {
      s.liveMatch!.phase = 'between_rounds';
      s.liveMatch!.watch = { mode: 'watch', round: null, cursorTick: 0, calls: [] };
    });
    await ready();
    expect(text('replay-report-link')).toContain('Match');
    key('Escape');
    expect(location.hash).toBe('#/between-rounds');
    location.hash = '#/replay/x';
    fireEvent.click(screen.getByTestId('replay-report-link'));
    expect(location.hash).toBe('#/between-rounds');
    expect(between.viewer()).toBeTruthy();
    cleanup();
    // A round waits in the arena (Home's Continue says Resume watching): back goes there.
    mountReplay({ round: '1' });
    await ready();
    key('Escape');
    expect(location.hash).toBe('#/arena');
  });

  it('explains why a match cannot be replayed, with the reason in words', async () => {
    mountReplay({}, () => ({ matchPlayback: (() => err(engineError('replay.unavailable', 'no', { reason: 'compacted' }))) as unknown as GameEngine['matchPlayback'] }));
    expect(screen.getByTestId('screen-replay').textContent).toContain('This match cannot be replayed');
    expect(screen.getByTestId('screen-replay').textContent).toContain('keep only their summary');
  });

  it('degrades to a plain note while core has no playback yet', async () => {
    mountReplay({}, () => ({ matchPlayback: undefined }));
    expect(screen.getByTestId('screen-replay').textContent).toContain('not available in this build yet');
  });

  it('a replay that does not reproduce its checksum is reported as a defect and never shown', async () => {
    const m = mountReplay({ round: '1' }, () => ({ roundPlayback: (() => err(engineError('replay.mismatch', 'checksum'))) as unknown as GameEngine['roundPlayback'] }));
    expect(screen.getByTestId('screen-replay').textContent).toContain('This is a defect');
    expect(m.harness.all).toHaveLength(0);
  });

  it('opens a fixed round of the dev world for the test hook', async () => {
    const w = watchWorld(content);
    const pb = roundPlaybackOf(liveWatchState(w, { round: 2 }), content, 'replay', 1);
    hookSlot.fixture = { fixtureId: '__fixture__', playback: { ...pb, fixtureId: '__fixture__' as FixtureId } };
    const core = createScriptedCore(w);
    const t = createTestStore({ world: 'none', engine: core.engine });
    t.store.replaceWorld(w.state, content);
    const harness = createFakeViewerHarness(fakeTimeline, content);
    render(
      <TestProviders store={t.store}>
        <ViewerFactoryContext.Provider value={harness.factory}>
          <ReplayScreen params={{ fixtureId: '__fixture__' }} />
        </ViewerFactoryContext.Provider>
      </TestProviders>,
    );
    await ready();
    expect(hookSlot.viewer).toBe(harness.current());
    expect(hookSlot.logHash).toBe(pb.log.hash);
    expect(hookSlot.frame?.()?.units).toHaveLength(10);
    cleanup();
    expect(hookSlot.viewer).toBeNull();
  });
});

describe('Replay entries (report, fixtures, Home)', () => {
  function entry(availability: ReplayAvailability | 'stub') {
    const w = watchWorld(content);
    const core = createScriptedCore(w);
    if (availability !== 'stub') core.availability = availability;
    const engine = availability === 'stub' ? { ...core.engine, replayAvailability: undefined } : core.engine;
    const t = createTestStore({ world: 'none', engine });
    t.store.replaceWorld(w.state, content);
    render(
      <TestProviders store={t.store}>
        <ReplayButton fixtureId={w.fixtureId as FixtureId} label="Replay" round={2} tick={300} />
      </TestProviders>,
    );
    return screen.getByTestId('replay-button');
  }

  it('is a link to the replay when the match can be rebuilt', () => {
    const el = entry({ available: true, rounds: 3 });
    expect(el.tagName).toBe('A');
    expect(el.getAttribute('href')).toMatch(/^#\/replay\/.+\?round=2&tick=300$/);
  });

  it.each([
    ['compacted', 'keep only their summary'],
    ['other-build', 'Played before a balance update'],
    ['live', 'Your match is in progress'],
    ['not-played', 'not been played'],
  ] as const)('is disabled with the reason as its tooltip: %s', (reason, words) => {
    const el = entry({ available: false, reason });
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('data-reason')).toBe(reason);
    expect(el.getAttribute('data-tip')).toContain(words);
  });

  it('stays disabled, with a note, while core has no availability check yet', () => {
    const el = entry('stub');
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('data-tip')).toBeTruthy();
  });
});
