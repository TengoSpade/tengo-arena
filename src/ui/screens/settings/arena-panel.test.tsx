import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetToasts, toasts, undoLast } from '../../components';
import { DEFAULT_SETTINGS, settings, updateSettings } from '../../store';
import SettingsScreen from './index';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
  resetToasts();
  updateSettings({ ...DEFAULT_SETTINGS });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  updateSettings({ ...DEFAULT_SETTINGS });
});

describe('Settings › Match day › Watching (05-technical-m2 §A7)', () => {
  it('shows the approved defaults: both offered, own downs, own captain and overtime pause, enemy downs do not', () => {
    render(<SettingsScreen params={{}} />);
    const panel = screen.getByTestId('settings-arena');
    expect(within(panel).getByText('Offer both').getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByTestId('autopause-ownDowned') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('autopause-ownCaptainDown') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('autopause-overtime') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('autopause-enemyDowned') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('autopause-ownHpBelowPct') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('arena-pause-hidden') as HTMLInputElement).checked).toBe(true);
  });

  it('applies each change at once, per device, with Undo', () => {
    render(<SettingsScreen params={{}} />);
    fireEvent.click(within(screen.getByTestId('settings-arena')).getByText('Always simulate'));
    expect(settings.value.arena.watchPreference).toBe('simulate');
    fireEvent.click(screen.getByTestId('autopause-enemyDowned'));
    expect(settings.value.arena.autoPause.enemyDowned).toBe(true);
    // The other triggers are untouched by changing one.
    expect(settings.value.arena.autoPause.ownDowned).toBe(true);
    fireEvent.click(screen.getByTestId('autopause-ownHpBelowPct'));
    expect(settings.value.arena.autoPause.ownHpBelowPct).toBe(25);
    fireEvent.click(within(screen.getByTestId('settings-arena')).getByText('4x'));
    expect(settings.value.arena.speed).toBe(4);
    fireEvent.click(screen.getByTestId('arena-pause-hidden'));
    expect(settings.value.arena.pauseWhenHidden).toBe(false);
    expect(toasts.value.at(-1)?.undo).toBeTruthy();
    undoLast();
    expect(settings.value.arena.pauseWhenHidden).toBe(true);
    expect(settings.value.arena.speed).toBe(4);
  });
});
