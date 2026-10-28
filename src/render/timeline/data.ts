/** Internal shape of an indexed log (`PlaybackIndex.internal`). PURE; opaque outside src/render/timeline. */
import type { AbilityId, FightEvent, FightHeader, Side, UnitIndex } from '../../core/model';
import type { CueTable, KeyMoment } from '../types';
import type { EffectRec } from './effects';
import type { FrameTable } from './frames';

/** A windup, cast or channel of one unit. Active while start ≤ tick < end. */
export interface CastRec {
  kind: 'windup' | 'cast' | 'channel';
  ability: AbilityId;
  start: number;
  /** The tick the windup, cast or channel completes by its own timing: progress runs over [start, planned]. */
  planned: number;
  /** First tick it is no longer active: `planned`, or earlier when an interrupt, a cancel or a down ends it. */
  end: number;
  target: UnitIndex | null;
  /** Where the area of a telegraph is centred; null for an ability without an area or zone. */
  center: 'self' | 'target' | null;
}

/** A displacement (dash, leap, knockback, pull) of one unit. */
export interface DisplaceRec {
  kind: 'dash' | 'leap' | 'knockback' | 'pull';
  start: number;
  end: number;
}

/** One version of a status instance: it holds from `from` until the next version, the removal, or the unit's down. */
export interface StatusSeg {
  status: string;
  category: string;
  from: number;
  to: number;
  appliedTick: number;
  endsTick: number;
  stacks: number;
  /** The status's stacking mode in content: only 'stacks' statuses add their instances' stacks together. */
  stacking: string;
  seq: number;
  /** Set when the status blocks move, attack and ability: the unit reads as stunned, or asleep when damage breaks it. */
  incapacitates: 'stunned' | 'asleep' | null;
}

export interface DecisionRec {
  /** Commit tick. */
  tick: number;
  seq: number;
  event: Extract<FightEvent, { type: 'unit.decide' }>;
}

export interface ProjectileRec {
  id: number;
  ability: AbilityId;
  source: UnitIndex;
  target: UnitIndex | null;
  launch: number;
  land: number;
  sx: number;
  sy: number;
}

export interface ZoneRec {
  id: number;
  ability: AbilityId;
  owner: UnitIndex;
  side: Side;
  x: number;
  y: number;
  radius: number;
  spawn: number;
  /** First tick the zone no longer exists (its expire event, a replacement, or its owner's down); Infinity until seen. */
  expire: number;
  /** spawn + the zone's duration from content, or null when the ability is unknown. */
  endsTick: number | null;
  follow: boolean;
}

export interface CaptainChange {
  tick: number;
  unit: UnitIndex | null;
}

export interface DownRec {
  tick: number;
  seq: number;
  unit: UnitIndex;
  side: Side;
}

export interface TimelineData {
  header: FightHeader;
  kind: 'live' | 'replay';
  logFormat: number;
  /** All events, ascending by (tick, seq). */
  events: readonly FightEvent[];
  eventTicks: Float64Array;
  unitCount: number;
  sides: readonly Side[];
  maxHp: readonly number[];
  frames: FrameTable;
  casts: readonly (readonly CastRec[])[];
  displaces: readonly (readonly DisplaceRec[])[];
  statuses: readonly (readonly StatusSeg[])[];
  decisions: readonly (readonly DecisionRec[])[];
  hitTicks: readonly (readonly number[])[];
  /** Tick of the unit's down, or null. */
  downTick: readonly (number | null)[];
  projectiles: readonly ProjectileRec[];
  maxFlight: number;
  zones: readonly ZoneRec[];
  effects: readonly EffectRec[];
  effectTicks: Float64Array;
  maxEffectLife: number;
  captains: readonly [readonly CaptainChange[], readonly CaptainChange[]];
  overtimeTick: number | null;
  overtimeSeq: number;
  /** Tick of `fight.end`, or null when the log has none (yet). */
  endTick: number | null;
  /** The last tick the log knows of (its last event or frame). */
  lastTick: number;
  moments: readonly KeyMoment[];
  momentTicks: Float64Array;
  downs: readonly DownRec[];
  captainDowns: readonly DownRec[];
  cues: CueTable;
  /** Seconds per tick = tickMs / 1000, and ticks per second. */
  tickSeconds: number;
}
