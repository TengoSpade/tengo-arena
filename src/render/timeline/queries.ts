/**
 * The bounded queries over an indexed log: events between ticks, the decision a unit has committed, key moments,
 * auto-pause stops and the live-call prefix check. PURE. Every query takes the tick it may look up to (`untilTick`,
 * `toTick`, `tick`) and returns nothing from after it (review B1), so a live round's caller never reads past its head.
 */
import type { FightEvent, UnitIndex } from '../../core/model';
import type { ArenaRoundContext, AutoPauseReason, AutoPauseRules, AutoPauseStop, DecisionSnapshot, KeyMoment } from '../types';
import type { DecisionRec, TimelineData } from './data';
import type { PlaybackIndex } from './model';
import { bisectRight, lastAtOrBefore } from './util';

function dataOf(index: PlaybackIndex): TimelineData {
  return index.internal as TimelineData;
}

/** Events with fromTick < tick ≤ toTick, in seq order (the scene's one-shot cues; the HUD feed). */
export function eventsBetween(index: PlaybackIndex, fromTick: number, toTick: number): readonly FightEvent[] {
  const d = dataOf(index);
  if (!(toTick > fromTick)) return [];
  return d.events.slice(bisectRight(d.eventTicks, fromTick), bisectRight(d.eventTicks, toTick));
}

/** The unit's committed decision at `tick` (latest unit.decide with commitTick ≤ tick), or null before his first. */
export function decisionAt(index: PlaybackIndex, unit: UnitIndex, tick: number): DecisionSnapshot | null {
  const d = dataOf(index);
  const list: readonly DecisionRec[] | undefined = d.decisions[unit];
  if (!list) return null;
  const i = lastAtOrBefore(list, tick, (r) => r.tick);
  if (i < 0) return null;
  const rec = list[i]!;
  const data = rec.event.data;
  if (!data) return null;
  return {
    unit,
    rule: data.rule,
    action: data.action,
    targetUnit: data.targetUnit,
    commitTick: rec.tick,
    reactTicks: data.reactTicks,
    reactCauses: data.reactCauses,
    trace: data.trace,
  };
}

const REASON_ORDER: readonly AutoPauseReason[] = ['ownDowned', 'enemyDowned', 'ownCaptainDown', 'overtime', 'ownHpBelowPct'];

/**
 * The ticks where playback must stop under `rules`, up to and including `untilTick`, in order. "Own" is
 * `ctx.playerSide`; in a match between other clubs (null) only the overtime stop exists.
 */
export function autoPauseStops(index: PlaybackIndex, rules: AutoPauseRules, ctx: ArenaRoundContext, untilTick: number): readonly AutoPauseStop[] {
  const d = dataOf(index);
  const own = ctx.playerSide;
  const out: AutoPauseStop[] = [];
  if (own !== null) {
    if (rules.ownDowned || rules.enemyDowned) {
      for (const down of d.downs) {
        if (down.tick > untilTick) break;
        if (down.side === own && rules.ownDowned) out.push({ tick: down.tick, reason: 'ownDowned', unit: down.unit, seq: down.seq });
        else if (down.side !== own && rules.enemyDowned) out.push({ tick: down.tick, reason: 'enemyDowned', unit: down.unit, seq: down.seq });
      }
    }
    if (rules.ownCaptainDown) {
      for (const c of d.captainDowns) {
        if (c.tick > untilTick) break;
        if (c.side === own) out.push({ tick: c.tick, reason: 'ownCaptainDown', unit: c.unit, seq: c.seq });
      }
    }
    if (rules.ownHpBelowPct !== null) {
      const pct = rules.ownHpBelowPct;
      const ft = d.frames;
      for (let u = 0; u < d.unitCount; u++) {
        if (d.sides[u] !== own) continue;
        const limit = (pct * d.maxHp[u]!) / 100;
        for (let k = 0; k < ft.count; k++) {
          const tick = ft.ticks[k]!;
          if (tick > untilTick) break;
          const hp = ft.hp[u]![k]!;
          // A unit that dropped straight to a down is the down stop's business, not a low-HP warning.
          if (hp <= 0) break;
          if (hp < limit) {
            out.push({ tick, reason: 'ownHpBelowPct', unit: u, seq: ft.seqs[k]! });
            break;
          }
        }
      }
    }
  }
  if (rules.overtime && d.overtimeTick !== null && d.overtimeTick <= untilTick) {
    out.push({ tick: d.overtimeTick, reason: 'overtime', unit: null, seq: d.overtimeSeq });
  }
  return out.sort((a, b) => a.tick - b.tick || a.seq - b.seq || REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason));
}

/**
 * Key moments up to and including `untilTick` (downs with cause, interrupts by another fighter, saves, rallies, captain
 * events, overtime, calls, the end): the report's selection rules (core/game `keyEvents`) plus calls and the end.
 * `unit` is the acting fighter and `target` the one it happened to: for a down, `unit` is who downed (null for a DoT
 * without a source) and `target` the fallen; for captain events `unit` is the captain concerned.
 */
export function keyMoments(index: PlaybackIndex, _ctx: ArenaRoundContext, untilTick: number): readonly KeyMoment[] {
  const d = dataOf(index);
  return d.moments.slice(0, bisectRight(d.momentTicks, untilTick));
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    if (a.length !== bb.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], bb[i])) return false;
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).filter((key) => ao[key] !== undefined);
  const bk = Object.keys(bo).filter((key) => bo[key] !== undefined);
  if (ak.length !== bk.length) return false;
  for (const key of ak) if (!same(ao[key], bo[key])) return false;
  return true;
}

/**
 * Live calls (calls package): true when `next` is `prev` extended by a re-simulation from `atTick` on, i.e.
 * the headers match and every event with tick ≤ atTick is identical. The viewer refuses a replacement log that breaks it.
 */
export function samePrefix(prev: PlaybackIndex, next: PlaybackIndex, atTick: number): boolean {
  const a = dataOf(prev);
  const b = dataOf(next);
  if (!same(a.header, b.header)) return false;
  const na = bisectRight(a.eventTicks, atTick);
  const nb = bisectRight(b.eventTicks, atTick);
  if (na !== nb) return false;
  for (let i = 0; i < na; i++) if (!same(a.events[i], b.events[i])) return false;
  return true;
}
