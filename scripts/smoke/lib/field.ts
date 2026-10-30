/**
 * Where the arena's field is in a screenshot, found from the picture: the bounding box of the floor-coloured pixels inside
 * the canvas. The camera contract's default padding is only a guess (the real stage has its own padding and a wall band), and a
 * token's ring is a thin annulus, so the projection must be right to a few pixels for the ring census to look at the ring and
 * not at the body's trim beside it. The field is 32 x 18 m, so its width gives the pixels per centimetre and the height
 * checks it. Pure.
 */
import { colorDistance, type Rect, type Rgb } from './checks';
import type { Rgba } from './png';

export interface FieldGeometry {
  /** Screenshot pixel of the field's top-left corner (world 0, 0). */
  x: number;
  y: number;
  width: number;
  height: number;
  pxPerCm: number;
}

export function findField(img: Rgba, canvas: Rect, floor: Rgb, arenaCm: { width: number; height: number }, tolerance = 10): FieldGeometry | null {
  const x0 = Math.max(0, Math.floor(canvas.x));
  const y0 = Math.max(0, Math.floor(canvas.y));
  const x1 = Math.min(img.width, Math.ceil(canvas.x + canvas.width));
  const y1 = Math.min(img.height, Math.ceil(canvas.y + canvas.height));
  const step = 2;
  const cols = new Map<number, number>();
  const rows = new Map<number, number>();
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const o = (y * img.width + x) * 4;
      if (colorDistance([img.data[o]!, img.data[o + 1]!, img.data[o + 2]!], floor) > tolerance) continue;
      cols.set(x, (cols.get(x) ?? 0) + 1);
      rows.set(y, (rows.get(y) ?? 0) + 1);
    }
  }
  if (cols.size === 0 || rows.size === 0) return null;
  // An edge is the first (last) line where the floor takes up a real share of the field's own extent, so a stray pixel of
  // a similar colour outside the wall cannot move it.
  const edge = (m: Map<number, number>, dir: 1 | -1): number | null => {
    const peak = Math.max(...m.values());
    const keys = [...m.keys()].sort((u, v) => (dir === 1 ? u - v : v - u));
    return keys.find((k) => m.get(k)! >= peak * 0.25) ?? null;
  };
  const left = edge(cols, 1);
  const right = edge(cols, -1);
  const top = edge(rows, 1);
  const bottom = edge(rows, -1);
  if (left === null || right === null || top === null || bottom === null) return null;
  const width = right - left + step;
  const height = bottom - top + step;
  const pxPerCm = width / arenaCm.width;
  // The field has the arena's proportions; anything else is not the field.
  if (Math.abs(height / arenaCm.height - pxPerCm) > pxPerCm * 0.03) return null;
  return { x: left, y: top, width, height, pxPerCm };
}

export function projectField(g: FieldGeometry, xCm: number, yCm: number): { x: number; y: number } {
  return { x: g.x + xCm * g.pxPerCm, y: g.y + yCm * g.pxPerCm };
}
