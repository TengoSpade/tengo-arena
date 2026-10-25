import type { CareerStats, Fighter, PersonName } from './fighter';
import type { GameState } from './game-state';
import type { ClassId, ClubId, FighterId, RaceId, RegionId, TraitId } from './ids';

/**
 * A fighter who has left the league for good (retired, career-ending injury,
 * left unsigned) or a hired blade after his season. Kept as a slim,
 * immutable record (GameState.alumni) instead of a full Fighter so the
 * per-week state clone and the save do not grow with every season
 * (05 §5 size, §8). It keeps what records and history screens show.
 */
export interface Alumnus {
  id: FighterId;
  name: PersonName;
  raceId: RaceId;
  classId: ClassId;
  originRegionId: RegionId;
  debutSeason: number;
  /** Season in which he left (retired, left unsigned, or played as a hired blade). */
  leftSeason: number;
  /** Age when he left. */
  age: number;
  lastClubId: ClubId | null;
  cause: AlumnusCause;
  career: CareerStats;
  traitIds: TraitId[];
  /** One slim row per season played: club and rating at season end. */
  seasons: AlumnusSeason[];
}

export type AlumnusCause = 'age' | 'career-ending-injury' | 'left-unsigned' | 'hired-blade';

export interface AlumnusSeason {
  season: number;
  clubId: ClubId | null;
  rating: number;
}

/** Slim record of a departing fighter. */
export function alumnusOf(fighter: Fighter, leftSeason: number, cause: AlumnusCause, lastClubId: ClubId | null): Alumnus {
  return {
    id: fighter.id,
    name: { ...fighter.name },
    raceId: fighter.raceId,
    classId: fighter.classId,
    originRegionId: fighter.originRegionId,
    debutSeason: fighter.debutSeason,
    leftSeason,
    age: fighter.age,
    lastClubId,
    cause,
    career: { ...fighter.career },
    traitIds: fighter.traits.map((t) => t.id),
    seasons: fighter.history.map((h) => ({ season: h.season, clubId: h.clubId, rating: h.rating })),
  };
}

/** Anyone a record can name: a current fighter or an alumnus. */
export type Person = { kind: 'fighter'; fighter: Fighter } | { kind: 'alumnus'; alumnus: Alumnus };

/** Look up a fighter id among current fighters, then alumni (for names in reports, records and history). */
export function personOf(state: GameState, id: FighterId): Person | null {
  const f = state.fighters[id];
  if (f) return { kind: 'fighter', fighter: f };
  const a = state.alumni[id];
  return a ? { kind: 'alumnus', alumnus: a } : null;
}

/** Display name of a current fighter or alumnus, or null if unknown. */
export function personName(state: GameState, id: FighterId): PersonName | null {
  return state.fighters[id]?.name ?? state.alumni[id]?.name ?? null;
}
