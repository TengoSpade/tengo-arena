/**
 * Event recording (03 sys-match-report). Recording never draws randomness
 * and never changes state, so outcomes and checksums are identical at every
 * RecordLevel (T4, vis-009).
 *
 * Summary level records SUMMARY_EVENT_TYPES plus, per the event table in
 * core/model/events.ts, `cast.release` for actives and `status.apply` for
 * hard control. Full level records everything, including frames every
 * combat.json events.frameEveryTicks.
 */
import type { AbilityId, FightEvent, FightEventData, FightEventType, FightHeader, RecordLevel, SimEvent } from '../model';
import { SUMMARY_EVENT_TYPES, hashEventStream } from '../model';

const SUMMARY = new Set<string>(SUMMARY_EVENT_TYPES);

/** Event data with content ids as plain strings (the sim holds validated ids as strings). */
export type Relax<T> = T extends AbilityId ? string : T extends object ? { [K in keyof T]: Relax<T[K]> } : T;

export class Recorder {
  readonly level: RecordLevel;
  readonly full: boolean;
  readonly events: FightEvent[] = [];
  private seq = 0;

  constructor(level: RecordLevel) {
    this.level = level;
    this.full = level === 'full';
  }

  /** Whether an event of this type is recorded at this level (`summaryToo` marks the S-level special cases). */
  wants(type: FightEventType, summaryToo = false): boolean {
    return this.full || summaryToo || SUMMARY.has(type);
  }

  emit<K extends FightEventType>(type: K, tick: number, unit: number | undefined, target: number | undefined, data: Relax<FightEventData[K]>, summaryToo = false): void {
    if (!this.wants(type, summaryToo)) return;
    const ev: SimEvent<K, FightEventData[K]> = { seq: this.seq++, tick, type, data: data as FightEventData[K] };
    if (unit !== undefined) ev.unit = unit;
    if (target !== undefined) ev.target = target;
    this.events.push(ev as unknown as FightEvent);
  }

  hash(header: FightHeader): string {
    return hashEventStream(header, this.events);
  }
}

/** mm -> cm for events (truncated). */
export function cm(mm: number): number {
  return Math.trunc(mm / 10);
}
