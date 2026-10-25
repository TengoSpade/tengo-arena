/**
 * Identifiers.
 *
 * Runtime ids are strings so GameState stays plain JSON. Branded types stop
 * a FighterId being passed where a ClubId is expected. Engine ids are
 * allocated deterministically from GameState.ids counters (never random, never
 * time-based), so the same seed and commands always produce the same ids.
 *
 * Content ids (ClassId, AbilityId, ...) are the `id` keys of entries in
 * content/<theme>/*.json; core/content validates every reference at load.
 */

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

// ---- Engine ids (allocated by the game) ------------------------------------
export type ClubId = Brand<string, 'ClubId'>;
export type FighterId = Brand<string, 'FighterId'>;
export type CompetitionId = Brand<string, 'CompetitionId'>;
export type FixtureId = Brand<string, 'FixtureId'>;
export type NewsId = Brand<string, 'NewsId'>;

// ---- Content ids (defined in content JSON) ---------------------------------
export type ClassId = Brand<string, 'ClassId'>;
export type AbilityId = Brand<string, 'AbilityId'>;
export type RaceId = Brand<string, 'RaceId'>;
export type TraitId = Brand<string, 'TraitId'>;
export type StatId = Brand<string, 'StatId'>;
export type TacticsPresetId = Brand<string, 'TacticsPresetId'>;
/** A region from leagues.json (talent pool; hosts leagues from M6). */
export type RegionId = Brand<string, 'RegionId'>;
/** A league tier from leagues.json (tier 1 is the top). */
export type TierId = Brand<string, 'TierId'>;
/** A tournament definition from leagues.json. */
export type TournamentTemplateId = Brand<string, 'TournamentTemplateId'>;
/** A club template from clubs.json. */
export type ClubTemplateId = Brand<string, 'ClubTemplateId'>;
/** An AI manager profile (style) from clubs.json or economy/ai content. */
export type AiProfileId = Brand<string, 'AiProfileId'>;

/** Map keyed by an id. Lookups return `V | undefined` (noUncheckedIndexedAccess). */
export type IdMap<K extends string, V> = Record<K, V>;

// ---- Deterministic allocation ----------------------------------------------
export type IdKind = 'club' | 'fighter' | 'competition' | 'fixture' | 'news';

export type IdOf<K extends IdKind> = K extends 'club'
  ? ClubId
  : K extends 'fighter'
    ? FighterId
    : K extends 'competition'
      ? CompetitionId
      : K extends 'fixture'
        ? FixtureId
        : NewsId;

/** Next number to allocate per id kind. Persisted in GameState.ids. */
export type IdCounters = Record<IdKind, number>;

export const ID_PREFIX: Readonly<Record<IdKind, string>> = {
  club: 'c',
  fighter: 'f',
  competition: 'cmp',
  fixture: 'fx',
  news: 'n',
};

export function emptyIdCounters(): IdCounters {
  return { club: 1, fighter: 1, competition: 1, fixture: 1, news: 1 };
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

/** Unchecked cast for ids read from validated content or a validated save. */
export function asId<T extends string>(raw: string): T {
  return raw as T;
}
