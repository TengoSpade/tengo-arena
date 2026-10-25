import type { Seed } from '../rng';
import { StreamHasher, stableStringify } from '../util';
import type { ClassId, ClubId, FighterId } from './ids';

/**
 * Fight event stream: the contract between the simulation (core/sim, the
 * only producer), match reports (core/game, ui) and the M2 arena viewer
 * (src/render, a pure consumer that never re-simulates or mutates state).
 *
 * Phase A fixes the ENVELOPE and the engine-level events below. The
 * content-dependent event types (ability casts, damage, heals, statuses,
 * rule firings, movement intents, ...) are added by core/sim in phase B as
 * further members of the FightEvent union, using the same envelope.
 */

export const FIGHT_LOG_FORMAT = 'arena-league-fight';

/**
 * How much the sim records. The OUTCOME must be identical at every level
 * (REQUIRED; tested): recording never consumes randomness or changes order.
 * - none:    result + checksum only (AI-vs-AI headless matches, balance runs)
 * - summary: + per-fighter stats and key events (unit.down, fight.end) for match reports
 * - full:    + every event and periodic frames (M2 viewer, determinism tests)
 */
export type RecordLevel = 'none' | 'summary' | 'full';

/** 0 = home side, 1 = away side. */
export type Side = 0 | 1;

/** Index into FightHeader.units (0..2*teamSize-1). Events reference units by index to stay compact. */
export type UnitIndex = number;

export interface FightUnitInfo {
  index: UnitIndex;
  side: Side;
  fighterId: FighterId;
  clubId: ClubId;
  classId: ClassId;
  /** Position in the lineup (0-based) and starting row. */
  slot: number;
  row: 'front' | 'back';
  isCaptain: boolean;
}

export interface FightHeader {
  format: typeof FIGHT_LOG_FORMAT;
  engineVersion: number;
  contentHash: string;
  /** The round seed this fight was simulated from. */
  seed: Seed;
  /** Fixed simulation step in ms (50 ms PROPOSED, 03 §1). Event time in ms = tick * tickMs. */
  tickMs: number;
  /** At level 'full', a 'frame' event is recorded every `frameEvery` ticks. */
  frameEvery: number;
  /** Arena size in integer centimetres (03 §1 units). [phase B] values and arena id from combat.json. */
  arena: { width: number; height: number };
  units: FightUnitInfo[];
}

/** Envelope shared by every event. */
export interface SimEvent<T extends string = string, D = unknown> {
  /** 0-based, strictly increasing within one fight. */
  seq: number;
  /** Tick on which the event happened (0-based). */
  tick: number;
  type: T;
  /** Acting unit, if any. */
  unit?: UnitIndex;
  /** Target unit, if any. */
  target?: UnitIndex;
  data?: D;
}

export type FightEndReason =
  | 'elimination'
  /** Time cap reached; winner decided by the tie-break rule in 03-combat [phase B]. */
  | 'time-limit';

export interface UnitSpawn {
  unit: UnitIndex;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

/** Compact per-unit frame: [x cm, y cm, hp], all integers. Index = UnitIndex. [phase B] may gain fields (focus, state flags, facing). */
export type FrameUnit = [x: number, y: number, hp: number];

export type FightStartEvent = SimEvent<'fight.start', { units: UnitSpawn[] }>;
export type FrameEvent = SimEvent<'frame', { u: FrameUnit[] }>;
/** `unit` is downed (0 HP, out for the round, 01 §7); `data.by` is the unit credited, if any. */
export type UnitDownEvent = SimEvent<'unit.down', { by: UnitIndex | null }>;
export type FightEndEvent = SimEvent<'fight.end', { winner: Side | null; reason: FightEndReason }>;

/** Engine-level events fixed in phase A. core/sim extends this union in phase B. */
export type EngineEvent = FightStartEvent | FrameEvent | UnitDownEvent | FightEndEvent;

export interface FightLog {
  header: FightHeader;
  events: SimEvent[];
  /** hashEventStream(header, events): replays and determinism tests compare this. */
  hash: string;
}

/**
 * Canonical hash of a fight's header and event stream. Two fights are
 * "identical" for replay purposes iff their hashes match.
 */
export function hashEventStream(header: FightHeader, events: readonly SimEvent[]): string {
  const hasher = new StreamHasher();
  hasher.update(stableStringify(header));
  for (const event of events) hasher.update(stableStringify(event));
  return hasher.digest();
}
