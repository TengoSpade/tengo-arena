/**
 * core/testkit — golden fixtures for module tests. Owner: architect.
 * May be imported ONLY from *.test.ts(x) files (enforced by tests/architecture).
 *
 * - fixtureContent(): a frozen 6-class content set (one base class per
 *   archetype + one hybrid; every constants file whole), regenerated with
 *   `npm run fixture:content` only when the content schema changes.
 * - buildFixtureWorld(): a hand-built, deterministic GameState (clubs from the
 *   fixture content, simple fighters, lineups, contracts, a few free agents)
 *   so modules and screens can be tested before world generation exists.
 *   No competitions or fixtures (core/league builds those).
 */
import { formatContentIssues, loadContent, type ContentDB, type RawContentFiles } from '../content';
import {
  DEFAULT_GAME_OPTIONS,
  asId,
  createEmptyGameState,
  emptyCareerStats,
  emptySeasonCounters,
  formatId,
  type ClassId,
  type Club,
  type ClubId,
  type Fighter,
  type FighterId,
  type GameState,
  type PaceId,
  type RaceId,
  type RegionId,
  type StatId,
  type TacticsPresetId,
  type TierId,
  type WeekId,
} from '../model';
import fixtureRaw from './fixture-content.json';

export const FIXTURE_CONTENT_RAW = fixtureRaw as unknown as RawContentFiles;
export const FIXTURE_SEED = 'fixture-seed';

let cached: ContentDB | null = null;

/** The frozen fixture ContentDB (validated with the 'fixture' profile). */
export function fixtureContent(): ContentDB {
  if (cached) return cached;
  const result = loadContent('fixture', FIXTURE_CONTENT_RAW, { profile: 'fixture' });
  if (!result.ok) throw new Error(`fixture content is invalid:\n${formatContentIssues(result.error)}`);
  cached = result.value;
  return cached;
}

/** Empty state on the fixture content. */
export function fixtureState(rootSeed = FIXTURE_SEED): GameState {
  return createEmptyGameState({ rootSeed, content: fixtureContent().ref });
}

export interface FixtureWorldOptions {
  /** Fighters per club (default 8, at least 5). */
  fightersPerClub?: number;
  /** Free agents in the pool (default 12). */
  freeAgents?: number;
  /** Only the first N clubs of clubs.json (default all). */
  clubLimit?: number;
  rootSeed?: string;
}

/** Deterministic fighter with plain values; override any field. */
export function makeFixtureFighter(n: number, content: ContentDB, overrides: Partial<Fighter> = {}): Fighter {
  const classes = content.classes.list;
  const races = content.races.list;
  const klass = classes[n % classes.length]!;
  const race = races[n % races.length]!;
  const statIds = content.stats.list.map((s) => s.id as StatId);
  const perStat = (f: (i: number) => number): Record<StatId, number> =>
    Object.fromEntries(statIds.map((id, i) => [id, f(i)])) as Record<StatId, number>;
  const id = formatId('fighter', n);
  return {
    id,
    name: { given: `Given${n}`, family: `Family${n}`, epithet: null, full: `Given${n} Family${n}` },
    raceId: asId<RaceId>(race.id),
    classId: asId<ClassId>(klass.id),
    originRegionId: asId<RegionId>(content.regions.list[0]!.id),
    age: 20 + (n % 12),
    debutSeason: 1,
    clubId: null,
    status: 'free-agent',
    contract: null,
    contractProfile: { greedBp: 0 },
    freeAgency: null,
    potentialRoll: 50 + (n % 40),
    paceId: asId<PaceId>(content.development.pace.levels[2]?.id ?? 'steady'),
    cap100: perStat((i) => 1000 + ((n * 7 + i * 13) % 900)),
    bloom: perStat(() => 0),
    dev100: { physical: 2400, mental: 2400 },
    wear100: perStat(() => 0),
    traits: [],
    statuses: [],
    injury: null,
    trainingEmphasis: 'balanced',
    finalSeason: false,
    career: emptyCareerStats(),
    season: emptySeasonCounters(),
    history: [],
    learnedAbilityIds: [],
    academy: null,
    ...overrides,
  };
}

/** A small, valid-looking world for tests and UI development. */
export function buildFixtureWorld(options: FixtureWorldOptions = {}): GameState {
  const content = fixtureContent();
  const perClub = Math.max(5, options.fightersPerClub ?? 8);
  const state = createEmptyGameState({ rootSeed: options.rootSeed ?? FIXTURE_SEED, content: content.ref, options: DEFAULT_GAME_OPTIONS });
  const firstWeek = content.weekByIndex(1);
  state.calendar = { season: 1, weekIndex: 1, weekId: asId<WeekId>(firstWeek.id), phase: 'preseason' };
  const templates = content.clubs.list.slice(0, options.clubLimit ?? content.clubs.list.length);
  let n = 1;
  for (const t of templates) {
    const clubId = asId<ClubId>(t.id);
    const tier = content.tierByLevel(t.startTierLevel);
    const profile = content.tierProfile(t.startTierLevel);
    const fighterIds: FighterId[] = [];
    for (let i = 0; i < perClub; i++, n++) {
      const f = makeFixtureFighter(n, content, {
        clubId,
        status: 'active',
        contract: {
          clubId,
          wagePerWeek: profile.tierMinWage * 2,
          startSeason: 1,
          endSeason: 1 + (i % 3),
          signedAt: { season: 1, weekIndex: 1 },
          dropClauseApplied: false,
        },
      });
      state.fighters[f.id] = f;
      fighterIds.push(f.id);
    }
    const tactics = Object.fromEntries(
      fighterIds.map((fid) => {
        const k = content.classes.require(state.fighters[fid]!.classId);
        return [fid, { kind: 'preset' as const, presetId: asId<TacticsPresetId>(k.defaultPresetId) }];
      }),
    );
    const club: Club = {
      id: clubId,
      name: t.name,
      shortName: t.shortName,
      code: t.code,
      colors: { ...t.colors },
      regionId: asId(t.regionId),
      districtId: asId(t.districtId),
      tierId: asId<TierId>(tier.id),
      wingId: null,
      aiPersonalityId: asId(t.aiPersonality),
      tacticsStyle: t.tacticsStyle,
      prestige: t.startPrestige,
      finance: {
        balance: profile.startingBalanceBase,
        seasonBudget: 0,
        wageBudgetPerWeek: 0,
        status: 'healthy',
        debtWeeks: 0,
        registryDebt: 0,
        parachuteSeasonsLeft: 0,
        ascensionSeasonsLeft: 0,
      },
      captainId: fighterIds[0] ?? null,
      viceCaptainId: fighterIds[1] ?? null,
      captainAtLastLock: null,
      captainSince: null,
      captainNotFieldedStreak: 0,
      statuses: [],
      lineup: {
        fighters: fighterIds.slice(0, 5).map((fighterId) => ({
          fighterId,
          row: content.classes.require(state.fighters[fighterId]!.classId).startingRow,
        })),
        matchCaptainId: null,
        tactics,
      },
      shortlist: [],
      history: [],
    };
    state.clubs[clubId] = club;
    state.ai[clubId] = { voluntaryReleasesThisSeason: 0 };
    state.ledger.openingBalances[clubId] = club.finance.balance;
  }
  for (let i = 0; i < (options.freeAgents ?? 12); i++, n++) {
    const f = makeFixtureFighter(n, content, {
      freeAgency: { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null },
    });
    state.fighters[f.id] = f;
  }
  state.ids.fighter = n;
  state.playerClubId = templates[0] ? asId<ClubId>(templates[0].id) : null;
  return state;
}
