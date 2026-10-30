/**
 * The placeholder skin (asset-006, Q59): generated shapes, no assets; flattened and faded when downed; a flat floor
 * with a centre line and walls; nothing with game meaning (that is the viewer's, tech-020).
 */
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { UnitRenderState } from '../../types';
import { defaultArenaPalette } from '../../colors';
import type { BodyFrame } from '../../viewer/skin';
import { fakeColors, fakeContext, fakeLog, createFakeTimeline, fakeContent } from '../../viewer/testing/fake-timeline';
import { MIN_TOKEN_DIAMETER_PX, placeholderSkin, type TokenBody } from './index';

const FRAME: BodyFrame = { tick: 0, dtMs: 0, speed: 1, reducedMotion: false, pxPerMetre: 52 };

function unitState(over: Partial<UnitRenderState> = {}): UnitRenderState {
  const t = createFakeTimeline();
  const index = t.indexFightLog(fakeLog(), fakeContent(), null as never, 'replay');
  return { ...t.sampleAt(index, 100, fakeContext()).units[3]!, ...over };
}

describe('placeholder skin', () => {
  it('loads and prepares without any asset (nothing to fetch)', async () => {
    const skin = placeholderSkin();
    await skin.load({ renderer: null as never, content: fakeContent(), palette: defaultArenaPalette('dark') });
    await expect(skin.prepare(fakeContext().units)).resolves.toBeUndefined();
    expect(skin.id).toBe('placeholder');
  });

  it('draws a token of 1.3 m of arena, never under 48 px (60 px at 46 px/m, the 1920 view)', async () => {
    const skin = placeholderSkin();
    await skin.load({ renderer: null as never, content: fakeContent(), palette: defaultArenaPalette('dark') });
    const body = skin.createBody(fakeContext().units[0]!, fakeColors(0));
    expect(body.drawsRole).toBe(true);
    const token = body.view.children[0] as Container;
    for (const [ppm, d] of [[27, MIN_TOKEN_DIAMETER_PX], [35, MIN_TOKEN_DIAMETER_PX], [46, 60], [52, 68], [104, 135]] as const) {
      expect(body.diameterPx?.(ppm)).toBe(d);
      body.update(unitState(), { ...FRAME, pxPerMetre: ppm });
      expect((body as TokenBody).shown().diameter).toBe(d);
      expect(token.getLocalBounds().width).toBeCloseTo(d, 0);
    }
    body.destroy();
    body.destroy(); // idempotent
    expect(body.view.destroyed).toBe(true);
  });

  it('flattens to 60% height at 40% opacity when downed, at once whether paused, playing or under reduced motion', async () => {
    const skin = placeholderSkin();
    await skin.load({ renderer: null as never, content: fakeContent(), palette: defaultArenaPalette('dark') });
    for (const frame of [FRAME, { ...FRAME, dtMs: 16 }, { ...FRAME, dtMs: 16, reducedMotion: true }]) {
      const body = skin.createBody(fakeContext().units[0]!, fakeColors(0));
      const disc = body.view.children[0] as Container;
      body.update(unitState({ standing: true }), frame);
      expect(body.view.alpha).toBe(1);
      expect(disc.scale.y).toBe(1);
      body.update(unitState({ standing: false }), frame);
      expect(body.view.alpha).toBeCloseTo(0.4, 5);
      expect(disc.scale.y).toBeCloseTo(0.6, 5);
      body.update(unitState({ standing: true }), frame); // stood up again (a seek back)
      expect(disc.scale.y).toBe(1);
    }
  });

  it('ignores facing: a disc has none, and the body is never rotated by the skin either', () => {
    const skin = placeholderSkin();
    const body = skin.createBody(fakeContext().units[0]!, fakeColors(0));
    for (const facing of [0, 1, 2.5, -3]) {
      body.update(unitState({ facing }), FRAME);
      expect(body.view.rotation).toBe(0);
    }
  });

  it('builds a floor of the arena size with walls around it, recoloured by the palette', async () => {
    const skin = placeholderSkin();
    await skin.load({ renderer: null as never, content: fakeContent(), palette: defaultArenaPalette('dark') });
    const arena = { width: 3200, height: 1800 };
    const floor = skin.createFloor(arena, 52);
    const b = floor.getLocalBounds();
    expect(b.width).toBeGreaterThan(1664); // 32 m x 52 px/m plus walls
    expect(b.width).toBeLessThan(1664 + 60);
    expect(b.height).toBeGreaterThan(936);
    expect(b.x).toBeLessThan(0); // walls sit outside the field
    const small = skin.createFloor(arena, 26);
    expect(small.getLocalBounds().width).toBeLessThan(b.width);
    skin.setPalette(defaultArenaPalette('light'));
    expect(skin.createFloor(arena, 52)).toBeInstanceOf(Container);
    skin.destroy();
    expect(floor.destroyed).toBe(true);
  });
});
