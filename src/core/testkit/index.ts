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
import { clubMatchDefaults, formatContentIssues, loadContent, type ContentDB, type RawContentFiles } from '../content';
import {
  DEFAULT_GAME_OPTIONS,
  FRESHNESS10_MAX,
  asId,
  blankProgression,
  createEmptyGameState,
  emptyCareerStats,
  emptySeasonCounters,
  formatId,
  type ClassId,
  type Club,
  type ClubId,
  type Fighter,
  type FighterId,
  type FightFighterInput,
  type GameState,
  type LevelOption,
  type MatchState,
  type MatchSquad,
  type PendingLevelUp,
  type StartingRow,
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
  /** M1.1: squad reserves per club from the fighters after the five starters (default 0; at most 2). */
  squadReserves?: number;
  rootSeed?: string;
}

/**
 * The developed value cap100 × M_g(D_g + bloom) (core/fighters developed100,
 * mirrored here because testkit may not import core/fighters): fixture
 * fighters' train100 equals what their M1 clocks give, so switching effective
 * stats to train100 (WP-B) changes no fixture stat. Checked by
 * fighters/levels.test.ts.
 */
export function fixtureTrain100(content: ContentDB, f: Pick<Fighter, 'cap100' | 'bloom' | 'dev100'>): Record<StatId, number> {
  const out = {} as Record<StatId, number>;
  for (const s of content.stats.list) {
    const group = s.group === 'physical' ? 'physical' : 'mental';
    const curve = content.development.maturityCurve[group]
      .map(([d, m]) => [Math.round(d * 100), Math.round(m * 10_000)] as const)
      .sort((a, b) => a[0] - b[0]);
    const d = f.dev100[group] + (f.bloom[s.id as StatId] ?? 0);
    let m = curve[curve.length - 1]![1];
    if (d <= curve[0]![0]) m = curve[0]![1];
    else {
      for (let i = 1; i < curve.length; i++) {
        const b = curve[i]!;
        if (d <= b[0]) {
          const a = curve[i - 1]!;
          m = a[1] + Math.trunc(((b[1] - a[1]) * (d - a[0])) / (b[0] - a[0]));
          break;
        }
      }
    }
    const v = ((f.cap100[s.id as StatId] ?? 0) * m) / 10_000;
    out[s.id as StatId] = Math.floor(v + 1e-7);
  }
  return out;
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
  const f: Fighter = {
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
    ...blankProgression({} as Record<StatId, number>),
    ...overrides,
  };
  return overrides.train100 ? f : { ...f, train100: fixtureTrain100(content, f) };
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
        reserves: fighterIds.slice(5, 5 + Math.min(2, Math.max(0, options.squadReserves ?? 0))),
        matchCaptainId: null,
        tactics,
      },
      ...clubMatchDefaults(content, t === templates[0] ? { player: true } : { player: false, personalityId: t.aiPersonality }),
      shortlist: [],
      history: [],
    };
    state.clubs[clubId] = club;
    state.ai[clubId] = { voluntaryReleasesThisSeason: 0 };
    state.ledger.openingBalances[clubId] = club.finance.balance;
  }
  for (let i = 0; i < (options.freeAgents ?? 12); i++, n++) {
    const f = makeFixtureFighter(n, content, {
      freeAgency: { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null, enteredAt: { season: 1, weekIndex: 1 } },
    });
    state.fighters[f.id] = f;
  }
  state.ids.fighter = n;
  state.playerClubId = templates[0] ? asId<ClubId>(templates[0].id) : null;
  return state;
}

// ---- M1.1 fixtures (05 M1.1 addendum) ---------------------------------------------------------------

/** The fighter with Freshness `value` (0-100). */
export function withFreshness(fighter: Fighter, value: number): Fighter {
  const v = Math.max(0, Math.min(100, value));
  return { ...fighter, freshness10: Math.min(FRESHNESS10_MAX, Math.round(v * 10)) };
}

/**
 * A stored level-up offer for a fighter: three stat options for the stats
 * with the most room (+1 point or the rest), or on every 3rd level two stats
 * and a perk (the first general tier I perk), plus an optional trait offer.
 */
export function fixturePendingLevelUp(fighter: Fighter, content: ContentDB, options: { level?: number; traitOffer?: string[] | null; weekIndex?: number } = {}): PendingLevelUp {
  const level = options.level ?? fighter.level + 1;
  const room = content.stats.list
    .map((s) => ({ stat: s.id as StatId, room: (fighter.cap100[s.id as StatId] ?? 0) - (fighter.train100[s.id as StatId] ?? 0) }))
    .filter((x) => x.room > 0)
    .sort((a, b) => b.room - a.room || (a.stat < b.stat ? -1 : 1));
  const stats: LevelOption[] = room.map((x) => ({ kind: 'stat', stat: x.stat, gain100: Math.min(100, x.room) }));
  const perk = content.perks.list.find((p) => p.archetype === 'general' && p.tier === 1);
  const opts: LevelOption[] = level % 3 === 0 && perk ? [...stats.slice(0, 2), { kind: 'perk', perkId: asId(perk.id) }] : stats.slice(0, 3);
  return { level, season: 1, weekIndex: options.weekIndex ?? 1, options: opts, traitOffer: options.traitOffer ? options.traitOffer.map((id) => asId(id)) : null };
}

function classRow(state: GameState, id: FighterId): StartingRow {
  const f = state.fighters[id]!;
  return (fixtureContent().classes.get(f.classId)?.startingRow ?? 'front') as StartingRow;
}

/** A club's match squad from its lineup (starters, reserves, rows, captain and vice). */
export function fixtureSquad(state: GameState, clubId: ClubId): MatchSquad {
  const club = state.clubs[clubId]!;
  const rows = {} as Record<FighterId, StartingRow>;
  for (const e of club.lineup.fighters) rows[e.fighterId] = e.row;
  for (const id of club.lineup.reserves) rows[id] = state.fighters[id] ? classRow(state, id) : 'front';
  return {
    starters: club.lineup.fighters.map((e) => e.fighterId),
    reserves: [...club.lineup.reserves],
    rows,
    captainId: club.captainId,
    viceCaptainId: club.viceCaptainId,
  };
}

/** Plain fight input (stats = train100 ÷ 100, clamped 1-20; CQ 50; the lineup's preset). Not the real lock: for orchestrator unit tests. */
export function fixtureFightInput(state: GameState, clubId: ClubId, fighterId: FighterId, slot: number, row: StartingRow, content: ContentDB): FightFighterInput {
  const f = state.fighters[fighterId]!;
  const stats = {} as Record<StatId, number>;
  for (const s of content.stats.list) stats[s.id as StatId] = Math.max(1, Math.min(20, Math.floor((f.train100[s.id as StatId] ?? 1000) / 100)));
  const k = content.classes.require(f.classId);
  return {
    fighterId,
    classId: f.classId,
    raceId: f.raceId,
    row,
    slot,
    stats,
    captainQuality: 50,
    traitIds: f.traits.map((x) => x.id),
    tactics: state.clubs[clubId]!.lineup.tactics[fighterId] ?? { kind: 'preset', presetId: asId(k.defaultPresetId) },
    rating: 50,
  };
}

/**
 * A MatchState before round 1 between two clubs of a fixture world built with
 * squadReserves (phase round_pending; no fixture needed): for swap-legality,
 * between-round and replay tests before the real startMatch lands.
 */
export function fixtureMatchState(state: GameState, homeClubId: ClubId, awayClubId: ClubId, content: ContentDB, bestOf = 3): MatchState {
  const side = (clubId: ClubId): { side: MatchState['home']; input: FightFighterInput[]; all: FightFighterInput[] } => {
    const squad = fixtureSquad(state, clubId);
    const input = squad.starters.map((id, slot) => fixtureFightInput(state, clubId, id, slot, squad.rows[id]!, content));
    const reserves = squad.reserves.map((id, i) => fixtureFightInput(state, clubId, id, 5 + i, squad.rows[id]!, content));
    return {
      side: {
        clubId,
        squad,
        active: [...squad.starters],
        rows: squad.starters.map((id) => squad.rows[id]!),
        withdrawn: [],
        unusedReserves: [...squad.reserves],
        swapsUsed: 0,
        injured: [],
        emergencyEntrants: [],
        actingCaptainId: squad.captainId,
        entering: [],
      },
      input,
      all: [...input, ...reserves],
    };
  };
  const home = side(homeClubId);
  const away = side(awayClubId);
  const inputsById = {} as Record<FighterId, FightFighterInput>;
  for (const f of [...home.all, ...away.all]) inputsById[f.fighterId] = f;
  const sideInput = (clubId: ClubId, fighters: FightFighterInput[]) => ({ clubId, fighters, captainIndex: 0, viceCaptainIndex: 1, chemistry: 0 });
  return {
    fixtureId: asId(`fixture:${homeClubId}:${awayClubId}`),
    seed: 'fixture-match-seed',
    bestOf,
    phase: 'round_pending',
    score: { home: 0, away: 0 },
    rounds: [],
    roundLineups: [],
    betweenRounds: [],
    home: home.side,
    away: away.side,
    input: { seed: 'fixture-match-seed', bestOf, home: sideInput(homeClubId, home.input), away: sideInput(awayClubId, away.input) },
    inputsById,
    fighterStats: {},
    hiredBladeIds: [],
    playerDecisions: null,
  };
}
