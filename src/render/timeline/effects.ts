/**
 * Short-lived arena cues derived from events: lifetimes, ids and the reduced-motion filter. PURE.
 *
 * Each effect is one event's visual (an event can have a companion: a hit has its impact and its number). The
 * primary effect of an event has `id` = the event's seq; a companion's id adds `slot × COMPANION_ID_OFFSET`
 * (slot 1 = the number, slot 2 = an extra flash), so ids stay unique and stable per event while a scene keeps one
 * visual per id across frames. `effectEventSeq(id)` gives the seq back.
 */
import type { AbilityId, UnitIndex } from '../../core/model';
import type { EffectKind, EffectRenderState } from '../types';

/** Added per companion slot to the event's seq (a round has far fewer than a million events). */
export const COMPANION_ID_OFFSET = 1 << 20;

export function companionId(seq: number, slot: number): number {
  return seq + slot * COMPANION_ID_OFFSET;
}

/** The seq of the event an effect id belongs to. */
export function effectEventSeq(id: number): number {
  return id % COMPANION_ID_OFFSET;
}

/**
 * How many ticks (50 ms) each effect lives, unless its event gives a better one (a dash trail lasts as long as the
 * dash, a guard link as long as the guard). TUNABLE by the UI designer: 04 §7 / vis-003 want effects gone within
 * 400 ms (8 ticks) at 1x; the exceptions are the down callout (2 s), the guard link (while it lasts) and the motion
 * streaks (as long as the motion).
 */
export const EFFECT_LIFETIME_TICKS: Readonly<Record<EffectKind, number>> = {
  swing: 4,
  beam: 3,
  impact: 6,
  number: 8,
  evade: 8,
  'heal-pulse': 8,
  'shield-gain': 8,
  'shield-break': 8,
  'status-apply': 8,
  'status-resist': 8,
  interrupt: 8,
  'dash-trail': 8,
  displace: 8,
  cleanse: 8,
  dispel: 8,
  'guard-link': 80,
  'chain-arc': 6,
  splash: 6,
  'cooldown-reset': 8,
  'focus-gain': 8,
  'zone-trigger': 8,
  down: 40,
  deathward: 8,
  rally: 8,
  'captain-down': 8,
  call: 8,
};

/**
 * Pulses, glints and streaks: no information beyond what their number, pip or the unit's own movement carries.
 * Reduced motion (04 §9) drops them from the sample; numbers, markers, telegraphs and projectiles stay.
 */
export const MOTION_ONLY_EFFECTS: ReadonlySet<EffectKind> = new Set<EffectKind>(['dash-trail', 'displace', 'heal-pulse', 'cooldown-reset', 'focus-gain']);

/** An effect as the index stores it. */
export interface EffectRec {
  id: number;
  kind: EffectKind;
  unit: UnitIndex | null;
  target: UnitIndex | null;
  ability: AbilityId | null;
  /** The unit whose position at `tick` anchors the effect (read at sample time, so a log's look-ahead rules apply), or null. */
  anchor: number | null;
  /** The fixed anchor when `anchor` is null. */
  x: number;
  y: number;
  amount: number | null;
  crit: boolean;
  tone: EffectRenderState['tone'];
  /** The tick the effect starts (its event's, or later when the event announces it: a leap's landing). */
  tick: number;
  /** First tick it no longer exists: tick + lifetime. Never shortened by a later event (that would leak it into ages). */
  end: number;
  /** Units that must still be standing: the effect is dropped from the tick any of them is down (a guard link, a leap's landing). */
  needsStanding: readonly UnitIndex[];
}
