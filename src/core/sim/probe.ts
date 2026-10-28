/**
 * M2 pause inspector probe (P-22, tech-022): `inspectRoundAt`. Re-simulates a round to the end of a tick at record
 * 'none' on a fresh Fight, reads every unit's state and runs a traced evaluation of every rule list against the state
 * the sim's next decision phase sees. It never touches the caller's data and never draws from a shared stream (the
 * fight owns its seeded streams), so it cannot change a later result.
 */
import type { ContentDB } from '../content';
import type { RoundInput } from '../model';
import type { Seed } from '../rng';
import { InvariantError } from '../util';
import { decisionAction, probeDecisions } from './act';
import { Fight } from './fight';
import type { RoundProbe, UnitProbe } from './index';
import { refuseCalls } from './match';
import { BP, ST } from './tables';

/** `blockedBy` of every unit once the round is over: the downed stay 'downed', the survivors have nothing left to decide. */
const ROUND_OVER = 'round_over';

export function probeRound(input: RoundInput, roundSeed: Seed, content: ContentDB, tick: number): RoundProbe {
  refuseCalls(input);
  if (!Number.isFinite(tick)) throw new InvariantError(`sim: inspectRoundAt tick ${String(tick)} is not a number`);
  const want = Math.max(0, Math.floor(tick));
  const f = new Fight(content, { seed: roundSeed, round: input.round, home: input.home, away: input.away }, 'none');
  f.runThrough(want);
  const over = f.ended;
  const at = over ? f.durationTicks - 1 : want;

  // State at the end of `at`, exactly what a frame at that tick shows.
  const units: UnitProbe[] = f.units.map((u) => {
    const [, , , , shield, focus] = f.frameUnit(u, at);
    const cdTicks = (cd: number): number => (cd <= 0 ? 0 : Math.ceil(cd / (BP + u.mods[ST.cooldownRate]!)));
    return {
      unit: u.index,
      standing: u.standing,
      hp: u.hp,
      maxHp: u.maxHp,
      shield,
      focus,
      cooldownTicks: { a1: cdTicks(u.cdA1), a2: cdTicks(u.cdA2) },
      statuses: u.statuses.filter((s) => s.end > at).map((s) => ({ status: s.st.id, ticksLeft: s.end - at, stacks: s.stacks, source: s.source >= 0 ? s.source : null })),
      committed: u.standing && u.committed ? { rule: u.committed.rule, action: decisionAction(u.committed), target: u.committed.target } : null,
      pending: u.standing && u.pending ? { rule: u.pending.decision.rule, action: decisionAction(u.pending.decision), target: u.pending.decision.target, commitTick: u.pending.commitAt } : null,
      evaluation: null,
      blockedBy: u.standing ? null : 'downed',
    };
  });
  if (over) {
    for (const p of units) if (p.standing) p.blockedBy = ROUND_OVER;
    return { tick: at, evaluatedTick: at + 1, units };
  }

  // The evaluation: the sim's next decision phase (tick `at` + 1: its timers, then the decisions), one unit at a time.
  f.beginTick();
  f.timers();
  const decided = probeDecisions(f);
  for (const p of units) {
    const d = decided[p.unit]!;
    p.blockedBy = d.blockedBy;
    p.evaluation = d.evaluation;
  }
  return { tick: at, evaluatedTick: at + 1, units };
}
