import { describe, expect, it } from 'vitest';
import { findField, projectField } from './field';
import { makeImage, paintRing } from './png';

const ARENA = { width: 3200, height: 1800 };
const FLOOR: [number, number, number] = [62, 58, 50];
const WALL: [number, number, number] = [113, 104, 87];
const PAGE: [number, number, number] = [20, 22, 26];

/** A stage of 1563 x 900 at (0, 57) in a 1920 x 1080 screenshot: page, a wall band, the 32 x 18 m field with clutter on it. */
function stage(): { img: ReturnType<typeof makeImage>; field: { x: number; y: number; w: number; h: number } } {
  const img = makeImage(1920, 1080, PAGE);
  const paint = (x0: number, y0: number, w: number, h: number, c: [number, number, number]): void => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) img.data.set([c[0], c[1], c[2], 255], (y * img.width + x) * 4);
  };
  paint(0, 57, 1563, 900, PAGE);
  // wall band, then the field (47.9 px per metre: 1532 x 862)
  paint(0, 60, 1563, 880, WALL);
  const field = { x: 16, y: 77, w: 1532, h: 862 };
  paint(field.x, field.y, field.w, field.h, FLOOR);
  // clutter: dashed row markers, a zone disc, ten tokens, HUD text pixels in the floor's colour outside the wall
  for (let x = 250; x < 260; x++) for (let y = field.y; y < field.y + field.h; y += 8) img.data.set([90, 85, 75, 255], (y * img.width + x) * 4);
  paintRing(img, 300, 640, 240, 0, [140, 120, 90]);
  for (let i = 0; i < 10; i++) paintRing(img, 600 + i * 70, 400 + (i % 3) * 120, 29, 0, [200, 160, 70]);
  for (let i = 0; i < 40; i++) img.data.set([FLOOR[0], FLOOR[1], FLOOR[2], 255], ((10 + (i % 3)) * img.width + 1600 + i) * 4);
  return { img, field };
}

describe('finding the field in a screenshot', () => {
  it('recovers the origin and the scale of the field, with clutter on it and stray floor-coloured pixels outside', () => {
    const { img, field } = stage();
    const g = findField(img, { x: 0, y: 57, width: 1563, height: 900 }, FLOOR, ARENA)!;
    expect(g).not.toBeNull();
    expect(Math.abs(g.x - field.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.y - field.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.width - field.w)).toBeLessThanOrEqual(4);
    expect(g.pxPerCm * 100).toBeCloseTo(47.9, 0);
  });

  it('projects world centimetres onto the screenshot', () => {
    const { img, field } = stage();
    const g = findField(img, { x: 0, y: 57, width: 1563, height: 900 }, FLOOR, ARENA)!;
    const centre = projectField(g, 1600, 900);
    expect(Math.abs(centre.x - (field.x + field.w / 2))).toBeLessThanOrEqual(3);
    expect(Math.abs(centre.y - (field.y + field.h / 2))).toBeLessThanOrEqual(3);
  });

  it('finds nothing where there is no floor, or where the box is not the arena\'s shape', () => {
    const blank = makeImage(400, 300, PAGE);
    expect(findField(blank, { x: 0, y: 0, width: 400, height: 300 }, FLOOR, ARENA)).toBeNull();
    const square = makeImage(600, 600, PAGE);
    for (let y = 100; y < 500; y++) for (let x = 100; x < 500; x++) square.data.set([FLOOR[0], FLOOR[1], FLOOR[2], 255], (y * 600 + x) * 4);
    expect(findField(square, { x: 0, y: 0, width: 600, height: 600 }, FLOOR, ARENA)).toBeNull();
  });
});
