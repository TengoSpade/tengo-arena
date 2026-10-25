import { cleanup, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { resetToasts } from '../components';
import { createTestStore } from '../debug/test-store';
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
    expect(screen.getByTestId('topbar-club').textContent).toContain(club.name);
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

  it('routes a career without a club to the club select', async () => {
    const { store } = createTestStore({ world: 'dev', playerClubId: null });
    navigate('#/squad');
    render(<App store={store} />);
    await waitFor(() => expect(screen.getByTestId('screen-club-select')).toBeTruthy());
  });
});
