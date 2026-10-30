/**
 * The M2 placeholder skin (T1: "placeholder sprites or simple shapes first"; WP-M2D implements).
 *
 * Bodies are flat shapes generated at load, no image files: a filled circle of the fighter radius (0.5 m) in
 * the side's primary with a secondary rim, flattened and at 40% opacity when downed (asset-006). The floor is a
 * flat mid-value plane with a centre line and walls (04 §5). Everything with game meaning (ring, role glyphs,
 * bars, pips, badges, cues) is drawn by the viewer, not here.
 */
import { notImplemented } from '../../../core/util';
import type { ArenaSkin } from '../../viewer/skin';

export function placeholderSkin(): ArenaSkin {
  return notImplemented('render.placeholderSkin');
}
