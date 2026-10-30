/**
 * An affine world-to-screen map (cm to CSS px) taken from a `ViewTransform`, so the per-frame scene code reads
 * coefficients instead of calling `toScreen` (which allocates) for every mark. Top-down and oblique projections are
 * affine, and so is a blend of two of them, which is how the camera eases (04 §4: a 220 ms ease on zoom changes).
 */
import type { ViewTransform } from '../../types';

export interface AffineMap {
  /** Screen position of world (0, 0). */
  ox: number;
  oy: number;
  /** Screen delta per cm of world x. */
  ax: number;
  ay: number;
  /** Screen delta per cm of world y. */
  bx: number;
  by: number;
}

export function affineOf(tf: ViewTransform): AffineMap {
  const o = tf.toScreen(0, 0);
  const x = tf.toScreen(100, 0);
  const y = tf.toScreen(0, 100);
  return { ox: o.x, oy: o.y, ax: (x.x - o.x) / 100, ay: (x.y - o.y) / 100, bx: (y.x - o.x) / 100, by: (y.y - o.y) / 100 };
}

export function blendAffine(a: AffineMap, b: AffineMap, t: number, out: AffineMap): AffineMap {
  out.ox = a.ox + (b.ox - a.ox) * t;
  out.oy = a.oy + (b.oy - a.oy) * t;
  out.ax = a.ax + (b.ax - a.ax) * t;
  out.ay = a.ay + (b.ay - a.ay) * t;
  out.bx = a.bx + (b.bx - a.bx) * t;
  out.by = a.by + (b.by - a.by) * t;
  return out;
}

export const sx = (m: AffineMap, x: number, y: number): number => m.ox + m.ax * x + m.bx * y;
export const sy = (m: AffineMap, x: number, y: number): number => m.oy + m.ay * x + m.by * y;

/** CSS px per metre along world x. */
export const pxPerMetreOf = (m: AffineMap): number => Math.hypot(m.ax, m.ay) * 100;

/** Screen point to world cm, or null for a degenerate map. */
export function toWorld(m: AffineMap, px: number, py: number): { x: number; y: number } | null {
  const det = m.ax * m.by - m.bx * m.ay;
  if (Math.abs(det) < 1e-12) return null;
  const dx = px - m.ox;
  const dy = py - m.oy;
  return { x: (dx * m.by - dy * m.bx) / det, y: (m.ax * dy - m.ay * dx) / det };
}

/** The screen direction angle of a world direction (radians, 0 = east, +y south), for the facing wedge under any projection. */
export function screenAngle(m: AffineMap, worldAngle: number): number {
  const c = Math.cos(worldAngle);
  const s = Math.sin(worldAngle);
  return Math.atan2(m.ay * c + m.by * s, m.ax * c + m.bx * s);
}
