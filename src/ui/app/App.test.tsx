import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { resetToasts } from '../components';
import { createTestStore } from '../debug/test-store';
import { DEFAULT_SETTINGS, updateSettings } from '../store/settings';
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
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy());
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
  }, 20_000);

  it('opens Save / Load with S, as the side navigation shows', async () => {
    const { store } = createTestStore({ world: 'dev', weekIndex: 11 });
    navigate('#/home');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy());
    fireEvent.keyDown(document.body, { key: 's' });
    await waitFor(() => expect(location.hash).toBe('#/saves'));
  });

  it('routes a career without a club to the club select', async () => {
    const { store } = createTestStore({ world: 'dev', playerClubId: null });
    navigate('#/squad');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('screen-club-select')).toBeTruthy());
  });
});
