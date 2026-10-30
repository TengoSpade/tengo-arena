/**
 * Palette helpers for the viewer (WP-M2D).
 *
 * `ArenaPalette` comes from the host (src/ui reads tokens.css computed style once per theme, motion or interface-
 * scale change: arena-notes.md §3). The viewer takes every colour, alpha, size and duration that has a token from it
 * and from `palette.metrics`. Tests, the dev harness and a host's first frame use WP-M2C's `defaultArenaPalette` /
 * `DEFAULT_ARENA_PALETTES` (src/render/colors).
 */
import type { ArenaPalette } from '../types';

/** Linear mix of two 0xRRGGBB colours (t = 0 gives a, 1 gives b). */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const r = Math.round(ar + (((b >> 16) & 255) - ar) * t);
  const g = Math.round(ag + (((b >> 8) & 255) - ag) * t);
  const bl = Math.round(ab + ((b & 255) - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export type Tone = 'physical' | 'arcane' | 'true' | 'heal' | 'shield' | 'neutral';

/** The hit and gain tone colour of an effect or ability (EffectRenderState.tone), all from the palette. */
export function toneColor(tone: Tone, palette: ArenaPalette): number {
  switch (tone) {
    case 'physical':
      return palette.fxPhysical;
    case 'arcane':
      return palette.fxArcane;
    case 'true':
      return palette.fxTrue;
    case 'heal':
      return palette.fxHeal;
    case 'shield':
      return palette.fxShield;
    case 'neutral':
      return palette.ink;
  }
}
