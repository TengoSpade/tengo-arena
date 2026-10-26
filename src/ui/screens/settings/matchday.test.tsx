import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetToasts } from '../../components';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { DEFAULT_SETTINGS, updateSettings } from '../../store';
import SettingsScreen from './index';

beforeEach(() => {
  // Settings › Tickets asks the dev-server plugin for its folder; there is no server here.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
  resetToasts();
  updateSettings({ ...DEFAULT_SETTINGS, pacingCustom: { ...DEFAULT_SETTINGS.pacingCustom } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  updateSettings({ ...DEFAULT_SETTINGS, pacingCustom: { ...DEFAULT_SETTINGS.pacingCustom } });
});

function mount() {
  const t = createTestStore();
  render(
    <TestProviders store={t.store}>
      <SettingsScreen params={{}} />
    </TestProviders>,
  );
  return t;
}

describe('Settings › Match day', () => {
  it('sets the club level-up default, the pause and the auto-swap rules through commands', () => {
    const { store } = mount();
    const club = () => store.game.value!.clubs[store.game.value!.playerClubId!]!;
    const panel = screen.getByTestId('settings-matchday');
    fireEvent.change(screen.getByTestId('levelup-default'), { target: { value: 'auto_skills' } });
    expect(club().levelUpDefault).toBe('auto_skills');
    fireEvent.click(within(panel).getByRole('button', { name: 'Never' }));
    expect(club().pauseBetweenRounds).toBe('never');
    fireEvent.change(screen.getByTestId('autoswap-freshnessBelow'), { target: { value: '50' } });
    expect(club().autoSwap.freshnessBelow).toBe(50);
    fireEvent.click(screen.getByTestId('autoswap-keep'));
    expect(club().autoSwap.keepOneForInjury).toBe(false);
    expect(store.recentCommands.value.map((c) => c.command.type)).toEqual(['levelup.policy', 'pacing.set', 'autoswap.set', 'autoswap.set']);
  });

  it('applies a pacing preset to match day too (Streamlined: fast level-ups, never pause)', () => {
    const { store } = mount();
    fireEvent.click(within(screen.getByTestId('preset-streamlined')).getByRole('radio'));
    const club = store.game.value!.clubs[store.game.value!.playerClubId!]!;
    expect([club.levelUpPacing, club.pauseBetweenRounds]).toEqual(['fast', 'never']);
  });
});
