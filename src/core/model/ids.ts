/**
 * Identifiers.
 *
 * Runtime ids are strings so GameState stays plain JSON. Branded types stop
 * a FighterId being passed where a ClubId is expected.
 *
 * - Clubs use their clubs.json id ("varrow-lanternguard"): every club comes
 *   from content, and readable ids make saves and seeds self-explanatory.
 * - Competitions and fixtures use stable IDENTITY strings built from season,
 *   tier, week and clubs (03-league-economy schema note 5), so match seeds
 *   derive from what the fixture is, not from allocation order (P-05).
 * - Fighters and news items are allocated from GameState.ids counters
 *   (deterministic, never random or time-based).
 *
 * Content ids (ClassId, AbilityId, ...) are the `id` keys of content entries;
 * core/content validates every reference at load.
 */

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

// ---- Engine ids ---------------------------------------------------------------
/** clubs.json id. */
export type ClubId = Brand<string, 'ClubId'>;
/** Allocated: "f-<n>". */
export type FighterId = Brand<string, 'FighterId'>;
/** Identity: "lg:<season>:<tierId>" or "rk:<season>:<tierId>". */
export type CompetitionId = Brand<string, 'CompetitionId'>;
/** Identity: "lg:<season>:<tierId>:<weekId>:<home>:<away>" or "rk:<season>:<tierId>:<roundId>:<slot>". */
export type FixtureId = Brand<string, 'FixtureId'>;
/** Allocated: "n-<n>". */
export type NewsId = Brand<string, 'NewsId'>;

// ---- Content ids ---------------------------------------------------------------
export type StatId = Brand<string, 'StatId'>;
export type ClassId = Brand<string, 'ClassId'>;
export type AbilityId = Brand<string, 'AbilityId'>;
/** M1.1 perks.json id. */
export type PerkId = Brand<string, 'PerkId'>;
export type TacticsPresetId = Brand<string, 'TacticsPresetId'>;
export type RaceId = Brand<string, 'RaceId'>;
export type TraitId = Brand<string, 'TraitId'>;
export type RegionId = Brand<string, 'RegionId'>;
export type DistrictId = Brand<string, 'DistrictId'>;
/** A league tier (tier level 1 is the top). */
export type TierId = Brand<string, 'TierId'>;
/** Wing of a tier ("dawn" / "dusk"). */
export type WingId = Brand<string, 'WingId'>;
/** Calendar week id from leagues.json ("P1", "MW3", "TW1"). */
export type WeekId = Brand<string, 'WeekId'>;
export type VenueId = Brand<string, 'VenueId'>;
export type AiPersonalityId = Brand<string, 'AiPersonalityId'>;
/** development.json pace level id. */
export type PaceId = Brand<string, 'PaceId'>;

/** Map keyed by an id. Lookups return `V | undefined` (noUncheckedIndexedAccess). */
export type IdMap<K extends string, V> = Record<K, V>;

// ---- Deterministic allocation -----------------------------------------------------
export type IdKind = 'fighter' | 'news';
export type IdOf<K extends IdKind> = K extends 'fighter' ? FighterId : NewsId;
/** Next number to allocate per id kind. Persisted in GameState.ids. */
export type IdCounters = Record<IdKind, number>;

export const ID_PREFIX: Readonly<Record<IdKind, string>> = { fighter: 'f', news: 'n' };

export function emptyIdCounters(): IdCounters {
  return { fighter: 1, news: 1 };
}

export function formatId<K extends IdKind>(kind: K, n: number): IdOf<K> {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`formatId: invalid number ${n}`);
  return `${ID_PREFIX[kind]}-${n}` as IdOf<K>;
}

/** Allocate the next id of `kind`. Mutates `counters`: call it on a draft state only. */
export function allocateId<K extends IdKind>(counters: IdCounters, kind: K): IdOf<K> {
  const n = counters[kind];
  counters[kind] = n + 1;
  return formatId(kind, n);
}

/** Numeric part of an allocated id ("f-12" -> 12), for ordering. */
export function idNumber(id: string): number {
  const n = Number(id.slice(id.lastIndexOf('-') + 1));
  return Number.isSafeInteger(n) ? n : 0;
}

// ---- Identity ids ----------------------------------------------------------------------
export function leagueCompetitionId(season: number, tierId: TierId): CompetitionId {
  return `lg:${season}:${tierId}` as CompetitionId;
}

export function reckoningCompetitionId(season: number, tierId: TierId): CompetitionId {
  return `rk:${season}:${tierId}` as CompetitionId;
}

export function leagueFixtureId(season: number, tierId: TierId, weekId: WeekId, home: ClubId, away: ClubId): FixtureId {
  return `lg:${season}:${tierId}:${weekId}:${home}:${away}` as FixtureId;
}

/** `slot` is the tie number within the round (1-based). */
export function reckoningFixtureId(season: number, tierId: TierId, roundId: string, slot: number): FixtureId {
  return `rk:${season}:${tierId}:${roundId}:${slot}` as FixtureId;
}

/** Unchecked cast for ids read from validated content or a validated save. */
export function asId<T extends string>(raw: string): T {
  return raw as T;
}
