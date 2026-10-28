/**
 * The watch flow through the whole app shell (05-technical-m2 §A3, §A7, §A11 test-first item 2, ux-001): Play match,
 * the arena, the round-end overlay, the between-round screen, the next round, the end of the match. The core is the
 * scripted fake of WP-M2B (src/ui/debug/arena-test-world.ts); the viewer is the fake behind the factory seam.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import { fixtureContent } from '../../../core/testkit';
import { App } from '../../app/App';
import { navigate } from '../../app/router';
import { resetToasts, toasts } from '../../components';
import { createTestStore } from '../../debug/test-store';
import { DEFAULT_SETTINGS, updateSettings } from '../../store/settings';
import { resetLiveRoundCache } from './index';
import { liveWatchState } from '../../debug/arena-test-world';
import { resetRoundEnd } from './RoundEnd';
import { fakeTimeline } from './testing/fake-timeline';
import { createFakeViewerHarness, type FakeViewerHarness } from './testing/fake-viewer';
import { createScriptedCore, watchWorld, type ScriptedCore, type WatchWorld } from '../../debug/arena-test-world';
import { ViewerFactoryContext } from './viewer-factory';

let content: ContentDB;
beforeEach(() => {
  resetToasts();
  resetRoundEnd();
  resetLiveRoundCache();
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

function mountApp(opts: { winners?: ('home' | 'away')[]; state?: 'prelock' | 'round-waiting'; hash?: string } = {}): Mounted {
  const w = watchWorld(content);
  const core = createScriptedCore(w, { winners: opts.winners });
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
  await waitFor(() => expect(m.harness.all.length).toBe(nth));
  await waitFor(() => expect(screen.getByTestId('screen-arena').getAttribute('data-status')).toBe('ready'));
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
