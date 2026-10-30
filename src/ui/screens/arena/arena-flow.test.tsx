/**
 * The watch flow through the whole app shell (05-technical-m2 §A3, §A7, §A11 test-first item 2, ux-001): Play match,
 * the arena, the round-end overlay, the between-round screen, the next round, the end of the match. The core is the
 * scripted fake of WP-M2B (src/ui/debug/arena-test-world.ts); the viewer is the fake behind the factory seam.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import type { FixtureId } from '../../../core/model';
import { fixtureContent } from '../../../core/testkit';
import type { LogSpec } from './testing/fixture-log';
import { App } from '../../app/App';
import { navigate } from '../../app/router';
import { resetToasts, toasts } from '../../components';
import { createTestStore } from '../../debug/test-store';
import { DEFAULT_SETTINGS, updateSettings } from '../../store/settings';
import { resetLiveRoundCache, roundOutcome } from './index';
import { liveWatchState } from '../../debug/arena-test-world';
import { forgetStop, recallStop, rememberStop } from './resume-cause';
import { resetRoundEnd, roundEnd } from './RoundEnd';
import { fakeTimeline } from './testing/fake-timeline';
import { createFakeViewerHarness, type FakeViewerHarness } from './testing/fake-viewer';
import { createScriptedCore, watchWorld, type ScriptedCore, type WatchWorld } from '../../debug/arena-test-world';
import { ViewerFactoryContext } from './viewer-factory';

let content: ContentDB;
beforeEach(() => {
  resetToasts();
  resetRoundEnd();
  resetLiveRoundCache();
  forgetStop();
  content = fixtureContent();
  // A player who lets the rounds run: no auto-pause stops, Watch without the offer, no lineup stop.
  updateSettings({
    ...DEFAULT_SETTINGS,
    // Custom stops (no lineup stop, a report only after an injury): Streamlined would always simulate (owner answer to Q54).
    pacing: 'custom',
    pacingCustom: { lineup: false, reportAlways: false, reportOnLoss: false, reportOnInjury: true },
    arena: {
      ...DEFAULT_SETTINGS.arena,
      watchPreference: 'watch',
      autoPause: { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null },
    },
  });
  location.hash = '#/codex';
});
afterEach(() => {
  cleanup();
  updateSettings({ ...DEFAULT_SETTINGS });
});

interface Mounted {
  w: WatchWorld;
  core: ScriptedCore;
  harness: FakeViewerHarness;
  t: ReturnType<typeof createTestStore>;
}

function mountApp(opts: { winners?: ('home' | 'away')[]; state?: 'prelock' | 'round-waiting'; hash?: string; injured?: boolean; log?: Partial<LogSpec> } = {}): Mounted {
  const w = watchWorld(content);
  if (opts.injured) {
    // A reserve of the player's club hurt this week (the scripted core's reports are of season 1, week 11): the injury stop.
    const reserve = Object.values(w.state.fighters).find((f) => f.clubId === w.home && !w.prepared.home.active.includes(f.id));
    if (!reserve) throw new Error('the fixture club has no reserve to injure');
    reserve.injury = { severity: 'minor', weeksOut: 1, fixtureId: w.fixtureId as FixtureId, round: 1, causeFighterId: null, damageBp: 4000, since: { season: 1, weekIndex: 11 } };
  }
  const core = createScriptedCore(w, { winners: opts.winners, log: opts.log });
  const t = createTestStore({ world: 'none', engine: core.engine });
  t.store.replaceWorld(opts.state === 'round-waiting' ? liveWatchState(w) : w.state, content);
  const harness = createFakeViewerHarness(fakeTimeline, content);
  navigate(opts.hash ?? '#/codex');
  render(
    <ViewerFactoryContext.Provider value={harness.factory}>
      <App store={t.store} />
    </ViewerFactoryContext.Provider>,
  );
  return { w, core, harness, t };
}

const press = (k: string, init: KeyboardEventInit = {}, target: Element = document.body) => fireEvent.keyDown(target, { key: k, ...init });

/** Let a freshly loaded screen register its effects (shortcut layers) before a key is pressed. */
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 100))));

async function arenaReady(m: Mounted, nth: number) {
  await waitFor(() => expect(m.harness.all.length).toBe(nth), { timeout: 4000 });
  await waitFor(() => expect(screen.getByTestId('screen-arena').getAttribute('data-status')).toBe('ready'), { timeout: 4000 });
}

async function playOut(m: Mounted) {
  await act(async () => {
    m.harness.current().advanceTo(1000);
  });
}

describe('ux-001 counted: Play match, then one Enter per round boundary', () => {
  it('a best-of-3 that goes the distance costs 1 + 2 inputs; the round-end overlay asks for none', async () => {
    const m = mountApp({ winners: ['home', 'away', 'home'] });
    let inputs = 0;
    const input = (k: string, init: KeyboardEventInit = {}) => {
      inputs++;
      press(k, init);
    };
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    input(' '); // Play match: Watch is the primary action
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    await arenaReady(m, 1);
    await playOut(m); // the round runs on its own
    await waitFor(() => expect(screen.getByTestId('arena-overlay')).toBeTruthy());
    // The overlay is non-blocking: nothing is pressed, and the between-round screen opens by itself.
    await waitFor(() => expect(location.hash).toBe('#/between-rounds'), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('screen-between-rounds')).toBeTruthy());
    // Replay of the round just played is offered (the live match's earlier rounds).
    expect(screen.getByTestId('br-replay').getAttribute('href')).toBe(`#/replay/${encodeURIComponent(m.w.fixtureId)}?round=1`);
    await settle();
    input('Enter'); // boundary 1
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    await arenaReady(m, 2);
    await playOut(m);
    await waitFor(() => expect(location.hash).toBe('#/between-rounds'), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('screen-between-rounds')).toBeTruthy());
    await settle();
    input('Enter'); // boundary 2
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    await arenaReady(m, 3);
    await playOut(m);
    // The deciding round commits the match: the card says the match result, then Home with the result toast (a win under Streamlined).
    await waitFor(() => expect(screen.getByTestId('round-end-winner').textContent).toMatch(/win the match/));
    expect(screen.getByTestId('arena-overlay').textContent).toContain('The match is decided.');
    expect(screen.getByTestId('arena-overlay').textContent).toContain('Next, back to Home with the result');
    await waitFor(() => expect(location.hash).toBe('#/home'), { timeout: 4000 });
    expect(inputs).toBe(1 + 2);
    expect(m.t.store.game.value!.liveMatch).toBeNull();
    // Every commit carried the log the viewer had loaded.
    const watched = m.core.advances.map((a) => (a.options as { watched?: { round: number; logHash: string } } | undefined)?.watched).filter(Boolean);
    expect(watched.map((x) => x!.round)).toEqual([1, 2, 3]);
    for (const [i, h] of m.harness.all.entries()) expect(watched[i]!.logHash).toBe(h.loadedLog!.hash);
    expect(m.core.advances.map((a) => (a.options ? Object.keys(a.options as object)[0] : 'continue'))).toEqual(['playerMatch', 'watched', 'continue', 'watched', 'continue', 'watched']);
  }, 30_000);

  it('a key pressed on the round-end overlay skips it and is not passed on to the next screen', async () => {
    const m = mountApp();
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await arenaReady(m, 1);
    await playOut(m);
    await waitFor(() => expect(screen.getByTestId('round-end-winner')).toBeTruthy());
    expect(screen.getByTestId('round-end-winner').textContent).toContain(m.w.state.clubs[m.w.home]!.name);
    expect(screen.getByTestId('round-end-score').textContent).toContain('1–0');
    await settle();
    press('Enter');
    await waitFor(() => expect(location.hash).toBe('#/between-rounds'));
    // The Enter was taken by the overlay: the match still waits between rounds, nothing was played on.
    await waitFor(() => expect(screen.getByTestId('screen-between-rounds')).toBeTruthy());
    expect(m.core.advances).toHaveLength(2); // Play match, the commit of round 1
    expect(m.t.store.game.value!.liveMatch!.phase).toBe('between_rounds');
  });
});

describe('after the deciding round the report opens per the pacing preset, as after a simulated match (A7, A18, D-L)', () => {
  const NO_STOPS = { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null };
  // pacingStops (D-L): Thorough opens every report; Balanced after a loss or an injury; Streamlined after an injury only.
  const cases: { pacing: 'thorough' | 'balanced' | 'streamlined'; won: boolean; injured: boolean; opens: boolean }[] = [
    { pacing: 'thorough', won: true, injured: false, opens: true },
    { pacing: 'thorough', won: false, injured: false, opens: true },
    { pacing: 'thorough', won: true, injured: true, opens: true },
    { pacing: 'balanced', won: true, injured: false, opens: false }, // a win goes Home with the result toast
    { pacing: 'balanced', won: false, injured: false, opens: true },
    { pacing: 'balanced', won: true, injured: true, opens: true },
    { pacing: 'streamlined', won: true, injured: false, opens: false },
    { pacing: 'streamlined', won: false, injured: false, opens: false }, // Streamlined does not stop on a loss
    { pacing: 'streamlined', won: true, injured: true, opens: true }, // it does stop on an injury
    { pacing: 'streamlined', won: false, injured: true, opens: true },
  ];
  it.for(cases)('$pacing, won=$won, injured=$injured: the report opens=$opens', { timeout: 30_000 }, async (c) => {
    updateSettings({ ...DEFAULT_SETTINGS, pacing: c.pacing, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch', autoPause: NO_STOPS } });
    // On the Squad screen (the lineup stop of Thorough and Balanced is behind us): Watch is the primary button.
    const m = mountApp({ winners: c.won ? ['home', 'home'] : ['away', 'away'], hash: '#/squad', injured: c.injured });
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toMatch(/Watch|Play match|Simulate/), { timeout: 4000 });
    await settle();
    // Under Streamlined the primary action simulates, and Watch is the second button.
    fireEvent.click(screen.getByTestId(c.pacing === 'streamlined' ? 'continue-other' : 'continue'));
    await arenaReady(m, 1);
    await playOut(m);
    await waitFor(() => expect(location.hash).toBe('#/between-rounds'), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('screen-between-rounds')).toBeTruthy());
    await settle();
    press('Enter');
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    await arenaReady(m, 2);
    await playOut(m);
    // The card names the match result and where it goes next; then the player is taken there.
    await waitFor(() => expect(screen.getByTestId('round-end-winner').textContent).toMatch(/the match/));
    expect(screen.getByTestId('arena-overlay').textContent).toContain(c.opens ? 'Next, the match report opens' : 'Next, back to Home with the result');
    await waitFor(() => expect(location.hash).toBe(c.opens ? `#/match/${encodeURIComponent(m.w.fixtureId)}` : '#/home'), { timeout: 4000 });
    if (!c.opens) expect(toasts.value.some((x) => x.action?.label === 'Open report')).toBe(true);
    else expect(toasts.value.some((x) => x.action?.label === 'Open report')).toBe(false);
  });

  it('Simulate under the same preset goes the same way: Thorough opens the report', async () => {
    updateSettings({ ...DEFAULT_SETTINGS, pacing: 'thorough', arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'simulate', autoPause: NO_STOPS } });
    const m = mountApp({ hash: '#/squad' });
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Simulate'), { timeout: 4000 });
    await settle();
    fireEvent.click(screen.getByTestId('continue'));
    await waitFor(() => expect(location.hash).toBe(`#/match/${encodeURIComponent(m.w.fixtureId)}`), { timeout: 4000 });
    expect(m.harness.all).toHaveLength(0);
  });
});

describe('the viewer opens only after the lock is saved (test-first item 2, through the shell)', () => {
  it('holds the arena closed while the write is pending, then opens it', async () => {
    const m = mountApp();
    const write = m.t.saves.write.bind(m.t.saves);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    m.t.saves.write = async (...a: Parameters<typeof m.t.saves.write>) => {
      if (a[0] === 'auto-round') await gate;
      return write(...a);
    };
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await waitFor(() => expect(m.t.store.game.value!.liveMatch).not.toBeNull());
    await new Promise((r) => setTimeout(r, 80));
    expect(location.hash).toBe('#/codex');
    expect(m.harness.all).toHaveLength(0);
    release();
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    await arenaReady(m, 1);
  });

  it('navigating to #/arena while the lock is still being written shows nothing of the round, and a failed write never shows it', async () => {
    const m = mountApp();
    const write = m.t.saves.write.bind(m.t.saves);
    let release!: (ok: boolean) => void;
    const gate = new Promise<boolean>((r) => (release = r));
    m.t.saves.write = async (...a: Parameters<typeof m.t.saves.write>) => {
      if (a[0] === 'auto-round') {
        if (!(await gate)) throw new Error('disk full');
      }
      return write(...a);
    };
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await waitFor(() => expect(m.t.store.game.value!.liveMatch).not.toBeNull()); // the lock is in memory, the write is pending
    let asked = 0;
    const inner = m.core.engine.liveRoundPlayback!;
    m.core.engine.liveRoundPlayback = ((...a: Parameters<typeof inner>) => (asked++, inner(...a))) as typeof inner;
    navigate('#/arena');
    await waitFor(() => expect(screen.getByTestId('screen-arena-saving')).toBeTruthy());
    await new Promise((r) => setTimeout(r, 80));
    expect(m.harness.all).toHaveLength(0);
    expect(asked).toBe(0);
    // The write fails: the lock rolls back, and the round was never shown.
    release(false);
    await waitFor(() => expect(m.t.store.game.value!.liveMatch).toBeNull());
    expect(m.harness.all).toHaveLength(0);
    expect(asked).toBe(0);
  });

  it('a failed write keeps the viewer closed with Could not save and Retry; Play match again locks the same round', async () => {
    const m = mountApp();
    const write = m.t.saves.write.bind(m.t.saves);
    let failing = true;
    m.t.saves.write = async (...a: Parameters<typeof m.t.saves.write>) => {
      if (a[0] === 'auto-round' && failing) throw new Error('disk full');
      return write(...a);
    };
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await waitFor(() => expect(toasts.value.some((x) => x.title === 'Could not save the lineup lock')).toBe(true));
    expect(location.hash).toBe('#/codex');
    expect(m.harness.all).toHaveLength(0);
    expect(m.t.store.game.value!.liveMatch).toBeNull();
    expect((await m.t.saves.list()).some((x) => x.slotId === 'auto-round')).toBe(false);
    const toast = toasts.value.find((x) => x.title === 'Could not save the lineup lock')!;
    expect(toast.action?.label).toBe('Retry');
    // One toast, not two: the store stays quiet and Play match says it once.
    expect(toasts.value).toHaveLength(1);
    failing = false;
    toast.action!.onClick();
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    await arenaReady(m, 1);
    expect(m.t.store.game.value!.liveMatch!.watch).toEqual({ mode: 'watch', round: 1, cursorTick: 0, calls: [] });
  });
});

describe('Play match offers Watch and Simulate side by side (open-020, Q54)', () => {
  it('Watch is primary and Simulate one input away (Shift Space)', async () => {
    updateSettings({ ...DEFAULT_SETTINGS, pacing: 'custom', pacingCustom: { ...DEFAULT_SETTINGS.pacingCustom, lineup: false }, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'ask' } });
    const m = mountApp();
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Watch'));
    expect(screen.getByTestId('continue-other').textContent).toContain('Simulate');
    // The pair of the mock: Watch is the brass one, Simulate the neutral one.
    expect(screen.getByTestId('continue-other').className).toContain('continue--secondary');
    expect(screen.getByTestId('continue').className).not.toContain('continue--secondary');
    await settle();
    press(' ', { shiftKey: true });
    await waitFor(() => expect(m.core.advances).toHaveLength(1));
    expect(m.core.advances[0]!.options).toEqual({ playerMatch: 'simulate' });
    // Simulated: nothing opened in the arena.
    expect(location.hash).not.toBe('#/arena');
    expect(m.harness.all).toHaveLength(0);
  });

  it('Streamlined simulates on Space and offers Watch beside it', async () => {
    updateSettings({ ...DEFAULT_SETTINGS, pacing: 'streamlined', arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'ask' } });
    const m = mountApp();
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Simulate'));
    expect(screen.getByTestId('continue-other').textContent).toContain('Watch');
    fireEvent.click(screen.getByTestId('continue-other'));
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    expect(m.core.advances[0]!.options).toEqual({ playerMatch: 'watch' });
  });

  it('an explicit preference hides the offer', async () => {
    mountApp();
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    expect(screen.queryByTestId('continue-other')).toBeNull();
  });

  it('Streamlined always simulates, with Watch beside it, even when the preference says Always watch', async () => {
    updateSettings({ ...DEFAULT_SETTINGS, pacing: 'streamlined', arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch' } });
    const m = mountApp();
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Simulate'));
    expect(screen.getByTestId('continue-other').textContent).toContain('Watch');
    await settle();
    press(' ');
    await waitFor(() => expect(m.core.advances).toHaveLength(1));
    expect(m.core.advances[0]!.options).toEqual({ playerMatch: 'simulate' });
    expect(m.harness.all).toHaveLength(0);
  });
});

describe('routing and resume', () => {
  it("Continue from another screen reads Resume watching and opens the arena instead of advancing (watch.not-shown never reached)", async () => {
    const m = mountApp({ state: 'round-waiting', hash: '#/codex' });
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Resume watching'));
    await settle();
    press(' ');
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    expect(m.core.advances).toHaveLength(0);
    await arenaReady(m, 1);
  });

  it('a commit with no shown log (a stale tab) is routed to the arena, not shown as an error', async () => {
    const m = mountApp({ state: 'round-waiting', hash: '#/codex' });
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Resume watching'));
    const res = await m.t.store.advance();
    expect(!res.ok && res.error.code).toBe('watch.not-shown');
    expect(toasts.value).toHaveLength(0);
  });

  it('Play match from another screen opens the arena and stays on it (no bounce to Home)', async () => {
    // This test used to fail under load, about 40 ms after #/arena: an EARLIER test's Simulate (Frame.advance keeps a 600 ms
    // Simulating pause) finished after its frame was unmounted and navigated Home. Frame.advance no longer routes once unmounted.
    const m = mountApp({ hash: '#/codex' });
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await arenaReady(m, 1);
    await new Promise((r) => setTimeout(r, 150));
    expect(location.hash).toBe('#/arena');
    expect(m.harness.all).toHaveLength(1);
  });

  it('a Simulate whose frame is gone before it finishes does not route afterwards (the stale navigate behind the bounce)', async () => {
    updateSettings({ ...DEFAULT_SETTINGS, pacing: 'streamlined', arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'ask' } });
    const m = mountApp({ hash: '#/codex' });
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Simulate'));
    await settle();
    press(' '); // Simulate: the Simulating pause runs 600 ms before the step routes
    await waitFor(() => expect(m.core.advances).toHaveLength(1));
    cleanup(); // the frame is gone (another screen took over, the test ended)
    navigate('#/market');
    await new Promise((r) => setTimeout(r, 900));
    expect(location.hash).toBe('#/market');
    expect(toasts.value).toHaveLength(0);
  });

  it('a cursor save that finds the store busy is retried quietly at the next stop (no toast, no error)', async () => {
    // Opened on a saved lock (a resumed round): this test is about the cursor, not about how the arena was reached.
    const m = mountApp({ state: 'round-waiting', hash: '#/arena' });
    await arenaReady(m, 1);
    await settle();
    const busy = m.t.store.busy as unknown as { value: boolean };
    busy.value = true; // a commit or save is in flight when the first stop happens
    await act(async () => {
      m.harness.current().advanceTo(250);
    });
    await settle();
    press(' '); // pause at 250: the cursor save finds the store busy
    await waitFor(() => expect(m.harness.current().playing).toBe(false));
    await settle();
    expect(m.core.watchCommands).toHaveLength(0);
    expect(toasts.value).toHaveLength(0);
    expect(m.t.store.lastError.value).toBeNull();
    // Free again: the next stop saves the frontier (the furthest tick shown), 250 included.
    busy.value = false;
    await settle();
    press(' '); // resume
    await waitFor(() => expect(m.harness.current().playing).toBe(true));
    await act(async () => {
      m.harness.current().advanceTo(400);
    });
    await settle();
    press(' '); // pause at 400
    await waitFor(() => expect(m.core.watchCommands.at(-1)?.tick).toBe(400), { timeout: 4000 });
    expect(toasts.value).toHaveLength(0);
    expect(m.t.store.lastError.value).toBeNull();
  });

  it('after a reload mid-round the arena resumes paused at the last stop and the outcome is still fixed', async () => {
    const m = mountApp({ hash: '#/codex' });
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await arenaReady(m, 1);
    await act(async () => {
      m.harness.current().advanceTo(250);
    });
    await settle();
    press(' '); // pause at 250: the cursor is saved
    await waitFor(() => expect(m.harness.current().playing).toBe(false));
    await waitFor(() => expect(m.core.watchCommands.at(-1)?.tick).toBe(250), { timeout: 4000 });
    await waitFor(async () => expect(JSON.parse((await m.t.saves.read('auto-round'))!).state.liveMatch.watch.cursorTick).toBe(250), { timeout: 4000 });
    // "Reload": a fresh store and app load the round autosave.
    cleanup();
    const json = (await m.t.saves.read('auto-round'))!;
    const core2 = createScriptedCore(m.w);
    const t2 = createTestStore({ world: 'none', engine: core2.engine });
    t2.store.replaceWorld(JSON.parse(json).state, content);
    const harness2 = createFakeViewerHarness(fakeTimeline, content);
    navigate('#/arena');
    render(
      <ViewerFactoryContext.Provider value={harness2.factory}>
        <App store={t2.store} />
      </ViewerFactoryContext.Provider>,
    );
    await waitFor(() => expect(harness2.all).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('screen-arena').getAttribute('data-status')).toBe('ready'));
    expect(harness2.current().tick).toBe(250);
    expect(harness2.current().playing).toBe(false);
    expect(harness2.current().calls).not.toContain('play');
  });
});

describe('a resumed round says why it stopped where it did', () => {
  /** Play the live round to a stop, save, "reload" (a fresh store and app on the round autosave), and return the resumed arena. */
  async function stopAndReload(stopTick: number, autoPause: Partial<typeof DEFAULT_SETTINGS.arena.autoPause>, pause: 'auto' | 'manual', savedTick = Math.ceil(stopTick)) {
    updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch', autoPause: { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null, ...autoPause } } });
    const m = mountApp({ state: 'round-waiting', hash: '#/arena' });
    await arenaReady(m, 1);
    await settle();
    const saved = savedTick;
    await act(async () => {
      m.harness.current().advanceTo(stopTick); // an automatic stop is reached on the way; a manual one is made below
    });
    await settle();
    if (pause === 'manual') {
      press(' ');
      await waitFor(() => expect(m.harness.current().playing).toBe(false));
    } else await waitFor(() => expect(m.harness.current().playing).toBe(false));
    await waitFor(() => expect(m.core.watchCommands.at(-1)?.tick).toBe(saved), { timeout: 4000 });
    await waitFor(async () => expect(JSON.parse((await m.t.saves.read('auto-round'))!).state.liveMatch.watch.cursorTick).toBe(saved), { timeout: 4000 });
    cleanup();
    const json = (await m.t.saves.read('auto-round'))!;
    const core2 = createScriptedCore(m.w);
    const t2 = createTestStore({ world: 'none', engine: core2.engine });
    t2.store.replaceWorld(JSON.parse(json).state, content);
    const harness2 = createFakeViewerHarness(fakeTimeline, content);
    navigate('#/arena');
    render(
      <ViewerFactoryContext.Provider value={harness2.factory}>
        <App store={t2.store} />
      </ViewerFactoryContext.Provider>,
    );
    await waitFor(() => expect(harness2.all).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('screen-arena').getAttribute('data-status')).toBe('ready'), { timeout: 4000 });
    expect(harness2.current().tick).toBe(saved);
    expect(harness2.current().playing).toBe(false);
    return { m };
  }

  it('an automatic pause: the same cause and announcement as the live stop', async () => {
    // The fixture round's first down is unit 3, ours, at tick 400.
    await stopAndReload(1000, { ownDowned: true }, 'auto', 400);
    const fallen = screen.getByTestId('status-note').textContent!;
    expect(fallen).toMatch(/ was downed$/);
    expect(screen.getByText('Paused automatically')).toBeTruthy();
    expect(screen.getByTestId('arena-announce').textContent).toBe(`Paused: one of yours went down (${fallen.replace(' was downed', '')})`);
  });

  it('a manual pause shows no cause', async () => {
    await stopAndReload(250, { ownDowned: true }, 'manual');
    expect(screen.queryByTestId('status-note')).toBeNull();
    expect(screen.getByTestId('arena-announce').textContent).toBe('');
  });

  it('a manual pause a fraction of a tick before a down is not shown as that down (the cursor is the ceil of the head)', async () => {
    // Paused at 399.6: the reveal frontier saved is 400, the tick of the own down, which was never reached.
    await stopAndReload(399.6, { ownDowned: true }, 'manual');
    expect(screen.queryByTestId('status-note')).toBeNull();
    expect(screen.queryByText('Paused automatically')).toBeNull();
    expect(screen.getByTestId('arena-announce').textContent).toBe('');
  });

  it('the start of overtime is named too, when the player stops on it', async () => {
    await stopAndReload(1000, { overtime: true }, 'auto', 900);
    expect(screen.getByTestId('arena-announce').textContent).toBe('Paused: overtime starts');
  });
});

describe('the remembered stop (resume-cause.ts)', () => {
  const at = { career: '7', fixtureId: 'f1', round: 1, cursor: 400 };
  const stop = { tick: 400, seq: 12, reason: 'ownDowned' as const, unit: 3 };

  it('is recalled for the same career, fixture, round and cursor, and for nothing else', () => {
    rememberStop(at, stop);
    expect(recallStop(at)).toEqual({ kind: 'auto', stop });
    for (const other of [{ ...at, cursor: 401 }, { ...at, round: 2 }, { ...at, fixtureId: 'f2' }, { ...at, career: '8' }]) expect(recallStop(other)).toBeNull();
  });

  it('a later stop that was not automatic clears it; garbage and missing storage give no cause', () => {
    rememberStop(at, stop);
    rememberStop({ ...at, cursor: 450 }, null);
    expect(recallStop(at)).toBeNull();
    expect(recallStop({ ...at, cursor: 450 })).toBeNull();
    localStorage.setItem('arena-league.arena.last-stop', '{not json');
    expect(recallStop(at)).toBeNull();
    localStorage.setItem('arena-league.arena.last-stop', JSON.stringify({ ...at, stop: { tick: 'x' } }));
    expect(recallStop(at)).toBeNull();
    forgetStop();
    expect(recallStop(at)).toBeNull();
  });
});

describe('committing a round', () => {
  async function toRoundEnd(m: Mounted) {
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await arenaReady(m, 1);
  }

  it('a hash mismatch is a defect: the overlay says so, nothing is committed and nothing retries silently', async () => {
    const m = mountApp();
    await toRoundEnd(m);
    m.core.failNext = { code: 'watch.mismatch', message: 'The shown log differs' };
    // failNext applies to the NEXT advance, which is the commit.
    await playOut(m);
    await waitFor(() => expect(screen.getByTestId('arena-overlay').getAttribute('data-phase')).toBe('mismatch'));
    expect(screen.getByTestId('arena-overlay').textContent).toContain('This is a defect');
    expect(m.t.store.game.value!.liveMatch!.rounds).toHaveLength(0);
    expect(m.core.advances).toHaveLength(2);
  });

  it('the failure cards have a Leave: the match stays live and Continue reads Resume watching', async () => {
    const m = mountApp();
    await toRoundEnd(m);
    m.core.failNext = { code: 'watch.mismatch', message: 'The shown log differs' };
    await playOut(m);
    await waitFor(() => expect(screen.getByTestId('arena-overlay').getAttribute('data-phase')).toBe('mismatch'));
    fireEvent.click(screen.getByTestId('round-end-leave'));
    await waitFor(() => expect(location.hash).toBe('#/home'));
    expect(m.t.store.game.value!.liveMatch!.watch!.round).toBe(1);
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Resume watching'));
  });

  it("a mismatch with reason 'round' (already committed) is not a defect and is not retried", async () => {
    const m = mountApp();
    await toRoundEnd(m);
    m.core.failNext = { code: 'watch.mismatch', message: 'already committed', details: { reason: 'round' } };
    await playOut(m);
    await waitFor(() => expect(screen.queryByTestId('arena-overlay')).toBeNull());
    expect(document.body.textContent).not.toContain('This is a defect');
    expect(m.core.advances).toHaveLength(2); // Play match and the one commit: no retry
  });

  it('a commit that fails can be retried from the overlay with the same hash', async () => {
    const m = mountApp();
    await toRoundEnd(m);
    m.core.failNext = { code: 'engine.crash', message: 'boom' };
    await playOut(m);
    await waitFor(() => expect(screen.getByTestId('arena-overlay').getAttribute('data-phase')).toBe('failed'));
    fireEvent.click(screen.getByTestId('round-end-retry'));
    await waitFor(() => expect(m.t.store.game.value!.liveMatch!.rounds).toHaveLength(1));
    const hashes = m.core.advances.map((a) => (a.options as { watched?: { logHash: string } } | undefined)?.watched?.logHash).filter(Boolean);
    expect(new Set(hashes).size).toBe(1);
    expect(hashes).toHaveLength(2);
  });

  it('Skip to end of round asks once, can be cancelled (the round runs on), and commits the loaded log', async () => {
    const m = mountApp();
    await toRoundEnd(m);
    await act(async () => {
      m.harness.current().advanceTo(100);
    });
    press('s', { shiftKey: true });
    await waitFor(() => expect(screen.getByTestId('dialog-skip').hasAttribute('open')).toBe(true));
    expect(m.harness.current().playing).toBe(false);
    // Cancel: back to playing, nothing committed.
    fireEvent.click(within(screen.getByTestId('dialog-skip')).getByText(/Cancel/));
    await waitFor(() => expect(m.harness.current().playing).toBe(true));
    expect(m.t.store.game.value!.liveMatch!.rounds).toHaveLength(0);
    press('s', { shiftKey: true });
    await waitFor(() => expect(screen.getByTestId('dialog-skip').hasAttribute('open')).toBe(true));
    fireEvent.click(screen.getByTestId('confirm-skip'));
    await waitFor(() => expect(m.t.store.game.value!.liveMatch!.rounds).toHaveLength(1));
    expect((m.core.advances.at(-1)!.options as { watched: { logHash: string } }).watched.logHash).toBe(m.harness.current().loadedLog!.hash);
  });

  it('Simulate the rest asks once, switches the mode, and the match is played on without a hash', async () => {
    const m = mountApp();
    await toRoundEnd(m);
    fireEvent.click(screen.getByTestId('arena-simulate-rest'));
    await waitFor(() => expect(screen.getByTestId('dialog-simulate').hasAttribute('open')).toBe(true));
    fireEvent.click(screen.getByTestId('confirm-simulate'));
    await waitFor(() => expect(m.core.watchCommands.some((c) => c.mode === 'simulate')).toBe(true));
    // The mode has switched under the screen, but the round stays on show with a card until the match has moved on: no flash
    // of the no-round screen.
    expect(document.body.textContent).not.toContain('No round is waiting to be watched');
    expect(screen.getByTestId('arena-overlay').textContent).toContain('Simulating the rest of the match');
    await waitFor(() => expect(m.t.store.game.value!.liveMatch).toBeNull());
    expect(m.core.advances.at(-1)!.options).toBeUndefined();
    await waitFor(() => expect(location.hash).not.toBe('#/arena'));
  });
});

describe('the live round is simulated once per round (WP-M2B: cache it)', () => {
  it('coming back to the arena does not simulate the same round again', async () => {
    const m = mountApp({ state: 'round-waiting', hash: '#/arena' });
    await arenaReady(m, 1);
    let calls = 0;
    const inner = m.core.engine.liveRoundPlayback!;
    m.core.engine.liveRoundPlayback = ((...a: Parameters<typeof inner>) => (calls++, inner(...a))) as typeof inner;
    navigate('#/codex');
    await waitFor(() => expect(m.harness.current().destroyed).toBe(true));
    navigate('#/arena');
    await arenaReady(m, 2);
    expect(calls).toBe(0);
  });
});

describe('keyboard only (04 §9, A9)', () => {
  it('plays a round, walks the fighters with Tab (focus is selection), opens the inspector and skips the round without a pointer', async () => {
    const m = mountApp();
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await arenaReady(m, 1);
    const v = m.harness.current();
    const host = screen.getByTestId('arena-host');
    // The canvas has focus on arrival, so every key below reaches the screen without a click. The shell's keys are gone:
    // 3 does not leave for Fixtures, S does not open Saves, Space is not Continue.
    await waitFor(() => expect(document.activeElement).toBe(host));
    await settle();
    press('3', {}, host);
    press('s', {}, host);
    expect(location.hash).toBe('#/arena');
    press('2', {}, host);
    expect(v.speed).toBe(2);
    await act(async () => v.advanceTo(200));
    press(' ', {}, host); // pause
    await waitFor(() => expect(v.playing).toBe(false));
    press('ArrowLeft', {}, host);
    expect(v.tick).toBe(198);
    // Tab moves through the ten cards in the normal focus order; focus is selection, so it opens the inspector.
    const first = screen.getByTestId('strip-unit-0');
    first.focus();
    await waitFor(() => expect(screen.getByTestId('arena-inspector')).toBeTruthy());
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('inspector-name').textContent).toBe(m.w.state.fighters[m.w.prepared.home.active[0]!]!.name.full);
    screen.getByTestId('strip-unit-1').focus();
    await waitFor(() => expect(screen.getByTestId('strip-unit-1').getAttribute('aria-pressed')).toBe('true'));
    expect(first.getAttribute('aria-pressed')).toBe('false');
    // Tab never traps: the canvas is one stop and nothing intercepts the key, so focus can leave in the normal order.
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    host.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    await settle();
    press('Escape', {}, host); // closes the inspector first
    await waitFor(() => expect(screen.queryByTestId('arena-inspector')).toBeNull());
    press('i', {}, host);
    await waitFor(() => expect(screen.getByTestId('arena-inspector')).toBeTruthy());
    press('s', { shiftKey: true }, host);
    await waitFor(() => expect(screen.getByTestId('dialog-skip').hasAttribute('open')).toBe(true));
    fireEvent.click(screen.getByTestId('confirm-skip')); // Enter on a focused button is its click
    await waitFor(() => expect(m.t.store.game.value!.liveMatch!.rounds).toHaveLength(1));
  });

  it('every control of the arena has an accessible name and a key', async () => {
    const m = mountApp();
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await arenaReady(m, 1);
    const root = screen.getByTestId('screen-arena');
    for (const el of root.querySelectorAll('button, input, [role="slider"]')) {
      const name = el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';
      expect(name, `unnamed control: ${el.outerHTML.slice(0, 80)}`).not.toBe('');
    }
    // The canvas is an image with a label, and focusable.
    const host = screen.getByTestId('arena-host');
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBeTruthy();
    expect(host.tabIndex).toBe(0);
    // The keys are listed on screen.
    expect(root.textContent).toContain('Space plays or pauses');
  });
});

describe('a deciding down on the end tick (WP-M2D: the end stop carries no cause)', () => {
  it('is the round end only (no separate pause), and the card and the status name the down read from the moments', async () => {
    // The fixture round's down (unit 3, ours, by unit 7) now lands on the end tick, and the player stops on own downs.
    updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch', autoPause: { ownDowned: true, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null } } });
    const m = mountApp({ state: 'round-waiting', hash: '#/arena', log: { endTick: 600, downTick: 600 } });
    await arenaReady(m, 1);
    await settle();
    const ctxName = (u: number) => m.w.state.fighters[m.w.prepared[u < 5 ? 'home' : 'away'].active[u % 5]!]!.name.full;
    await act(async () => {
      m.harness.current().advanceTo(1000);
    });
    // One stop, the end: the card is up with no key pressed, and it names the deciding down.
    await waitFor(() => expect(screen.getByTestId('round-end-down')).toBeTruthy(), { timeout: 4000 });
    // The sentence the feed uses for that down (the fallen, the one who downed him, the ability).
    const sentence = screen.getByTestId('round-end-down').textContent!;
    expect(sentence.startsWith(`The last to fall: ${ctxName(3)} downed by ${ctxName(7)}`)).toBe(true);
    expect(sentence.endsWith('.')).toBe(true);
    expect(m.harness.current().calls.filter((c) => c === 'play')).toHaveLength(1);
    expect(screen.getByTestId('status-note').textContent).toBe(`${ctxName(3)} was downed`);
    expect(screen.queryByText('Paused automatically')).toBeNull();
  }, 20_000);

  it('a round that ends with no down on its end tick (the time cap) names no down', async () => {
    const m = mountApp({ state: 'round-waiting', hash: '#/arena' }); // the fixture's down is at 400, the end at 1,000
    await arenaReady(m, 1);
    await settle();
    await act(async () => {
      m.harness.current().advanceTo(1000);
    });
    await waitFor(() => expect(screen.getByTestId('round-end-winner')).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByTestId('round-end-down')).toBeNull();
    expect(screen.queryByTestId('status-note')).toBeNull();
  }, 20_000);
});

describe('a step that outlives its screen does not act afterwards (Back while a round commits)', () => {
  it('leaves no result card behind: the next arena shows none and is not sent to the between-round screen 1.5 s later', async () => {
    const m = mountApp({ state: 'round-waiting', hash: '#/arena' });
    await arenaReady(m, 1);
    await settle();
    // Hold the commit's autosave, so finish() is still waiting when Back is pressed.
    const write = m.t.saves.write.bind(m.t.saves);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    m.t.saves.write = async (...a: Parameters<typeof m.t.saves.write>) => {
      if (a[0] === 'auto-round') await gate;
      return write(...a);
    };
    await playOut(m); // the round ends: the commit starts and waits on the held write
    await waitFor(() => expect(screen.getByTestId('arena-overlay').getAttribute('data-phase')).toBe('saving'));
    navigate('#/home'); // Back
    await waitFor(() => expect(screen.queryByTestId('screen-arena')).toBeNull());
    release();
    await waitFor(() => expect(m.t.store.game.value!.liveMatch!.phase).toBe('between_rounds'), { timeout: 4000 }); // the commit stands
    await settle();
    expect(location.hash).toBe('#/home'); // the finished commit did not route him anywhere
    expect(toasts.value).toHaveLength(0);
    // Round 2, from the between-round screen: no card is waiting for it.
    navigate('#/between-rounds');
    await waitFor(() => expect(screen.getByTestId('screen-between-rounds')).toBeTruthy());
    await settle();
    press('Enter');
    await waitFor(() => expect(location.hash).toBe('#/arena'));
    await arenaReady(m, 2);
    expect(screen.queryByTestId('arena-overlay')).toBeNull();
    await new Promise((r) => setTimeout(r, 1900)); // longer than the card's 1.5 s
    expect(location.hash).toBe('#/arena');
    expect(m.harness.all[1]!.destroyed).toBe(false);
    expect(screen.queryByTestId('arena-overlay')).toBeNull();
  }, 20_000);

  it('a card left in the module signal by an earlier screen is cleared when the arena mounts', async () => {
    const m = mountApp({ state: 'round-waiting', hash: '#/codex' });
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Resume watching'));
    // What the commit used to leave behind: a result card with a next step.
    let ran = 0;
    roundEnd.value = { phase: 'result', round: 1, bestOf: 3, result: null, next: () => void ran++, retry: null };
    await settle();
    press(' ');
    await arenaReady(m, 1);
    expect(screen.queryByTestId('arena-overlay')).toBeNull();
    await new Promise((r) => setTimeout(r, 1800));
    expect(ran).toBe(0);
    expect(location.hash).toBe('#/arena');
  }, 20_000);
});

describe('final QA defects', () => {
  const NO_STOPS = { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null };

  /** Watch round 1 to the end and wait on the between-round screen. */
  async function toBetweenRounds(m: Mounted) {
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    await settle();
    press(' ');
    await arenaReady(m, 1);
    await playOut(m);
    await waitFor(() => expect(location.hash).toBe('#/between-rounds'), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('br-continue')).toBeTruthy());
    await settle();
  }
  /** The auto-round write of the NEXT lock: held, then failed (or passed on). */
  function gateLockWrite(m: Mounted) {
    const write = m.t.saves.write.bind(m.t.saves);
    let release!: (ok: boolean) => void;
    let gate = new Promise<boolean>((r) => (release = r));
    let mode: 'ok' | 'hold' = 'ok';
    m.t.saves.write = async (...a: Parameters<typeof m.t.saves.write>) => {
      if (a[0] === 'auto-round' && mode === 'hold') {
        if (!(await gate)) throw new Error('disk full');
      }
      return write(...a);
    };
    return {
      hold: () => {
        mode = 'hold';
        gate = new Promise<boolean>((r) => (release = r));
      },
      finish: (ok: boolean) => {
        mode = 'ok';
        release(ok);
      },
    };
  }

  describe('D1: a failed lock write on the between-round Continue is not silent', () => {
    beforeEach(() => updateSettings({ ...DEFAULT_SETTINGS, pacing: 'custom', pacingCustom: { lineup: false, reportAlways: false, reportOnLoss: false, reportOnInjury: true }, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch', autoPause: NO_STOPS } }));

    it('says what is happening while the write runs, then a toast with Retry (the screen is back); Retry opens the round', async () => {
      const m = mountApp();
      await toBetweenRounds(m);
      const gate = gateLockWrite(m);
      gate.hold();
      await act(async () => void fireEvent.click(screen.getByTestId('br-continue')));
      // The lock is in memory while the write runs: not "No match is waiting".
      await waitFor(() => expect(screen.getByTestId('br-locking')).toBeTruthy());
      expect(screen.getByTestId('screen-between-rounds').textContent).not.toContain('No match is waiting');
      gate.finish(false);
      await waitFor(() => expect(toasts.value.some((x) => x.title === 'Could not save the lineup lock')).toBe(true), { timeout: 4000 });
      const toast = toasts.value.find((x) => x.title === 'Could not save the lineup lock')!;
      expect(toast.action?.label).toBe('Retry');
      expect(toasts.value).toHaveLength(1);
      // The between-round view is back, the lock rolled back, nothing opened.
      await waitFor(() => expect(screen.getByTestId('br-continue')).toBeTruthy());
      expect(location.hash).toBe('#/between-rounds');
      expect(m.t.store.game.value!.liveMatch!.phase).toBe('between_rounds');
      expect(m.harness.all).toHaveLength(1);
      toast.action!.onClick();
      await waitFor(() => expect(location.hash).toBe('#/arena'), { timeout: 4000 });
      await arenaReady(m, 2);
    }, 20_000);

    it('the toast survives a screen that is gone: Back during the write, the failure still says so, and Retry works from the toast', async () => {
      const m = mountApp();
      await toBetweenRounds(m);
      const gate = gateLockWrite(m);
      gate.hold();
      await act(async () => void fireEvent.click(screen.getByTestId('br-continue')));
      await waitFor(() => expect(screen.getByTestId('br-locking')).toBeTruthy());
      navigate('#/home'); // Back
      await waitFor(() => expect(screen.queryByTestId('screen-between-rounds')).toBeNull());
      gate.finish(false);
      await waitFor(() => expect(toasts.value.some((x) => x.title === 'Could not save the lineup lock')).toBe(true), { timeout: 4000 });
      expect(location.hash).toBe('#/home'); // nobody was routed anywhere
      toasts.value.find((x) => x.title === 'Could not save the lineup lock')!.action!.onClick();
      await waitFor(() => expect(location.hash).toBe('#/arena'), { timeout: 4000 });
      await arenaReady(m, 2);
    }, 20_000);
  });

  describe('D2: a manual pause clears the cause of an earlier automatic one', () => {
    it('own down pauses automatically with its cause; resume, then Space: just Paused, nothing announced', async () => {
      updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch', autoPause: { ...NO_STOPS, ownDowned: true } } });
      const m = mountApp({ state: 'round-waiting', hash: '#/arena' });
      await arenaReady(m, 1);
      await settle();
      await act(async () => {
        m.harness.current().advanceTo(1000); // stops on the own down at 400
      });
      await waitFor(() => expect(screen.getByText('Paused automatically')).toBeTruthy());
      expect(screen.getByTestId('status-note').textContent).toMatch(/ was downed$/);
      expect(screen.getByTestId('arena-announce').textContent).toMatch(/^Paused: one of yours went down/);
      await settle();
      press(' '); // resume
      await waitFor(() => expect(m.harness.current().playing).toBe(true));
      await act(async () => {
        m.harness.current().advanceTo(450);
      });
      await settle();
      press(' '); // a manual pause
      await waitFor(() => expect(m.harness.current().playing).toBe(false));
      await waitFor(() => expect(screen.getByTestId('status-paused')).toBeTruthy());
      expect(screen.queryByText('Paused automatically')).toBeNull();
      expect(screen.queryByTestId('status-note')).toBeNull();
      expect(screen.getByTestId('arena-announce').textContent).toBe('');
    }, 20_000);
  });

  describe('D7: feedback and consistency', () => {
    it('Ctrl S while the round runs says to pause first; paused, it saves with no such message', async () => {
      updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch', autoPause: NO_STOPS } });
      const m = mountApp({ state: 'round-waiting', hash: '#/arena' });
      await arenaReady(m, 1);
      await settle();
      expect(m.harness.current().playing).toBe(true);
      fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
      await waitFor(() => expect(toasts.value.some((x) => x.title === 'Pause first, then save')).toBe(true));
      expect((await m.t.saves.list()).some((s) => s.slotId.startsWith('manual'))).toBe(false);
      resetToasts();
      press(' ');
      await waitFor(() => expect(m.harness.current().playing).toBe(false));
      await settle();
      fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
      await waitFor(async () => expect((await m.t.saves.list()).some((s) => s.slotId.startsWith('manual'))).toBe(true), { timeout: 4000 });
      expect(toasts.value.some((x) => x.title === 'Pause first, then save')).toBe(false);
    });

    it('a cursor save that fails at a stop leaves a quiet note (no toast); the next stop that saves clears it', async () => {
      updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch', autoPause: NO_STOPS } });
      const m = mountApp({ state: 'round-waiting', hash: '#/arena' });
      await arenaReady(m, 1);
      await settle();
      const write = m.t.saves.write.bind(m.t.saves);
      let failing = true;
      m.t.saves.write = async (...a: Parameters<typeof m.t.saves.write>) => {
        if (a[0] === 'auto-round' && failing) throw new Error('disk full');
        return write(...a);
      };
      await act(async () => {
        m.harness.current().advanceTo(250);
      });
      await settle();
      press(' '); // pause: the save fails
      await waitFor(() => expect(screen.getByTestId('status-save')).toBeTruthy(), { timeout: 4000 });
      expect(toasts.value).toHaveLength(0);
      failing = false;
      await settle();
      press(' '); // resume
      await waitFor(() => expect(m.harness.current().playing).toBe(true));
      await act(async () => {
        m.harness.current().advanceTo(400);
      });
      await settle();
      press(' '); // pause: saved this time
      await waitFor(() => expect(screen.queryByTestId('status-save')).toBeNull(), { timeout: 4000 });
      expect(m.core.watchCommands.at(-1)?.tick).toBe(400);
    }, 20_000);

    it('an OS reduced-motion change while the arena is open reaches the viewer at once', async () => {
      const realMatchMedia = window.matchMedia;
      const listeners: (() => void)[] = [];
      let reduce = false;
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (q: string) => ({ matches: /reduce/.test(q) ? reduce : false, addEventListener: (_: string, fn: () => void) => void listeners.push(fn), removeEventListener: () => undefined }),
      });
      try {
        updateSettings({ ...DEFAULT_SETTINGS, reducedMotion: 'system', arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'watch', autoPause: NO_STOPS } });
        const m = mountApp({ state: 'round-waiting', hash: '#/arena' });
        await arenaReady(m, 1);
        await settle();
        reduce = true; // the player turns "reduce motion" on in the OS
        await act(async () => listeners.forEach((fn) => fn()));
        expect(m.harness.current().reducedMotion).toBe(true);
      } finally {
        Object.defineProperty(window, 'matchMedia', { configurable: true, value: realMatchMedia });
      }
    });
  });
});

describe('D7: the round-end card is home-left like the HUD', () => {
  const state = (playerClubId: string) =>
    ({
      playerClubId,
      clubs: { h: { name: 'Home Club', shortName: 'HC' }, a: { name: 'Away Club', shortName: 'AC' } },
      results: {},
      liveMatch: {
        fixtureId: 'f1',
        home: { clubId: 'h' },
        away: { clubId: 'a' },
        score: { home: 1, away: 0 },
        rounds: [{ round: 1, winner: 'home', endReason: 'elimination', durationTicks: 600, survivors: { home: 3, away: 0 } }],
        watch: { mode: 'watch', round: null },
      },
    }) as never;
  const content = { combat: { overtime: { startS: 60 } } } as never;

  it('the player away: home first, the home winner marked first; the player at home reads the same', () => {
    for (const player of ['a', 'h']) {
      const r = roundOutcome(state(player), content, 'f1' as never, 1, null)!;
      expect(r.score).toEqual([1, 0]); // home, away: not "you, them"
      expect(r.winnerFirst).toBe(true); // the home side won the round
    }
    const away = roundOutcome(state('a'), content, 'f1' as never, 1, null)!;
    expect(away.ours).toBe(false); // the winner is the player's opponent
    expect(away.winner).toBe('Home Club');
  });

  it('an away winner is marked second', () => {
    const s = state('a') as unknown as { liveMatch: { score: { home: number; away: number }; rounds: { winner: string }[] } };
    s.liveMatch.score = { home: 0, away: 1 };
    s.liveMatch.rounds[0]!.winner = 'away';
    const r = roundOutcome(s as never, content, 'f1' as never, 1, null)!;
    expect(r.score).toEqual([0, 1]);
    expect(r.winnerFirst).toBe(false);
    expect(r.ours).toBe(true);
  });
});
