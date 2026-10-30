import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_PAUSE } from '../../render';
import { DEFAULT_ARENA_SETTINGS, mergeArenaSettings } from './arena-settings';
import { DEFAULT_SETTINGS } from './settings';

describe('arena viewer settings (per device, outside saves)', () => {
  it('start with the auto-pause defaults the owner approved (Q58): own downs, own captain, overtime on; the others off', () => {
    expect(DEFAULT_ARENA_SETTINGS.autoPause).toEqual(DEFAULT_AUTO_PAUSE);
    expect(DEFAULT_SETTINGS.arena.autoPause).toEqual({ ownDowned: true, enemyDowned: false, ownCaptainDown: true, overtime: true, ownHpBelowPct: null });
    expect(DEFAULT_SETTINGS.arena.watchPreference).toBe('ask');
    expect(DEFAULT_SETTINGS.arena.speed).toBe(1);
    expect(DEFAULT_SETTINGS.arena.pauseWhenHidden).toBe(true);
    expect(DEFAULT_SETTINGS.arena.dockOpen).toBe(true);
  });

  it('merge keeps valid stored values and falls back per field, never throwing', () => {
    expect(mergeArenaSettings(undefined)).toEqual(DEFAULT_ARENA_SETTINGS);
    expect(mergeArenaSettings('junk')).toEqual(DEFAULT_ARENA_SETTINGS);
    const m = mergeArenaSettings({ watchPreference: 'simulate', speed: 4, labels: 'all', pauseWhenHidden: false, dockOpen: false, autoPause: { ownDowned: false, ownHpBelowPct: 30, overtime: 'yes' } });
    expect(m).toMatchObject({ watchPreference: 'simulate', speed: 4, labels: 'all', pauseWhenHidden: false, dockOpen: false });
    expect(m.autoPause).toEqual({ ownDowned: false, enemyDowned: false, ownCaptainDown: true, overtime: true, ownHpBelowPct: 30 });
    const bad = mergeArenaSettings({ watchPreference: 'sometimes', speed: 3, labels: 'big', autoPause: { ownHpBelowPct: 400 } });
    expect(bad).toEqual(DEFAULT_ARENA_SETTINGS);
  });

  it('does not share its defaults with the stored copy (changing one never changes the defaults)', () => {
    const m = mergeArenaSettings({});
    m.autoPause.ownDowned = false;
    expect(DEFAULT_ARENA_SETTINGS.autoPause.ownDowned).toBe(true);
  });
});
