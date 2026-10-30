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

  it('draws a token at least 44 px across and a metre of arena when that is larger', async () => {
    const skin = placeholderSkin();
    await skin.load({ renderer: null as never, content: fakeContent(), palette: defaultArenaPalette('dark') });
    const body = skin.createBody(fakeContext().units[0]!, fakeColors(0));
    expect(body.drawsRole).toBe(true);
    expect(body.minDiameterPx).toBe(MIN_TOKEN_DIAMETER_PX);
    body.update(unitState(), { ...FRAME, pxPerMetre: 27 });
    expect((body as TokenBody).shown().diameter).toBe(MIN_TOKEN_DIAMETER_PX);
    const token = body.view.children[0] as Container;
    expect(token.getLocalBounds().width).toBeCloseTo(MIN_TOKEN_DIAMETER_PX, 0);
    body.update(unitState(), FRAME);
    expect((body as TokenBody).shown().diameter).toBe(52);
    expect(token.getLocalBounds().width).toBeCloseTo(52, 0); // 2 x 0.5 m x 52 px/m
    body.update(unitState(), { ...FRAME, pxPerMetre: 104 });
    expect(token.getLocalBounds().width).toBeCloseTo(104, 0);
    body.destroy();
    body.destroy(); // idempotent
    expect(body.view.destroyed).toBe(true);
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
