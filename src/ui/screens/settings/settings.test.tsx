import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetToasts, toasts, undoLast } from '../../components';
import { DEFAULT_SETTINGS, applySettingsToDocument, pacingStops, settings, updateSettings } from '../../store';
import SettingsScreen from './index';

let dispose: (() => void) | null = null;
beforeEach(() => {
  resetToasts();
  updateSettings({ ...DEFAULT_SETTINGS, pacingCustom: { ...DEFAULT_SETTINGS.pacingCustom } });
  dispose = applySettingsToDocument();
});
afterEach(() => {
  cleanup();
  dispose?.();
  updateSettings({ ...DEFAULT_SETTINGS, pacingCustom: { ...DEFAULT_SETTINGS.pacingCustom } });
});

describe('Settings screen', () => {
  it('renders every section with Balanced as the default pacing preset', () => {
    render(<SettingsScreen params={{}} />);
    for (const id of ['settings-gameplay', 'settings-interface', 'settings-a11y', 'settings-audio', 'settings-controls']) expect(screen.getByTestId(id)).toBeTruthy();
    expect((within(screen.getByTestId('preset-balanced')).getByRole('radio') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('stop-lineup') as HTMLInputElement).disabled).toBe(true);
  });

  it('applies a pacing preset at once and undoes it', () => {
    render(<SettingsScreen params={{}} />);
    fireEvent.click(within(screen.getByTestId('preset-streamlined')).getByRole('radio'));
    expect(settings.value.pacing).toBe('streamlined');
    expect(pacingStops().lineup).toBe(false);
    expect(toasts.value.at(-1)?.undo).toBeTruthy();
    undoLast();
    expect(settings.value.pacing).toBe('balanced');
  });

  it('switches to custom stops when a stop is toggled under Custom', () => {
    render(<SettingsScreen params={{}} />);
    fireEvent.click(within(screen.getByTestId('preset-custom')).getByRole('radio'));
    const always = screen.getByTestId('stop-reportAlways') as HTMLInputElement;
    expect(always.disabled).toBe(false);
    fireEvent.click(always);
    expect(settings.value.pacingCustom.reportAlways).toBe(true);
  });

  it('changes the theme, density, motion and status palette on <html>', () => {
    render(<SettingsScreen params={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
    fireEvent.click(screen.getByRole('button', { name: 'Blue / orange' }));
    expect(document.documentElement.getAttribute('data-status-palette')).toBe('blue-orange');
    fireEvent.change(screen.getByLabelText(/Interface scale/), { target: { value: '1.2' } });
    expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('1.2');
  });

  it('turns autosave off and resets everything to defaults', () => {
    render(<SettingsScreen params={{}} />);
    fireEvent.click(screen.getByTestId('autosave'));
    expect(settings.value.autosave).toBe(false);
    fireEvent.click(screen.getByTestId('settings-reset'));
    expect(settings.value).toEqual(DEFAULT_SETTINGS);
  });
});
