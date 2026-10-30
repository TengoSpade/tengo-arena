/**
 * Round results, per-fighter stats and match assembly (03 sys-match,
 * boundary contract 2, schema note 7).
 */
import type { ContentDB } from '../content';
import type { AbilityId, FightLog, FighterId, FighterMatchStats, MatchInput, RecordLevel, RoundCalls, RoundRecap, RoundResult, RuleSkipReason } from '../model';
import { deriveSeed } from '../rng';
import { InvariantError } from '../util';
import { Fight } from './fight';
import { fatigueTier } from './profile';
import type { Unit } from './state';

/**
 * PROVISIONAL (OPEN, request for combat.json): MVP score weights. The design
 * lists the MVP inputs (damage, healing, downs) but no formula; score =
 * damage + healing + shielding + downs x 150 + assists x 50, winning side only.
 */
export const PROVISIONAL_MVP_DOWN_POINTS = 150;
export const PROVISIONAL_MVP_ASSIST_POINTS = 50;

export interface FightRun {
  result: Omit<RoundResult, 'round' | 'seed'>;
  fighterStats: Record<FighterId, FighterMatchStats>;
  log: FightLog | null;
  fight: Fight;
}

/**
 * Calls (P-01) are staged after M2 (05-technical-m2 §A6): until the calls package, a round's call plan must be absent
 * or { none, none } for both sides. The sim refuses anything else instead of ignoring it, so a plan can never be
 * silently dropped from a replay.
 */
export function refuseCalls(input: { calls?: RoundCalls | null | undefined }): void {
  const c = input.calls;
  if (c == null) return;
  // Optional chaining: a malformed plan (no side, no mode) is refused like any other, never a bare TypeError.
  const home = (c as Partial<RoundCalls>).home?.mode;
  const away = (c as Partial<RoundCalls>).away?.mode;
  if (home !== 'none' || away !== 'none') {
    throw new InvariantError(`sim: call plans are not available yet (home ${String(home)}, away ${String(away)}); only { none, none } or no plan is accepted until the calls package`);
  }
}

export function runFight(content: ContentDB, seed: string, round: number, input: Pick<MatchInput, 'home' | 'away'>, record: RecordLevel): FightRun {
  const f = new Fight(content, { seed, round, home: input.home, away: input.away }, record);
  f.run();
  if (f.rec) f.rec.emit('round.summary', f.durationTicks - 1, undefined, undefined, { units: f.units.map((u) => recapOf(f, u)) });
  const finalHp = f.units.map((u) => (u.standing ? u.hp : 0));
  let homeUp = 0;
  let awayUp = 0;
  for (const u of f.units) {
    if (!u.standing) continue;
    if (u.side === 0) homeUp++;
    else awayUp++;
  }
  const result: Omit<RoundResult, 'round' | 'seed'> = {
    winner: f.winner === 0 ? 'home' : 'away',
    endReason: f.endReason,
    tiebreakStep: f.tiebreakStep,
    durationTicks: f.durationTicks,
    survivors: { home: homeUp, away: awayUp },
    downs: { home: 5 - homeUp, away: 5 - awayUp },
    finalHp,
    checksum: f.checksum(),
    eventHash: null,
  };
  let log: FightLog | null = null;
  if (f.rec) {
    const hash = f.rec.hash(f.header);
    log = { header: f.header, events: f.rec.events, hash };
    if (f.rec.full) result.eventHash = hash;
  }
  const fighterStats: Record<FighterId, FighterMatchStats> = {} as Record<FighterId, FighterMatchStats>;
  for (const u of f.units) fighterStats[u.input.fighterId] = statsOf(f, u, round);
  return { result, fighterStats, log, fight: f };
}

function sortedCasts(m: Map<string, number>): Record<AbilityId, number> {
  const out: Record<string, number> = {};
  for (const k of [...m.keys()].sort()) out[k] = m.get(k)!;
  return out as Record<AbilityId, number>;
}

/** M1.1 recap additions: the round's Freshness and penalty (Tired / Spent tag), perk procs, entry flag. */
export interface RoundRecapM11 extends RoundRecap {
  freshness: number;
  /** levels.json freshness label id at the round start (fresh, ready, tired, spent). */
  freshnessLabel: string;
  /** 'tired' or 'spent' when the round started below the threshold, else null (report tag "Tired (52)"). */
  /** The penalty tier's label (Winded 'ready', 'tired', 'spent'); null in the penalty-free tier. */
  fatigueTag: 'ready' | 'tired' | 'spent' | null;
  fatigueBp: number;
  /** Trigger fires per perk this round. */
  perkProcs: Record<string, number>;
  enteredThisRound: boolean;
}

export function freshnessLabelOf(f: Fight, freshness: number): string {
  for (const l of f.tb.freshness.labels) if (freshness >= l.min) return l.id;
  return f.tb.freshness.labels[f.tb.freshness.labels.length - 1]?.id ?? 'spent';
}

function recapOf(f: Fight, u: Unit): RoundRecapM11 {
  const t = u.tally;
  const label = freshnessLabelOf(f, u.freshness);
  const procs: Record<string, number> = {};
  for (const k of [...u.perkProcs.keys()].sort()) procs[k] = u.perkProcs.get(k)!;
  return {
    freshness: u.freshness,
    freshnessLabel: label,
    fatigueTag: fatigueTier(f.tb, u.freshness).severityBp > 0 ? (fatigueTier(f.tb, u.freshness).id as 'ready' | 'tired' | 'spent') : null,
    fatigueBp: u.fatigueBp,
    perkProcs: procs,
    enteredThisRound: u.input.enteredThisRound === true,
    unit: u.index,
    damageDealt: t.damageDealt,
    damageToShields: t.damageToShields,
    damageTaken: t.damageTaken,
    healingDone: t.healingDone,
    shieldingDone: t.shieldingDone,
    overheal: t.overheal,
    ccAppliedTicks: t.ccAppliedTicks,
    ccReceivedTicks: t.ccReceivedTicks,
    downsInflicted: t.downsInflicted,
    assists: t.assists,
    focusSpent: t.focusSpent,
    casts: sortedCasts(t.casts),
    ruleFires: [...t.ruleFires],
    ruleCommittedTicks: [...t.ruleTicks],
    ruleSkips: t.ruleSkips.map((m) => {
      const o: Partial<Record<RuleSkipReason, number>> = {};
      for (const k of [...m.keys()].sort()) o[k as RuleSkipReason] = m.get(k)!;
      return o;
    }),
    stanceTicks: t.ruleTicks[u.ruleCount] ?? 0,
  };
}

function statsOf(f: Fight, u: Unit, round: number): FighterMatchStats {
  const t = u.tally;
  const clubId = u.side === 0 ? f.setup.home.clubId : f.setup.away.clubId;
  const opponents = f.units.filter((o) => o.side !== u.side).map((o) => o.input.fighterId);
  return {
    clubId,
    roundsPlayed: 1,
    roundsSurvived: u.standing ? 1 : 0,
    ticksOnArena: t.ticksStanding,
    damageDealt: t.damageDealt,
    damageToShields: t.damageToShields,
    damageTaken: t.damageTaken,
    healingDone: t.healingDone,
    healingReceived: t.healingReceived,
    shieldingDone: t.shieldingDone,
    overheal: t.overheal,
    ccAppliedTicks: t.ccAppliedTicks,
    ccReceivedTicks: t.ccReceivedTicks,
    downsInflicted: t.downsInflicted,
    downsSuffered: u.standing ? 0 : 1,
    assists: t.assists,
    focusSpent: t.focusSpent,
    casts: sortedCasts(t.casts),
    ruleFires: [...t.ruleFires],
    ruleCommittedTicks: [...t.ruleTicks],
    rulesNeverFired: t.ruleFires.slice(0, u.ruleCount).flatMap((n, i) => (n === 0 ? [i] : [])),
    downs: u.down
      ? [
          {
            round,
            tick: u.down.tick,
            byFighterId: u.down.by >= 0 ? f.units[u.down.by]!.input.fighterId : null,
            abilityId: u.down.ability as AbilityId | null,
            hit: u.down.hit,
            overkill: u.down.overkill,
            damageTakenRound: u.down.damageTakenRound,
            maxHp: u.maxHp,
          },
        ]
      : [],
    opponentIds: [...opponents].sort(),
    roundDamageTaken: [t.damageTaken],
    roundMaxHp: [u.maxHp],
  };
}

export function mergeStats(into: FighterMatchStats, add: FighterMatchStats): FighterMatchStats {
  const casts: Record<string, number> = { ...into.casts };
  for (const [k, v] of Object.entries(add.casts)) casts[k] = (casts[k] ?? 0) + v;
  const sortedC: Record<string, number> = {};
  for (const k of Object.keys(casts).sort()) sortedC[k] = casts[k]!;
  const fires = into.ruleFires.map((n, i) => n + (add.ruleFires[i] ?? 0));
  const ticks = into.ruleCommittedTicks.map((n, i) => n + (add.ruleCommittedTicks[i] ?? 0));
  const ruleCount = fires.length - 1;
  return {
    clubId: into.clubId,
    roundsPlayed: into.roundsPlayed + add.roundsPlayed,
    roundsSurvived: into.roundsSurvived + add.roundsSurvived,
    ticksOnArena: into.ticksOnArena + add.ticksOnArena,
    damageDealt: into.damageDealt + add.damageDealt,
    damageToShields: into.damageToShields + add.damageToShields,
    damageTaken: into.damageTaken + add.damageTaken,
    healingDone: into.healingDone + add.healingDone,
    healingReceived: (into.healingReceived ?? 0) + (add.healingReceived ?? 0),
    shieldingDone: into.shieldingDone + add.shieldingDone,
    overheal: into.overheal + add.overheal,
    ccAppliedTicks: into.ccAppliedTicks + add.ccAppliedTicks,
    ccReceivedTicks: into.ccReceivedTicks + add.ccReceivedTicks,
    downsInflicted: into.downsInflicted + add.downsInflicted,
    downsSuffered: into.downsSuffered + add.downsSuffered,
    assists: into.assists + add.assists,
    focusSpent: into.focusSpent + add.focusSpent,
    casts: sortedC as Record<AbilityId, number>,
    ruleFires: fires,
    ruleCommittedTicks: ticks,
    rulesNeverFired: fires.slice(0, ruleCount).flatMap((n, i) => (n === 0 ? [i] : [])),
    downs: [...into.downs, ...add.downs],
    opponentIds: [...new Set([...into.opponentIds, ...add.opponentIds])].sort() as FighterId[],
    roundDamageTaken: [...(into.roundDamageTaken ?? []), ...(add.roundDamageTaken ?? [])],
    roundMaxHp: [...(into.roundMaxHp ?? []), ...(add.roundMaxHp ?? [])],
  };
}

export function mvpScore(s: FighterMatchStats): number {
  return s.damageDealt + s.damageToShields + s.healingDone + s.shieldingDone + s.downsInflicted * PROVISIONAL_MVP_DOWN_POINTS + s.assists * PROVISIONAL_MVP_ASSIST_POINTS;
}

export interface MatchRun {
  rounds: RoundResult[];
  score: { home: number; away: number };
  winner: 'home' | 'away';
  fighterStats: Record<FighterId, FighterMatchStats>;
  mvpFighterId: FighterId | null;
  logs: FightLog[] | null;
}

export function runMatch(input: MatchInput, content: ContentDB, record: RecordLevel): MatchRun {
  if (!Number.isSafeInteger(input.bestOf) || input.bestOf < 1 || input.bestOf % 2 === 0) {
    throw new InvariantError(`sim: bestOf must be a positive odd number, got ${input.bestOf}`);
  }
  const need = (input.bestOf + 1) / 2;
  const rounds: RoundResult[] = [];
  const logs: FightLog[] = [];
  const stats = new Map<FighterId, FighterMatchStats>();
  const order: FighterId[] = [...input.home.fighters, ...input.away.fighters].map((x) => x.fighterId);
  let home = 0;
  let away = 0;
  for (let n = 1; home < need && away < need; n++) {
    const seed = deriveSeed(input.seed, 'round', n);
    const run = runFight(content, seed, n, input, record);
    rounds.push({ round: n, seed, ...run.result });
    if (run.result.winner === 'home') home++;
    else away++;
    if (run.log) logs.push(run.log);
    for (const id of order) {
      const s = run.fighterStats[id]!;
      const prev = stats.get(id);
      stats.set(id, prev ? mergeStats(prev, s) : s);
    }
  }
  const winner = home > away ? 'home' : 'away';
  const fighterStats = {} as Record<FighterId, FighterMatchStats>;
  for (const id of order) fighterStats[id] = stats.get(id)!;
  const winners = (winner === 'home' ? input.home : input.away).fighters.map((x) => x.fighterId);
  let mvp: FighterId | null = null;
  let best = -1;
  for (const id of winners) {
    const sc = mvpScore(fighterStats[id]!);
    if (sc > best) {
      best = sc;
      mvp = id;
    }
  }
  return { rounds, score: { home, away }, winner, fighterStats, mvpFighterId: mvp, logs: record === 'none' ? null : logs };
}
