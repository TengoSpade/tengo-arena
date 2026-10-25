/**
 * TEST DOUBLES for core/fighters, used only by economy tests:
 *
 *   vi.mock('../fighters', async () => (await import('./testing')).fightersDouble);
 *
 * Economy tests pin exact ratings, potentials and human-ages (the 03 worked
 * examples) independently of WP2's lifecycle numbers. Not imported by any
 * production code. Pure (no platform APIs); module state is reset per test.
 */
import type { ContentDB } from '../content';
import type { FighterSpec } from '../fighters';
import type {
  ClassId,
  ClubId,
  CompetitionId,
  Fighter,
  FighterId,
  FightFighterInput,
  Fixture,
  FixtureId,
  FixtureStage,
  GameState,
  MatchResult,
  PaceId,
  RaceId,
  SideInput,
  StandingRow,
  StatId,
  TierId,
  TierSeasonRecord,
  VenueId,
  WeekId,
} from '../model';
import { allocateId, asId, emptyCareerStats, emptySeasonCounters } from '../model';
import { Rng } from '../rng';

export interface DoubleValues {
  rating: number;
  potential: number;
  /** Hundredths of a human-year; default from age and race lifespan. */
  humanAge100?: number;
  fit?: boolean;
}

const values = new Map<string, DoubleValues>();
const created: { id: FighterId; spec: FighterSpec }[] = [];

export function setFighterValues(id: string, v: DoubleValues): void {
  values.set(id, v);
}

export function resetFighterDoubles(): void {
  values.clear();
  created.length = 0;
}

/** Specs passed to createFighter since the last reset (assertions on journeymen and hired blades). */
export function createdFighters(): readonly { id: FighterId; spec: FighterSpec }[] {
  return created;
}

function lifespan(f: Fighter, content: ContentDB): number {
  return content.races.get(f.raceId)?.lifespan ?? 80;
}

/** A plain fighter record (same shape as testkit makeFixtureFighter). */
export function plainFighter(id: FighterId, content: ContentDB, overrides: Partial<Fighter> = {}): Fighter {
  const statIds = content.stats.list.map((s) => s.id as StatId);
  const perStat = (v: number): Record<StatId, number> => Object.fromEntries(statIds.map((s) => [s, v])) as Record<StatId, number>;
  return {
    id,
    name: { given: `Given ${id}`, family: null, epithet: null, full: `Given ${id}` },
    raceId: asId<RaceId>(content.races.list[0]!.id),
    classId: asId<ClassId>(content.classes.list[0]!.id),
    originRegionId: asId(content.regions.list[0]!.id),
    age: 25,
    debutSeason: 1,
    clubId: null,
    status: 'free-agent',
    contract: null,
    contractProfile: { greedBp: 0 },
    freeAgency: null,
    potentialRoll: 50,
    paceId: asId<PaceId>(content.development.pace.levels[0]?.id ?? 'steady'),
    cap100: perStat(1200),
    bloom: perStat(0),
    dev100: { physical: 2400, mental: 2400 },
    wear100: perStat(0),
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

export const fightersDouble = {
  rating(f: Fighter, _content: ContentDB): number {
    return values.get(f.id)?.rating ?? Math.max(1, f.potentialRoll - 10);
  },
  potential(f: Fighter, _content: ContentDB): number {
    return values.get(f.id)?.potential ?? f.potentialRoll;
  },
  humanAge100(f: Fighter, content: ContentDB): number {
    return values.get(f.id)?.humanAge100 ?? Math.trunc((f.age * 8000) / lifespan(f, content));
  },
  isFit(f: Fighter): boolean {
    const v = values.get(f.id)?.fit;
    if (v !== undefined) return v;
    return f.status !== 'retired' && (f.injury === null || f.injury.weeksOut === 0);
  },
  createFighter(draft: GameState, spec: FighterSpec, content: ContentDB): FighterId {
    const id = allocateId(draft.ids, 'fighter');
    const rng = Rng.create(draft.rng.root, 'test-double', id);
    const klass = spec.classId ?? asId<ClassId>(rng.pick(content.classes.list).id);
    const race = spec.raceId ?? asId<RaceId>(content.races.list[0]!.id);
    const ha = spec.humanAge ? rng.int(spec.humanAge.min, spec.humanAge.max) : 25;
    const life = content.races.get(race)?.lifespan ?? 80;
    const age = Math.trunc((ha * life) / 80);
    const lowest = [...content.tiers.list].sort((a, b) => b.level - a.level)[0]!;
    const rating = spec.ratingTarget ?? rng.int(lowest.ratingBand.min, lowest.ratingBand.max);
    const f = plainFighter(id, content, { classId: klass, raceId: race, originRegionId: spec.regionId, age, potentialRoll: rating + 3 });
    draft.fighters[id] = f;
    values.set(id, { rating, potential: Math.max(rating, rating + 3 + spec.potentialShift), humanAge100: ha * 100 });
    created.push({ id, spec });
    return id;
  },
};

// ---- state builders for economy tests (no testkit import: callers pass the fixture state and content) ----------

/** Add a fighter with pinned double values; on a roster when clubId is given (contract wage/endSeason). */
export function addFighter(
  state: GameState,
  content: ContentDB,
  opts: { values: DoubleValues; clubId?: ClubId | null; wage?: number; endSeason?: number; overrides?: Partial<Fighter> },
): Fighter {
  const id = allocateId(state.ids, 'fighter');
  const clubId = opts.clubId ?? null;
  const season = state.calendar.season;
  const f = plainFighter(id, content, {
    clubId,
    status: clubId ? 'active' : 'free-agent',
    contract: clubId
      ? {
          clubId,
          wagePerWeek: opts.wage ?? 100,
          startSeason: season,
          endSeason: opts.endSeason ?? season,
          signedAt: { season, weekIndex: 0 },
          dropClauseApplied: false,
        }
      : null,
    freeAgency: clubId ? null : { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null },
    ...opts.overrides,
  });
  state.fighters[id] = f;
  values.set(id, opts.values);
  return f;
}

/** Remove every fighter of a club from its roster (they become retired placeholders). */
export function clearRoster(state: GameState, clubId: ClubId): void {
  for (const f of Object.values(state.fighters)) {
    if (f.clubId === clubId) {
      f.clubId = null;
      f.contract = null;
      f.status = 'retired';
    }
  }
}

/** Put the calendar on a week index (phase from leagues.json). */
export function setWeek(state: GameState, content: ContentDB, weekIndex: number, season = state.calendar.season): void {
  const week = content.weekByIndex(weekIndex);
  state.calendar = { season, weekIndex, weekId: asId<WeekId>(week.id), phase: week.phase };
}

/** A played fixture with a minimal committed result (enough for gates, bonuses and usage). */
export function addPlayedFixture(
  state: GameState,
  content: ContentDB,
  p: {
    weekIndex: number;
    home: ClubId;
    away: ClubId;
    winner: ClubId;
    homeFighters?: readonly FighterId[];
    awayFighters?: readonly FighterId[];
    stage?: FixtureStage;
    season?: number;
    played?: boolean;
  },
): Fixture {
  const season = p.season ?? state.calendar.season;
  const week = content.weekByIndex(p.weekIndex);
  const stage = p.stage ?? 'league';
  const tierId = state.clubs[p.home]!.tierId;
  const id = (stage === 'league' ? `lg:${season}:${tierId}:${week.id}:${p.home}:${p.away}` : `rk:${season}:${tierId}:${stage}:${p.home}`) as FixtureId;
  const fixture: Fixture = {
    id,
    competitionId: `${stage === 'league' ? 'lg' : 'rk'}:${season}:${tierId}` as CompetitionId,
    season,
    tierId,
    weekIndex: p.weekIndex,
    weekId: asId<WeekId>(week.id),
    stage,
    matchweek: week.matchweek ?? null,
    wing: null,
    homeClubId: p.home,
    awayClubId: p.away,
    bestOf: stage === 'final' ? 5 : 3,
    venueId: stage === 'final' ? asId<VenueId>('charterhall') : null,
    status: p.played === false ? 'scheduled' : 'played',
  };
  state.fixtures[id] = fixture;
  if (p.played === false) return fixture;
  const side = (clubId: ClubId, ids: readonly FighterId[] | undefined): SideInput => ({
    clubId,
    fighters: (ids ?? []).map(
      (fighterId, slot) => ({ fighterId, slot, traitIds: state.fighters[fighterId]?.traits.map((t) => t.id) ?? [] }) as unknown as FightFighterInput,
    ),
    captainIndex: 0,
    viceCaptainIndex: null,
    chemistry: 0,
  });
  const homeWon = p.winner === p.home;
  const result: MatchResult = {
    fixtureId: id,
    competitionId: fixture.competitionId,
    stage,
    season,
    weekIndex: p.weekIndex,
    weekId: fixture.weekId,
    homeClubId: p.home,
    awayClubId: p.away,
    engineVersion: 0,
    contentHash: 'test',
    input: { seed: 'test', bestOf: fixture.bestOf, home: side(p.home, p.homeFighters), away: side(p.away, p.awayFighters) },
    rounds: [],
    score: { home: homeWon ? 2 : 1, away: homeWon ? 1 : 2 },
    winnerClubId: p.winner,
    fighterStats: {},
    mvpFighterId: null,
    hiredBladeIds: [],
  };
  state.results[id] = result;
  return fixture;
}

/** A standings row with only the fields economy reads (club and position). */
export function standingRow(clubId: ClubId, position: number): StandingRow {
  return {
    clubId,
    position,
    played: 16,
    matchWins: 8,
    matchLosses: 8,
    points: 24,
    roundsWon: 0,
    roundsLost: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    results: { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 },
    form: [],
  };
}

/** Season record for one tier: clubs in tier-table order; optional champion, runner-up and movements. */
export function tierRecord(
  tierId: TierId,
  clubIdsInOrder: readonly ClubId[],
  extra: Partial<Pick<TierSeasonRecord, 'reckoningChampionId' | 'reckoningRunnerUpId' | 'promotedIds' | 'relegatedIds'>> = {},
): TierSeasonRecord {
  return {
    tierId,
    wingTables: [],
    tierTable: clubIdsInOrder.map((id, i) => standingRow(id, i + 1)),
    reckoningChampionId: extra.reckoningChampionId ?? null,
    reckoningRunnerUpId: extra.reckoningRunnerUpId ?? null,
    shieldWinnerId: clubIdsInOrder[0] ?? null,
    promotedIds: extra.promotedIds ?? [],
    relegatedIds: extra.relegatedIds ?? [],
  };
}

/** Put the calendar into the season-end step of its season. */
export function toSeasonEnd(state: GameState, content: ContentDB): void {
  state.calendar = { season: state.calendar.season, weekIndex: content.leagues.calendar.weeks.length + 1, weekId: null, phase: 'season-end' };
}

/** Set a club balance directly as a new opening balance (test setup only; keeps the ledger invariant). */
export function setOpeningBalance(state: GameState, clubId: ClubId, balance: number): void {
  const club = state.clubs[clubId]!;
  const sum = state.ledger.entries.filter((e) => e.clubId === clubId).reduce((s, e) => s + e.amount, 0);
  club.finance.balance = balance;
  state.ledger.openingBalances[clubId] = balance - sum;
}
