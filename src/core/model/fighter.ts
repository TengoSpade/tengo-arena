import type { AbilityId, ClassId, ClubId, FighterId, RaceId, RegionId, StatId, TraitId } from './ids';
import type { Gold } from './ledger';

/**
 * PROVISIONAL (phase A). Fields marked [phase B] depend on the designers'
 * schemas (03-combat, 03-fighter-lifecycle, 03-league-economy) and may change
 * shape when those land. Fields without the mark are engine structure and
 * should stay stable. Units follow 03 §1: stats are integers on the absolute
 * 1-20 scale, rating and potential are integers 1-100, ages whole years.
 */
export interface Fighter {
  id: FighterId;
  name: PersonName;
  raceId: RaceId;
  classId: ClassId;
  /** Talent-pool region the fighter comes from (open-027). */
  originRegionId: RegionId;
  /** Age in whole years. +1 for every fighter in the season-end aging step only. */
  age: number;
  /** Season the fighter entered the world (world generation or rookie intake). */
  debutSeason: number;
  /** Owning club, or null for free agents and retired fighters. Single source of truth for roster membership. */
  clubId: ClubId | null;
  status: FighterStatus;
  contract: Contract | null;

  /** [phase B] current stat values keyed by stat id (physical and mental families, 03 §1). */
  stats: Record<StatId, number>;
  /** [phase B] highest reachable rating, 1-100 (mostly fixed, P-12). Rating itself is derived from stats + class, not stored. */
  potential: number;
  /** [phase B] experience points (drives growth toward potential and unlocks rule slots). */
  xp: number;
  /** [phase B] owned traits (O5; reveal state arrives with M4 knowledge). */
  traitIds: TraitId[];
  /** [phase B] abilities available beyond the class kit (learned later, R5). The class kit itself comes from content. */
  learnedAbilityIds: AbilityId[];
  /** [phase B] current injury on the ladder (P-11), if any. */
  injury: Injury | null;

  career: CareerStats;
}

/** [phase B] 'hired-blade' (open-006) may be added for one-match fighters. */
export type FighterStatus = 'active' | 'free-agent' | 'retired';

/** Generated once from names.json parts and stored as text. */
export interface PersonName {
  given: string;
  family: string | null;
  /** Optional nickname / epithet. */
  epithet: string | null;
}

/** [phase B] exact terms and clauses from 03-league-economy. */
export interface Contract {
  clubId: ClubId;
  /** Gold per week. */
  wagePerWeek: Gold;
  startSeason: number;
  /** Last season covered; the contract expires in that season's season-end step. */
  endSeason: number;
}

/** [phase B] injury ladder from 03-fighter-lifecycle (P-11). */
export interface Injury {
  /** Content-defined injury key (ladder step / type). */
  kind: string;
  /** Weeks still unavailable (0 = available next week). */
  weeksOut: number;
  /** Lasting effect after recovery (scar), if any. */
  permanent: boolean;
  sinceSeason: number;
  sinceWeek: number;
}

/** Lifetime totals, updated after each played match. */
export interface CareerStats {
  matches: number;
  roundsPlayed: number;
  roundsWon: number;
  downsInflicted: number;
  downsSuffered: number;
  damageDealt: number;
  healingDone: number;
  titles: number;
}

export function emptyCareerStats(): CareerStats {
  return {
    matches: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    damageDealt: 0,
    healingDone: 0,
    titles: 0,
  };
}
