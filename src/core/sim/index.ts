/**
 * core/sim — fixed-tick fight engine (03-combat sys-fight-sim, sys-match,
 * sys-abilities, sys-movement, sys-fight-traits, sys-fight-captain,
 * sys-match-report). Owner: WP1 (combat). CONTRACT: signatures fixed; bodies are stubs.
 *
 * Pure: (inputs, content) -> outputs. Never reads GameState. Integer state
 * only: positions in mm, HP in points, damage in centipoints, focus in
 * millipoints, probabilities and accumulators in basis points (03-combat
 * schema note 10). Randomness only from the round seed's purpose streams
 * phase/<unit>, variance/<unit>, react/<unit>, tiebreak (combat.json randomness).
 */
import type { ContentDB } from '../content';
import type {
  FightFighterInput,
  FightLog,
  FighterId,
  FighterMatchStats,
  MatchInput,
  RecordLevel,
  RoundResult,
  SideInput,
} from '../model';
import type { Seed } from '../rng';
import { notImplemented } from '../util';

/**
 * Version of the fight rules implementation. Bump on ANY change that can
 * alter an outcome or event stream for the same inputs. Stored in results,
 * fight headers and saves; replays require an exact match.
 */
export const ENGINE_VERSION = 1;

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
  return notImplemented('sim.simulateMatch', input, content, options);
}

/** Play one round. */
export function simulateFight(input: FightInput, content: ContentDB, options?: SimOptions): FightOutput {
  return notImplemented('sim.simulateFight', input, content, options);
}

/** Derived combat values (no randomness) for one fighter input. */
export function combatProfile(fighter: FightFighterInput, content: ContentDB): CombatProfile {
  return notImplemented('sim.combatProfile', fighter, content);
}
