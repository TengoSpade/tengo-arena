/**
 * STAND-IN for core/sim (WP1): a seeded rating-weighted coin per round. It
 * honours the sim contract (bestOf, never drawn, identical outcome at every
 * record level, summary logs with fight.start / unit.down / fight.end) so
 * reports and determinism checks can be exercised. Not the fight engine.
 */
import type { ContentDB } from '../../content';
import type { MatchOutput, RoundOutput, SimOptions } from '../../sim';
import {
  FIGHT_LOG_FORMAT,
  hashEventStream,
  type FightEvent,
  type FightHeader,
  type FightLog,
  type FighterId,
  type FighterMatchStats,
  type MatchInput,
  type RoundAftermath,
  type RoundInput,
  type RoundResult,
} from '../../model';
import { Rng, deriveSeed, type Seed } from '../../rng';
import { clamp, hashString, stableStringify } from '../../util';
import type { GamePorts } from '../ports';

export const STAND_IN_ENGINE_VERSION = 9000;

function emptyStats(clubId: string, rounds: number): FighterMatchStats {
  return {
    clubId: clubId as FighterMatchStats['clubId'],
    roundsPlayed: rounds,
    roundsSurvived: 0,
    ticksOnArena: 0,
    damageDealt: 0,
    damageToShields: 0,
    damageTaken: 0,
    healingDone: 0,
    shieldingDone: 0,
    overheal: 0,
    ccAppliedTicks: 0,
    ccReceivedTicks: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    assists: 0,
    focusSpent: 0,
    casts: {},
    ruleFires: [0],
    ruleCommittedTicks: [0],
    rulesNeverFired: [0],
    downs: [],
    opponentIds: [],
  };
}

/** Summary-level log of one stand-in round (fight.start, one down, fight.end, round.summary). */
function roundLog(content: ContentDB, seed: string, n: number, home: MatchInput['home'], away: MatchInput['away'], winner: 'home' | 'away', durationTicks: number): FightLog {
  const input = { home, away };
  const all = [...home.fighters, ...away.fighters];
  const header: FightHeader = {
    format: FIGHT_LOG_FORMAT,
    engineVersion: STAND_IN_ENGINE_VERSION,
    contentHash: content.ref.hash,
    seed,
    round: n,
    tickMs: 50,
    frameEvery: 2,
    arena: { width: 3200, height: 1800 },
    units: all.map((f, i) => ({
      index: i,
      side: i < 5 ? 0 : 1,
      fighterId: f.fighterId,
      clubId: i < 5 ? input.home.clubId : input.away.clubId,
      classId: f.classId,
      slot: f.slot,
      row: f.row,
      isCaptain: i === input.home.captainIndex || i === 5 + input.away.captainIndex,
    })),
  };
  const loser = winner === 'home' ? 5 : 0;
  const events: FightEvent[] = [
    { seq: 0, tick: 0, type: 'fight.start', data: { units: [] } },
    { seq: 1, tick: Math.trunc(durationTicks / 2), type: 'unit.down', unit: loser, data: { by: winner === 'home' ? 0 : 5, ability: null, hit: 100, overkill: 0, assists: [] } },
    { seq: 2, tick: durationTicks, type: 'fight.end', data: { winner: winner === 'home' ? 0 : 1, reason: 'elimination', tiebreakStep: null } },
    {
      seq: 3,
      tick: durationTicks,
      type: 'round.summary',
      data: {
        units: all.map((_, i) => ({
          unit: i,
          damageDealt: 0,
          damageToShields: 0,
          damageTaken: 0,
          healingDone: 0,
          shieldingDone: 0,
          overheal: 0,
          ccAppliedTicks: 0,
          ccReceivedTicks: 0,
          downsInflicted: 0,
          assists: 0,
          focusSpent: 0,
          casts: {},
          ruleFires: [1, 0],
          ruleCommittedTicks: [durationTicks, 0],
          ruleSkips: [{}, { no_target: 1 }],
          stanceTicks: 0,
        })),
      },
    },
  ];
  return { header, events, hash: hashEventStream(header, events) };
}

function simulateMatch(input: MatchInput, content: ContentDB, options?: SimOptions): MatchOutput {
  const need = Math.trunc(input.bestOf / 2) + 1;
  const strength = (side: MatchInput['home']): number => side.fighters.reduce((s, f) => s + f.rating, 0);
  const pHome = clamp(5000 + (strength(input.home) - strength(input.away)) * 40, 1500, 8500);
  const rounds: RoundResult[] = [];
  const logs: FightLog[] = [];
  const score = { home: 0, away: 0 };
  const all = [...input.home.fighters, ...input.away.fighters];
  while (score.home < need && score.away < need) {
    const n = rounds.length + 1;
    const seed = deriveSeed(input.seed, 'round', n);
    const rng = Rng.create(seed, 'stand-in');
    const winner = rng.chanceBp(pHome) ? 'home' : 'away';
    score[winner]++;
    const survivors = rng.int(1, 5);
    const durationTicks = rng.int(300, 1200);
    const finalHp = all.map((_, i) => ((i < 5) === (winner === 'home') && i % 5 < survivors ? 100 : 0));
    const core = { round: n, winner, durationTicks, survivors, finalHp };
    const round: RoundResult = {
      round: n,
      seed,
      winner,
      endReason: 'elimination',
      tiebreakStep: null,
      durationTicks,
      survivors: { home: winner === 'home' ? survivors : 0, away: winner === 'away' ? survivors : 0 },
      downs: { home: winner === 'home' ? 5 - survivors : 5, away: winner === 'away' ? 5 - survivors : 5 },
      finalHp,
      checksum: hashString(stableStringify(core)),
      eventHash: null,
    };
    if (options?.record && options.record !== 'none') {
      const log = roundLog(content, seed, n, input.home, input.away, winner, durationTicks);
      if (options.record === 'full') round.eventHash = log.hash;
      logs.push(log);
    }
    rounds.push(round);
  }
  const fighterStats: Record<FighterId, FighterMatchStats> = {};
  for (const f of input.home.fighters) fighterStats[f.fighterId] = emptyStats(input.home.clubId, rounds.length);
  for (const f of input.away.fighters) fighterStats[f.fighterId] = emptyStats(input.away.clubId, rounds.length);
  const won = score.home > score.away ? input.home : input.away;
  const mvp = [...won.fighters].sort((a, b) => b.rating - a.rating || (a.fighterId < b.fighterId ? -1 : 1))[0];
  return {
    rounds,
    score,
    winner: score.home > score.away ? 'home' : 'away',
    fighterStats,
    mvpFighterId: mvp?.fighterId ?? null,
    logs: options?.record && options.record !== 'none' ? logs : null,
  };
}

/**
 * One round as a seeded rating coin (M1.1 orchestrator runs): strength = Σ
 * rating − 0.1 × Σ max(0, 60 − Freshness); the losing side is downed, the
 * winners keep `survivors` standing. Aftermath and per-round stats as the sim's.
 */
function simulateRound(input: RoundInput, roundSeed: Seed, content: ContentDB, options?: SimOptions): RoundOutput {
  const strength = (side: RoundInput['home']): number =>
    side.fighters.reduce((s, f) => s + f.rating * 10 - Math.max(0, 60 - (f.freshness ?? 100)), 0);
  const pHome = clamp(5000 + Math.trunc(((strength(input.home) - strength(input.away)) * 40) / 10), 1500, 8500);
  const rng = Rng.create(roundSeed, 'stand-in');
  const winner = rng.chanceBp(pHome) ? 'home' : 'away';
  const survivors = rng.int(1, 5);
  const durationTicks = rng.int(300, 1200);
  const all = [...input.home.fighters, ...input.away.fighters];
  const finalHp = all.map((_, i) => ((i < 5) === (winner === 'home') && i % 5 < survivors ? 100 : 0));
  const result: RoundOutput['result'] = {
    winner,
    endReason: 'elimination',
    tiebreakStep: null,
    durationTicks,
    survivors: { home: winner === 'home' ? survivors : 0, away: winner === 'away' ? survivors : 0 },
    downs: { home: winner === 'home' ? 5 - survivors : 5, away: winner === 'away' ? 5 - survivors : 5 },
    finalHp,
    checksum: hashString(stableStringify({ round: input.round, winner, durationTicks, survivors, finalHp, ids: all.map((f) => f.fighterId) })),
    eventHash: null,
  };
  const fighterStats: Record<FighterId, FighterMatchStats> = {};
  const aftermath: RoundAftermath[] = [];
  all.forEach((f, i) => {
    const side = i < 5 ? 'home' : 'away';
    const clubId = side === 'home' ? input.home.clubId : input.away.clubId;
    const downed = finalHp[i] === 0;
    const taken = rng.int(20, 140);
    const st = emptyStats(clubId, 1);
    st.roundsSurvived = downed ? 0 : 1;
    st.downsSuffered = downed ? 1 : 0;
    st.damageTaken = taken;
    st.roundDamageTaken = [taken];
    st.roundMaxHp = [100];
    if (downed) st.downs = [{ round: input.round, tick: Math.trunc(durationTicks / 2), byFighterId: null, abilityId: null, hit: 20, overkill: 0, damageTakenRound: taken, maxHp: 100 }];
    st.opponentIds = (side === 'home' ? input.away : input.home).fighters.map((o) => o.fighterId).sort();
    fighterStats[f.fighterId] = st;
    aftermath.push({ fighterId: f.fighterId, side, damageTaken: taken, maxHp: 100, downed, largestHit: downed ? 20 : 0, downCause: st.downs[0] ?? null, downsInflicted: 0 });
  });
  const record = options?.record ?? 'none';
  const log = record === 'none' ? null : roundLog(content, roundSeed, input.round, input.home, input.away, winner, durationTicks);
  if (record === 'full') result.eventHash = log!.hash;
  return { result, fighterStats, aftermath, log };
}

export function standInSim(): GamePorts['sim'] {
  return {
    simulateMatch,
    simulateRound,
    engineVersion: STAND_IN_ENGINE_VERSION,
  };
}
