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
export { autoPauseStops, decisionAt, eventsBetween, indexFightLog, keyMoments, sampleAt, samePrefix, timeline, type PlaybackIndex, type Timeline } from './timeline';
export { buildCueTable, TELEGRAPH_MIN_TICKS } from './cues';
// Every export of the colours module is public (WP-M2C's default palettes, PRIMARY_CLASH_DELTA_E and contrast helpers
// included): src/ui may not deep-import (render-deep-import), and a star export needs no index change as it grows.
export * from './colors';
export { DEFAULT_CAMERA, viewTransform } from './camera';

/** Auto-pause defaults (P-01; approved by the owner as recommended, Q58, 2026-10-27). Each is a Settings › Match day switch. */
export const DEFAULT_AUTO_PAUSE = {
  ownDowned: true,
  enemyDowned: false,
  ownCaptainDown: true,
  overtime: true,
  ownHpBelowPct: null,
} as const satisfies AutoPauseRules;
