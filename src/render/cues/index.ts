/**
 * Ability and status cues, derived from content (05-technical-m2 §A5, tech-021; WP-M2C implements). PURE.
 *
 * Every one of the 168 abilities and every status of content/default gets a cue by construction, from its
 * definition: `delivery` (instant, dash, leap, projectile), `area` (circle, cone, line, centre, radius,
 * angle), `castTimeS`, `channel`, `target` and its effects (damage type, heal, shield, status categories,
 * knockback, pull, zones). No ability id or class id appears in this code; a theme's skin may later add
 * per-ability overrides from its own data file (designer-owned, not in M2).
 */
import type { ContentDB } from '../../core/content';
import { notImplemented } from '../../core/util';
import type { CueTable } from '../types';

/** Build the cue table of a content set (once per content hash; cached by the caller). */
export function buildCueTable(content: ContentDB): CueTable {
  return notImplemented('render.buildCueTable', content);
}

/** Telegraph threshold (04 §7: casts and channels of 0.3 s or longer). In ticks at 20 per second. */
export const TELEGRAPH_MIN_TICKS = 6;
