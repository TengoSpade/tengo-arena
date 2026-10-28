/**
 * Render-state model (05-technical-m2 §A5; WP-M2C). PURE: no PixiJS, no DOM, no clocks
 * (tests/architecture rule render-pure; typechecked without DOM types and tested in Node). It turns one full-level
 * FightLog into an indexed timeline and samples it at any (fractional) tick, so the same state comes out whether
 * playback reached the tick by playing at 1x, at 4x or by seeking (tested). It never simulates and never draws
 * randomness.
 *
 * No future leaks (review B1): nothing here tells a caller about a live round beyond the tick it asks for. A live
 * index has no end tick (null); key moments and auto-pause stops are bounded by `untilTick`; a sample reports the
 * end only once it is reached. The viewer is the only caller for live rounds and never asks past its head.
 *
 * Contract (fixed signatures; additions are additive):
 * - indexFightLog: O(events) once per log; frames, unit.decide, statuses, casts, projectiles, zones, shields and
 *   downs become per-unit interval lists for O(log n) lookups.
 * - sampleAt: positions interpolated linearly between `frame` events (every 2 ticks); HP, shield and focus step at
 *   frame ticks (log format 2; format 1 gives shield and focus null); discrete state from the intervals; effects
 *   whose lifetime covers the tick.
 *
 * Layout: build.ts (indexing), frames.ts (frame table), sample.ts (sampleAt), queries.ts (the bounded queries),
 * effects.ts (effect lifetimes and ids), data.ts (the internal shape). See README.md.
 */
import type { ContentDB } from '../../core/content';
import type { FightLog } from '../../core/model';
import type { CueTable } from '../types';
import { buildTimelineData } from './build';
import type { PlaybackIndex } from './model';
import { sampleAt } from './sample';
import { autoPauseStops, decisionAt, eventsBetween, keyMoments, samePrefix } from './queries';

export type { PlaybackIndex } from './model';
export { sampleAt } from './sample';
export { autoPauseStops, decisionAt, eventsBetween, keyMoments, samePrefix } from './queries';
export { COMPANION_ID_OFFSET, EFFECT_LIFETIME_TICKS, MOTION_ONLY_EFFECTS, effectEventSeq } from './effects';
export { RULE_PULSE_MS } from './sample';

/** Build the index of one round's full-level log. Throws InvariantError for a log without frames (not 'full'). */
export function indexFightLog(log: FightLog, content: ContentDB, cues: CueTable, kind: 'live' | 'replay'): PlaybackIndex {
  const data = buildTimelineData(log, content, cues, kind);
  return {
    header: log.header,
    kind,
    // A live round's end is not known until the playback reaches it: the index never says (samples report `endTick` once reached).
    endTick: kind === 'replay' ? data.endTick : null,
    logFormat: data.logFormat,
    internal: data,
  };
}

/**
 * The model as one injectable object (review B8): the viewer takes it as `ArenaViewerOptions.timeline`, so WP-M2D
 * can test with a fake before WP-M2C lands, and tests can count what the viewer asks for.
 */
export interface Timeline {
  indexFightLog: typeof indexFightLog;
  sampleAt: typeof sampleAt;
  eventsBetween: typeof eventsBetween;
  decisionAt: typeof decisionAt;
  autoPauseStops: typeof autoPauseStops;
  keyMoments: typeof keyMoments;
  samePrefix: typeof samePrefix;
}

/** The real model. */
export const timeline: Timeline = { indexFightLog, sampleAt, eventsBetween, decisionAt, autoPauseStops, keyMoments, samePrefix };
