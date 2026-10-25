/**
 * UI settings (04 ui-settings): theme, interface scale, density, reduced
 * motion, status palette, tooltip delay, pacing preset (D-L), nav collapse.
 * One signal; the Settings screen (WP7) calls updateSettings(). Applied to
 * <html> as data attributes the designer's tokens read (data-theme,
 * --ui-scale, data-density, data-motion, data-status-palette).
 * A pacing preset only decides where Continue stops, never a result (P-05).
 */
import { effect, signal } from '@preact/signals';
import { readSettingsRecord, writeSettingsRecord } from '../../platform/settings-storage';
import { tooltipDelayMs } from '../components/Tooltip';

export type ThemeSetting = 'dark' | 'light' | 'system';
export type PacingPreset = 'thorough' | 'balanced' | 'streamlined' | 'custom';

export interface PacingStops {
  /** Stop at the lineup every week. */
  lineup: boolean;
  /** Open the report after every match. */
  reportAlways: boolean;
  /** Open the report after a loss. */
  reportOnLoss: boolean;
  /** Open the report after an injury. */
  reportOnInjury: boolean;
}

export interface UiSettings {
  theme: ThemeSetting;
  /** 0.85 - 1.5 (TUNABLE). */
  scale: number;
  density: 'comfortable' | 'compact';
  /** 'system' follows the OS. */
  reducedMotion: 'system' | 'on' | 'off';
  statusPalette: 'green-red' | 'blue-orange';
  tooltipDelayMs: number;
  pacing: PacingPreset;
  pacingCustom: PacingStops;
  navCollapsed: boolean;
  autosave: boolean;
}

export const DEFAULT_SETTINGS: Readonly<UiSettings> = {
  theme: 'dark',
  scale: 1,
  density: 'comfortable',
  reducedMotion: 'system',
  statusPalette: 'green-red',
  tooltipDelayMs: 280,
  pacing: 'balanced',
  pacingCustom: { lineup: true, reportAlways: false, reportOnLoss: true, reportOnInjury: true },
  navCollapsed: false,
  autosave: true,
};

function merge(record: Record<string, unknown> | null): UiSettings {
  const s: UiSettings = { ...DEFAULT_SETTINGS, pacingCustom: { ...DEFAULT_SETTINGS.pacingCustom } };
  if (!record) return s;
  const pick = <K extends keyof UiSettings>(key: K, ok: (v: unknown) => boolean) => {
    if (ok(record[key])) (s as unknown as Record<string, unknown>)[key] = record[key];
  };
  pick('theme', (v) => v === 'dark' || v === 'light' || v === 'system');
  pick('scale', (v) => typeof v === 'number' && v >= 0.85 && v <= 1.5);
  pick('density', (v) => v === 'comfortable' || v === 'compact');
  pick('reducedMotion', (v) => v === 'system' || v === 'on' || v === 'off');
  pick('statusPalette', (v) => v === 'green-red' || v === 'blue-orange');
  pick('tooltipDelayMs', (v) => typeof v === 'number' && v >= 0 && v <= 2000);
  pick('pacing', (v) => v === 'thorough' || v === 'balanced' || v === 'streamlined' || v === 'custom');
  pick('navCollapsed', (v) => typeof v === 'boolean');
  pick('autosave', (v) => typeof v === 'boolean');
  const pc = record['pacingCustom'];
  if (pc && typeof pc === 'object') {
    for (const k of Object.keys(s.pacingCustom) as (keyof PacingStops)[]) {
      const v = (pc as Record<string, unknown>)[k];
      if (typeof v === 'boolean') s.pacingCustom[k] = v;
    }
  }
  return s;
}

export const settings = signal<UiSettings>(merge(readSettingsRecord()));

export function updateSettings(patch: Partial<UiSettings>): void {
  settings.value = { ...settings.value, ...patch };
  writeSettingsRecord(settings.value as unknown as Record<string, unknown>);
}

/** The effective stops of the current pacing preset (04 ui-settings). */
export function pacingStops(s: UiSettings = settings.value): PacingStops {
  switch (s.pacing) {
    case 'thorough':
      return { lineup: true, reportAlways: true, reportOnLoss: true, reportOnInjury: true };
    case 'balanced':
      return { lineup: true, reportAlways: false, reportOnLoss: true, reportOnInjury: true };
    case 'streamlined':
      return { lineup: false, reportAlways: false, reportOnLoss: false, reportOnInjury: true };
    case 'custom':
      return s.pacingCustom;
  }
}

function prefersDark(): boolean {
  try {
    return !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

/** Resolved theme ('system' follows the OS). */
export function effectiveTheme(s: UiSettings = settings.value): 'dark' | 'light' {
  if (s.theme === 'system') return prefersDark() ? 'dark' : 'light';
  return s.theme;
}

/** Keep <html> in sync with the settings. Returns the disposer. */
export function applySettingsToDocument(root: HTMLElement = document.documentElement): () => void {
  return effect(() => {
    const s = settings.value;
    root.setAttribute('data-theme', effectiveTheme(s));
    root.style.setProperty('--ui-scale', String(s.scale));
    if (s.density === 'compact') root.setAttribute('data-density', 'compact');
    else root.removeAttribute('data-density');
    if (s.reducedMotion === 'on') root.setAttribute('data-motion', 'reduced');
    else root.removeAttribute('data-motion');
    if (s.statusPalette === 'blue-orange') root.setAttribute('data-status-palette', 'blue-orange');
    else root.removeAttribute('data-status-palette');
    tooltipDelayMs.value = s.tooltipDelayMs;
  });
}

/** Reduced motion is on (setting or OS). */
export function reducedMotion(s: UiSettings = settings.value): boolean {
  if (s.reducedMotion === 'on') return true;
  if (s.reducedMotion === 'off') return false;
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}
