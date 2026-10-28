/**
 * Team colours and contrast (05-technical-m2 §A5; WP-M2C implements). PURE.
 *
 * asset-006: the player's side ring is brass (--c-side-us), the opponent's steel blue (--c-side-them); in a
 * match between other clubs both rings use the clubs' primaries with a luminance check. Research §6: when the
 * two primaries are too close the away side becomes secondary-dominant. Every ring and body colour must reach
 * 3:1 against the floor (04 §9); the ring style (solid or double) is the colour-free side cue.
 */
import type { Side } from '../../core/model';
import { notImplemented } from '../../core/util';
import type { ArenaPalette, ClubColors, TeamColors } from '../types';

/** Side colours for both sides of a match. playerSide null = a match between other clubs. */
export function colorsForMatch(home: ClubColors, away: ClubColors, playerSide: Side | null, palette: ArenaPalette): readonly [TeamColors, TeamColors] {
  return notImplemented('render.colorsForMatch', home, away, playerSide, palette);
}

/** WCAG contrast ratio of two 0xRRGGBB colours (1..21). */
export function contrastRatio(a: number, b: number): number {
  return notImplemented('render.contrastRatio', a, b);
}

/** '#1A2D5A' (clubs.json, tokens.css) → 0x1a2d5a. */
export function parseHexColor(hex: string): number {
  return notImplemented('render.parseHexColor', hex);
}
