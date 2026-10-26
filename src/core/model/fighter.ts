import type { GameTime } from './calendar';
import type { AbilityId, ClassId, ClubId, FighterId, FixtureId, PaceId, PerkId, RaceId, RegionId, StatId, TraitId } from './ids';
import type { Gold } from './ledger';
import type { AbilityRanks, LevelUpModeSetting, PendingLevelUp, ResolvedLevelUp } from './progression';

/**
 * A fighter. Owners: core/fighters (lifecycle fields), core/economy
 * (clubId, contract, contractProfile, freeAgency, status active/free-agent).
 *
 * Stats are DERIVED, never stored (03-fighter-lifecycle schema note 1):
 * `effectiveStats(fighter, context)` in core/fighters computes them from the
 * stored inputs (caps, trained values, wear, race, traits, statuses, injury;
 * M1.1 v3: `train100` replaces the M1 development clocks). Rating (1-100) and captaincy (CQ 1-100) are derived the
 * same way. Units: "100" fields are hundredths of a stat point (03 §1
 * internalUnitsPerPoint); ages are whole years.
 */
export interface Fighter {
  id: FighterId;
  name: PersonName;
  raceId: RaceId;
  classId: ClassId;
  /** Talent-pool region (open-027). */
  originRegionId: RegionId;
  /** Age in whole years. +1 in the season-end aging step only. humanAge = age × 80 / race.lifespan. */
  age: number;
  /** Season the fighter entered the world. */
  debutSeason: number;

  /** Owning club, or null (free agent, retired). Single source of truth for roster membership. */
  clubId: ClubId | null;
  status: FighterStatus;
  contract: Contract | null;
  /** Economy-owned temperament, rolled once at creation on the `market` stream. */
  contractProfile: { greedBp: number };
  /** Set while the fighter is a free agent. */
  freeAgency: FreeAgency | null;

  // ---- lifecycle inputs (core/fighters) --------------------------------------------
  /** Potential P, 1-100, rolled once (mostly fixed, P-12). */
  potentialRoll: number;
  /** Hidden development pace (development.json pace.levels). */
  paceId: PaceId;
  /** Per-stat ceiling in hundredths of a point. */
  cap100: Record<StatId, number>;
  /** Per-stat bloom offset (hundredths of a human-year) on the maturity curve. */
  bloom: Record<StatId, number>;
  /** Development clocks D_physical / D_mental in hundredths of a human-year. M1.1 (v3): legacy, frozen after generation (progression.md sys-development). */
  dev100: { physical: number; mental: number };
  /** Accumulated decline per stat in hundredths of a point. */
  wear100: Record<StatId, number>;
  traits: FighterTrait[];
  statuses: FighterStatusEntry[];
  injury: Injury | null;
  /** Standing training emphasis (cuttable by GameOptions.trainingEmphasis). M1.1: weights which stats level-up offers draw. */
  trainingEmphasis: TrainingEmphasis;
  /** Announced last season (retires at season end). */
  finalSeason: boolean;

  // ---- M1.1 progression (state v3; progression.md, combat-skills.md) ---------------------------
  /**
   * Trained value per stat in centipoints (13 stats): set once at generation
   * (cap100 × M_g(D_g + bloom)), raised only by level-up stat picks, clipped
   * to cap100 by a cap-lowering scar. The developed value of effective stats.
   */
  train100: Record<StatId, number>;
  /** Level, 1 or more; never decreases (initial level from the formula in progression.md). */
  level: number;
  /** XP into the current level (carry-over kept). */
  xpIntoLevel: number;
  /** XP for the next level, frozen when the level starts and recomputed at season end after age +1 (levels.json xpPerLevel). */
  xpNeeded: number;
  /** Level-ups waiting for a choice, oldest first (levels.json offers.pending.maxQueued). Never block Continue. */
  pendingLevelUps: PendingLevelUp[];
  /** 'inherit' follows Club.levelUpDefault. */
  levelUpMode: LevelUpModeSetting;
  /** Combat sys-ability-ranks: rank 1-3 per rankable slot of the class kit. */
  abilityRanks: AbilityRanks;
  /** Combat sys-perks: held perks in pick order (perks.json rules.perkCap, at most rules.maxTier3 of tier III). Permanent. */
  perkIds: PerkId[];
  /** sys-freshness: 0-1000 tenths (1000 = fully rested); the sim and UI read floor(freshness10 ÷ 10). */
  freshness10: number;

  career: CareerStats;
  /** Counters of the current season; reset at season end after history is written. */
  season: SeasonCounters;
  /** One row per completed season. */
  history: FighterSeasonRow[];

  // ---- reserved for later milestones ---------------------------------------------------
  /** R5 abilities learned beyond the class kit (M5 academy). Empty in M1. */
  learnedAbilityIds: AbilityId[];
  /** M5 academy enrollment. Always null in M1. */
  academy: AcademyEnrollment | null;
}

/** 'hired-blade' (open-006): generated one-match fighter, outside the cap. 'academy' from M5. */
export type FighterStatus = 'active' | 'free-agent' | 'retired' | 'hired-blade' | 'academy';

export type TrainingEmphasis = 'balanced' | 'body' | 'mind';

/** Generated once from names.json and stored as text. */
export interface PersonName {
  given: string;
  family: string | null;
  epithet: string | null;
  /** The rendered full name ("Bran Ashwood", "Grakk the Unbent"). */
  full: string;
}

export interface FighterTrait {
  id: TraitId;
  gainedSeason: number;
  /** 'level' (M1.1): learned from a level-up trait offer (traits.json rollRules.learned). */
  source: 'worldgen' | 'rolled' | 'event' | 'scar' | 'level';
}

/** Lifecycle status (development.json statuses), e.g. still_tender, at_risk, snubbed. */
export interface FighterStatusEntry {
  id: string;
  /** Remaining weeks, or null when counted in matches or until season end. */
  remainingWeeks: number | null;
  /** Remaining matches started, or null. */
  remainingMatches: number | null;
  since: GameTime;
}

/** 03-league-economy sys-contracts. */
export interface Contract {
  clubId: ClubId;
  /** Gold per week. */
  wagePerWeek: Gold;
  startSeason: number;
  /** Last season covered; expires in that season's season-end step. */
  endSeason: number;
  /** Signed at (for "matchweeks at club", renewal rules). */
  signedAt: GameTime;
  /** A relegation drop clause has already been applied this contract. */
  dropClauseApplied: boolean;
  /**
   * Agreed renewal not yet in force (renewals happen in the final season; the new
   * wage starts at the next season-end setup, 03-league-economy sys-contracts).
   * endSeason already includes the renewal (next.endSeason === endSeason); the
   * old wage is paid until setup, which then applies next.wagePerWeek and clears
   * next. null or absent = none. (Optional in the type for hand-built fixtures;
   * core always writes it.)
   */
  next?: ContractTerms | null;
}

export interface ContractTerms {
  wagePerWeek: Gold;
  /** Last season covered by the renewed contract (equals Contract.endSeason). */
  endSeason: number;
}

export interface FreeAgency {
  /** Season ends passed unsigned (leaves the world at development.json unsignedSeasonEndsBeforeLeaving). */
  unsignedSeasonEnds: number;
  formerClubId: ClubId | null;
  releasedByClubId: ClubId | null;
  releasedSeason: number | null;
  /** When he entered the pool (market "new this week"). Optional in the type for hand-built fixtures; core always writes it. */
  enteredAt?: GameTime;
}

/** Injury.weeksOut of a career-ending injury (never counts down to fit). */
export const CAREER_ENDING_WEEKS = 999;

/** P-11 ladder (knock, minor, moderate, serious); scars are traits. */
export interface Injury {
  severity: 'knock' | 'minor' | 'moderate' | 'serious';
  /** Matchweeks (and preseason weeks) still unavailable; 0 = fit for the next lock. */
  weeksOut: number;
  /** Where it happened. */
  fixtureId: FixtureId | null;
  round: number | null;
  causeFighterId: FighterId | null;
  /** Size of the hit as basis points of max HP. */
  damageBp: number;
  since: GameTime;
  /** Career-ending (P-11 top rung): unavailable for good, retires at season end. Absent = false. */
  careerEnding?: boolean;
}

/** Lifetime totals. */
export interface CareerStats {
  matches: number;
  roundsStarted: number;
  roundsWon: number;
  downsInflicted: number;
  downsSuffered: number;
  damageDealt: number;
  healingDone: number;
  xpTotal: number;
  proSeasons: number;
  matchweeksAtClub: number;
  matchweeksAsClubCaptain: number;
  peakRating: number;
  titles: number;
  /** M1.1: levels gained since the fighter's initial level. */
  levelsGained: number;
}

export interface SeasonCounters {
  /** All XP this season (round XP + bench XP; M1: round XP only). */
  xp: number;
  matchesStarted: number;
  roundsStarted: number;
  emphasisWeeks: Record<TrainingEmphasis, number>;
  captainWeeksByClub: Record<ClubId, number>;
  injuries: number;
  // ---- M1.1 -----------------------------------------------------------------------------------
  /** XP from rounds started (retirement usage = min(1, roundXp ÷ 360)). */
  roundXp: number;
  /** XP from matches the club played while he started no round (levels.json benchXp). */
  benchXp: number;
  /** Level-ups resolved this season, in order. */
  levelLog: ResolvedLevelUp[];
  /** Rounds he started Tired (40-59) or Spent (< 40). */
  tiredRoundStarts: number;
  spentRoundStarts: number;
  /** Week processings in which he recovered Freshness (started no round). */
  restWeeks: number;
  /** Matches in which he was a squad reserve and never entered. */
  squadReserveMatches: number;
}

/** One row per fighter-season (about 20 integers; 03-fighter-lifecycle schema note 7). */
export interface FighterSeasonRow {
  season: number;
  age: number;
  clubId: ClubId | null;
  rating: number;
  potential: number;
  /**
   * Display stats at season end. Kept on the last HISTORY_STATS_ROWS rows only
   * (the fighter screen and the season review compare the latest two); older
   * rows hold {} to bound the save (05 §5).
   */
  stats: Record<StatId, number>;
  xp: number;
  /** Share of possible rounds started, basis points. */
  usageBp: number;
  injuries: number;
  traitsGained: TraitId[];
  traitsLost: TraitId[];
  // ---- M1.1 (null on rows written before state v3) ----------------------------------------------
  levelStart: number | null;
  levelEnd: number | null;
  /** Effective Stamina at season end. */
  stamina: number | null;
  benchXp: number | null;
  tiredRoundStarts: number | null;
}

/** Rows of Fighter.history that keep their display stats (FighterSeasonRow.stats). */
export const HISTORY_STATS_ROWS = 2;

/** Blank the display stats of rows older than the last HISTORY_STATS_ROWS (in place). */
export function trimHistoryStats(history: FighterSeasonRow[]): void {
  for (let i = 0; i < history.length - HISTORY_STATS_ROWS; i++) {
    const row = history[i]!;
    if (Object.keys(row.stats).length > 0) row.stats = {} as Record<StatId, number>;
  }
}

/** Reserved for M5. */
export interface AcademyEnrollment {
  programId: string;
  sinceSeason: number;
  progressBp: number;
}

export function emptyCareerStats(): CareerStats {
  return {
    matches: 0,
    roundsStarted: 0,
    roundsWon: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    damageDealt: 0,
    healingDone: 0,
    xpTotal: 0,
    proSeasons: 0,
    matchweeksAtClub: 0,
    matchweeksAsClubCaptain: 0,
    peakRating: 0,
    titles: 0,
    levelsGained: 0,
  };
}

/** The M1.1 progression fields of a fighter (state v3). */
export type ProgressionFields = Pick<Fighter, 'train100' | 'level' | 'xpIntoLevel' | 'xpNeeded' | 'pendingLevelUps' | 'levelUpMode' | 'abilityRanks' | 'perkIds' | 'freshness10'>;

/** XP per level for hand-built fighters (the lvl-001 worked example); core/fighters initProgression computes the real value. */
export const PLACEHOLDER_XP_NEEDED = 155;

/**
 * Progression fields for a hand-built fighter (tests, stand-ins, dev worlds):
 * the given trained values, level 1, rested, rank 1, no perks. Generated
 * fighters use core/fighters initProgression (initial level and xpNeeded from
 * the formulas).
 */
export function blankProgression(train100: Record<StatId, number>): ProgressionFields {
  return {
    train100: { ...train100 },
    level: 1,
    xpIntoLevel: 0,
    xpNeeded: PLACEHOLDER_XP_NEEDED,
    pendingLevelUps: [],
    levelUpMode: 'inherit',
    abilityRanks: { a1: 1, a2: 1, passive: 1 },
    perkIds: [],
    freshness10: 1000,
  };
}

export function emptySeasonCounters(): SeasonCounters {
  return {
    xp: 0,
    matchesStarted: 0,
    roundsStarted: 0,
    emphasisWeeks: { balanced: 0, body: 0, mind: 0 },
    captainWeeksByClub: {},
    injuries: 0,
    roundXp: 0,
    benchXp: 0,
    levelLog: [],
    tiredRoundStarts: 0,
    spentRoundStarts: 0,
    restWeeks: 0,
    squadReserveMatches: 0,
  };
}
