import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { resetToasts } from '../components';
import { createTestStore } from '../debug/test-store';
import { DEFAULT_SETTINGS, updateArenaSettings, updateSettings } from '../store/settings';
import { App } from './App';
import { navigate } from './router';

afterEach(() => {
  cleanup();
  resetToasts();
});

describe('App', () => {
  it('shows the blocking content-error screen with every issue', () => {
    const { store } = createTestStore({ world: 'none' });
    store.initContent('broken-theme'); // fixture files validated with the full theme profile -> issues
    render(<App store={store} />);
    expect(screen.getByTestId('content-error')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Game content has errors');
  });

  it('opens the title screen when there is no career', async () => {
    const { store } = createTestStore({ world: 'none' });
    navigate('#/home');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('screen-new-game')).toBeTruthy());
  });

  it('renders the hub frame: club, calendar, money, nav and one Continue', async () => {
    const { store } = createTestStore({ world: 'dev', weekIndex: 11 });
    navigate('#/home');
    render(<App store={store} />);
    const club = store.game.value!.clubs[store.game.value!.playerClubId!]!;
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy(), { timeout: 5000 }); // the lazy Home chunk can be slow under a loaded machine
    // Long names show the short name whole; the full name stays in the label.
    expect(screen.getByTestId('topbar-club').textContent).toContain(club.name.length > 17 ? club.shortName : club.name);
    expect(screen.getByTestId('topbar-club').getAttribute('aria-label')).toBe(club.name);
    expect(screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('.sidenav__item').length).toBeGreaterThanOrEqual(9);
    const cont = screen.getAllByTestId('continue');
    expect(cont).toHaveLength(1);
    expect(cont[0]!.textContent).toContain('Continue');
    expect(cont[0]!.textContent).toContain('Lineup');
    expect(document.querySelectorAll('.btn--primary, .continue').length).toBeGreaterThanOrEqual(1);
  });

  it('says no matches yet instead of a draw-order position before matchweek 1', async () => {
    const { store } = createTestStore({ world: 'dev', weekIndex: 1 });
    navigate('#/home');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy());
    const stats = document.querySelector('.topbar')!.textContent!;
    expect(stats).toContain('StandingNo matches yet');
    expect(stats).not.toMatch(/Standing\d/);
  });

  it('commits and autosaves the result before the match report opens (no reroll by reloading)', async () => {
    const { store, saves } = createTestStore({ world: 'dev', weekIndex: 11 });
    updateSettings({ pacing: 'thorough' }); // open every report
    updateArenaSettings({ watchPreference: 'simulate' }); // this is the Simulate flow's ordering rule (M2: Watch has its own, arena tests)
    const week = store.game.value!.calendar.weekIndex;
    // Hold the autosave write until the test releases it.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const write = saves.write.bind(saves);
    saves.write = async (...args: Parameters<typeof saves.write>) => {
      await gate;
      return write(...args);
    };
    navigate('#/squad');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    screen.getByTestId('continue').click();
    await waitFor(() => expect(store.game.value!.calendar.weekIndex).toBe(week + 1));
    await new Promise((r) => setTimeout(r, 800)); // past the Simulating panel's minimum time
    // Result committed, autosave still pending: the report has not opened and the panel still shows.
    expect(location.hash).not.toMatch(/^#\/match\//);
    expect(screen.getByTestId('simulating')).toBeTruthy();
    release();
    await waitFor(() => expect(location.hash).toMatch(/^#\/match\//));
    const autos = (await saves.list()).filter((m) => m.kind === 'auto');
    expect(autos.some((m) => m.weekIndex === week + 1)).toBe(true);
    updateSettings({ pacing: DEFAULT_SETTINGS.pacing });
    updateArenaSettings({ watchPreference: DEFAULT_SETTINGS.arena.watchPreference });
  }, 20_000);

  it("M1.1: the player's match pauses between rounds; Continue on that screen plays on to the report", async () => {
    const { store } = createTestStore({ world: 'dev', weekIndex: 11, pauseBetweenRounds: 'always' });
    updateSettings({ pacing: 'thorough' }); // open every report
    updateArenaSettings({ watchPreference: 'simulate' }); // the M1.1 flow (the Watch flow has its own tests)
    const week = store.game.value!.calendar.weekIndex;
    navigate('#/squad');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('continue').textContent).toContain('Play match'));
    screen.getByTestId('continue').click();
    await waitFor(() => expect(location.hash).toBe('#/between-rounds'), { timeout: 10_000 });
    expect(store.game.value!.liveMatch).not.toBeNull();
    expect(store.game.value!.calendar.weekIndex).toBe(week);
    await waitFor(() => expect(screen.getByTestId('screen-between-rounds')).toBeTruthy());
    // A routine round is one click; best of 3 pauses at most twice.
    for (let i = 0; i < 3 && location.hash === '#/between-rounds'; i++) {
      await waitFor(() => expect(screen.getByTestId('br-continue')).toBeTruthy());
      const before = store.game.value!.liveMatch?.rounds.length ?? 0;
      const btn = screen.getByTestId('br-continue');
      btn.click();
      await new Promise((r) => setTimeout(r, 50));
      if (document.querySelector('[data-testid="br-continue-dialog"][open]')) screen.getByTestId('br-continue-confirm').click();
      await new Promise((r) => setTimeout(r, 50));
      const err = document.querySelector('.br-error');
      if (err) throw new Error(`between-round error: ${err.textContent}`);
      await waitFor(() => expect(store.game.value!.liveMatch === null || (store.game.value!.liveMatch?.rounds.length ?? 0) > before).toBe(true), { timeout: 10_000 });
    }
    await waitFor(() => expect(location.hash).toMatch(/^#\/match\//), { timeout: 10_000 });
    expect(store.game.value!.calendar.weekIndex).toBe(week + 1);
    updateSettings({ pacing: DEFAULT_SETTINGS.pacing });
    updateArenaSettings({ watchPreference: DEFAULT_SETTINGS.arena.watchPreference });
  }, 30_000);

  it('opens Save / Load with S, as the side navigation shows', async () => {
    const { store } = createTestStore({ world: 'dev', weekIndex: 11 });
    navigate('#/home');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy());
    fireEvent.keyDown(document.body, { key: 's' });
    await waitFor(() => expect(location.hash).toBe('#/saves'));
  });

  it('skips quiet preseason weeks to the kick-off confirm', async () => {
    const { store } = createTestStore({ world: 'dev', weekIndex: 2 });
    // The dev world seeds an injury and other needs-action news: a quiet week has none.
    const quiet = structuredClone(store.game.value!);
    quiet.news = [];
    for (const f of Object.values(quiet.fighters)) f.injury = null;
    store.replaceWorld(quiet);
    navigate('#/home');
    render(<App store={store} />);
    const skip = await screen.findByTestId('skip-to-mw1');
    skip.click();
    await waitFor(() => expect(document.querySelector('[data-testid="continue-confirm"][open]')).toBeTruthy(), { timeout: 10_000 });
    const week = store.content.value!.weekByIndex(store.game.value!.calendar.weekIndex);
    expect(week.commit).toBe('kick_off');
  }, 20_000);

  it('routes a career without a club to the club select', async () => {
    const { store } = createTestStore({ world: 'dev', playerClubId: null });
    navigate('#/squad');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('screen-club-select')).toBeTruthy());
  });
});
