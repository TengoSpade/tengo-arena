import type { ContentRef } from '../model';
import { InvariantError } from '../util';
import type { ContentIssue } from './issues';
import type {
  AbilityDef,
  AiPersonalityDef,
  CalendarWeekDef,
  ClassDef,
  ClubTemplate,
  CombatConstants,
  ContentFiles,
  DevelopmentConstants,
  EconomyConstants,
  LeaguesConfig,
  NamesConfig,
  PresetDef,
  RaceDef,
  RegionDef,
  StatDef,
  StatusDef,
  TacticsLimits,
  TierDef,
  TierProfile,
  TraitDef,
  VenueDef,
  Vocabulary,
} from './types';

/** Read-only lookup over one kind of content entry, in file order. */
export interface Registry<T extends { readonly id: string }> {
  readonly list: readonly T[];
  get(id: string): T | undefined;
  /** Like get, but throws InvariantError for an unknown id (use only for ids that validation guarantees). */
  require(id: string): T;
  has(id: string): boolean;
}

export function createRegistry<T extends { readonly id: string }>(items: readonly T[], what: string): Registry<T> {
  const byId = new Map<string, T>();
  for (const item of items) byId.set(item.id, item);
  return {
    list: items,
    get: (id) => byId.get(id),
    require: (id) => {
      const item = byId.get(id);
      if (!item) throw new InvariantError(`Unknown ${what} "${id}"`);
      return item;
    },
    has: (id) => byId.has(id),
  };
}

/**
 * Validated, frozen content of one theme. Built once at startup by
 * loadContent(); every module reads content only through this object.
 * Values are in authoring units (see units.ts).
 */
export interface ContentDB {
  readonly ref: ContentRef;
  /** The validated files as authored. */
  readonly files: Readonly<ContentFiles>;
  /** Non-blocking validation findings. */
  readonly warnings: readonly ContentIssue[];

  readonly combat: CombatConstants;
  readonly development: DevelopmentConstants;
  readonly economy: EconomyConstants;
  readonly leagues: LeaguesConfig;
  readonly names: NamesConfig;
  readonly vocabulary: Vocabulary;
  readonly tacticsLimits: TacticsLimits;

  readonly stats: Registry<StatDef>;
  readonly statuses: Registry<StatusDef>;
  readonly classes: Registry<ClassDef>;
  readonly abilities: Registry<AbilityDef>;
  readonly presets: Registry<PresetDef>;
  readonly races: Registry<RaceDef>;
  readonly traits: Registry<TraitDef>;
  readonly clubs: Registry<ClubTemplate>;
  readonly regions: Registry<RegionDef>;
  readonly tiers: Registry<TierDef>;
  readonly venues: Registry<VenueDef>;
  readonly weeks: Registry<CalendarWeekDef>;
  readonly aiPersonalities: Registry<AiPersonalityDef>;

  /** Tier by level (1 = top). Throws for an unknown level. */
  tierByLevel(level: number): TierDef;
  /** Economy profile of a tier level. Throws for an unknown level. */
  tierProfile(level: number): TierProfile;
  /** Calendar week by 1-based season week index. Throws for an unknown index. */
  weekByIndex(index: number): CalendarWeekDef;
  /** The ability in a class's kit slot. Throws for an unknown class. */
  classAbility(classId: string, slot: 'basic' | 'a1' | 'a2' | 'passive'): AbilityDef;
}

export function buildContentDB(ref: ContentRef, files: ContentFiles, warnings: readonly ContentIssue[]): ContentDB {
  const tiers = createRegistry(files.leagues.tiers, 'tier');
  const tiersByLevel = new Map(files.leagues.tiers.map((t) => [t.level, t]));
  const profiles = new Map(files.economy.tierProfiles.map((p) => [p.tierLevel, p]));
  const weeks = createRegistry(files.leagues.calendar.weeks, 'calendar week');
  const weeksByIndex = new Map(files.leagues.calendar.weeks.map((w) => [w.index, w]));
  const classes = createRegistry(files.classes.classes, 'class');
  const abilities = createRegistry(files.abilities.abilities, 'ability');
  const need = <T>(value: T | undefined, what: string): T => {
    if (value === undefined) throw new InvariantError(`Unknown ${what}`);
    return value;
  };
  return {
    ref,
    files,
    warnings,
    combat: files.combat,
    development: files.development,
    economy: files.economy,
    leagues: files.leagues,
    names: files.names,
    vocabulary: files['tactics-presets'].vocabulary,
    tacticsLimits: files['tactics-presets'].limits,
    stats: createRegistry(files.combat.attributes, 'stat'),
    statuses: createRegistry(files.combat.statuses, 'status'),
    classes,
    abilities,
    presets: createRegistry(files['tactics-presets'].presets, 'preset'),
    races: createRegistry(files.races.races, 'race'),
    traits: createRegistry(files.traits.traits, 'trait'),
    clubs: createRegistry(files.clubs.clubs, 'club'),
    regions: createRegistry(files.leagues.regions, 'region'),
    tiers,
    venues: createRegistry(files.leagues.venues, 'venue'),
    weeks,
    aiPersonalities: createRegistry(files.economy.aiPersonalities, 'AI personality'),
    tierByLevel: (level) => need(tiersByLevel.get(level), `tier level ${level}`),
    tierProfile: (level) => need(profiles.get(level), `tier profile ${level}`),
    weekByIndex: (index) => need(weeksByIndex.get(index), `calendar week ${index}`),
    classAbility: (classId, slot) => abilities.require(classes.require(classId).abilities[slot]),
  };
}
