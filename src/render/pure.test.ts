/**
 * M2 contracts (05-technical-m2 §A8): the pure half of src/render loads and runs in Node with no DOM (this file runs
 * in the vitest "core" project), and its fixed defaults are the approved ones (Q55 camera, Q58 auto-pause).
 */
import { describe, expect, it } from 'vitest';
import { NotImplementedError } from '../core/util';
import { DEFAULT_AUTO_PAUSE, DEFAULT_CAMERA, TELEGRAPH_MIN_TICKS, keyMoments, timeline } from './index';

describe('src/render pure half', () => {
  it('runs without a DOM', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
  });

  it('keeps the approved defaults: top-down, whole arena, no follow; auto-pause on our downs, captain down, overtime', () => {
    expect(DEFAULT_CAMERA).toMatchObject({ projection: { kind: 'top-down' }, zoom: 1, follow: null, easeMs: 220 });
    expect(DEFAULT_AUTO_PAUSE).toEqual({ ownDowned: true, enemyDowned: false, ownCaptainDown: true, overtime: true, ownHpBelowPct: null });
    expect(TELEGRAPH_MIN_TICKS).toBe(6);
  });

  it('exposes the model as one injectable object whose bodies are implemented (WP-M2C landed)', () => {
    expect(timeline.keyMoments).toBe(keyMoments);
    let thrown: unknown = null;
    try {
      keyMoments(null as never, null as never, 0);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).not.toBeInstanceOf(NotImplementedError);
  });
});
