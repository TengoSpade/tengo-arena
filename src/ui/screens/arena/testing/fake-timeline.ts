/**
 * Test support: a small implementation of the render-state `Timeline` over the synthetic logs of fixture-log.ts, so the
 * arena screen tests run before (and independently of) WP-M2C's real model. It honours the same contract that matters
 * for the leak test: a live index has no end tick, key moments and stops are bounded by `untilTick`, and a sample
 * reports the end only once it is reached. When the real timeline lands, the leak test also runs against it (see
 * leak.test.tsx), which is why the tests only talk to the `Timeline` interface.
 */
import type { FightEvent, FightLog, FrameUnit, RuleTraceEntry } from '../../../../core/model';
import type { ArenaFrameState, ArenaRoundContext, AutoPauseReason, AutoPauseRules, AutoPauseStop, DecisionSnapshot, KeyMoment, UnitRenderState } from '../../../../render';
import type { PlaybackIndex, Timeline } from '../../../../render';

interface Internal {
  events: readonly FightEvent[];
  frames: { tick: number; u: FrameUnit[] }[];
}

const internal = (index: PlaybackIndex): Internal => index.internal as Internal;

function frameAt(i: Internal, tick: number): FrameUnit[] | null {
  let found: FrameUnit[] | null = null;
  for (const f of i.frames) {
    if (f.tick > tick) break;
    found = f.u;
  }
  return found;
}

function decisions(index: PlaybackIndex, unit: number, tick: number): FightEvent[] {
  return internal(index).events.filter((e) => e.type === 'unit.decide' && e.unit === unit && e.data!.commitTick <= tick);
}

export const fakeTimeline: Timeline = {
  indexFightLog(log: FightLog, _content, _cues, kind): PlaybackIndex {
    const end = log.events.find((e) => e.type === 'fight.end');
    return {
      header: log.header,
      kind,
      // A live round's end is never known (review B1), even when the log in memory has it.
      endTick: kind === 'replay' && end ? end.tick : null,
      logFormat: log.header.logFormat ?? 1,
      internal: { events: log.events, frames: log.events.filter((e) => e.type === 'frame').map((e) => ({ tick: e.tick, u: (e as Extract<FightEvent, { type: 'frame' }>).data!.u })) } satisfies Internal,
    };
  },

  sampleAt(index, tick, ctx): ArenaFrameState {
    const i = internal(index);
    const t = Math.max(0, tick);
    const u = frameAt(i, t) ?? [];
    const spawn = i.events[0]?.type === 'fight.start' ? i.events[0].data!.units : [];
    const over = i.events.find((e) => e.type === 'overtime.start' && e.tick <= t);
    const end = i.events.find((e) => e.type === 'fight.end' && e.tick <= t);
    const downs = new Map<number, number>();
    for (const e of i.events) if (e.type === 'unit.down' && e.tick <= t && e.unit !== undefined) downs.set(e.unit, e.tick);
    const units: UnitRenderState[] = index.header.units.map((h) => {
      const f = u[h.index];
      const decided = decisions(index, h.index, t).at(-1);
      const rule = decided && decided.type === 'unit.decide' ? decided.data!.rule : null;
      const standing = (f?.[2] ?? 100) > 0;
      return {
        unit: h.index,
        side: h.side,
        x: f?.[0] ?? spawn[h.index]?.x ?? 0,
        y: f?.[1] ?? spawn[h.index]?.y ?? 0,
        facing: h.side === 0 ? 0 : Math.PI,
        hp: f?.[2] ?? spawn[h.index]?.hp ?? 100,
        maxHp: spawn[h.index]?.maxHp ?? 100,
        shield: f?.[4] ?? null,
        focus: f?.[5] ?? null,
        standing,
        downedTick: downs.get(h.index) ?? null,
        action: standing ? 'idle' : 'downed',
        cast: null,
        statuses: [],
        rule: rule === null ? null : { label: `R${rule + 1}`, rule, sinceTick: 0, pulse: 0 },
        isCaptain: h.isCaptain,
        targetUnit: null,
        lastHitTick: null,
      };
    });
    const standing = { home: units.filter((x) => x.side === 0 && x.standing).length, away: units.filter((x) => x.side === 1 && x.standing).length };
    void ctx;
    return {
      tick: t,
      fightSeconds: t * 0.05,
      overtime: over !== undefined,
      ended: end !== undefined,
      endTick: end ? end.tick : null,
      units,
      projectiles: [],
      zones: [],
      telegraphs: [],
      effects: [],
      standing,
      captains: { home: null, away: null },
    };
  },

  eventsBetween(index, from, to) {
    return internal(index).events.filter((e) => e.tick > from && e.tick <= to);
  },

  decisionAt(index, unit, tick): DecisionSnapshot | null {
    const e = decisions(index, unit, tick).at(-1);
    if (!e || e.type !== 'unit.decide') return null;
    const d = e.data!;
    return { unit, rule: d.rule, action: d.action, targetUnit: d.targetUnit, commitTick: d.commitTick, reactTicks: d.reactTicks, reactCauses: d.reactCauses, trace: d.trace as readonly RuleTraceEntry[] };
  },

  autoPauseStops(index, rules: AutoPauseRules, ctx: ArenaRoundContext, untilTick): readonly AutoPauseStop[] {
    const stops: AutoPauseStop[] = [];
    const own = (unit: number | undefined) => unit !== undefined && ctx.playerSide !== null && index.header.units[unit]?.side === ctx.playerSide;
    for (const e of internal(index).events) {
      if (e.tick > untilTick) break;
      const push = (reason: AutoPauseReason, unit: number | null) => stops.push({ tick: e.tick, reason, unit, seq: e.seq });
      if (e.type === 'unit.down') {
        if (rules.ownDowned && own(e.unit)) push('ownDowned', e.unit ?? null);
        if (rules.enemyDowned && ctx.playerSide !== null && !own(e.unit)) push('enemyDowned', e.unit ?? null);
        if (rules.ownCaptainDown && own(e.unit) && index.header.units[e.unit!]?.isCaptain) push('ownCaptainDown', e.unit ?? null);
      }
      if (e.type === 'overtime.start' && rules.overtime) push('overtime', null);
    }
    return stops;
  },

  keyMoments(index, _ctx, untilTick): readonly KeyMoment[] {
    const out: KeyMoment[] = [];
    for (const e of internal(index).events) {
      if (e.tick > untilTick) break;
      if (e.type === 'unit.down') out.push({ tick: e.tick, seq: e.seq, kind: 'down', unit: e.data!.by, target: e.unit ?? null, ability: e.data!.ability }); // unit = the killer, target = the fallen (the KeyMoment convention)
      else if (e.type === 'overtime.start') out.push({ tick: e.tick, seq: e.seq, kind: 'overtime', unit: null, target: null, ability: null });
      else if (e.type === 'fight.end') out.push({ tick: e.tick, seq: e.seq, kind: 'end', unit: null, target: null, ability: null });
    }
    return out;
  },

  samePrefix(prev, next, atTick) {
    const a = internal(prev).events.filter((e) => e.tick <= atTick);
    const b = internal(next).events.filter((e) => e.tick <= atTick);
    return a.length === b.length && a.every((e, i) => e.seq === b[i]!.seq);
  },
};
