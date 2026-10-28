/**
 * src/render — the M2 arena viewer, PURE half (docs/design/_drafts/05-technical-m2.md §A5).
 *
 * This entry has no PixiJS and no DOM: types, the render-state model (timeline), cues, colours and the
 * camera transform. src/ui may import it statically from lazy screen chunks. The PixiJS half is
 * `src/render/viewer` (createArenaViewer, skins), which src/ui may load only with a dynamic import() or
 * import type (tests/architecture rule ui-render-viewer-static; tests/build/bundle.test.ts keeps PixiJS out
 * of the startup JS).
 *
 * CONTRACT: signatures are fixed (architect); additions are additive. Stubs throw NotImplementedError until
 * WP-M2C lands.
 */
import type { AutoPauseRules } from './types';

export type * from './types';
export { autoPauseStops, decisionAt, eventsBetween, indexFightLog, keyMoments, sampleAt, samePrefix, type PlaybackIndex } from './timeline';
export { buildCueTable, TELEGRAPH_MIN_TICKS } from './cues';
export { colorsForMatch, contrastRatio, parseHexColor } from './colors';
export { DEFAULT_CAMERA, viewTransform } from './camera';

/** Auto-pause defaults: the working assumption of owner question Q58 (PROPOSED, P-01; OPEN). */
export const DEFAULT_AUTO_PAUSE = {
  ownDowned: true,
  enemyDowned: false,
  ownCaptainDown: true,
  overtime: true,
  ownHpBelowPct: null,
} as const satisfies AutoPauseRules;
