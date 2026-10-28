/**
 * Render-state model (05-technical-m2 §A5; WP-M2C implements). PURE: no PixiJS, no DOM, no clocks
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
 */
import type { ContentDB } from '../../core/content';
import type { FightEvent, FightHeader, FightLog, UnitIndex } from '../../core/model';
import { notImplemented } from '../../core/util';
import type { ArenaFrameState, ArenaRoundContext, AutoPauseRules, AutoPauseStop, CueTable, DecisionSnapshot, KeyMoment } from '../types';

/** An indexed log. Opaque outside src/render/timeline. */
export interface PlaybackIndex {
  readonly header: FightHeader;
  readonly kind: 'live' | 'replay';
  /** The tick of `fight.end` for a replay; always null for a live round (the end is not known until reached). */
  readonly endTick: number | null;
  /** FightHeader.logFormat ?? 1. */
  readonly logFormat: number;
  readonly internal: unknown;
}

/** Build the index of one round's full-level log. Throws InvariantError for a log without frames (not 'full'). */
export function indexFightLog(log: FightLog, content: ContentDB, cues: CueTable, kind: 'live' | 'replay'): PlaybackIndex {
  return notImplemented('render.indexFightLog', log, content, cues, kind);
}

/**
 * The arena at `tick` (fractional allowed; clamped to the round). `ArenaFrameState.endTick` is set only once the
 * tick has reached the end. `reducedMotion` sets pulses and animated ages to their end states (04 §9). Pure.
 */
export function sampleAt(index: PlaybackIndex, tick: number, ctx: ArenaRoundContext, options?: { reducedMotion?: boolean }): ArenaFrameState {
  return notImplemented('render.sampleAt', index, tick, ctx, options);
}

/** Events with fromTick < tick ≤ toTick, in seq order (the scene's one-shot cues; the HUD feed). */
export function eventsBetween(index: PlaybackIndex, fromTick: number, toTick: number): readonly FightEvent[] {
  return notImplemented('render.eventsBetween', index, fromTick, toTick);
}

/** The unit's committed decision at `tick` (latest unit.decide with commitTick ≤ tick), or null before his first. */
export function decisionAt(index: PlaybackIndex, unit: UnitIndex, tick: number): DecisionSnapshot | null {
  return notImplemented('render.decisionAt', index, unit, tick);
}

/** The ticks where playback must stop under `rules`, up to and including `untilTick`, in order. */
export function autoPauseStops(index: PlaybackIndex, rules: AutoPauseRules, ctx: ArenaRoundContext, untilTick: number): readonly AutoPauseStop[] {
  return notImplemented('render.autoPauseStops', index, rules, ctx, untilTick);
}

/** Key moments up to and including `untilTick` (downs with cause, interrupts by another fighter, saves, rallies, captain events, overtime, the end). */
export function keyMoments(index: PlaybackIndex, ctx: ArenaRoundContext, untilTick: number): readonly KeyMoment[] {
  return notImplemented('render.keyMoments', index, ctx, untilTick);
}

/**
 * Live calls (calls package): true when `next` is `prev` extended by a re-simulation from `atTick` on, i.e.
 * every event with tick ≤ atTick is identical. The viewer refuses a replacement log that breaks it.
 */
export function samePrefix(prev: PlaybackIndex, next: PlaybackIndex, atTick: number): boolean {
  return notImplemented('render.samePrefix', prev, next, atTick);
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
