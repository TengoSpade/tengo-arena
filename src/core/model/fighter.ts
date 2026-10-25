import type { GameTime } from './calendar';
import type { AbilityId, ClassId, ClubId, FighterId, FixtureId, PaceId, RaceId, RegionId, StatId, TraitId } from './ids';
import type { Gold } from './ledger';

/**
 * A fighter. Owners: core/fighters (lifecycle fields), core/economy
 * (clubId, contract, contractProfile, freeAgency, status active/free-agent).
 *
 * Stats are DERIVED, never stored (03-fighter-lifecycle schema note 1):
 * `effectiveStats(fighter, context)` in core/fighters computes them from the
 * stored inputs (caps, development clocks, bloom, wear, race, traits,
 * statuses, injury). Rating (1-100) and captaincy (CQ 1-100) are derived the
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
  /** Development clocks D_physical / D_mental in hundredths of a human-year. */
  dev100: { physical: number; mental: number };
  /** Accumulated decline per stat in hundredths of a point. */
  wear100: Record<StatId, number>;
  traits: FighterTrait[];
  statuses: FighterStatusEntry[];
  injury: Injury | null;
  /** Standing training emphasis (M1, cuttable by GameOptions.trainingEmphasis). Routes earned growth only. */
  trainingEmphasis: TrainingEmphasis;
  /** Announced last season (retires at season end). */
  finalSeason: boolean;

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
  source: 'worldgen' | 'rolled' | 'event' | 'scar';
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
}

export interface SeasonCounters {
  xp: number;
  matchesStarted: number;
  roundsStarted: number;
  emphasisWeeks: Record<TrainingEmphasis, number>;
  captainWeeksByClub: Record<ClubId, number>;
  injuries: number;
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
  };
}
