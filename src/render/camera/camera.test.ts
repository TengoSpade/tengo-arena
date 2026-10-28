/** Camera transform tests (05-technical-m2 §A5, 04 §4): letterboxing, round trips, zoom clamping, the oblique tilt. */
import { describe, expect, it } from 'vitest';
import { InvariantError } from '../../core/util';
import type { CameraConfig } from '../types';
import { DEFAULT_CAMERA, MAX_TILT_DEG, viewTransform } from './index';

const ARENA = { width: 3200, height: 1800 };
const HD = { width: 1920, height: 1080 };

describe('DEFAULT_CAMERA', () => {
  it('is the approved M2 camera: top-down, whole arena, no follow, HUD padding, 220 ms ease', () => {
    expect(DEFAULT_CAMERA).toEqual({ projection: { kind: 'top-down' }, zoom: 1, follow: null, padding: { top: 56, right: 16, bottom: 72, left: 16 }, easeMs: 220 });
  });
});

describe('viewTransform, top-down at zoom 1', () => {
  it('fits the whole arena inside the padding at about 52 px per metre at 1920 x 1080', () => {
    const v = viewTransform(DEFAULT_CAMERA, HD, ARENA);
    expect(v.pxPerMetre).toBeGreaterThan(52);
    expect(v.pxPerMetre).toBeLessThan(53.5);
    const nw = v.toScreen(0, 0);
    const se = v.toScreen(ARENA.width, ARENA.height);
    expect(nw.y).toBeGreaterThanOrEqual(56 - 1e-9);
    expect(se.y).toBeLessThanOrEqual(1080 - 72 + 1e-9);
    expect(nw.x).toBeGreaterThanOrEqual(16 - 1e-9);
    expect(se.x).toBeLessThanOrEqual(1920 - 16 + 1e-9);
    // Height-limited here: the arena touches the top and bottom of the padded area and is centred left to right.
    expect(nw.y).toBeCloseTo(56, 6);
    expect(se.y).toBeCloseTo(1080 - 72, 6);
    expect(nw.x + se.x).toBeCloseTo(1920, 6);
  });

  it('letterboxes: centred, whichever side has room, and never scrolls', () => {
    for (const [width, height] of [[1280, 720], [1920, 1080], [2560, 1440], [800, 900], [3440, 1440], [1000, 300]] as const) {
      const v = viewTransform(DEFAULT_CAMERA, { width, height }, ARENA);
      const nw = v.toScreen(0, 0);
      const se = v.toScreen(ARENA.width, ARENA.height);
      expect(nw.x).toBeGreaterThanOrEqual(DEFAULT_CAMERA.padding.left - 1e-6);
      expect(nw.y).toBeGreaterThanOrEqual(DEFAULT_CAMERA.padding.top - 1e-6);
      expect(se.x).toBeLessThanOrEqual(width - DEFAULT_CAMERA.padding.right + 1e-6);
      expect(se.y).toBeLessThanOrEqual(height - DEFAULT_CAMERA.padding.bottom + 1e-6);
      const innerCentreX = DEFAULT_CAMERA.padding.left + (width - DEFAULT_CAMERA.padding.left - DEFAULT_CAMERA.padding.right) / 2;
      const innerCentreY = DEFAULT_CAMERA.padding.top + (height - DEFAULT_CAMERA.padding.top - DEFAULT_CAMERA.padding.bottom) / 2;
      expect((nw.x + se.x) / 2).toBeCloseTo(innerCentreX, 6);
      expect((nw.y + se.y) / 2).toBeCloseTo(innerCentreY, 6);
      // Square scale: 16:9 world, uniform pixels.
      expect((se.x - nw.x) / ARENA.width).toBeCloseTo((se.y - nw.y) / ARENA.height, 9);
    }
    const wide = viewTransform(DEFAULT_CAMERA, { width: 3440, height: 1440 }, ARENA).toScreen(0, 0);
    expect(wide.x).toBeGreaterThan(300);
  });

  it('round-trips world to screen to world', () => {
    const v = viewTransform(DEFAULT_CAMERA, HD, ARENA);
    for (let x = 0; x <= ARENA.width; x += 400) {
      for (let y = 0; y <= ARENA.height; y += 300) {
        const s = v.toScreen(x, y);
        const w = v.toWorld(s.x, s.y);
        expect(w.x).toBeCloseTo(x, 6);
        expect(w.y).toBeCloseTo(y, 6);
      }
    }
    const mid = v.toScreen(ARENA.width / 2, ARENA.height / 2);
    expect(mid.x).toBeCloseTo(960, 6);
    expect(mid.y).toBeCloseTo(56 + (1080 - 56 - 72) / 2, 6);
  });

  it('ignores the focus and the height in a top-down view at zoom 1', () => {
    const a = viewTransform(DEFAULT_CAMERA, HD, ARENA);
    const b = viewTransform(DEFAULT_CAMERA, HD, ARENA, { x: 100, y: 100 });
    expect(b.toScreen(500, 500)).toEqual(a.toScreen(500, 500));
    expect(a.toScreen(500, 500, 120)).toEqual(a.toScreen(500, 500));
  });

  it('survives a viewport smaller than its padding and refuses an empty arena', () => {
    const tiny = viewTransform(DEFAULT_CAMERA, { width: 10, height: 10 }, ARENA);
    expect(Number.isFinite(tiny.pxPerMetre)).toBe(true);
    expect(tiny.pxPerMetre).toBeGreaterThan(0);
    expect(Number.isFinite(tiny.toScreen(0, 0).x)).toBe(true);
    expect(() => viewTransform(DEFAULT_CAMERA, HD, { width: 0, height: 100 })).toThrow(InvariantError);
    expect(() => viewTransform(DEFAULT_CAMERA, HD, { width: 100, height: -1 })).toThrow(InvariantError);
  });
});

describe('viewTransform, zoom and follow', () => {
  const zoomed = (zoom: 1.5 | 2): CameraConfig => ({ ...DEFAULT_CAMERA, zoom, follow: 3 });

  it('scales by the zoom and centres on the focus', () => {
    const fit = viewTransform(DEFAULT_CAMERA, HD, ARENA).pxPerMetre;
    const v = viewTransform(zoomed(2), HD, ARENA, { x: 1600, y: 900 });
    expect(v.pxPerMetre).toBeCloseTo(fit * 2, 9);
    const c = v.toScreen(1600, 900);
    expect(c.x).toBeCloseTo(960, 6);
    expect(c.y).toBeCloseTo(56 + (1080 - 56 - 72) / 2, 6);
    const world = v.toWorld(960, 56 + 476);
    expect(world.x).toBeCloseTo(1600, 6);
    expect(world.y).toBeCloseTo(900, 6);
  });

  it('keeps the arena edge from leaving the screen, whatever the focus', () => {
    for (const zoom of [1.5, 2] as const) {
      for (const focus of [{ x: 0, y: 0 }, { x: 3200, y: 1800 }, { x: 100, y: 1700 }, { x: 3100, y: 50 }, { x: 1600, y: 900 }]) {
        const v = viewTransform(zoomed(zoom), HD, ARENA, focus);
        const nw = v.toScreen(0, 0);
        const se = v.toScreen(ARENA.width, ARENA.height);
        // The padded area is always covered by the arena.
        expect(nw.x).toBeLessThanOrEqual(16 + 1e-6);
        expect(nw.y).toBeLessThanOrEqual(56 + 1e-6);
        expect(se.x).toBeGreaterThanOrEqual(1920 - 16 - 1e-6);
        expect(se.y).toBeGreaterThanOrEqual(1080 - 72 - 1e-6);
      }
    }
  });

  it('shows the arena centred when zoomed with no focus, and round-trips', () => {
    const v = viewTransform(zoomed(1.5), HD, ARENA, null);
    expect(v.toWorld(960, 56 + 476).x).toBeCloseTo(1600, 6);
    expect(v.toWorld(960, 56 + 476).y).toBeCloseTo(900, 6);
    const s = v.toScreen(2000, 700);
    expect(v.toWorld(s.x, s.y).x).toBeCloseTo(2000, 6);
    expect(v.toWorld(s.x, s.y).y).toBeCloseTo(700, 6);
  });

  it('stays centred on an axis where the zoomed arena still fits', () => {
    const tall = viewTransform({ ...DEFAULT_CAMERA, zoom: 1.5 }, { width: 600, height: 1400 }, ARENA, { x: 100, y: 100 });
    // Width-limited: at 1.5x the arena is 1.5 × 568 px wide, wider than the padded area; but vertically it is much shorter, so it stays centred.
    const nw = tall.toScreen(0, 0);
    const se = tall.toScreen(ARENA.width, ARENA.height);
    expect((nw.y + se.y) / 2).toBeCloseTo(56 + (1400 - 56 - 72) / 2, 6);
  });
});

describe('viewTransform, oblique', () => {
  const oblique = (tiltDeg: number): CameraConfig => ({ ...DEFAULT_CAMERA, projection: { kind: 'oblique', tiltDeg } });

  it('squashes y by cos(tilt), lifts height by sin(tilt), and still fits the arena', () => {
    const v = viewTransform(oblique(45), HD, ARENA);
    const o = v.toScreen(1000, 1000);
    const right = v.toScreen(2000, 1000);
    const down = v.toScreen(1000, 2000);
    const px = (right.x - o.x) / 1000;
    expect((down.y - o.y) / 1000).toBeCloseTo(px * Math.cos(Math.PI / 4), 9);
    const lifted = v.toScreen(1000, 1000, 100);
    expect(o.y - lifted.y).toBeCloseTo(100 * px * Math.sin(Math.PI / 4), 9);
    expect(lifted.x).toBe(o.x);
    const nw = v.toScreen(0, 0);
    const se = v.toScreen(ARENA.width, ARENA.height);
    expect(nw.y).toBeGreaterThanOrEqual(56 - 1e-6);
    expect(se.y).toBeLessThanOrEqual(1080 - 72 + 1e-6);
    expect(nw.x).toBeGreaterThanOrEqual(16 - 1e-6);
    expect(se.x).toBeLessThanOrEqual(1920 - 16 + 1e-6);
  });

  it('toWorld inverts the ground plane (picking), and tilt 0 equals top-down', () => {
    const v = viewTransform(oblique(30), HD, ARENA);
    for (const [x, y] of [[0, 0], [3200, 1800], [1234, 567], [2900, 100]] as const) {
      const s = v.toScreen(x, y);
      expect(v.toWorld(s.x, s.y).x).toBeCloseTo(x, 6);
      expect(v.toWorld(s.x, s.y).y).toBeCloseTo(y, 6);
    }
    const flat = viewTransform(oblique(0), HD, ARENA);
    const top = viewTransform(DEFAULT_CAMERA, HD, ARENA);
    expect(flat.toScreen(700, 400)).toEqual(top.toScreen(700, 400));
    expect(flat.pxPerMetre).toBe(top.pxPerMetre);
  });

  it('clamps an extreme tilt so the floor never collapses', () => {
    const v = viewTransform(oblique(90), HD, ARENA);
    expect(MAX_TILT_DEG).toBeLessThan(90);
    expect(Number.isFinite(v.pxPerMetre)).toBe(true);
    expect(v.pxPerMetre).toBeGreaterThan(0);
    const clampedLow = viewTransform(oblique(-20), HD, ARENA);
    expect(clampedLow.toScreen(700, 400)).toEqual(viewTransform(DEFAULT_CAMERA, HD, ARENA).toScreen(700, 400));
  });
});
