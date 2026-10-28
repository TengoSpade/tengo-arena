/**
 * M2 contracts (05-technical-m2 §A8): the pure half of src/render loads and runs in Node with no DOM (this file runs
 * in the vitest "core" project), and its fixed defaults are the approved ones (Q55 camera, Q58 auto-pause).
 */
import { describe, expect, it } from 'vitest';
import { InvariantError } from '../core/util';
import { DEFAULT_AUTO_PAUSE, DEFAULT_CAMERA, TELEGRAPH_MIN_TICKS, colorsForMatch, contrastRatio, defaultArenaPalette, keyMoments, parseHexColor, timeline, viewTransform } from './index';

describe('src/render pure half', () => {
  it('runs without a DOM', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
  });

  it('keeps the approved defaults: top-down, whole arena, no follow; auto-pause on our downs, captain down, overtime', () => {
    expect(DEFAULT_CAMERA).toMatchObject({ projection: { kind: 'top-down' }, zoom: 1, follow: null, easeMs: 220, padding: { top: 16, right: 16, bottom: 16, left: 16 } });
    expect(DEFAULT_AUTO_PAUSE).toEqual({ ownDowned: true, enemyDowned: false, ownCaptainDown: true, overtime: true, ownHpBelowPct: null });
    expect(TELEGRAPH_MIN_TICKS).toBe(6);
  });

  it('exposes the model as one injectable object of the real functions, which work on a small log', () => {
    const functions = ['indexFightLog', 'sampleAt', 'eventsBetween', 'decisionAt', 'autoPauseStops', 'keyMoments', 'samePrefix'] as const;
    expect(Object.keys(timeline).sort()).toEqual([...functions].sort());
    expect(timeline.keyMoments).toBe(keyMoments);
    for (const name of functions) expect(typeof timeline[name]).toBe('function');
    // The bodies are the real ones: a log without units or frames is refused with an InvariantError, not a stub error.
    const empty = { header: { units: [] }, events: [], hash: '' };
    expect(() => timeline.indexFightLog(empty as never, null as never, null as never, 'replay')).toThrow(InvariantError);
    const noFrames = { header: { units: [{ index: 0, side: 0 }] }, events: [{ seq: 0, tick: 0, type: 'fight.start', data: { units: [] } }], hash: '' };
    expect(() => timeline.indexFightLog(noFrames as never, null as never, null as never, 'replay')).toThrow(/no frame events/);
  });

  it('reaches the team colours, the contrast helpers and the camera transform through the pure index', () => {
    const palette = defaultArenaPalette('dark');
    const [home, away] = colorsForMatch({ primary: 0x1a2d5a, secondary: 0xf2b83b }, { primary: 0x7a1f2b, secondary: 0xe8e1d0 }, 0, palette);
    expect([home.ringStyle, away.ringStyle]).toEqual(['solid', 'double']);
    expect(home.primary).toBe(0x1a2d5a);
    expect(contrastRatio(0xffffff, 0x000000)).toBeCloseTo(21, 6);
    expect(parseHexColor('#1A2D5A')).toBe(0x1a2d5a);
    const view = viewTransform(DEFAULT_CAMERA, { width: 1280, height: 720 }, { width: 3200, height: 1800 });
    const centre = view.toScreen(1600, 900);
    expect(view.toWorld(centre.x, centre.y)).toEqual({ x: 1600, y: 900 });
  });
});
