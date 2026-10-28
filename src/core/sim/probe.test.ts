/**
 * inspectRoundAt (05-technical-m2 §A5, tech-022; WP-M2A): the pause inspector's probe. Read-only, consistent with the
 * frames and with the traces the sim itself records, and it reports why a unit cannot decide. Also the calls refusal.
 */
import { describe, expect, it, vi } from 'vitest';
import { loadContent, type ContentDB, type ContentFileName, type RawContentFiles } from '../content';
import type { FightEvent, FightLog, RoundCalls } from '../model';
import type * as TacticsModule from '../tactics';
import { InvariantError } from '../util';
import { corpusRound } from './corpus';
import { inspectRoundAt, simulateRound, type UnitProbe } from './index';

// Record every traced evaluation the sim makes (tick, unit, decision, trace); the probe must reproduce them.
const recorded = vi.hoisted(() => ({ on: false, calls: [] as { tick: number; unit: number; rule: number; action: string; target: number | null; trace: unknown[] }[] }));
vi.mock('../tactics', async (importOriginal) => {
  const orig = await importOriginal<typeof TacticsModule>();
  return {
    ...orig,
    evaluateTactics: (...args: Parameters<typeof orig.evaluateTactics>) => {
      const result = orig.evaluateTactics(...args);
      if (recorded.on) {
        const d = result.decision;
        recorded.calls.push({ tick: args[1].fightTicks, unit: args[2], rule: d.rule, action: d.action === 'ability' ? `ability:${d.slot}` : d.action, target: d.target, trace: result.trace });
      }
      return result;
    },
  };
});

const rawFiles = import.meta.glob('../../../content/default/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

function loadDefault(): ContentDB {
  const raw: RawContentFiles = {};
  for (const [path, json] of Object.entries(rawFiles)) raw[path.split('/').pop()!.replace(/\.json$/, '') as ContentFileName] = json;
  const r = loadContent('default', raw);
  if (!r.ok) throw new Error(`content/default invalid: ${r.error.map((e) => e.message).join('; ')}`);
  return r.value;
}

const content = loadDefault();
const corpus = Array.from({ length: 12 }, (_, i) => corpusRound(content, i));
const full = corpus.map(({ input, seed }) => simulateRound(input, seed, content, { record: 'full' }));

type Frame = Extract<FightEvent, { type: 'frame' }>;
const framesOf = (log: FightLog): Frame[] => log.events.filter((e): e is Frame => e.type === 'frame');
const probeAt = (i: number, tick: number) => inspectRoundAt(corpus[i]!.input, corpus[i]!.seed, content, tick);

describe('inspectRoundAt: state is the frame at that tick', () => {
  it('hp, shield, focus and standing equal the full log frame of the same tick (all frames of several rounds, the closing frame included)', () => {
    let checked = 0;
    for (const i of [0, 4, 9]) {
      const frames = framesOf(full[i]!.log!);
      // Every 5th frame, plus the first and the closing frame.
      const picks = frames.filter((_, k) => k % 5 === 0 || k === frames.length - 1);
      for (const frame of picks) {
        const probe = probeAt(i, frame.tick);
        expect(probe.tick).toBe(frame.tick);
        expect(probe.units).toHaveLength(10);
        frame.data!.u.forEach((fu, u) => {
          const p = probe.units[u]!;
          expect(p.unit).toBe(u);
          expect([p.hp, p.shield, p.focus, p.standing]).toEqual([fu[2], fu[4], fu[5], (fu[3] & 16) === 0]);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('inspectRoundAt: evaluations are the sim\'s own', () => {
  it('reproduces every sampled traced evaluation the sim made at the tick it made it (decision, rule, target and the whole trace)', () => {
    let compared = 0;
    for (let i = 0; i < corpus.length; i++) {
      recorded.calls = [];
      recorded.on = true;
      simulateRound(corpus[i]!.input, corpus[i]!.seed, content, { record: 'none' });
      recorded.on = false;
      const calls = recorded.calls;
      // Group by tick; probe every 6th distinct tick (a probe is one partial round).
      const ticks = [...new Set(calls.map((c) => c.tick))].filter((t) => t >= 1);
      for (const tick of ticks.filter((_, k) => k % 6 === 0)) {
        const probe = probeAt(i, tick - 1);
        for (const c of calls.filter((x) => x.tick === tick)) {
          const ev = probe.units[c.unit]!.evaluation;
          expect(ev, `round ${i} unit ${c.unit} tick ${tick}`).not.toBeNull();
          expect(ev).toEqual({ rule: c.rule, action: c.action, target: c.target, trace: c.trace });
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(200);
  });

  it('every decision traced into the log was evaluated at some tick of its reaction window, and the probe gives that trace there', () => {
    let compared = 0;
    let immediate = 0;
    for (let i = 0; i < corpus.length; i++) {
      const decisions = full[i]!.log!.events.filter((e): e is Extract<FightEvent, { type: 'unit.decide' }> => e.type === 'unit.decide' && e.data!.rule >= 0 && e.tick >= 1);
      for (const e of decisions.filter((d, k) => k % 7 === 0 || d.data!.reactTicks === 0)) {
        // The trace is the evaluation of the tick the decision started waiting out its reaction delay, or of a later
        // one that replaced it before the commit: some tick in [commit - reactTicks, commit].
        let found = -1;
        for (let t = e.tick - e.data!.reactTicks; t <= e.tick && found < 0; t++) {
          if (t < 1) continue;
          const ev = probeAt(i, t - 1).units[e.unit!]!.evaluation;
          if (ev && ev.rule === e.data!.rule && ev.action === e.data!.action && ev.target === e.data!.targetUnit && JSON.stringify(ev.trace) === JSON.stringify(e.data!.trace)) found = t;
        }
        // The opening evaluations are made at tick 0, before any tick has ended: there is nothing to probe there.
        if (found < 0 && e.tick - e.data!.reactTicks === 0) continue;
        expect(found, `round ${i} unit ${e.unit} commit tick ${e.tick} (reaction ${e.data!.reactTicks})`).toBeGreaterThanOrEqual(0);
        if (e.data!.reactTicks === 0) {
          expect(found).toBe(e.tick);
          immediate++;
        }
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(80);
    expect(immediate).toBeGreaterThan(0);
  });

  it('every evaluation is a well-formed trace: the chosen rule (or the stance) is the last entry, fired; earlier ones are skipped with a reason', () => {
    let seen = 0;
    for (const i of [1, 5, 8]) {
      const end = full[i]!.result.durationTicks - 1;
      for (let tick = 3; tick < end; tick += 29) {
        for (const p of probeAt(i, tick).units) {
          if (!p.evaluation) continue;
          const trace = p.evaluation.trace;
          const last = trace[trace.length - 1]!;
          expect(last.fired).toBe(true);
          expect(last.rule).toBe(p.evaluation.rule);
          expect(trace.slice(0, -1).every((t) => !t.fired && t.skip !== null)).toBe(true);
          seen++;
        }
      }
    }
    expect(seen).toBeGreaterThan(100);
  });
});

describe('inspectRoundAt: why a unit cannot decide', () => {
  it('evaluation is null exactly when blockedBy is set, and each reason matches the unit\'s state', () => {
    const reasons = new Map<string, number>();
    for (const i of [0, 2, 6, 10]) {
      const end = full[i]!.result.durationTicks - 1;
      for (let tick = 0; tick < end; tick += 7) {
        for (const p of probeAt(i, tick).units) {
          expect(p.evaluation === null).toBe(p.blockedBy !== null);
          if (p.blockedBy) reasons.set(p.blockedBy, (reasons.get(p.blockedBy) ?? 0) + 1);
          expect(p.blockedBy === 'downed').toBe(!p.standing);
          const has = (s: string) => p.statuses.some((x) => x.status === s && x.ticksLeft >= 1);
          if (p.blockedBy === 'stunned') expect(has('stun')).toBe(true);
          if (p.blockedBy === 'asleep') expect(has('sleep')).toBe(true);
          if (p.blockedBy === 'taunted') expect(has('taunt')).toBe(true);
          if (p.blockedBy === 'casting' || p.blockedBy === 'winding_up' || p.blockedBy === 'channelling') expect(p.committed).not.toBeNull();
        }
      }
    }
    for (const reason of ['downed', 'winding_up', 'casting']) expect(reasons.get(reason) ?? 0, reason).toBeGreaterThan(0);
  });

  it('reports hp, cooldowns, statuses, committed and pending decisions of the unit (shapes and ranges)', () => {
    const p = probeAt(3, 150);
    expect(p.tick).toBe(150);
    for (const u of p.units as UnitProbe[]) {
      expect(u.hp).toBeLessThanOrEqual(u.maxHp);
      expect(u.cooldownTicks.a1).toBeGreaterThanOrEqual(0);
      expect(u.cooldownTicks.a2).toBeGreaterThanOrEqual(0);
      for (const s of u.statuses) expect(s.ticksLeft).toBeGreaterThanOrEqual(1);
      if (u.pending) expect(u.pending.commitTick).toBeGreaterThanOrEqual(150 - 40);
      if (!u.standing) expect([u.hp, u.shield, u.committed, u.pending]).toEqual([0, 0, null, null]);
    }
  });

  it('after a cast.release the used slot is on cooldown, and the cooldown runs down with the ticks', () => {
    let checked = 0;
    for (let i = 0; i < corpus.length && checked < 12; i++) {
      const input = corpus[i]!.input;
      for (const e of full[i]!.log!.events) {
        if (e.type !== 'cast.release' || e.data!.cooldownTicks < 60 || e.tick < 2) continue;
        const side = e.unit! < 5 ? input.home : input.away;
        const f = side.fighters[e.unit! % 5]!;
        const k = content.classes.require(f.classId);
        const slot = k.abilities.a1 === e.data!.ability ? 'a1' : k.abilities.a2 === e.data!.ability ? 'a2' : null;
        if (slot === null) continue;
        const at = probeAt(i, e.tick).units[e.unit!]!;
        const later = probeAt(i, e.tick + 6).units[e.unit!]!;
        if (!at.standing || !later.standing) continue;
        expect(at.cooldownTicks[slot]).toBeGreaterThan(0);
        expect(later.cooldownTicks[slot]).toBeLessThanOrEqual(at.cooldownTicks[slot]);
        checked++;
        break;
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe('inspectRoundAt: read-only', () => {
  it('probes change no later result: the same round simulates to the same checksum and log hash after many probes, on the same content', () => {
    const { input, seed } = corpus[7]!;
    const snapshot = JSON.stringify(input);
    const before = simulateRound(input, seed, content, { record: 'full' });
    for (const tick of [0, 1, 2, 50, 51, 130, 260, 400, 5000]) inspectRoundAt(input, seed, content, tick);
    // Probing other rounds in between must not matter either (shared compiled tables and kit caches).
    for (const i of [0, 3, 5]) probeAt(i, 200);
    const after = simulateRound(input, seed, content, { record: 'full' });
    expect(after.result).toEqual(before.result);
    expect(after.log!.hash).toBe(before.log!.hash);
    expect(after.log!.events).toEqual(before.log!.events);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('is repeatable: the same probe twice gives equal results', () => {
    for (const tick of [0, 37, 200]) expect(probeAt(2, tick)).toEqual(probeAt(2, tick));
  });
});

describe('inspectRoundAt: edges', () => {
  it('a tick at or beyond the end gives the final state at the end tick, with nothing left to decide', () => {
    const run = full[5]!;
    const endTick = run.result.durationTicks - 1;
    for (const tick of [endTick, endTick + 1, endTick + 500]) {
      const p = probeAt(5, tick);
      expect(p.tick).toBe(endTick);
      p.units.forEach((u, i) => {
        expect(u.hp).toBe(run.result.finalHp[i]);
        expect(u.evaluation).toBeNull();
        expect(u.blockedBy).toBe(u.standing ? 'round_over' : 'downed');
      });
    }
  });

  it('floors fractional ticks, clamps negatives to 0 and refuses a tick that is not a number', () => {
    expect(probeAt(1, 10.9)).toEqual(probeAt(1, 10));
    expect(probeAt(1, -4)).toEqual(probeAt(1, 0));
    expect(() => probeAt(1, Number.NaN)).toThrow(InvariantError);
    expect(() => probeAt(1, Number.POSITIVE_INFINITY)).toThrow(InvariantError);
  });
});

describe('call plans are refused until the calls package (P-01 staged after M2)', () => {
  const { input, seed } = corpus[0]!;
  const plans: [string, RoundCalls][] = [
    ['policy for home', { home: { mode: 'policy' }, away: { mode: 'none' } }],
    ['policy for away', { home: { mode: 'none' }, away: { mode: 'policy' } }],
    ['an explicit plan, even with no calls', { home: { mode: 'explicit', calls: [] }, away: { mode: 'none' } }],
    ['an explicit plan with a call', { home: { mode: 'none' }, away: { mode: 'explicit', calls: [{ tick: 40, kind: 'focus', target: 2 }] } }],
  ];

  it.each(plans)('simulateRound and inspectRoundAt refuse %s', (_name, calls) => {
    expect(() => simulateRound({ ...input, calls }, seed, content)).toThrow(InvariantError);
    expect(() => simulateRound({ ...input, calls }, seed, content, { record: 'full' })).toThrow(/call plans are not available/);
    expect(() => inspectRoundAt({ ...input, calls }, seed, content, 30)).toThrow(InvariantError);
  });

  it('accepts no plan and { none, none }, with results identical to the round without the field', () => {
    const plain = simulateRound(input, seed, content, { record: 'full' });
    const none = simulateRound({ ...input, calls: { home: { mode: 'none' }, away: { mode: 'none' } } }, seed, content, { record: 'full' });
    expect(none.result).toEqual(plain.result);
    expect(none.log!.hash).toBe(plain.log!.hash);
    expect(inspectRoundAt({ ...input, calls: { home: { mode: 'none' }, away: { mode: 'none' } } }, seed, content, 30)).toEqual(inspectRoundAt(input, seed, content, 30));
  });
});
