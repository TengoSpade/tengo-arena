import type { Seed } from '../rng';
import type { StartingRow, TacticsAssignment } from './club';
import type { FixtureStage } from './competition';
import type { AbilityId, ClassId, ClubId, CompetitionId, FighterId, FixtureId, RaceId, StatId, TraitId, WeekId } from './ids';

// ---- Sim inputs (core/game builds them; core/sim consumes them) ------------------------------

/** 03-combat sys-match inputs. Everything the sim needs; stored in MatchResult so a match can be re-simulated. */
export interface MatchInput {
  /** Match seed: deriveSeed(root, STREAM.match, season, fixtureId). */
  seed: Seed;
  /** 3, or 5 for finals. */
  bestOf: number;
  home: SideInput;
  away: SideInput;
}

export interface SideInput {
  clubId: ClubId;
  /** Exactly 5 fighters (O1), in slot order. */
  fighters: FightFighterInput[];
  /** Index into fighters of the lineup captain, and of the vice-captain if fielded. */
  captainIndex: number;
  viceCaptainIndex: number | null;
  /** Lineup chemistry (-5..5): from trait and captain lineup modifiers only in M1. Already folded into stats. */
  chemistry: number;
}

export interface FightFighterInput {
  fighterId: FighterId;
  classId: ClassId;
  raceId: RaceId;
  row: StartingRow;
  slot: number;
  /** Management-effective integer stats 1-20 (race, traits, statuses, chemistry, captain penalty applied; the sim must not re-apply them). */
  stats: Record<StatId, number>;
  /** Captaincy CQ 0-100 (lifecycle; −10 already applied for an acting captain). */
  captainQuality: number;
  /** Trait ids; the sim applies only combat-owned effects (traitEffectAdapter). */
  traitIds: TraitId[];
  tactics: TacticsAssignment;
  /** Rating 1-100 at kickoff (reports, MVP). */
  rating: number;
  /** Optional per-fighter hooks (combat.json combatModsDefaults). */
  combatMods?: { hpMult?: number; armorFlat?: number; wardFlat?: number; moveSpeedMult?: number; tenacityFlat?: number };
}

// ---- Committed result ------------------------------------------------------------------------

/**
 * What happened in the arena for one fixture. Written once when the match is
 * played; never rerolled (P-05). Consequences (XP, injuries, gold) are
 * applied by their modules and reported through news and the ledger.
 */
export interface MatchResult {
  fixtureId: FixtureId;
  competitionId: CompetitionId;
  stage: FixtureStage;
  season: number;
  weekIndex: number;
  weekId: WeekId;
  homeClubId: ClubId;
  awayClubId: ClubId;
  engineVersion: number;
  contentHash: string;
  /** Full sim inputs (seed, bestOf, sides): enough to re-simulate the match for the report timeline or a replay. */
  input: MatchInput;
  rounds: RoundResult[];
  /** Rounds won. Rounds and matches are never drawn (03-combat sys-match). */
  score: { home: number; away: number };
  winnerClubId: ClubId;
  /** Keyed by fighter; every fighter who appeared. */
  fighterStats: Record<FighterId, FighterMatchStats>;
  mvpFighterId: FighterId | null;
  /** Hired blades used by either side (open-006). */
  hiredBladeIds: FighterId[];
}

export type RoundTiebreakStep = 'fighters_standing' | 'hp_fraction_sum' | 'damage_dealt' | 'first_down' | 'seeded_coin';

export interface RoundResult {
  /** 1-based. */
  round: number;
  /** deriveSeed(match seed, 'round', round). */
  seed: Seed;
  winner: 'home' | 'away';
  endReason: 'elimination' | 'time-limit';
  /** Which time-cap tie-break decided it, if any. */
  tiebreakStep: RoundTiebreakStep | null;
  durationTicks: number;
  survivors: { home: number; away: number };
  downs: { home: number; away: number };
  /** Final HP per unit index (0-4 home, 5-9 away). */
  finalHp: number[];
  /** Hash of the final fight state; identical at every RecordLevel. */
  checksum: string;
  /** hashEventStream of the full log when recorded at 'full', else null. */
  eventHash: string | null;
}

/** 03-combat schema note 7. Summed over the match unless stated. */
export interface FighterMatchStats {
  clubId: ClubId;
  roundsPlayed: number;
  roundsSurvived: number;
  ticksOnArena: number;
  damageDealt: number;
  damageToShields: number;
  damageTaken: number;
  healingDone: number;
  shieldingDone: number;
  overheal: number;
  ccAppliedTicks: number;
  ccReceivedTicks: number;
  downsInflicted: number;
  downsSuffered: number;
  assists: number;
  focusSpent: number;
  casts: Record<AbilityId, number>;
  /** ruleFires[i] = fires of rule i; the last entry is the stance (P-22 recap). */
  ruleFires: number[];
  /** Ticks spent committed to each rule (same indexing as ruleFires). */
  ruleCommittedTicks: number[];
  /** Indexes of rules that never fired in the match. */
  rulesNeverFired: number[];
  /** Every down suffered (input to sys-injury and the death summary). */
  downs: DownRecord[];
  /** Opponents faced (M4 knowledge contact). */
  opponentIds: FighterId[];
  /**
   * Damage taken and max HP in each round played (index = round - 1; v2, for
   * per-round injury rolls). The sim always writes them; absent only in
   * hand-built fixtures and in results from v1 saves.
   */
  roundDamageTaken?: number[];
  roundMaxHp?: number[];
}

export interface DownRecord {
  round: number;
  tick: number;
  /** Credited fighter, if any. */
  byFighterId: FighterId | null;
  abilityId: AbilityId | null;
  /** Size of the downing hit, overkill, and damage taken that round (points). */
  hit: number;
  overkill: number;
  damageTakenRound: number;
  maxHp: number;
}
