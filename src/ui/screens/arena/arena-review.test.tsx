/**
 * Fixes of the independent review of WP-M2E: the live-round cache follows the locked inputs, the arena opens only for a
 * saved lock, Space and Enter on a fighter card, a loaded save with a watched round resumes in the arena, the palette
 * is re-read on theme, motion and scale change, a visible Leave, and the KeyMoment convention in the feed.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import type { GameState } from '../../../core/model';
import { fixtureContent } from '../../../core/testkit';
import { createScriptedCore, liveWatchState, roundPlaybackOf, watchWorld, type WatchWorld } from '../../debug/arena-test-world';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { resetToasts } from '../../components';
import { savedWatch, watchKey } from '../../store/arena';
import { DEFAULT_SETTINGS, updateSettings } from '../../store/settings';
import NewGameScreen from '../new-game';
import SavesScreen from '../saves';
import ArenaScreen, { resetLiveRoundCache } from './index';
import { buildRoundContext } from './context';
import { feedItems, momentText, subjectOf } from './feed';
import { readArenaPalette } from './palette';
import { resetRoundEnd } from './RoundEnd';
import { fakeTimeline } from './testing/fake-timeline';
import { createFakeViewerHarness, type FakeViewer } from './testing/fake-viewer';
import { ViewerFactoryContext } from './viewer-factory';

let content: ContentDB;
beforeEach(() => {
  resetToasts();
  resetRoundEnd();
  resetLiveRoundCache();
  content = fixtureContent();
  updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, autoPause: { ...DEFAULT_SETTINGS.arena.autoPause } } });
  location.hash = '#/arena';
});
afterEach(cleanup);

function setup(state?: (w: WatchWorld) => GameState) {
  const w = watchWorld(content);
  const core = createScriptedCore(w);
  const t = createTestStore({ world: 'none', engine: core.engine });
  t.store.replaceWorld(state ? state(w) : liveWatchState(w), content);
  const harness = createFakeViewerHarness(fakeTimeline, content);
  const tree = () => (
    <TestProviders store={t.store}>
      <ViewerFactoryContext.Provider value={harness.factory}>
        <ArenaScreen params={{}} />
      </ViewerFactoryContext.Provider>
    </TestProviders>
  );
  return { w, core, harness, t, tree, viewer: (): FakeViewer => harness.current() };
}

async function ready() {
  await waitFor(() => expect(screen.getByTestId('screen-arena').getAttribute('data-status')).toBe('ready'));
}

/** The same world with the home squad's first two starters swapped: a different lineup, the same seed and round. */
function swapLineup(w: WatchWorld): void {
  const h = w.prepared.home;
  [h.active[0], h.active[1]] = [h.active[1]!, h.active[0]!];
  [h.rows[0], h.rows[1]] = [h.rows[1]!, h.rows[0]!];
}

describe('the live-round cache follows the locked inputs (review 1)', () => {
  it('after an in-session load and a re-lock with another lineup, the arena shows the new lineup and its commit is accepted', async () => {
    updateSettings({ arena: { ...DEFAULT_SETTINGS.arena, autoPause: { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null } } }); // let the round run to its end
    const { w, core, harness, t, tree } = setup((world) => world.state);
    const lineupA = w.prepared.home.active.slice();
    // The player saves, locks lineup A and watches (the playback is cached).
    expect((await t.store.save('manual-1')).ok).toBe(true);
    expect((await t.store.advance({ playerMatch: 'watch' })).ok).toBe(false);
    render(tree());
    await ready();
    expect(harness.current().loadedLog!.header.units[0]!.fighterId).toBe(lineupA[0]);
    cleanup();
    // In the same session he loads the save and locks lineup B: same seed, same round, same career.
    expect((await t.store.load('manual-1')).ok).toBe(true);
    swapLineup(w);
    expect((await t.store.advance({ playerMatch: 'watch' })).ok).toBe(false);
    render(tree());
    await ready();
    const viewer = harness.current();
    expect(viewer.loadedLog!.header.units[0]!.fighterId).toBe(w.prepared.home.active[0]);
    expect(viewer.loadedLog!.header.units[0]!.fighterId).not.toBe(lineupA[0]);
    expect(viewer.loadedLog!.hash).toBe(core.hashOf(t.store.game.value!, 1));
    // The round plays out and commits: a stale log would be refused as watch.mismatch and show the defect card.
    await act(async () => {
      viewer.play();
      viewer.advanceTo(1000);
    });
    await waitFor(() => expect(t.store.game.value!.liveMatch!.rounds).toHaveLength(1));
    expect(document.body.textContent).not.toContain('This is a defect');
  });

  it('keys on the locked inputs, not on the match seed: another lineup under the same seed, round and epoch is a miss', async () => {
    const { w, harness, t, tree } = setup();
    render(tree());
    await ready();
    const hashA = harness.current().loadedLog!.hash;
    cleanup();
    // The world in memory changes under the same epoch (no load, no rollback): only the locked inputs differ.
    swapLineup(w);
    const b = liveWatchState(w);
    (t.store.game as unknown as { value: GameState }).value = b;
    render(tree());
    await ready();
    expect(harness.current().loadedLog!.hash).not.toBe(hashA);
    expect(harness.current().loadedLog!.header.units[0]!.fighterId).toBe(w.prepared.home.active[0]);
  });

  it('serves the cached round when nothing that fixes it changed (a second visit does not simulate again)', async () => {
    const { core, harness, tree } = setup();
    let calls = 0;
    const inner = core.engine.liveRoundPlayback!;
    core.engine.liveRoundPlayback = ((...a: Parameters<typeof inner>) => (calls++, inner(...a))) as typeof inner;
    render(tree());
    await ready();
    cleanup();
    render(tree());
    await waitFor(() => expect(harness.all).toHaveLength(2));
    await ready();
    expect(calls).toBe(1);
  });
});

describe('the arena opens only for a saved lock (review 2, A3)', () => {
  it('shows nothing of the round while its lock is in memory but not yet saved, then opens when the write has succeeded', async () => {
    const { w, core, harness, t, tree } = setup();
    // The lock is published in memory before its write completes: the store's gate is still shut.
    savedWatch.value = null;
    let asked = 0;
    const inner = core.engine.liveRoundPlayback!;
    core.engine.liveRoundPlayback = ((...a: Parameters<typeof inner>) => (asked++, inner(...a))) as typeof inner;
    render(tree());
    expect(screen.getByTestId('screen-arena-saving').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByTestId('arena-host')).toBeNull();
    await new Promise((r) => setTimeout(r, 60));
    expect(harness.all).toHaveLength(0);
    expect(asked).toBe(0); // not even simulated: nothing to peek at
    // The write succeeded: the gate opens for exactly this round.
    await act(async () => {
      savedWatch.value = watchKey({ fixtureId: t.store.game.value!.liveMatch!.fixtureId, round: 1 });
    });
    await ready();
    expect(harness.all).toHaveLength(1);
    expect(w.fixtureId).toBeTruthy();
  });

  it('a gate for another round does not open this one', async () => {
    const { harness, t, tree } = setup();
    savedWatch.value = watchKey({ fixtureId: t.store.game.value!.liveMatch!.fixtureId, round: 2 });
    render(tree());
    expect(screen.getByTestId('screen-arena-saving')).toBeTruthy();
    expect(harness.all).toHaveLength(0);
  });
});

describe('fighter cards take Space and Enter (review 3)', () => {
  it('Space on a focused card plays or pauses, Enter opens the inspector, Shift Space asks to simulate the rest', async () => {
    const { harness, tree } = setup();
    render(tree());
    await ready();
    const v = harness.current();
    const card = screen.getByTestId('strip-unit-2');
    await act(async () => {
      card.focus(); // focus is selection: the inspector opens while paused, but the round is running
    });
    await waitFor(() => expect(card.getAttribute('aria-pressed')).toBe('true'));
    expect(v.playing).toBe(true);
    const space = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
    await act(async () => {
      card.dispatchEvent(space);
    });
    expect(space.defaultPrevented).toBe(true);
    expect(v.playing).toBe(false);
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });
    expect(v.playing).toBe(true);
    // Enter opens the inspector for the focused card (a button's own Enter would only click it).
    expect(screen.queryByTestId('arena-inspector')).toBeNull();
    fireEvent.keyDown(card, { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('arena-inspector')).toBeTruthy());
    fireEvent.keyDown(card, { key: ' ', code: 'Space', shiftKey: true });
    await waitFor(() => expect(screen.getByTestId('dialog-simulate').hasAttribute('open')).toBe(true));
  });
});

describe('a loaded save with a watched round resumes in the arena (review 5, A3/A7)', () => {
  function withWatchedSave() {
    const w = watchWorld(content);
    const core = createScriptedCore(w);
    const t = createTestStore({ world: 'none', engine: core.engine });
    return { w, t };
  }

  it('Load on the Saves screen opens #/arena', async () => {
    const { w, t } = withWatchedSave();
    t.store.replaceWorld(liveWatchState(w, { cursorTick: 120 }), content);
    expect((await t.store.save('manual-1')).ok).toBe(true);
    t.store.replaceWorld(w.state, content); // another world in memory: the save is what is loaded
    location.hash = '#/saves';
    render(
      <TestProviders store={t.store}>
        <SavesScreen params={{}} />
      </TestProviders>,
    );
    fireEvent.click(await screen.findByTestId('load-manual-1'));
    fireEvent.click(await screen.findByTestId('load-manual-1-confirm'));
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    expect(t.store.game.value!.liveMatch!.watch!.cursorTick).toBe(120);
    // A loaded save is a saved one: its round may open at once.
    expect(savedWatch.value).toBe(watchKey({ fixtureId: t.store.game.value!.liveMatch!.fixtureId, round: 1 }));
  });

  it('Continue on the title screen opens #/arena too, and a save without a watched round still goes Home', async () => {
    const { w, t } = withWatchedSave();
    t.store.replaceWorld(liveWatchState(w), content);
    expect((await t.store.save('manual-1')).ok).toBe(true);
    location.hash = '#/new-game';
    render(
      <TestProviders store={t.store}>
        <NewGameScreen params={{}} />
      </TestProviders>,
    );
    await waitFor(() => expect(screen.getByTestId('title-continue').getAttribute('aria-disabled')).toBeNull());
    fireEvent.click(screen.getByTestId('title-continue'));
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    cleanup();
    // A plain save loads to Home.
    t.store.replaceWorld(w.state, content);
    expect((await t.store.save('manual-2')).ok).toBe(true);
    await t.store.deleteSave('manual-1');
    await t.store.deleteSave('auto-round');
    location.hash = '#/new-game';
    render(
      <TestProviders store={t.store}>
        <NewGameScreen params={{}} />
      </TestProviders>,
    );
    await waitFor(() => expect(screen.getByTestId('title-continue').getAttribute('aria-disabled')).toBeNull());
    fireEvent.click(screen.getByTestId('title-continue'));
    await waitFor(() => expect(location.hash).toBe('#/home'));
  });
});

describe('the palette is re-read on theme, motion and scale change, and only then (review 8)', () => {
  it('calls setPalette for each, setReducedMotion with the motion, and leaves other settings alone', async () => {
    const { harness, tree } = setup();
    render(tree());
    await ready();
    const v = harness.current();
    const count = (what: string) => v.calls.filter((c) => c === what).length;
    const before = count('palette');
    await act(async () => updateSettings({ theme: 'light' }));
    expect(count('palette')).toBe(before + 1);
    await act(async () => updateSettings({ reducedMotion: 'on' }));
    expect(count('palette')).toBe(before + 2);
    expect(count('motion')).toBeGreaterThan(0);
    await act(async () => updateSettings({ scale: 1.25 }));
    expect(count('palette')).toBe(before + 3);
    // Unrelated settings do not re-read the tokens.
    await act(async () => updateSettings({ density: 'compact' }));
    expect(count('palette')).toBe(before + 3);
    await act(async () => updateSettings({ theme: 'dark', reducedMotion: 'system', scale: 1, density: 'comfortable' }));
  });

  it('reads the reduced-motion metrics the designer sets (the flash and pulse tokens go to 0)', () => {
    const root = document.documentElement;
    root.style.setProperty('--arena-pulse-ms', '0ms');
    root.style.setProperty('--arena-hit-flash-ms', '0ms');
    try {
      const p = readArenaPalette('dark', root);
      expect(p.metrics.pulseMs).toBe(0);
      expect(p.metrics.hitFlashMs).toBe(0);
    } finally {
      root.removeAttribute('style');
    }
  });
});

describe('leaving with the pointer (review 9)', () => {
  it('the live arena has a visible Leave that asks once and keeps the match live', async () => {
    const { t, tree } = setup();
    render(tree());
    await ready();
    fireEvent.click(screen.getByTestId('arena-leave'));
    await waitFor(() => expect(screen.getByTestId('dialog-leave').hasAttribute('open')).toBe(true));
    fireEvent.click(screen.getByTestId('confirm-leave'));
    expect(location.hash).toBe('#/home');
    expect(t.store.game.value!.liveMatch!.watch!.round).toBe(1);
  });
});

describe('the feed names who did what (KeyMoment convention: unit acts on target)', () => {
  const w = watchWorld(fixtureContent());
  const state = liveWatchState(w);
  const playback = roundPlaybackOf(state, fixtureContent(), 'live', 1);
  const ctx = buildRoundContext({ state, content: fixtureContent(), playback, match: null, palette: readArenaPalette('dark'), startTick: 0 });
  const name = (u: number) => ctx.units[u]!.name;

  it('a down: unit is the killer and target the fallen; the line, the side and the subject follow the fallen', () => {
    const m = { tick: 400, seq: 9, kind: 'down' as const, unit: 7, target: 3, ability: null };
    expect(momentText(m, ctx, fixtureContent())).toBe(`${name(3)} downed by ${name(7)}`);
    expect(subjectOf(m)).toBe(3);
    const [item] = feedItems([m], ctx, fixtureContent());
    expect(item!.side).toBe(0); // the fallen is ours (home): the moment is about our side
    expect(item!.ours).toBe(true);
    expect(item!.mark).toBe('us');
    expect(item!.title).toBe(`${name(3)} downed by ${name(7)}`);
  });

  it('a down with no credited fighter names only the fallen; an interrupt and a death-ward read unit acting on target', () => {
    expect(momentText({ tick: 1, seq: 1, kind: 'down', unit: null, target: 5, ability: null }, ctx, fixtureContent())).toBe(`${name(5)} downed`);
    expect(momentText({ tick: 1, seq: 2, kind: 'interrupt', unit: 6, target: 1, ability: null }, ctx, fixtureContent())).toBe(`${name(1)} interrupted by ${name(6)}`);
    expect(momentText({ tick: 1, seq: 3, kind: 'deathward', unit: 2, target: 4, ability: null }, ctx, fixtureContent())).toBe(`${name(4)} saved from a fall by ${name(2)}`);
    expect(subjectOf({ tick: 1, seq: 4, kind: 'rally', unit: 0, target: null, ability: null })).toBe(0);
  });
});
