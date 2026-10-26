/**
 * core/sim — fixed-tick fight engine (03-combat sys-fight-sim, sys-match,
 * sys-abilities, sys-movement, sys-fight-traits, sys-fight-captain,
 * sys-match-report). Owner: WP1 (combat). CONTRACT: the original signatures
 * are fixed; additions are marked "additive".
 *
 * Pure: (inputs, content) -> outputs. Never reads GameState. Integer state
 * only: positions in mm, HP in points, damage in centipoints, focus in
 * millipoints, probabilities and accumulators in basis points (03-combat
 * schema note 10). Randomness only from the round seed's purpose streams
 * phase/<unit>, variance/<unit>, react/<unit>, tiebreak (combat.json randomness).
 */
import type { ContentDB } from '../content';
import type {
  DownRecord,
  FightFighterInput,
  FightLog,
  FighterId,
  FighterMatchStats,
  MatchInput,
  RecordLevel,
  RoundAftermath,
  RoundInput,
  RoundResult,
  SideInput,
} from '../model';
import type { Seed } from '../rng';
import { SIM_ENGINE_VERSION, modifiedStat } from './fight';
import { runFight, runMatch } from './match';
import { staticValues } from './profile';
import { BP, ST, kitFor, simTables } from './tables';
import { InvariantError } from '../util';

/**
 * Version of the fight rules implementation. Bump on ANY change that can
 * alter an outcome or event stream for the same inputs. Stored in results,
 * fight headers and saves; replays require an exact match.
 */
export const ENGINE_VERSION = SIM_ENGINE_VERSION;

export interface SimOptions {
  /** Default 'none'. The outcome is identical at every level. */
  record?: RecordLevel;
}

/** One round (fight) between two sides. */
export interface FightInput {
  /** Round seed: deriveSeed(matchSeed, 'round', round). */
  seed: Seed;
  round: number;
  home: SideInput;
  away: SideInput;
}

export interface FightOutput {
  result: Omit<RoundResult, 'round' | 'seed'>;
  /** Per-fighter stats of this round. */
  fighterStats: Record<FighterId, FighterMatchStats>;
  /** Present when record is 'summary' (summary events) or 'full'. */
  log: FightLog | null;
}

export interface MatchOutput {
  rounds: RoundResult[];
  score: { home: number; away: number };
  winner: 'home' | 'away';
  fighterStats: Record<FighterId, FighterMatchStats>;
  mvpFighterId: FighterId | null;
  /** One log per round when record is not 'none'. */
  logs: FightLog[] | null;
}

/** Derived combat values of one fighter (03-combat sys-combat-stats), for the sim and the fighter profile UI. */
export interface CombatProfile {
  maxHp: number;
  armor: number;
  ward: number;
  power: number;
  support: number;
  attackIntervalTicks: number;
  moveSpeedMmPerTick: number;
  critBp: number;
  evadeBp: number;
  tenacityBp: number;
  resolveBp: number;
  reactionTicks: number;
  focusRegenMilliPerTick: number;
}

/**
 * Play a match: rounds until a side wins a majority of bestOf (never drawn).
 * M1: lineups and tactics fixed for the whole match (open-010).
 */
export function simulateMatch(input: MatchInput, content: ContentDB, options?: SimOptions): MatchOutput {
  return runMatch(input, content, options?.record ?? 'none');
}

/** Play one round. */
export function simulateFight(input: FightInput, content: ContentDB, options?: SimOptions): FightOutput {
  const run = runFight(content, input.seed, input.round, input, options?.record ?? 'none');
  return { result: run.result, fighterStats: run.fighterStats, log: run.log };
}

/** Derived combat values (no randomness) for one fighter input: attributes, class, race combatMods and unconditional passive mods. */
export function combatProfile(fighter: FightFighterInput, content: ContentDB): CombatProfile {
  const tb = simTables(content);
  if (!tb.classes.has(fighter.classId)) throw new InvariantError(`sim: unknown class "${fighter.classId}"`);
  // Ranked kit, perks and the round's Freshness penalty are all static for a round (M1.1).
  const s = staticValues(fighter, kitFor(tb, fighter.classId, fighter.abilityRanks), tb);
  const d = tb.derived;
  const m = s.staticMods;
  const atk = Math.min(s.atkSpeedMax, Math.max(4000, s.atkSpeed0 + m[ST.attackSpeed]!));
  const [lo, hi] = d.speedClamp;
  const speedMult = Math.min(hi, Math.max(lo, BP + m[ST.moveSpeed]!));
  const cmp = Math.min(d.cmpMax, Math.max(d.cmpMin, s.attrs[8]! + m[ST.composure]!));
  let us = d.reactBaseUs + d.reactPerAwrUs * (s.attrs[10]! - 10) + d.reactPerCmpUs * (cmp - 10);
  us = Math.trunc((us * (BP + m[ST.reactionDelay]!)) / BP);
  us = Math.min(d.reactMaxUs, Math.max(d.reactMinUs, us));
  return {
    maxHp: s.maxHp,
    armor: s.armor0 + m[ST.armor]!,
    ward: s.ward0 + m[ST.ward]!,
    power: modifiedStat(s.power0, s.powerX, m[ST.power]!, 1),
    support: modifiedStat(s.support0, s.supportX, m[ST.support]!, 0),
    attackIntervalTicks: Math.trunc((s.intervalTicks * BP) / atk),
    moveSpeedMmPerTick: Math.trunc((s.speedE4 * speedMult) / (BP * BP)),
    critBp: Math.min(d.critMaxBp, Math.max(0, s.crit0 + m[ST.crit]!)),
    evadeBp: Math.min(d.evadeMaxBp, Math.max(0, s.evade0 + m[ST.evade]!)),
    tenacityBp: Math.min(d.tenMaxBp, Math.max(d.tenMinBp, d.tenPerCmpBp * (cmp - 10) + s.tenacity0 + m[ST.tenacity]!)),
    resolveBp: Math.min(d.resMaxBp, Math.max(d.resMinBp, s.resolve0 + m[ST.resolve]!)),
    reactionTicks: Math.trunc((us * tb.tps) / 1_000_000),
    focusRegenMilliPerTick: Math.trunc((s.focusRegen0 * (BP + m[ST.focusRegen]!)) / BP),
  };
}

// ---- M1.1 contract (WP-A; docs/design/05 M1.1 addendum §WP-A) --------------------------------------

/** One round's output (combat-skills.md "Operation contract"): the result, per-fighter stats, aftermath for lifecycle, the log. */
export interface RoundOutput {
  result: Omit<RoundResult, 'round' | 'seed'>;
  fighterStats: Record<FighterId, FighterMatchStats>;
  /** One entry per fighter who started the round (both sides, slot order home then away). */
  aftermath: RoundAftermath[];
  log: FightLog | null;
}

/**
 * Play one round of a match (simulateFight with the M1.1 per-round inputs).
 * Round seed: deriveSeed(matchSeed, 'round', input.round).
 *
 * Applies the per-round fields (combat-skills.md): the Freshness penalty
 * (fixed at round start, scaled by fatigueResist), ability ranks, up to 4 perk
 * passive blocks with trait effects, the self_is_captain /
 * self_freshness_below / self_fresh_entry predicates, the self_hp_below and
 * ability_release triggers, trigger `if` and aura `requires`. A round with
 * defaults (freshness 100, ranks 1, no perks) is bit-identical to
 * simulateFight (sim/round.test.ts, sim/m11.test.ts).
 */
export function simulateRound(input: RoundInput, roundSeed: Seed, content: ContentDB, options?: SimOptions): RoundOutput {
  const run = runFight(content, roundSeed, input.round, input, options?.record ?? 'none');
  const aftermath: RoundAftermath[] = [];
  for (const u of run.fight.units) {
    const st = run.fighterStats[u.input.fighterId]!;
    const down: DownRecord | null = st.downs.find((d) => d.round === input.round) ?? null;
    aftermath.push({
      fighterId: u.input.fighterId,
      side: u.side === 0 ? 'home' : 'away',
      damageTaken: st.damageTaken,
      maxHp: u.maxHp,
      downed: down !== null,
      // Largest single hit taken this round (HP + shield, points).
      largestHit: u.largestHit,
      downCause: down,
      downsInflicted: st.downsInflicted,
    });
  }
  return { result: run.result, fighterStats: run.fighterStats, aftermath, log: run.log };
}

/** Additive: fight-input builders (harness, tests, dev tools). */
export { fighterInput, sideInput } from './build';
export type { FighterSpec } from './build';

/** Additive (M1.1): skill eligibility (perks and rank steps) for the harness and tests; lifecycle's offers follow the same rules. */
export { eligiblePerks, eligibleRankSteps, perkEligible, perkPool } from './skills';

/** Additive (M1.1 integration): per-round stats summed over a match, and the PROVISIONAL MVP score; core/game's orchestrator assembles round-by-round results with them. */
export { mergeStats, mvpScore } from './match';
