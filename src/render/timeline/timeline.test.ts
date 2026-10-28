/**
 * Render-state model tests (05-technical-m2 §A11, "Render-state model without a GPU"): sampling, bounded queries,
 * selection rules, no future leaks, format 1 and 2 frames, reduced motion. Fixture logs are real simulator output
 * (fixtures/make-fixtures.mjs); synthetic edits of them exercise the cases the simulator does not produce yet.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkSource, listSourceFiles } from '../../../tests/architecture/rules';
import { InvariantError } from '../../core/util';
import type { FightEvent, FightLog } from '../../core/model';
import { DEFAULT_AUTO_PAUSE } from '../index';
import type { ArenaFrameState, AutoPauseRules, KeyMoment } from '../types';
import { COMPANION_ID_OFFSET, EFFECT_LIFETIME_TICKS, MOTION_ONLY_EFFECTS, autoPauseStops, decisionAt, effectEventSeq, eventsBetween, indexFightLog, keyMoments, sampleAt, samePrefix, timeline } from './index';
import { FIXTURE_NAMES, defaultContent, defaultCues, eventsOf, loadFixture, makeCtx, skeletonLog, truncateLog, withEvents, type FixtureName } from './support.mts';

const content = defaultContent();
const cues = defaultCues();

function indexOf(log: FightLog, kind: 'live' | 'replay' = 'replay') {
  return indexFightLog(log, content, cues, kind);
}
function fixture(name: FixtureName) {
  const { log, meta } = loadFixture(name);
  return { log, meta, index: indexOf(log), ctx: makeCtx(log, content) };
}
const ALL_RULES: AutoPauseRules = { ownDowned: true, enemyDowned: true, ownCaptainDown: true, overtime: true, ownHpBelowPct: 50 };

describe('indexFightLog', () => {
  it('indexes every fixture; a replay knows its end, a live round never says', () => {
    for (const name of FIXTURE_NAMES) {
      const { log, meta } = loadFixture(name);
      const replay = indexOf(log, 'replay');
      const live = indexOf(log, 'live');
      expect(replay.kind).toBe('replay');
      expect(replay.logFormat).toBe(1);
      expect(replay.header).toBe(log.header);
      expect(replay.endTick).toBe(eventsOf(log, 'fight.end')[0]!.tick);
      expect(replay.endTick).toBe(meta.durationTicks - 1);
      expect(live.kind).toBe('live');
      expect(live.endTick).toBeNull();
    }
  });

  it('refuses a log that is not full-level (no frames, no start)', () => {
    const { log } = loadFixture('a');
    const noFrames: FightLog = { ...log, events: log.events.filter((e) => e.type !== 'frame') };
    expect(() => indexOf(noFrames)).toThrow(InvariantError);
    const noStart: FightLog = { ...log, events: log.events.filter((e) => e.type !== 'fight.start') };
    expect(() => indexOf(noStart)).toThrow(InvariantError);
  });

  it('exposes the model as one injectable object whose members are the real functions', () => {
    expect(timeline.indexFightLog).toBe(indexFightLog);
    expect(timeline.sampleAt).toBe(sampleAt);
    expect(timeline.eventsBetween).toBe(eventsBetween);
    expect(timeline.decisionAt).toBe(decisionAt);
    expect(timeline.autoPauseStops).toBe(autoPauseStops);
    expect(timeline.keyMoments).toBe(keyMoments);
    expect(timeline.samePrefix).toBe(samePrefix);
  });
});

describe('sampleAt: positions, HP and the round clock', () => {
  const { log, index, ctx } = fixture('a');
  const frames = eventsOf(log, 'frame');

  it('starts at the spawn: ten standing units at full HP, a captain each, no end', () => {
    const s = sampleAt(index, 0, ctx);
    const start = eventsOf(log, 'fight.start')[0]!.data!.units;
    expect(s.units).toHaveLength(10);
    expect(s.tick).toBe(0);
    expect(s.fightSeconds).toBe(0);
    expect(s.ended).toBe(false);
    expect(s.endTick).toBeNull();
    expect(s.overtime).toBe(false);
    expect(s.standing).toEqual({ home: 5, away: 5 });
    for (const u of s.units) {
      const spawn = start[u.unit]!;
      expect(u.standing).toBe(true);
      expect(u.maxHp).toBe(spawn.maxHp);
      expect(u.hp).toBe(spawn.hp);
      expect(u.side).toBe(log.header.units[u.unit]!.side);
    }
    expect(s.captains).toEqual({ home: log.header.units.find((u) => u.side === 0 && u.isCaptain)!.index, away: log.header.units.find((u) => u.side === 1 && u.isCaptain)!.index });
    expect(s.units.filter((u) => u.isCaptain)).toHaveLength(2);
  });

  it('is exact at a frame and linear between two', () => {
    const f = frames[10]!;
    const g = frames[11]!;
    const at = sampleAt(index, f.tick, ctx);
    const mid = sampleAt(index, (f.tick + g.tick) / 2, ctx);
    for (let u = 0; u < 10; u++) {
      const a = f.data!.u[u]!;
      const b = g.data!.u[u]!;
      expect(at.units[u]!.x).toBeCloseTo(a[0], 9);
      expect(at.units[u]!.y).toBeCloseTo(a[1], 9);
      expect(mid.units[u]!.x).toBeCloseTo((a[0] + b[0]) / 2, 9);
      expect(mid.units[u]!.y).toBeCloseTo((a[1] + b[1]) / 2, 9);
    }
  });

  it('steps HP at frame ticks and shows a down at its own tick', () => {
    const f = frames[20]!;
    const between = sampleAt(index, f.tick + 1.5, ctx);
    const at = sampleAt(index, f.tick, ctx);
    for (let u = 0; u < 10; u++) {
      if (!at.units[u]!.standing) continue;
      expect(between.units[u]!.hp).toBe(f.data!.u[u]![2]);
    }
    for (const down of eventsOf(log, 'unit.down')) {
      const u = down.unit!;
      const before = sampleAt(index, down.tick - 0.5, ctx).units[u]!;
      const after = sampleAt(index, down.tick, ctx).units[u]!;
      expect(before.standing).toBe(true);
      expect(after.standing).toBe(false);
      expect(after.hp).toBe(0);
      expect(after.action).toBe('downed');
      expect(after.downedTick).toBe(down.tick);
      expect(after.statuses).toEqual([]);
      expect(after.rule).toBeNull();
    }
  });

  it('ends at fight.end: ended and endTick appear only once reached, and the sample clamps to the round', () => {
    const end = eventsOf(log, 'fight.end')[0]!;
    const before = sampleAt(index, end.tick - 0.5, ctx);
    const at = sampleAt(index, end.tick, ctx);
    const past = sampleAt(index, end.tick + 500, ctx);
    expect(before.ended).toBe(false);
    expect(before.endTick).toBeNull();
    expect(at.ended).toBe(true);
    expect(at.endTick).toBe(end.tick);
    expect(past.tick).toBe(end.tick);
    expect(sampleAt(index, -10, ctx).tick).toBe(0);
    expect(sampleAt(index, Number.NaN, ctx).tick).toBe(0);
    const winnerSide = end.data!.winner;
    expect(at.standing[winnerSide === 0 ? 'home' : 'away']).toBeGreaterThan(0);
  });

  it('turns overtime on at overtime.start (round "long" runs into it)', () => {
    const long = fixture('long');
    const start = eventsOf(long.log, 'overtime.start')[0]!;
    expect(sampleAt(long.index, start.tick - 1, long.ctx).overtime).toBe(false);
    expect(sampleAt(long.index, start.tick, long.ctx).overtime).toBe(true);
    expect(sampleAt(long.index, start.tick, long.ctx).fightSeconds).toBeCloseTo(45, 6);
  });
});

describe('sampleAt: path independence and purity', () => {
  const { index, ctx, meta } = fixture('b');

  it('gives the same state whether reached by playing at 1x, at 4x or by seeking', () => {
    // Ticks are key / 3: 1x playback at 60 fps visits every key, 4x every fourth, a seek any of them in any order.
    const keys = Math.floor(meta.durationTicks * 3);
    const play = (stride: number): Map<number, string> => {
      const seen = new Map<number, string>();
      for (let key = 0; key <= keys; key += stride) seen.set(key, JSON.stringify(sampleAt(index, key / 3, ctx)));
      return seen;
    };
    const x1 = play(1);
    const x4 = play(4);
    expect(x4.size).toBeGreaterThan(300);
    for (const [key, state] of x4) expect(x1.get(key)).toBe(state);
    // Seeking: a fresh index, keys visited in a scrambled order.
    const fresh = indexOf(loadFixture('b').log);
    const order = [...x4.keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = (i * 7919) % (i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    for (const key of order.slice(0, 120)) expect(JSON.stringify(sampleAt(fresh, key / 3, ctx))).toBe(x4.get(key));
  });

  it('returns fresh objects: holding a result across later samples never changes it', () => {
    const held = sampleAt(index, 120, ctx);
    const snapshot = JSON.stringify(held);
    for (let t = 0; t < 300; t += 7.5) sampleAt(index, t, ctx);
    expect(JSON.stringify(held)).toBe(snapshot);
  });
});

describe('no future leaks (review B1)', () => {
  const { log, index, ctx } = fixture('a');
  const endTick = indexOf(log).endTick!;

  it('a log truncated after tick H samples exactly as the full log with knownUntilTick H, on every fixture, whole sample (effects and ages included)', () => {
    let compared = 0;
    for (const name of FIXTURE_NAMES) {
      const f = fixture(name);
      const end = f.index.endTick!;
      const heads = new Set<number>();
      for (let h = 0; h < end; h += name === 'long' ? 23 : 7) heads.add(h);
      // Where a future event could reach back: around every down, and every guard-link or leap that a down may shorten.
      for (const down of eventsOf(f.log, 'unit.down')) for (const d of [-2, -1, 0, 1]) if (down.tick + d >= 0 && down.tick + d < end) heads.add(down.tick + d);
      for (const head of heads) {
        const live = indexOf(truncateLog(f.log, head), 'live');
        const picks = new Set<number>([head, head - 0.5, head - 1, head - 1.7, head - 3, head - 9, head * 0.3, head * 0.6]);
        for (const t of picks) {
          if (t < 0) continue;
          for (const reducedMotion of [false, true]) {
            const full = sampleAt(f.index, t, f.ctx, { knownUntilTick: head, reducedMotion });
            const truncated = sampleAt(live, t, f.ctx, { reducedMotion });
            expect(truncated, name + ': head ' + head + ', tick ' + t + (reducedMotion ? ' (reduced motion)' : '')).toEqual(full);
            compared++;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(5000);
  });

  it('knownUntilTick keeps positions from using a frame after it; without it they interpolate toward the next frame', () => {
    const frames = eventsOf(log, 'frame');
    const f0 = frames.find((f) => f.tick === 100)!;
    const f1 = frames.find((f) => f.tick === 102)!;
    const moving = [...Array(10).keys()].find((u) => f0.data!.u[u]![0] !== f1.data!.u[u]![0])!;
    const held = sampleAt(index, 101, ctx, { knownUntilTick: 101 }).units[moving]!;
    const open = sampleAt(index, 101, ctx).units[moving]!;
    expect(held.x).toBe(f0.data!.u[moving]![0]);
    expect(open.x).toBeCloseTo((f0.data!.u[moving]![0] + f1.data!.u[moving]![0]) / 2, 9);
    // Known up to the next frame: interpolation resumes (no seam at the frame).
    expect(sampleAt(index, 101, ctx, { knownUntilTick: 102 }).units[moving]!.x).toBeCloseTo(open.x, 9);
    // Everything but positions is the same whatever the head.
    const strip = (s: ArenaFrameState) => ({ ...s, units: s.units.map((u) => ({ ...u, x: 0, y: 0, facing: 0 })), effects: s.effects.map((e) => ({ ...e, x: 0, y: 0 })), telegraphs: [], projectiles: [] });
    expect(strip(sampleAt(index, 101, ctx, { knownUntilTick: 101 }))).toEqual(strip(sampleAt(index, 101, ctx)));
  });

  it('a live round reports no end until reached, and none for a head before the end', () => {
    const live = indexOf(truncateLog(log, 300), 'live');
    expect(live.endTick).toBeNull();
    expect(sampleAt(live, 300, ctx).ended).toBe(false);
    expect(sampleAt(live, 300, ctx).endTick).toBeNull();
    // A live log with no end yet is never clamped upward: the caller holds its head, the sample holds the last known state.
    expect(sampleAt(live, 301, ctx).tick).toBe(301);
  });

  it('keyMoments, autoPauseStops and eventsBetween never return a tick past the one asked for, and match a truncated log', () => {
    const full = keyMoments(index, ctx, endTick);
    expect(full.length).toBeGreaterThan(5);
    for (const head of [0, 50, 150, 299, 300, 420, endTick - 1]) {
      const live = indexOf(truncateLog(log, head), 'live');
      const a = keyMoments(index, ctx, head);
      expect(a.every((m) => m.tick <= head)).toBe(true);
      expect(a).toEqual(keyMoments(live, ctx, head));
      expect(a).toEqual(full.filter((m) => m.tick <= head));
      const stops = autoPauseStops(index, ALL_RULES, ctx, head);
      expect(stops.every((s) => s.tick <= head)).toBe(true);
      expect(stops).toEqual(autoPauseStops(live, ALL_RULES, ctx, head));
      const events = eventsBetween(index, 0, head);
      expect(events.every((e) => e.tick <= head)).toBe(true);
      expect(events).toEqual(eventsBetween(live, 0, head));
      for (let u = 0; u < 10; u++) expect(decisionAt(index, u, head)).toEqual(decisionAt(live, u, head));
    }
  });

  it('the end is a key moment only from its tick on', () => {
    expect(keyMoments(index, ctx, endTick - 1).some((m) => m.kind === 'end')).toBe(false);
    const all = keyMoments(index, ctx, endTick);
    expect(all.filter((m) => m.kind === 'end')).toHaveLength(1);
    expect(all[all.length - 1]!.kind).toBe('end');
  });
});

describe('keyMoments', () => {
  it('follow the report selection rules on every fixture (downs, interrupts by someone, saves, rallies, captain events, overtime) plus the end', () => {
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      const expected: Pick<KeyMoment, 'tick' | 'kind'>[] = [];
      for (const ev of log.events) {
        switch (ev.type) {
          case 'unit.down':
            expected.push({ tick: ev.tick, kind: 'down' });
            break;
          case 'cast.interrupt':
            if (ev.data!.by !== null) expected.push({ tick: ev.tick, kind: 'interrupt' });
            break;
          case 'deathward.save':
            expected.push({ tick: ev.tick, kind: 'deathward' });
            break;
          case 'captain.rally':
            expected.push({ tick: ev.tick, kind: 'rally' });
            break;
          case 'captain.down':
            expected.push({ tick: ev.tick, kind: 'captain-down' });
            break;
          case 'captain.handover':
            expected.push({ tick: ev.tick, kind: 'handover' });
            break;
          case 'overtime.start':
            expected.push({ tick: ev.tick, kind: 'overtime' });
            break;
          case 'fight.end':
            expected.push({ tick: ev.tick, kind: 'end' });
            break;
          default:
            break;
        }
      }
      const got = keyMoments(index, ctx, 1e9);
      expect(got.map((m) => ({ tick: m.tick, kind: m.kind }))).toEqual(expected);
      // seq is the event's; the list is in event order.
      for (let i = 1; i < got.length; i++) expect(got[i]!.seq).toBeGreaterThan(got[i - 1]!.seq);
    }
  });

  it('name who did it and to whom: a down is by the killer, to the fallen, with the killing ability', () => {
    const { log, index, ctx } = fixture('a');
    const downs = keyMoments(index, ctx, 1e9).filter((m) => m.kind === 'down');
    const events = eventsOf(log, 'unit.down');
    expect(downs).toHaveLength(events.length);
    downs.forEach((m, i) => {
      expect(m.target).toBe(events[i]!.unit);
      expect(m.unit).toBe(events[i]!.data!.by);
      expect(m.ability).toBe(events[i]!.data!.ability);
    });
  });
});

describe('autoPauseStops', () => {
  const { log, index, ctx } = fixture('b');
  const downs = eventsOf(log, 'unit.down');

  it('stops on our downs, their downs, our captain, overtime, and our HP below a line; the defaults pick the approved ones', () => {
    const end = index.endTick!;
    const own = autoPauseStops(index, { ...DEFAULT_AUTO_PAUSE, overtime: false }, ctx, end).filter((s) => s.reason === 'ownDowned');
    expect(own.map((s) => s.tick)).toEqual(downs.filter((d) => log.header.units[d.unit!]!.side === 0).map((d) => d.tick));
    const enemy = autoPauseStops(index, { ...DEFAULT_AUTO_PAUSE, ownDowned: false, ownCaptainDown: false, overtime: false, enemyDowned: true }, ctx, end);
    expect(enemy.map((s) => [s.reason, s.unit])).toEqual(downs.filter((d) => log.header.units[d.unit!]!.side === 1).map((d) => ['enemyDowned', d.unit]));
    const captain = autoPauseStops(index, { ownDowned: false, enemyDowned: false, ownCaptainDown: true, overtime: false, ownHpBelowPct: null }, ctx, end);
    expect(captain.map((s) => s.tick)).toEqual(eventsOf(log, 'captain.down').filter((e) => log.header.units[e.unit!]!.side === 0).map((e) => e.tick));
    const none = autoPauseStops(index, { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null }, ctx, end);
    expect(none).toEqual([]);
  });

  it('is in tick order, each stop names its triggering event, and overtime stops once', () => {
    const long = fixture('long');
    const stops = autoPauseStops(long.index, ALL_RULES, long.ctx, 1e9);
    for (let i = 1; i < stops.length; i++) expect(stops[i]!.tick).toBeGreaterThanOrEqual(stops[i - 1]!.tick);
    expect(stops.filter((s) => s.reason === 'overtime')).toHaveLength(1);
    const overtime = stops.find((s) => s.reason === 'overtime')!;
    expect(long.log.events.find((e) => e.seq === overtime.seq)!.type).toBe('overtime.start');
    for (const s of stops.filter((x) => x.reason === 'ownDowned' || x.reason === 'enemyDowned')) expect(long.log.events.find((e) => e.seq === s.seq)!.type).toBe('unit.down');
  });

  it('ownHpBelowPct fires once per unit of ours, at the first frame below the line, not for a unit that fell straight to a down', () => {
    const rules: AutoPauseRules = { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: 50 };
    const stops = autoPauseStops(index, rules, ctx, index.endTick!);
    const units = stops.map((s) => s.unit);
    expect(new Set(units).size).toBe(units.length);
    const frames = eventsOf(log, 'frame');
    const spawn = eventsOf(log, 'fight.start')[0]!.data!.units;
    for (const s of stops) {
      expect(log.header.units[s.unit!]!.side).toBe(0);
      const frame = frames.find((f) => f.seq === s.seq)!;
      expect(frame.tick).toBe(s.tick);
      const limit = spawn[s.unit!]!.maxHp * 0.5;
      expect(frame.data!.u[s.unit!]![2]).toBeLessThan(limit);
      expect(frame.data!.u[s.unit!]![2]).toBeGreaterThan(0);
      const earlier = frames.filter((f) => f.tick < s.tick).map((f) => f.data!.u[s.unit!]![2]);
      expect(earlier.every((hp) => hp >= limit)).toBe(true);
    }
  });

  it('a match between other clubs (no player side) has only the overtime stop', () => {
    const long = fixture('long');
    const other = { ...long.ctx, playerSide: null };
    const stops = autoPauseStops(long.index, ALL_RULES, other, 1e9);
    expect(stops.map((s) => s.reason)).toEqual(['overtime']);
  });
});

describe('decisionAt and the rule badge', () => {
  const { log, index, ctx } = fixture('a');

  it('is null before a unit\'s first decision and the latest committed decision from then on', () => {
    for (let u = 0; u < 10; u++) {
      const decides = eventsOf(log, 'unit.decide').filter((e) => e.unit === u);
      expect(decides.length).toBeGreaterThan(0);
      const first = decides[0]!;
      if (first.tick > 0) expect(decisionAt(index, u, first.tick - 1)).toBeNull();
      for (const d of decides.slice(0, 12)) {
        const snap = decisionAt(index, u, d.tick)!;
        const latest = decides.filter((e) => e.tick <= d.tick).pop()!;
        expect(snap.commitTick).toBe(latest.data!.commitTick);
        expect(snap.rule).toBe(latest.data!.rule);
        expect(snap.action).toBe(latest.data!.action);
        expect(snap.targetUnit).toBe(latest.data!.targetUnit);
        expect(snap.reactTicks).toBe(latest.data!.reactTicks);
        expect(snap.reactCauses).toEqual(latest.data!.reactCauses);
        expect(snap.trace).toEqual(latest.data!.trace);
      }
    }
    expect(decisionAt(index, 99, 100)).toBeNull();
  });

  it('labels R1.. for rules, S for the stance, T for a forced decision, and pulses 220 ms from the commit', () => {
    let rules = 0;
    let stances = 0;
    for (const d of eventsOf(log, 'unit.decide')) {
      const u = d.unit!;
      const s = sampleAt(index, d.tick, ctx).units[u]!;
      if (!s.standing) continue;
      const ruleCount = ctx.units[u]!.ruleCount;
      expect(s.rule).not.toBeNull();
      if (d.data!.rule < 0) expect(s.rule!.label).toBe('T');
      else if (d.data!.rule >= ruleCount) {
        expect(s.rule!.label).toBe('S');
        stances++;
      } else {
        expect(s.rule!.label).toBe(`R${d.data!.rule + 1}`);
        rules++;
      }
      expect(s.rule!.sinceTick).toBe(d.tick);
      expect(s.rule!.pulse).toBe(1);
      const later = sampleAt(index, d.tick + 2.2, ctx).units[u]!;
      if (later.rule && later.rule.sinceTick === d.tick) expect(later.rule.pulse).toBeCloseTo(0.5, 6);
      const settled = sampleAt(index, d.tick + 4.4, ctx).units[u]!;
      if (settled.rule && settled.rule.sinceTick === d.tick) expect(settled.rule.pulse).toBeCloseTo(0, 9);
    }
    expect(rules).toBeGreaterThan(0);
    expect(stances).toBeGreaterThan(0);
  });

  it('reduced motion never pulses', () => {
    for (const d of eventsOf(log, 'unit.decide').slice(0, 40)) {
      const s = sampleAt(index, d.tick, ctx, { reducedMotion: true }).units[d.unit!]!;
      if (s.rule) expect(s.rule.pulse).toBe(0);
    }
  });

  it('shows a forced decision as T (synthetic: a taunt decision has rule -1)', () => {
    const { log: base } = loadFixture('a');
    const events = base.events.map((e): FightEvent => (e.type === 'unit.decide' && e.unit === 1 && e.tick > 20 ? { ...e, data: { ...e.data!, rule: -1, action: 'attack' } } : e));
    const forced = indexOf({ ...base, events });
    const first = events.find((e) => e.type === 'unit.decide' && e.unit === 1 && e.tick > 20)!;
    expect(sampleAt(forced, first.tick, ctx).units[1]!.rule!.label).toBe('T');
  });
});

describe('sampleAt: statuses, casts, telegraphs, displacement', () => {
  it('shows a status from its apply to its expire, and clears everything when the unit goes down', () => {
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      const downAt = new Map<number, number>();
      for (const d of eventsOf(log, 'unit.down')) downAt.set(d.unit!, d.tick);
      const applies = eventsOf(log, 'status.apply').filter((e) => e.unit !== undefined && (downAt.get(e.unit) ?? Infinity) > e.tick);
      expect(applies.length).toBeGreaterThan(5);
      for (const e of applies) {
        const def = content.statuses.require(e.data!.status);
        const s = sampleAt(index, e.tick, ctx).units[e.unit!]!;
        const shown = s.statuses.find((x) => x.status === e.data!.status);
        expect(shown, `${name}: ${e.data!.status} on ${e.unit} at ${e.tick}`).toBeDefined();
        expect(shown!.category).toBe(def.category);
        expect(shown!.endsTick).toBeGreaterThanOrEqual(e.tick + e.data!.durationTicks);
        expect(shown!.appliedTick).toBeLessThanOrEqual(e.tick);
      }
      for (const e of eventsOf(log, 'status.expire')) {
        const def = content.statuses.require(e.data!.status);
        if (def.stacking === 'stacks' || def.stacking === 'strongest') continue; // several instances can overlap
        const s = sampleAt(index, e.tick, ctx).units[e.unit!]!;
        expect(s.statuses.find((x) => x.status === e.data!.status), `${name}: ${e.data!.status} on ${e.unit} expired at ${e.tick}`).toBeUndefined();
      }
    }
  });

  it('counts the stacks of instances together only for statuses that stack; one pip per status; the event stack count is kept', () => {
    const { log } = loadFixture('d');
    const apply = (tick: number, status: string, source: number, ability: string, stacks: number) =>
      ({ tick, type: 'status.apply', unit: 0, target: source, data: { status, ability, durationTicks: 40, magnitude: 0.1, stacks, drStep: null } }) as const;
    const extended = withEvents(log, [
      apply(60, 'haste', 5, 'abc_one', 1), // strongest-wins: two sources are not two stacks
      apply(60, 'haste', 6, 'abc_two', 1),
      apply(60, 'bleed', 5, 'abc_one', 1), // stacks: two sources add up
      apply(60, 'bleed', 6, 'abc_two', 2),
      apply(60, 'empower', 5, 'abc_one', 3), // strongest-wins with its own stack count
      apply(70, 'bleed', 5, 'abc_one', 2), // the first source's second stack: a new version of the same instance
    ]);
    const index = indexOf(extended);
    const ctx = makeCtx(extended, content);
    const at = (tick: number) => sampleAt(index, tick, ctx).units[0]!.statuses;
    const pips = at(60);
    expect(pips.filter((s) => s.status === 'haste')).toHaveLength(1);
    expect(pips.find((s) => s.status === 'haste')!.stacks).toBe(1);
    expect(pips.filter((s) => s.status === 'bleed')).toHaveLength(1);
    expect(pips.find((s) => s.status === 'bleed')!.stacks).toBe(3);
    expect(pips.find((s) => s.status === 'empower')!.stacks).toBe(3);
    expect(at(70).find((s) => s.status === 'bleed')!.stacks).toBe(4);
    expect(at(70).find((s) => s.status === 'bleed')!.appliedTick).toBe(60);
    expect(at(70).find((s) => s.status === 'bleed')!.endsTick).toBe(110);
  });

  it('reads hard control as stunned or asleep, and a unit that is displaced as displaced', () => {
    let stunned = 0;
    let displaced = 0;
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const e of eventsOf(log, 'status.apply')) {
        const def = content.statuses.require(e.data!.status);
        const blocks = def.blocks ?? [];
        if (!(blocks.includes('move') && blocks.includes('attack') && blocks.includes('ability'))) continue;
        const s = sampleAt(index, e.tick, ctx).units[e.unit!]!;
        if (!s.standing) continue;
        expect(['stunned', 'asleep']).toContain(s.action);
        expect(s.action).toBe(def.breakOnDamagePct !== undefined ? 'asleep' : 'stunned');
        stunned++;
      }
      for (const e of eventsOf(log, 'displace')) {
        if (e.data!.kind !== 'knockback' && e.data!.kind !== 'pull') continue;
        const s = sampleAt(index, e.tick, ctx).units[e.unit!]!;
        if (s.standing && s.statuses.every((x) => x.category !== 'cc_hard' || (content.statuses.require(x.status).blocks ?? []).length < 3)) {
          expect(s.action).toBe('displaced');
          displaced++;
        }
      }
    }
    expect(stunned).toBeGreaterThan(0);
    expect(displaced).toBeGreaterThan(0);
  });

  it('shows windups, casts and channels with progress, and ends them at their release', () => {
    let casts = 0;
    let channels = 0;
    let windups = 0;
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const e of eventsOf(log, 'cast.start')) {
        if (e.data!.castTicks < 2) continue;
        const u = e.unit!;
        // A cast cut off in its own tick (stunned, interrupted, downed) never shows.
        if (log.events.some((x) => x.tick === e.tick && x.unit === u && (x.type === 'cast.interrupt' || x.type === 'unit.down'))) continue;
        const at = sampleAt(index, e.tick, ctx).units[u]!;
        expect(at.cast?.ability).toBe(e.data!.ability);
        expect(at.cast?.kind).toBe('cast');
        expect(at.cast?.progress).toBe(0);
        expect(at.cast?.startTick).toBe(e.tick);
        expect(at.cast?.endTick).toBe(e.tick + e.data!.castTicks);
        expect(at.action === 'cast' || at.action === 'stunned' || at.action === 'asleep' || at.action === 'downed').toBe(true);
        const mid = sampleAt(index, e.tick + e.data!.castTicks / 2, ctx).units[u]!;
        if (mid.cast) expect(mid.cast.progress).toBeCloseTo(0.5, 6);
        const release = log.events.find((r) => r.type === 'cast.release' && r.unit === u && r.tick === e.tick + e.data!.castTicks);
        if (release) {
          const done = sampleAt(index, e.tick + e.data!.castTicks, ctx).units[u]!;
          expect(done.cast?.kind === 'cast').toBe(false);
        }
        casts++;
      }
      for (const e of eventsOf(log, 'cast.release')) {
        const def = content.abilities.require(e.data!.ability);
        if (!def.channel) continue;
        const s = sampleAt(index, e.tick, ctx).units[e.unit!]!;
        if (!s.standing) continue;
        expect(s.cast?.kind).toBe('channel');
        expect(s.cast?.ability).toBe(def.id);
        expect(s.cast?.endTick).toBe(e.tick + Math.round(def.channel.durationS * 20));
        channels++;
      }
      for (const e of eventsOf(log, 'attack.start').slice(0, 60)) {
        // A windup cancelled in its own tick (a knockback lands) never shows.
        if (log.events.some((x) => x.tick === e.tick && x.unit === e.unit && (x.type === 'attack.cancel' || x.type === 'unit.down'))) continue;
        const s = sampleAt(index, e.tick, ctx).units[e.unit!]!;
        expect(s.cast?.kind).toBe('windup');
        expect(s.cast?.endTick).toBe(e.tick + e.data!.windupTicks);
        windups++;
      }
    }
    expect(casts).toBeGreaterThan(10);
    expect(channels).toBeGreaterThan(0);
    expect(windups).toBeGreaterThan(30);
  });

  it('telegraphs casts and channels of 0.3 s or longer, and every area cast that has any duration, with growing progress', () => {
    let shown = 0;
    const shapes = new Set<string>();
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const e of eventsOf(log, 'cast.start')) {
        if (e.data!.castTicks < 1) continue;
        const cue = cues.ability(e.data!.ability);
        const tele = cue.telegraph;
        const first = sampleAt(index, e.tick, ctx);
        const mine = first.telegraphs.filter((t) => t.caster === e.unit);
        if (!tele || e.data!.castTicks < tele.minTicks) {
          expect(mine).toEqual([]);
          continue;
        }
        const state = first.units[e.unit!]!;
        if (!state.cast || state.cast.ability !== e.data!.ability) continue;
        if (tele.shape === 'single' && (state.cast.target === null || state.cast.target === e.unit)) continue;
        expect(mine).toHaveLength(1);
        const t = mine[0]!;
        expect(t.ability).toBe(e.data!.ability);
        expect(t.shape).toBe(tele.shape);
        expect(t.progress).toBe(0);
        if (tele.shape !== 'single') expect(t.size).toBe(tele.sizeCm);
        expect(t.spread).toBe(tele.spread);
        const later = sampleAt(index, e.tick + Math.min(e.data!.castTicks - 0.5, e.data!.castTicks / 2), ctx).telegraphs.find((x) => x.caster === e.unit && x.ability === t.ability);
        if (later) expect(later.progress).toBeGreaterThan(0);
        shapes.add(t.shape);
        shown++;
      }
    }
    expect(shown).toBeGreaterThan(5);
    expect(shapes.size).toBeGreaterThanOrEqual(2);
  });

  it('faces the committed or cast target; falls back to the last movement', () => {
    const { log, index, ctx } = fixture('a');
    let faced = 0;
    for (const e of eventsOf(log, 'cast.start').slice(0, 20)) {
      if (e.data!.castTicks < 2 || e.target === undefined || e.target === e.unit) continue;
      const s = sampleAt(index, e.tick + 1, ctx);
      const me = s.units[e.unit!]!;
      const them = s.units[e.target]!;
      if (!me.cast || !me.standing || !them.standing) continue;
      expect(me.facing).toBeCloseTo(Math.atan2(them.y - me.y, them.x - me.x), 9);
      faced++;
    }
    expect(faced).toBeGreaterThan(2);
    const s0 = sampleAt(index, 0, ctx);
    for (const u of s0.units) expect(Number.isFinite(u.facing)).toBe(true);
    for (let t = 0; t < index.endTick!; t += 9.5) for (const u of sampleAt(index, t, ctx).units) expect(Number.isFinite(u.facing)).toBe(true);
  });
});

describe('sampleAt: projectiles, zones, captains, hits', () => {
  it('flies a projectile from launch to landing and removes it on landing', () => {
    let seen = 0;
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const e of eventsOf(log, 'projectile.launch').slice(0, 40)) {
        const land = Math.max(e.data!.landTick, e.tick + 1);
        const atLaunch = sampleAt(index, e.tick, ctx).projectiles.find((p) => p.id === e.seq);
        expect(atLaunch).toBeDefined();
        expect(atLaunch!.progress).toBe(0);
        expect(atLaunch!.source).toBe(e.unit);
        expect(atLaunch!.target).toBe(e.target);
        expect(atLaunch!.ability).toBe(e.data!.ability);
        const near = sampleAt(index, land - 0.01, ctx);
        const p = near.projectiles.find((x) => x.id === e.seq)!;
        expect(p.progress).toBeGreaterThan(0.9);
        const t = near.units[e.target!]!;
        expect(Math.hypot(p.x - t.x, p.y - t.y)).toBeLessThan(60);
        expect(sampleAt(index, land, ctx).projectiles.some((x) => x.id === e.seq)).toBe(false);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('keeps a zone from its spawn until it expires (or is replaced or its owner goes down)', () => {
    let seen = 0;
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const e of eventsOf(log, 'zone.spawn')) {
        const z = sampleAt(index, e.tick, ctx).zones.find((x) => x.id === e.seq);
        expect(z, `${name}: zone ${e.seq}`).toBeDefined();
        expect(z!.owner).toBe(e.unit);
        expect(z!.side).toBe(log.header.units[e.unit!]!.side);
        expect(z!.radius).toBe(e.data!.radius);
        expect(z!.ability).toBe(e.data!.ability);
        expect(z!.spawnTick).toBe(e.tick);
        expect(z!.endsTick).not.toBeNull();
        expect(z!.endsTick!).toBeGreaterThan(e.tick);
        seen++;
      }
      for (const e of eventsOf(log, 'zone.expire')) {
        const zones = sampleAt(index, e.tick, ctx).zones.filter((x) => x.owner === e.unit);
        const spawned = eventsOf(log, 'zone.spawn').filter((s) => s.unit === e.unit && s.tick <= e.tick).length;
        const expired = eventsOf(log, 'zone.expire').filter((s) => s.unit === e.unit && s.tick <= e.tick).length;
        expect(zones.length).toBeLessThanOrEqual(spawned - expired);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('moves the crown on captain.down and captain.handover', () => {
    let downs = 0;
    let handovers = 0;
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const e of eventsOf(log, 'captain.down')) {
        const side = log.header.units[e.unit!]!.side;
        const s = sampleAt(index, e.tick, ctx);
        expect(side === 0 ? s.captains.home : s.captains.away).toBeNull();
        expect(s.units[e.unit!]!.isCaptain).toBe(false);
        downs++;
      }
      for (const e of eventsOf(log, 'captain.handover')) {
        const next = e.data!.newCaptain;
        const side = log.header.units[next]!.side;
        const s = sampleAt(index, e.tick, ctx);
        expect(side === 0 ? s.captains.home : s.captains.away).toBe(next);
        expect(s.units[next]!.isCaptain).toBe(true);
        expect(s.units.filter((u) => u.isCaptain && u.side === side)).toHaveLength(1);
        handovers++;
      }
    }
    expect(downs).toBeGreaterThan(0);
    expect(handovers).toBeGreaterThan(0);
  });

  it('records the last hit taken', () => {
    const { log, index, ctx } = fixture('c');
    const hits = eventsOf(log, 'hit').filter((h) => h.target !== undefined);
    for (const h of hits.slice(0, 60)) {
      const s = sampleAt(index, h.tick, ctx).units[h.target!]!;
      expect(s.lastHitTick).toBe(h.tick);
    }
    expect(sampleAt(index, 0, ctx).units.every((u) => u.lastHitTick === null || u.lastHitTick === 0)).toBe(true);
  });
});

describe('sampleAt: effects', () => {
  const kinds = new Set<string>();

  it('draws an impact and a number for every hit, with stable unique ids, and fades them by their lifetime', () => {
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const h of eventsOf(log, 'hit').slice(0, 80)) {
        const s = sampleAt(index, h.tick, ctx);
        const impact = s.effects.find((e) => e.id === h.seq);
        expect(impact, `${name}: impact of hit ${h.seq}`).toBeDefined();
        expect(impact!.kind).toBe('impact');
        expect(impact!.unit).toBe(h.unit);
        expect(impact!.target).toBe(h.target);
        expect(impact!.tone).toBe(h.data!.damageType);
        expect(impact!.crit).toBe(h.data!.crit);
        expect(impact!.age).toBe(0);
        const total = h.data!.amount + h.data!.toShield;
        const number = s.effects.find((e) => e.id === h.seq + COMPANION_ID_OFFSET);
        if (total > 0) {
          expect(number!.kind).toBe('number');
          expect(number!.amount).toBe(total);
          expect(effectEventSeq(number!.id)).toBe(h.seq);
        } else expect(number).toBeUndefined();
        const gone = sampleAt(index, h.tick + EFFECT_LIFETIME_TICKS.impact, ctx);
        expect(gone.effects.some((e) => e.id === h.seq)).toBe(false);
      }
      for (let t = 0; t < index.endTick!; t += 11.3) {
        const s = sampleAt(index, t, ctx);
        const ids = s.effects.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const e of s.effects) {
          expect(e.age).toBeGreaterThanOrEqual(0);
          expect(e.age).toBeLessThanOrEqual(1);
          expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
          kinds.add(e.kind);
        }
      }
    }
  });

  it('covers the effect kinds the events can drive across the fixtures', () => {
    const expected = [
      'swing', 'beam', 'impact', 'number', 'evade', 'heal-pulse', 'shield-gain', 'shield-break', 'status-apply', 'status-resist', 'interrupt', 'dash-trail', 'displace',
      'cleanse', 'dispel', 'guard-link', 'chain-arc', 'splash', 'zone-trigger', 'down', 'deathward', 'captain-down',
    ];
    // The set above was sampled every ~11 ticks; sample every effect event's own tick to see the rarer kinds.
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      const ticks = new Set(log.events.map((e) => e.tick));
      for (const t of ticks) for (const e of sampleAt(index, t, ctx).effects) kinds.add(e.kind);
    }
    for (const kind of expected) expect(kinds.has(kind), `effect kind ${kind} appears`).toBe(true);
    // cooldown-reset and focus-gain have no event in log format 1 and 2: they stay in the vocabulary (cue table) only.
    expect(kinds.has('cooldown-reset')).toBe(false);
    expect(kinds.has('focus-gain')).toBe(false);
  });

  it('anchors a dash trail at where the dash began and a swing or beam at the target', () => {
    const { log, index, ctx } = fixture('d');
    for (const e of eventsOf(log, 'displace').filter((d) => d.data!.kind === 'dash' || d.data!.kind === 'leap')) {
      const fx = sampleAt(index, e.tick, ctx).effects.find((x) => x.id === e.seq)!;
      expect(fx.kind).toBe('dash-trail');
      expect([fx.x, fx.y]).toEqual(e.data!.from);
      expect(fx.unit).toBe(e.unit);
    }
    for (const e of eventsOf(log, 'cast.release')) {
      const cue = cues.ability(e.data!.ability);
      if (cue.release !== 'swing' && cue.release !== 'beam') continue;
      const s = sampleAt(index, e.tick, ctx);
      const fx = s.effects.find((x) => x.id === e.seq)!;
      expect(fx.kind).toBe(cue.release);
      expect(fx.unit).toBe(e.unit);
      expect(fx.target).toBe(e.target);
      expect(fx.ability).toBe(e.data!.ability);
    }
  });

  it('draws a chain as an arc from each target to the next, from the second distinct target on', () => {
    const { log, index, ctx } = fixture('f');
    let arcs = 0;
    for (const release of eventsOf(log, 'cast.release').filter((r) => r.data!.ability === 'thunderhand_chain_lightning')) {
      let last = release.target!;
      const hits = eventsOf(log, 'hit').filter((h) => h.unit === release.unit && h.data!.ability === release.data!.ability && h.tick >= release.tick && h.tick <= release.tick + 40);
      for (const hit of hits) {
        if (hit.target === last) continue;
        const arc = sampleAt(index, hit.tick, ctx).effects.find((e) => e.id === hit.seq + 2 * COMPANION_ID_OFFSET);
        expect(arc?.kind).toBe('chain-arc');
        expect(arc?.unit).toBe(last);
        expect(arc?.target).toBe(hit.target);
        expect(effectEventSeq(arc!.id)).toBe(hit.seq);
        last = hit.target!;
        arcs++;
      }
    }
    expect(arcs).toBeGreaterThan(2);
  });

  it('draws rally and call events from the log (synthetic: the simulator emits neither with default captains yet), and lists them as key moments', () => {
    const { log } = loadFixture('a');
    const extended = withEvents(log, [
      { tick: 100, type: 'captain.rally', unit: 0, data: { composure: 12 } },
      { tick: 120, type: 'call.issue', unit: 0, data: { side: 0, kind: 'focus', target: 7, index: 0 } },
    ]);
    const index = indexOf(extended);
    const ctx = makeCtx(extended, content);
    const rally = sampleAt(index, 100, ctx).effects.find((e) => e.kind === 'rally')!;
    expect(rally.unit).toBe(0);
    const call = sampleAt(index, 120, ctx).effects.find((e) => e.kind === 'call')!;
    expect([call.unit, call.target]).toEqual([0, 7]);
    const moments = keyMoments(index, ctx, 130);
    expect(moments.find((m) => m.kind === 'rally')).toMatchObject({ tick: 100, unit: 0 });
    expect(moments.find((m) => m.kind === 'call')).toMatchObject({ tick: 120, unit: 0, target: 7 });
    expect(sampleAt(index, 99, ctx).effects.some((e) => e.kind === 'rally')).toBe(false);
    expect(sampleAt(index, 100 + EFFECT_LIFETIME_TICKS.rally, ctx).effects.some((e) => e.kind === 'rally')).toBe(false);
  });

  it('reduced motion leaves out the motion-only effects, sets the others at their end state (age 1) and keeps numbers fading in place', () => {
    const { log, index, ctx } = fixture('b');
    let dropped = 0;
    let settled = 0;
    let numbers = 0;
    for (const t of new Set(log.events.map((e) => e.tick))) {
      for (const dt of [0, 2]) {
        const normal = sampleAt(index, t + dt, ctx).effects;
        const reduced = sampleAt(index, t + dt, ctx, { reducedMotion: true }).effects;
        expect(reduced.every((e) => !MOTION_ONLY_EFFECTS.has(e.kind))).toBe(true);
        expect(reduced.map((e) => e.id)).toEqual(normal.filter((e) => !MOTION_ONLY_EFFECTS.has(e.kind)).map((e) => e.id));
        for (const e of reduced) {
          const real = normal.find((n) => n.id === e.id)!;
          expect({ ...e, age: 0 }).toEqual({ ...real, age: 0 });
          if (e.kind === 'number') {
            expect(e.age).toBe(real.age);
            numbers++;
          } else {
            expect(e.age).toBe(1);
            settled++;
          }
        }
        dropped += normal.length - reduced.length;
        // Telegraph progress, projectiles and zones are information: untouched.
        const a = sampleAt(index, t + dt, ctx);
        const b = sampleAt(index, t + dt, ctx, { reducedMotion: true });
        expect(b.telegraphs).toEqual(a.telegraphs);
        expect(b.projectiles).toEqual(a.projectiles);
        expect(b.zones).toEqual(a.zones);
      }
    }
    expect(dropped).toBeGreaterThan(0);
    expect(settled).toBeGreaterThan(50);
    expect(numbers).toBeGreaterThan(50);
  });

  it('gives each effect a fresh id at every event tick, across all fixtures (a guard link no longer shares its event\'s id)', () => {
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const t of new Set(log.events.map((e) => e.tick))) {
        const ids = sampleAt(index, t, ctx).effects.map((e) => e.id);
        expect(new Set(ids).size, name + ' tick ' + t).toBe(ids.length);
      }
    }
    const { log, index, ctx } = fixture('a');
    const release = eventsOf(log, 'cast.release').find((e) => e.data!.ability === 'oathguard_interpose');
    if (release) {
      const guard = sampleAt(index, release.tick, ctx).effects.find((e) => e.kind === 'guard-link');
      if (guard) expect(guard.id).toBe(release.seq + 3 * COMPANION_ID_OFFSET);
    }
  });

  it('names the actor first for an evade, as for an impact, a shield break and a resist: unit = attacker, target = evader', () => {
    let seen = 0;
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      for (const e of eventsOf(log, 'evade')) {
        const fx = sampleAt(index, e.tick, ctx).effects.find((x) => x.id === e.seq)!;
        expect(fx.kind).toBe('evade');
        expect(fx.unit).toBe(e.target ?? null);
        expect(fx.target).toBe(e.unit);
        // The mark sits on the evader.
        const evader = sampleAt(index, e.tick, ctx).units[e.unit!]!;
        expect(Math.hypot(fx.x - evader.x, fx.y - evader.y)).toBeLessThan(1e-6);
        seen++;
      }
      for (const e of eventsOf(log, 'status.resist')) {
        const fx = sampleAt(index, e.tick, ctx).effects.find((x) => x.id === e.seq)!;
        expect([fx.unit, fx.target]).toEqual([e.target ?? null, e.unit]);
      }
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('keeps every effect lifetime within the 400 ms rule (8 ticks) except the down callout, the guard link and the motion streaks', () => {
    const exceptions = new Set(['down', 'guard-link']);
    for (const [kind, ticks] of Object.entries(EFFECT_LIFETIME_TICKS)) {
      if (!exceptions.has(kind)) expect(ticks * 50, kind + ' lifetime in ms').toBeLessThanOrEqual(400);
    }
    expect(EFFECT_LIFETIME_TICKS.down * 50).toBe(2000);
    expect(EFFECT_LIFETIME_TICKS.cleanse * 50).toBe(400);
    expect(EFFECT_LIFETIME_TICKS.dispel * 50).toBe(400);
  });
});

describe('effects that outlive their event: a guard link and a leap\'s landing never read the future', () => {
  const base = loadFixture('a').log;
  const skeleton = skeletonLog(base);
  const down = (tick: number, unit: number): Omit<FightEvent, 'seq'> => ({ tick, type: 'unit.down', unit, target: 5, data: { by: 5, ability: null, hit: 10, overkill: 0, assists: [] } });
  const guardCast: Omit<FightEvent, 'seq'> = { tick: 40, type: 'cast.release', unit: 0, target: 1, data: { ability: 'oathguard_interpose' as never, focusSpent: 0, cooldownTicks: 0 } };

  it('a guard link keeps its age and lifetime whatever happens later, and is dropped from the tick either fighter is down', () => {
    const quiet = withEvents(skeleton, [guardCast]);
    const cut = withEvents(skeleton, [guardCast, down(60, 1)]);
    const quietIdx = indexOf(quiet);
    const cutIdx = indexOf(cut);
    const ctx = makeCtx(quiet, content);
    const life = content.abilities.require('oathguard_interpose').effects.flatMap((e) => (e.type === 'guard' ? [Math.round(e.durationS * 20)] : []))[0]!;
    expect(life).toBe(80);
    for (let t = 40; t < 60; t += 1.5) {
      const a = sampleAt(quietIdx, t, ctx).effects.find((e) => e.kind === 'guard-link')!;
      const b = sampleAt(cutIdx, t, ctx).effects.find((e) => e.kind === 'guard-link')!;
      expect(b.age).toBe(a.age);
      expect(a.age).toBeCloseTo((t - 40) / life, 9);
    }
    expect(sampleAt(quietIdx, 60, ctx).effects.some((e) => e.kind === 'guard-link')).toBe(true);
    expect(sampleAt(cutIdx, 60, ctx).effects.some((e) => e.kind === 'guard-link')).toBe(false);
    expect(sampleAt(cutIdx, 59.9, ctx).effects.some((e) => e.kind === 'guard-link')).toBe(true);
    // The guard going down ends it too.
    const guardDown = indexOf(withEvents(skeleton, [guardCast, down(50, 0)]));
    expect(sampleAt(guardDown, 49, ctx).effects.some((e) => e.kind === 'guard-link')).toBe(true);
    expect(sampleAt(guardDown, 50, ctx).effects.some((e) => e.kind === 'guard-link')).toBe(false);
  });

  it('a leap that strikes an area flashes it where it lands, and not when the leaper is down before landing', () => {
    const release: Omit<FightEvent, 'seq'> = { tick: 100, type: 'cast.release', unit: 0, target: 5, data: { ability: 'chaffcutter_reaping_leap' as never, focusSpent: 0, cooldownTicks: 0 } };
    const leap: Omit<FightEvent, 'seq'> = { tick: 100, type: 'displace', unit: 0, target: 5, data: { kind: 'leap', from: [500, 900], to: [900, 900], ticks: 6 } };
    const landed = withEvents(skeleton, [release, leap]);
    const idx = indexOf(landed);
    const ctx = makeCtx(landed, content);
    const flashes = (t: number) => sampleAt(idx, t, ctx).effects.filter((e) => e.kind === 'splash' && e.ability === 'chaffcutter_reaping_leap');
    expect(flashes(100)).toEqual([]);
    expect(flashes(105.5)).toEqual([]);
    const landing = flashes(106);
    expect(landing).toHaveLength(1);
    expect(landing[0]!.age).toBe(0);
    expect(landing[0]!.unit).toBe(0);
    expect(landing[0]!.target).toBe(5);
    const target = sampleAt(idx, 106, ctx).units[5]!;
    expect([landing[0]!.x, landing[0]!.y]).toEqual([target.x, target.y]);
    expect(flashes(106 + EFFECT_LIFETIME_TICKS.splash)).toEqual([]);
    // The trail is drawn at once; the flash waits for the landing and is dropped when the leaper never lands.
    expect(sampleAt(idx, 100, ctx).effects.some((e) => e.kind === 'dash-trail')).toBe(true);
    const slain = indexOf(withEvents(skeleton, [release, leap, down(103, 0)]));
    expect(sampleAt(slain, 106, ctx).effects.filter((e) => e.kind === 'splash')).toEqual([]);
    expect(sampleAt(slain, 102, ctx).effects.some((e) => e.kind === 'dash-trail')).toBe(true);
    // Effects stay ordered by start (the landing is later than the event after it).
    for (let t = 99; t < 120; t += 0.5) {
      const ids = sampleAt(idx, t, ctx).effects.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('every active ability is visible when released (sampleAt, not just a cue-table entry)', () => {
  it('produces an effect or a projectile at the release of each of the 84 actives, of the kind its cue names', () => {
    const base = skeletonLog(loadFixture('long').log);
    const actives = content.abilities.list.filter((a) => a.kind === 'active');
    expect(actives).toHaveLength(84);
    const spacing = 16;
    const plan = actives.map((def, i) => {
      const tick = 30 + spacing * i;
      const cue = cues.ability(def.id as never);
      const target = def.target === 'self' ? 0 : def.target === 'enemy' ? 5 : 1;
      const events: Omit<FightEvent, 'seq'>[] = [{ tick, type: 'cast.release', unit: 0, target, data: { ability: def.id as never, focusSpent: 0, cooldownTicks: 0 } }];
      if (cue.release === 'projectile') events.push({ tick, type: 'projectile.launch', unit: 0, target: 5, data: { ability: def.id as never, landTick: tick + 8 } });
      if (cue.release === 'dash-trail') events.push({ tick, type: 'displace', unit: 0, target: 5, data: { kind: def.delivery.type === 'leap' ? 'leap' : 'dash', from: [500, 900], to: [900, 900], ticks: 5 } });
      return { def, cue, tick, events };
    });
    const log = withEvents(base, plan.flatMap((p) => p.events));
    const index = indexOf(log);
    const ctx = makeCtx(log, content);
    const expectedKind: Record<string, string | null> = { swing: 'swing', beam: 'beam', 'area-flash': 'splash', 'self-pulse': 'splash', projectile: null, 'dash-trail': 'dash-trail', none: null };
    let visible = 0;
    const kinds = new Map<string, number>();
    for (const p of plan) {
      const s = sampleAt(index, p.tick, ctx);
      const ids = s.effects.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      if (p.cue.release === 'projectile') {
        expect(s.projectiles.some((x) => x.ability === p.def.id), p.def.id + ' projectile').toBe(true);
      } else {
        const want = expectedKind[p.cue.release]!;
        const fx = s.effects.filter((e) => e.kind === want && (want === 'dash-trail' || e.ability === p.def.id));
        expect(fx.length, p.def.id + ' ' + p.cue.release).toBeGreaterThan(0);
      }
      visible++;
      kinds.set(p.cue.release, (kinds.get(p.cue.release) ?? 0) + 1);
    }
    expect(visible).toBe(84);
    expect([...kinds.keys()].sort()).toEqual(['area-flash', 'beam', 'dash-trail', 'projectile', 'self-pulse', 'swing']);
  });
});

describe('unknown ability and status ids are tolerated the same way at index and sample time', () => {
  it('indexes and samples a log whose abilities and statuses the content does not know (no throw, no telegraph, a plain pip)', () => {
    const skeleton = skeletonLog(loadFixture('a').log);
    const ghost = 'no_such_ability' as never;
    const log = withEvents(skeleton, [
      { tick: 20, type: 'cast.start', unit: 0, target: 5, data: { ability: ghost, castTicks: 10 } },
      { tick: 30, type: 'cast.release', unit: 0, target: 5, data: { ability: ghost, focusSpent: 0, cooldownTicks: 0 } },
      { tick: 30, type: 'projectile.launch', unit: 0, target: 5, data: { ability: ghost, landTick: 36 } },
      { tick: 36, type: 'hit', unit: 0, target: 5, data: { ability: ghost, amount: 10, toShield: 0, overkill: 0, damageType: 'physical', crit: false, guardRedirect: false, preMitigation: 10 } },
      { tick: 36, type: 'status.apply', unit: 5, target: 0, data: { status: 'no_such_status', ability: ghost, durationTicks: 20, magnitude: 0, stacks: 1, drStep: null } },
      { tick: 40, type: 'status.expire', unit: 5, data: { status: 'no_such_status' } },
    ]);
    const index = indexOf(log);
    const ctx = makeCtx(log, content);
    const mid = sampleAt(index, 25, ctx);
    expect(mid.units[0]!.cast).toMatchObject({ ability: 'no_such_ability', kind: 'cast', progress: 0.5 });
    expect(mid.telegraphs).toEqual([]);
    expect(sampleAt(index, 33, ctx).projectiles).toHaveLength(1);
    const hit = sampleAt(index, 36, ctx);
    expect(hit.effects.some((e) => e.kind === 'impact' && e.ability === 'no_such_ability')).toBe(true);
    expect(hit.units[5]!.statuses).toEqual([{ status: 'no_such_status', category: 'special', stacks: 1, appliedTick: 36, endsTick: 56 }]);
    expect(sampleAt(index, 40, ctx).units[5]!.statuses).toEqual([]);
  });
});

describe('the test support is held to the pure-half rules', () => {
  it('is scanned by the architecture rules (it is a source file of src/render, not a test file), and they would catch a simulator import in it', () => {
    const files = listSourceFiles('src/render');
    expect(files).toContain('src/render/timeline/support.mts');
    const here = new URL('./support.mts', import.meta.url);
    const text = readFileSync(here, 'utf8');
    expect(checkSource('src/render/timeline/support.mts', text)).toEqual([]);
    expect(checkSource('src/render/timeline/support.mts', text + "\nimport { simulateRound } from '../../core/sim';").map((v) => v.rule)).toEqual(['render-sim-value']);
    expect(checkSource('src/render/timeline/support.mts', text + '\nconst t = performance.now();').map((v) => v.rule)).toEqual(['render-pure']);
    // And nothing under src/render value-imports the simulator: the generator lives in scripts/.
    for (const file of files) expect(checkSource(file, readFileSync(new URL('../../../' + file, import.meta.url), 'utf8')), file).toEqual([]);
  });
});

describe('log format 1 and 2 frames', () => {
  it('format 1 gives null shield and focus; format 2 frames (six elements) give exact values and the same everything else', () => {
    const { log, index, ctx } = fixture('a');
    const s1 = sampleAt(index, 100, ctx);
    for (const u of s1.units) {
      expect(u.shield).toBeNull();
      expect(u.focus).toBeNull();
    }
    // Synthesize format 2: shield = 3 × unit + frame tick, focus = 10 × unit + (tick / 2).
    const events = log.events.map((e): FightEvent => (e.type === 'frame' ? { ...e, data: { u: e.data!.u.map((f, u) => [f[0], f[1], f[2], f[3], 3 * u + e.tick, 10 * u + e.tick / 2]) } } : e));
    const header = { ...log.header, logFormat: 2 };
    const v2 = indexOf({ ...log, header, events });
    expect(v2.logFormat).toBe(2);
    const s2 = sampleAt(v2, 101, ctx);
    for (const u of s2.units) {
      if (!u.standing) continue;
      expect(u.shield).toBe(3 * u.unit + 100);
      expect(u.focus).toBe(10 * u.unit + 50);
    }
    const strip = (s: ArenaFrameState) => ({ ...s, units: s.units.map((u) => ({ ...u, shield: null, focus: null })) });
    expect(strip(sampleAt(v2, 150.5, ctx))).toEqual(strip(sampleAt(index, 150.5, ctx)));
    // A downed unit shows no shield.
    const down = eventsOf(log, 'unit.down')[0]!;
    expect(sampleAt(v2, down.tick, ctx).units[down.unit!]!.shield).toBe(0);
  });

  it('copes with frames that miss a unit and with a log whose first frame is after tick 0', () => {
    const { log, ctx } = fixture('a');
    const later = log.events.filter((e) => !(e.type === 'frame' && e.tick < 4));
    const idx = indexOf({ ...log, events: later });
    const s = sampleAt(idx, 1, ctx);
    const spawn = eventsOf(log, 'fight.start')[0]!.data!.units;
    expect(s.units[3]!.hp).toBe(spawn[3]!.hp);
    expect(s.units[3]!.x).toBeGreaterThan(0);
    const holes = log.events.map((e): FightEvent => (e.type === 'frame' && e.tick === 20 ? { ...e, data: { u: e.data!.u.slice(0, 7) } } : e));
    const s2 = sampleAt(indexOf({ ...log, events: holes }), 20, ctx);
    expect(s2.units).toHaveLength(10);
    expect(s2.units[8]!.x).toBeGreaterThan(0);
  });
});

describe('eventsBetween and samePrefix', () => {
  const { log, index } = fixture('c');

  it('returns events with from < tick ≤ to, in seq order', () => {
    const got = eventsBetween(index, 100, 130);
    expect(got.every((e) => e.tick > 100 && e.tick <= 130)).toBe(true);
    expect(got).toEqual(log.events.filter((e) => e.tick > 100 && e.tick <= 130));
    for (let i = 1; i < got.length; i++) expect(got[i]!.seq).toBeGreaterThan(got[i - 1]!.seq);
    expect(eventsBetween(index, 130, 130)).toEqual([]);
    expect(eventsBetween(index, 130, 100)).toEqual([]);
    expect(eventsBetween(index, -5, 0).every((e) => e.tick === 0)).toBe(true);
    // A walk in 1x frames covers every event exactly once.
    let count = 0;
    for (let t = -1; t < index.endTick!; t += 1.7) count += eventsBetween(index, t, Math.min(t + 1.7, index.endTick!)).length;
    expect(count).toBe(log.events.length - eventsBetween(index, -1, -1).length - log.events.filter((e) => e.tick < 0).length);
  });

  it('samePrefix: a log extended after the tick matches; a changed event or header at or before it does not', () => {
    const cut = 200;
    const extended: FightLog = {
      ...log,
      events: log.events.map((e): FightEvent => (e.tick > cut && e.type === 'hit' ? { ...e, data: { ...e.data!, amount: e.data!.amount + 1 } } : e)),
    };
    const next = indexOf(extended);
    expect(samePrefix(index, next, cut)).toBe(true);
    expect(samePrefix(index, next, cut + 400)).toBe(false);
    expect(samePrefix(index, index, 99999)).toBe(true);
    const victim = log.events.find((e) => e.type === 'hit' && e.tick > 100)!;
    const broken: FightLog = { ...log, events: log.events.map((e): FightEvent => (e === victim && e.type === 'hit' ? { ...e, data: { ...e.data!, amount: e.data!.amount + 1 } } : e)) };
    expect(samePrefix(index, indexOf(broken), victim.tick + 10)).toBe(false);
    expect(samePrefix(index, indexOf(broken), victim.tick)).toBe(false);
    expect(samePrefix(index, indexOf(broken), victim.tick - 1)).toBe(true);
    const otherSeed: FightLog = { ...log, header: { ...log.header, seed: 'other' } };
    expect(samePrefix(index, indexOf(otherSeed), 10)).toBe(false);
    const fewer = indexOf(truncateLog(log, 100));
    expect(samePrefix(index, fewer, 100)).toBe(true);
    expect(samePrefix(index, fewer, 101)).toBe(false);
  });
});

describe('sampleAt on every fixture: invariants at every half tick', () => {
  it('keeps HP in range, positions inside the arena, finite numbers, and standing counts consistent', () => {
    for (const name of FIXTURE_NAMES) {
      const { log, index, ctx } = fixture(name);
      const arena = log.header.arena;
      let prevStanding = { home: 5, away: 5 };
      for (let t = 0; t <= index.endTick!; t += 0.5) {
        const s = sampleAt(index, t, ctx);
        expect(s.units).toHaveLength(10);
        for (const u of s.units) {
          expect(u.hp).toBeGreaterThanOrEqual(0);
          expect(u.hp).toBeLessThanOrEqual(u.maxHp);
          expect(u.x).toBeGreaterThanOrEqual(-1);
          expect(u.x).toBeLessThanOrEqual(arena.width + 1);
          expect(u.y).toBeGreaterThanOrEqual(-1);
          expect(u.y).toBeLessThanOrEqual(arena.height + 1);
          expect(Number.isFinite(u.facing)).toBe(true);
          expect(u.standing).toBe(u.hp > 0 || !log.events.some((e) => e.type === 'unit.down' && e.unit === u.unit && e.tick <= t));
          if (!u.standing) expect(u.action).toBe('downed');
          if (u.cast) {
            expect(u.cast.progress).toBeGreaterThanOrEqual(0);
            expect(u.cast.progress).toBeLessThanOrEqual(1);
          }
        }
        const home = s.units.filter((u) => u.side === 0 && u.standing).length;
        const away = s.units.filter((u) => u.side === 1 && u.standing).length;
        expect(s.standing).toEqual({ home, away });
        expect(s.standing.home).toBeLessThanOrEqual(prevStanding.home);
        expect(s.standing.away).toBeLessThanOrEqual(prevStanding.away);
        prevStanding = s.standing;
      }
    }
  });
});

describe('golden snapshots', () => {
  it('pins the state of fixture "a" at tick 0 and at its first down (positions rounded)', () => {
    const { log, index, ctx } = fixture('a');
    const round = (n: number): number => Math.round(n * 10) / 10;
    const digest = (s: ArenaFrameState) => ({
      tick: s.tick,
      standing: s.standing,
      captains: s.captains,
      units: s.units.map((u) => [u.unit, round(u.x), round(u.y), u.hp, u.action, u.rule?.label ?? null, u.statuses.map((x) => x.status).join('+')]),
      effects: s.effects.map((e) => `${e.kind}:${e.unit}>${e.target}`),
    });
    const first = eventsOf(log, 'unit.down')[0]!;
    const snapshot = { start: digest(sampleAt(index, 0, ctx)), firstDown: { tick: first.tick, unit: first.unit, state: digest(sampleAt(index, first.tick, ctx)) } };
    expect(snapshot).toMatchSnapshot();
  });
});
