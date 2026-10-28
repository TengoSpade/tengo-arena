import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import type { GameState } from '../../../core/model';
import { fixtureContent } from '../../../core/testkit';
import { resetToasts, toasts } from '../../components';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { DEFAULT_SETTINGS, settings, updateSettings } from '../../store/settings';
import ArenaScreen, { resetLiveRoundCache } from './index';
import { resetRoundEnd } from './RoundEnd';
import { fakeTimeline } from './testing/fake-timeline';
import { createFakeViewerHarness, type FakeViewer, type FakeViewerHarness } from './testing/fake-viewer';
import { createScriptedCore, liveWatchState, watchWorld, type ScriptedCore, type WatchWorld } from '../../debug/arena-test-world';
import { ViewerFactoryContext } from './viewer-factory';

let dispose: (() => void) | null = null;
let content: ContentDB;
beforeEach(() => {
  resetToasts();
  resetRoundEnd();
  resetLiveRoundCache();
  updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, autoPause: { ...DEFAULT_SETTINGS.arena.autoPause } } });
  location.hash = '#/arena';
  content = fixtureContent();
});
afterEach(() => {
  cleanup();
  dispose?.();
  dispose = null;
});

interface Setup {
  w: WatchWorld;
  core: ScriptedCore;
  harness: FakeViewerHarness;
  store: ReturnType<typeof createTestStore>['store'];
  saves: ReturnType<typeof createTestStore>['saves'];
  viewer(): FakeViewer;
  state(): GameState;
}

async function mount(opts: { round?: number; cursorTick?: number; winners?: ('home' | 'away')[]; wins?: ('home' | 'away')[]; failLoad?: boolean; noWatch?: boolean } = {}): Promise<Setup> {
  const w = watchWorld(content);
  const core = createScriptedCore(w, { winners: opts.winners });
  const t = createTestStore({ world: 'none', engine: core.engine });
  const state = opts.noWatch ? w.state : liveWatchState(w, { round: opts.round, cursorTick: opts.cursorTick, wins: opts.wins });
  t.store.replaceWorld(state, content);
  const harness = createFakeViewerHarness(fakeTimeline, content, { failLoad: opts.failLoad });
  render(
    <TestProviders store={t.store}>
      <ViewerFactoryContext.Provider value={harness.factory}>
        <ArenaScreen params={{}} />
      </ViewerFactoryContext.Provider>
    </TestProviders>,
  );
  const s: Setup = { w, core, harness, store: t.store, saves: t.saves, viewer: () => harness.current(), state: () => t.store.game.value! };
  if (!opts.noWatch && !opts.failLoad) await ready();
  return s;
}

async function ready() {
  await waitFor(() => expect(screen.getByTestId('screen-arena').getAttribute('data-status')).toBe('ready'));
}

const key = (k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(screen.getByTestId('arena-host'), { key: k, ...init });
const text = (id: string) => screen.getByTestId(id).textContent ?? '';

async function advance(s: Setup, tick: number) {
  await act(async () => {
    s.viewer().advanceTo(tick);
  });
}

describe('arena screen: a live round', () => {
  it('shows the HUD, both sides of the strip and starts a fresh round playing at the remembered speed', async () => {
    const s = await mount();
    // The player's side is on the left, with "You" and the standing; rounds won are pips toward the 2 a best of 3 takes.
    expect(text('hud-left')).toContain(s.w.state.clubs[s.w.home]!.name);
    expect(text('hud-left')).toContain('You');
    expect(text('hud-right')).toContain(s.w.state.clubs[s.w.away]!.name);
    expect(text('hud-left-standing')).toBe('5 of 5 standing');
    expect(text('hud-right-standing')).toBe('5 of 5 standing');
    expect(screen.getByTestId('hud-left-pips').getAttribute('aria-label')).toBe('Rounds won: 0 of 2');
    expect(screen.getByTestId('hud-left-pips').querySelectorAll('.spip')).toHaveLength(2);
    expect(text('arena-clock')).toBe('0:00');
    expect(screen.getByTestId('arena-hud').textContent).toContain('Round 1 of 3');
    expect(screen.getByTestId('status-live').textContent).toContain('Live');
    // Ten fighter cards, ours on the left; the colour-free side cue is the card border (data-side drives it).
    expect(screen.getByTestId('arena-strip').querySelectorAll('button.afighter')).toHaveLength(10);
    expect(screen.getByTestId('strip-unit-0').getAttribute('data-side')).toBe('us');
    expect(screen.getByTestId('strip-unit-5').getAttribute('data-side')).toBe('them');
    expect(screen.getByTestId('arena-dock')).toBeTruthy(); // the dock is open at every width
    // A fresh round plays at once (so Play match plus one Enter per boundary holds); the calls slot stays hidden.
    expect(s.viewer().calls).toContain('play');
    expect(s.viewer().calls).toContain('speed:1');
    expect(screen.getByTestId('arena-calls').hasAttribute('hidden')).toBe(true);
    // The viewer gets the palette read from the tokens (metrics included) and is not a second tab stop: the host is the one.
    const o = s.viewer().options as { tabStop?: boolean; palette: { metrics: { ringWidthPx: number }; plate: number }; reducedMotion: boolean };
    expect(o.tabStop).toBe(false);
    expect(o.palette.metrics.ringWidthPx).toBeGreaterThan(0);
    expect(typeof o.reducedMotion).toBe('boolean');
    // The viewer got the round's log and nothing else of the round was asked of core.
    expect(s.viewer().loadedLog?.header.round).toBe(1);
  });

  it('resumes paused at the persisted cursor with a toast, and the scrubber stops at the live head', async () => {
    const s = await mount({ cursorTick: 200 });
    expect(s.viewer().calls).not.toContain('play');
    expect(s.viewer().playing).toBe(false);
    expect(text('arena-clock')).toBe('0:10');
    // The live track is a fixed 0 to 75 s: its length says nothing about the round. The playhead is at the head.
    const scrub = screen.getByTestId('arena-scrubber');
    expect(scrub.getAttribute('aria-valuemax')).toBe('75');
    expect(scrub.getAttribute('aria-valuenow')).toBe('10');
    expect(scrub.getAttribute('aria-valuetext')).toBe('0:10, at the live head');
    expect(toasts.value.map((x) => x.title)).toContain('Resumed where the round last stopped');
  });

  it('Space pauses and persists the cursor (match.watch plus the round autosave); a pause at tick 0 saves nothing', async () => {
    const s = await mount();
    key(' ');
    await waitFor(() => expect(screen.getByTestId('arena-play').textContent).toContain('Play'));
    expect(s.core.watchCommands).toEqual([]);
    key(' ');
    await advance(s, 200);
    key(' ');
    await waitFor(() => expect(s.core.watchCommands).toEqual([{ tick: 200, mode: undefined }]));
    await waitFor(async () => expect((await s.saves.list()).some((m) => m.slotId === 'auto-round')).toBe(true));
    expect(s.state().liveMatch!.watch!.cursorTick).toBe(200);
    expect(JSON.parse((await s.saves.read('auto-round'))!).state.liveMatch.watch.cursorTick).toBe(200);
  });

  it('Ctrl S saves only while paused (the cursor is already saved with the pause); F8 and the rest of the shell are not here', async () => {
    const s = await mount();
    fireEvent.keyDown(screen.getByTestId('arena-host'), { key: 's', ctrlKey: true });
    expect(location.hash).toBe('#/arena'); // the round runs: nothing saved or opened
    await advance(s, 100);
    key(' ');
    await waitFor(() => expect(s.viewer().playing).toBe(false));
    fireEvent.keyDown(screen.getByTestId('arena-host'), { key: 's', ctrlKey: true });
    // No manual slot yet for this career: the first free one is used and the toast says which (the pause saved the cursor first).
    await waitFor(async () => expect((await s.saves.list()).some((m) => m.slotId === 'manual-1')).toBe(true));
    expect(toasts.value.map((x) => x.title)).toContain('Saved to slot 1');
    expect(location.hash).toBe('#/arena');
    expect(s.core.watchCommands.at(-1)?.tick).toBe(100);
    // The next Ctrl S goes to the same slot.
    fireEvent.keyDown(screen.getByTestId('arena-host'), { key: 's', ctrlKey: true });
    await waitFor(() => expect(toasts.value.filter((x) => x.title === 'Saved to slot 1').length).toBe(2));
  });

  it('D hides and shows the dock, remembered per device; nothing else changes the layout (A18)', async () => {
    const s = await mount();
    expect(screen.getByTestId('arena-dock')).toBeTruthy();
    key('d');
    await waitFor(() => expect(screen.queryByTestId('arena-dock')).toBeNull());
    expect(settings.value.arena.dockOpen).toBe(false);
    expect(screen.getByTestId('screen-arena').querySelector('.arena-body')!.getAttribute('data-dock')).toBe('closed');
    // Pausing, an auto-pause stop and a selection never open or close it on their own.
    await advance(s, 600);
    expect(screen.queryByTestId('arena-dock')).toBeNull();
    key('d');
    await waitFor(() => expect(screen.getByTestId('arena-dock')).toBeTruthy());
    expect(settings.value.arena.dockOpen).toBe(true);
  });

  it('Esc with nothing to close asks once to leave (the match stays live), and Stay resumes', async () => {
    const s = await mount();
    await advance(s, 100);
    key('Escape');
    await waitFor(() => expect(screen.getByTestId('dialog-leave').hasAttribute('open')).toBe(true));
    expect(s.viewer().playing).toBe(false);
    await waitFor(() => expect(s.core.watchCommands.at(-1)?.tick).toBe(100)); // leaving is a stop: the cursor is saved
    fireEvent.click(screen.getByTestId('leave-stay'));
    await waitFor(() => expect(s.viewer().playing).toBe(true));
    expect(location.hash).toBe('#/arena');
    key('Escape');
    await waitFor(() => expect(screen.getByTestId('dialog-leave').hasAttribute('open')).toBe(true));
    fireEvent.click(screen.getByTestId('confirm-leave'));
    expect(location.hash).toBe('#/home');
    expect(s.state().liveMatch!.watch!.round).toBe(1); // still live: Continue reads Resume watching
  });

  it('Shift Space is Simulate the rest and asks once', async () => {
    const s = await mount();
    key(' ', { shiftKey: true });
    await waitFor(() => expect(screen.getByTestId('dialog-simulate').hasAttribute('open')).toBe(true));
    expect(s.viewer().playing).toBe(false);
  });

  it('saves the reveal frontier (the furthest tick shown), not the playhead after a rewind (tech-019)', async () => {
    const s = await mount();
    updateSettings({ arena: { ...settings.value.arena, autoPause: { ...settings.value.arena.autoPause, ownDowned: false } } });
    await advance(s, 300);
    await act(async () => {
      s.viewer().seek(100); // a live rewind while the round runs
    });
    key(' '); // pause with the playhead at 100 and the head at 300
    await waitFor(() => expect(s.core.watchCommands.at(-1)?.tick).toBe(300));
    expect(s.core.watchCommands.every((c) => c.tick === 300)).toBe(true);
    expect(s.state().liveMatch!.watch!.cursorTick).toBe(300);
    // A second stop at the same frontier saves nothing new.
    key(' ');
    key(' ');
    await new Promise((r) => setTimeout(r, 30));
    expect(s.core.watchCommands).toHaveLength(1);
  });

  it('auto-pauses when one of ours goes down, says why, lists the moment with its cause and saves the stop', async () => {
    const s = await mount();
    await advance(s, 600);
    // The down at tick 400 stops the viewer there (after drawing it), not at 600.
    expect(s.viewer().tick).toBe(400);
    expect(s.viewer().playing).toBe(false);
    await waitFor(() => expect(screen.getByTestId('arena-announce').textContent).toContain('one of yours went down'));
    const items = within(screen.getByTestId('feed-list')).getAllByTestId('feed-item');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toMatch(/downed by/);
    expect(items[0]!.getAttribute('data-ours')).toBe('true');
    expect(text('hud-left-standing')).toBe('4 of 5 standing');
    expect(screen.getByTestId('strip-unit-3').getAttribute('data-down')).toBe('true');
    // The card says who downed him (from the key moments shown so far) and the transport names the cause.
    expect(text('strip-down-3')).toMatch(/^Downed · /);
    expect(text('status-auto')).toContain('Paused automatically');
    expect(text('status-note')).toMatch(/was downed/);
    await waitFor(() => expect(s.core.watchCommands.at(-1)?.tick).toBe(400));
  });

  it('speed keys, bracket cycling, frame steps while paused, End and the names toggle', async () => {
    const s = await mount();
    key('2');
    expect(s.viewer().speed).toBe(2);
    expect(settings.value.arena.speed).toBe(2);
    key(']');
    expect(s.viewer().speed).toBe(4);
    key('[');
    expect(s.viewer().speed).toBe(2);
    key('4');
    expect(s.viewer().speed).toBe(4);
    // While playing, the arrows are not taken (they keep their normal meaning).
    const before = s.viewer().calls.length;
    key('ArrowRight');
    expect(s.viewer().calls.length).toBe(before);
    await advance(s, 300);
    key(' '); // pause at 300
    await waitFor(() => expect(s.viewer().playing).toBe(false));
    key('ArrowLeft');
    expect(s.viewer().tick).toBe(298);
    key('ArrowLeft', { shiftKey: true });
    expect(s.viewer().tick).toBe(278);
    key('ArrowRight', { shiftKey: true });
    key('ArrowRight');
    expect(s.viewer().tick).toBe(300);
    key('ArrowRight', { shiftKey: true }); // never past the live head
    expect(s.viewer().tick).toBe(300);
    key('ArrowLeft', { shiftKey: true });
    await waitFor(() => expect((screen.getByTestId('arena-live') as HTMLButtonElement).disabled).toBe(false));
    key('End');
    expect(s.viewer().tick).toBe(300);
    key('l');
    expect(settings.value.arena.labels).toBe('all');
    expect(s.viewer().calls).toContain('labels:all');
    key('Home');
    expect(s.viewer().calls).toContain('camera');
  });

  it('reads the auto-pause rules, names and pause-when-hidden from the settings', async () => {
    updateSettings({ arena: { ...settings.value.arena, autoPause: { ...settings.value.arena.autoPause, ownDowned: false }, labels: 'all' } });
    const s = await mount();
    expect(s.viewer().autoPause.ownDowned).toBe(false);
    expect(s.viewer().calls).toContain('labels:all');
    // With the trigger off the viewer runs on past the down.
    await advance(s, 600);
    expect(s.viewer().tick).toBe(600);
  });

  it('pauses and saves the cursor when the window is hidden (setting, on by default)', async () => {
    const s = await mount();
    await advance(s, 100);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(s.viewer().playing).toBe(false);
      await waitFor(() => expect(s.core.watchCommands.at(-1)?.tick).toBe(100));
      expect(screen.getByTestId('arena-announce').textContent).toContain('window was hidden');
    } finally {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    }
  });

  it('leaving the arena while the round runs persists the stop', async () => {
    const s = await mount();
    await advance(s, 120);
    cleanup();
    await waitFor(() => expect(s.core.watchCommands.at(-1)?.tick).toBe(120));
    expect(s.viewer().destroyed).toBe(true);
  });

  it('shows a way out when the viewer does not load, and Try again creates a new one', async () => {
    const s = await mount({ failLoad: true });
    await waitFor(() => expect(screen.getByTestId('arena-failed')).toBeTruthy());
    expect(text('arena-failed')).toContain('The arena could not be opened');
    expect(s.state().liveMatch!.watch!.round).toBe(1); // nothing was lost: the round is still locked
    expect(screen.getByTestId('arena-retry')).toBeTruthy();
  });

  it('says so when no round is waiting, and offers the between-round screen when the match waits there', async () => {
    await mount({ noWatch: true });
    expect(screen.getByTestId('screen-arena').textContent).toContain('No round is waiting to be watched');
    cleanup();
    const w = watchWorld(content);
    const core = createScriptedCore(w);
    const t = createTestStore({ world: 'none', engine: core.engine });
    const st = liveWatchState(w, { round: 2 });
    st.liveMatch!.phase = 'between_rounds';
    st.liveMatch!.watch = { mode: 'watch', round: null, cursorTick: 0, calls: [] };
    t.store.replaceWorld(st, content);
    render(
      <TestProviders store={t.store}>
        <ArenaScreen params={{}} />
      </TestProviders>,
    );
    expect(screen.getByText('Back to the match').getAttribute('href')).toBe('#/between-rounds');
  });
});

describe('arena screen: the inspector (P-22)', () => {
  it('opens for the selected fighter while paused, with the committed rule as a sentence and what he would decide now', async () => {
    const s = await mount({ cursorTick: 200 });
    // Paused at the resume point: pick a fighter from the strip.
    fireEvent.click(screen.getByTestId('strip-unit-0'));
    await waitFor(() => expect(screen.getByTestId('arena-inspector')).toBeTruthy());
    expect(text('inspector-name')).toBe(s.w.state.fighters[s.w.prepared.home.active[0]!]!.name.full);
    // The recorded decision at tick 200 is rule 2 (R2) of his preset, with the skipped rule above it.
    await waitFor(() => expect(screen.getByTestId('inspector-rule').textContent).toMatch(/^R2/));
    // Every rule in order: the first skipped with its reason and the observed value, the second fired, the rest not reached.
    const lines = screen.getAllByTestId('trace-line');
    expect(lines.map((l) => l.getAttribute('data-fired')).slice(0, 2)).toEqual(['false', 'true']);
    expect(lines[0]!.textContent).toContain('Condition 1 was false.');
    expect(lines[0]!.textContent).toContain('Observed 8200.');
    expect(lines[1]!.textContent).toContain('Fired.');
    expect(lines.slice(2).every((l) => l.getAttribute('data-reached') === 'false')).toBe(true);
    expect(lines.at(-1)!.textContent).toContain('Not reached: a rule fired.');
    // The probe: a live round waits for the saved cursor (200 was persisted at the lock), then asks core for tick 200.
    await waitFor(() => expect(screen.getByTestId('inspector-now-rule')).toBeTruthy());
    expect(s.core.inspects.at(-1)).toEqual([1, 200]);
    expect(screen.getAllByTestId('inspector-cooldown')[0]!.textContent).toMatch(/ready in 2s/);
    expect(screen.getByTestId('inspector-status').textContent).toMatch(/Stunned 1 s/);
  });

  it('asks to pause first while the round runs, and Esc closes it before going back', async () => {
    const s = await mount();
    key('i');
    key('Enter');
    await waitFor(() => expect(screen.getByTestId('arena-inspector')).toBeTruthy());
    expect(screen.getByTestId('inspector-pause-first')).toBeTruthy();
    expect(s.core.inspects).toEqual([]);
    key('Escape');
    await waitFor(() => expect(screen.queryByTestId('arena-inspector')).toBeNull());
  });

  it('names why he cannot decide when the probe says he is down', async () => {
    const s = await mount({ cursorTick: 500 });
    fireEvent.click(screen.getByTestId('strip-unit-3'));
    await waitFor(() => expect(screen.getByTestId('inspector-blocked').textContent).toContain('he is down'));
    expect(s.core.inspects.at(-1)).toEqual([1, 500]);
  });

  it('a live probe waits for the saved cursor: it is not asked for a tick past it', async () => {
    const s = await mount({ cursorTick: 200 });
    await act(async () => {
      s.viewer().play();
    });
    await advance(s, 260);
    // Pause: the cursor save is in flight; selecting now must not probe 260 before it persisted.
    fireEvent.click(screen.getByTestId('arena-play'));
    fireEvent.click(screen.getByTestId('strip-unit-0'));
    await waitFor(() => expect(s.core.inspects.some(([, tick]) => tick === 260)).toBe(true));
    await waitFor(() => expect(s.core.watchCommands.some((c) => c.tick === 260)).toBe(true));
    // Every probe came after a cursor at least as far.
    for (const [, tick] of s.core.inspects) expect(tick).toBeLessThanOrEqual(260);
  });
});
