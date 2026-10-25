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
import { StreamHasher, stableStringify } from '../util';

const SUMMARY = new Set<string>(SUMMARY_EVENT_TYPES);

/** Event data with content ids as plain strings (the sim holds validated ids as strings). */
export type Relax<T> = T extends AbilityId ? string : T extends object ? { [K in keyof T]: Relax<T[K]> } : T;

export class Recorder {
  readonly level: RecordLevel;
  readonly full: boolean;
  readonly events: FightEvent[] = [];
  private seq = 0;
  /** Incremental hashEventStream: header first, then every event as it is emitted. */
  private hasher: StreamHasher | null = null;
  private hashedHeader: FightHeader | null = null;

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
    if (this.hasher) this.hasher.update(eventJson(ev as unknown as FightEvent));
  }

  /** Start the incremental hash; call before the first event. */
  begin(header: FightHeader): void {
    if (this.events.length > 0) return;
    this.hasher = new StreamHasher();
    this.hasher.update(stableStringify(header));
    this.hashedHeader = header;
  }

  /** hashEventStream(header, events), from the incremental hasher when it covered the whole stream. */
  hash(header: FightHeader): string {
    if (this.hasher && this.hashedHeader === header) return this.hasher.digest();
    return hashEventStream(header, this.events);
  }
}

/**
 * stableStringify(event) for the frequent event types, written out directly
 * (keys in code-unit order, undefined omitted, JSON number and string
 * formatting); every other type goes through stableStringify. Equality with
 * hashEventStream is asserted in sim.test.ts.
 */
function eventJson(ev: FightEvent): string {
  switch (ev.type) {
    case 'frame': {
      const u = ev.data!.u;
      let d = '{"u":[';
      for (let i = 0; i < u.length; i++) {
        const f = u[i]!;
        d += (i > 0 ? ',[' : '[') + f[0] + ',' + f[1] + ',' + f[2] + ',' + f[3] + ']';
      }
      return env(ev, d + ']}');
    }
    case 'hit': {
      const x = ev.data!;
      return env(
        ev,
        '{"ability":' + str(x.ability) + ',"amount":' + x.amount + ',"crit":' + x.crit + ',"damageType":' + str(x.damageType) +
          ',"guardRedirect":' + x.guardRedirect + ',"overkill":' + x.overkill + ',"preMitigation":' + x.preMitigation + ',"toShield":' + x.toShield + '}',
      );
    }
    case 'cast.release': {
      const x = ev.data!;
      return env(ev, '{"ability":' + str(x.ability) + ',"cooldownTicks":' + x.cooldownTicks + ',"focusSpent":' + x.focusSpent + '}');
    }
    case 'cast.start': {
      const x = ev.data!;
      return env(ev, '{"ability":' + str(x.ability) + ',"castTicks":' + x.castTicks + '}');
    }
    case 'attack.start':
      return env(ev, '{"windupTicks":' + ev.data!.windupTicks + '}');
    case 'projectile.launch': {
      const x = ev.data!;
      return env(ev, '{"ability":' + str(x.ability) + ',"landTick":' + x.landTick + '}');
    }
    case 'heal': {
      const x = ev.data!;
      return env(ev, '{"ability":' + str(x.ability) + ',"amount":' + x.amount + ',"overheal":' + x.overheal + '}');
    }
    case 'status.apply': {
      const x = ev.data!;
      return env(
        ev,
        '{"ability":' + str(x.ability) + ',"drStep":' + (x.drStep === null ? 'null' : x.drStep) + ',"durationTicks":' + x.durationTicks +
          ',"magnitude":' + x.magnitude + ',"stacks":' + x.stacks + ',"status":' + str(x.status) + '}',
      );
    }
    case 'status.expire':
      return env(ev, '{"status":' + str(ev.data!.status) + '}');
    case 'unit.decide': {
      const x = ev.data!;
      let tr = '[';
      for (let i = 0; i < x.trace.length; i++) {
        const e = x.trace[i] as TraceLike;
        let o = '{';
        if (e.cond !== undefined) o += '"cond":' + e.cond + ',';
        o += '"fired":' + e.fired;
        if (e.observed !== undefined) o += ',"observed":' + (e.observed === null ? 'null' : e.observed);
        if (e.readyInTicks !== undefined) o += ',"readyInTicks":' + e.readyInTicks;
        if (e.reason !== undefined) o += ',"reason":' + str(e.reason);
        o += ',"rule":' + e.rule + ',"skip":' + str(e.skip) + '}';
        tr += (i > 0 ? ',' : '') + o;
      }
      let causes = '[';
      for (let i = 0; i < x.reactCauses.length; i++) causes += (i > 0 ? ',' : '') + str(x.reactCauses[i]!);
      return env(
        ev,
        '{"action":' + str(x.action) + ',"commitTick":' + x.commitTick + ',"reactCauses":' + causes + '],"reactTicks":' + x.reactTicks +
          ',"rule":' + x.rule + ',"targetUnit":' + (x.targetUnit === null ? 'null' : x.targetUnit) + ',"trace":' + tr + ']}',
      );
    }
    default:
      return stableStringify(ev);
  }
}

interface TraceLike {
  cond?: number;
  fired: boolean;
  observed?: number | null;
  readyInTicks?: number;
  reason?: string | null;
  rule: number;
  skip: string | null;
}

/** The envelope with its keys in code-unit order: data, seq, target, tick, type, unit. */
function env(ev: FightEvent, data: string): string {
  let s = '{"data":' + data + ',"seq":' + ev.seq;
  if (ev.target !== undefined) s += ',"target":' + ev.target;
  s += ',"tick":' + ev.tick + ',"type":"' + ev.type + '"';
  if (ev.unit !== undefined) s += ',"unit":' + ev.unit;
  return s + '}';
}

function str(v: string | null): string {
  return v === null ? 'null' : JSON.stringify(v);
}

/** mm -> cm for events (truncated). */
export function cm(mm: number): number {
  return Math.trunc(mm / 10);
}
