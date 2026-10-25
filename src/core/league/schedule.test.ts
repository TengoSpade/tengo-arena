import { describe, expect, it } from 'vitest';
import {
  asId,
  leagueCompetitionId,
  type ClubId,
  type Fixture,
  type GameState,
  type SeasonRecord,
  type StandingRow,
  type TierId,
} from '../model';
import { Rng } from '../rng';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { InvariantError, cloneJson, compareStrings } from '../util';
import {
  buildLeagueSchedule,
  clubFixture,
  clubSchedule,
  competitionFixtures,
  fixturesForWeek,
  leagueCompetitionOf,
  seasonSeedOrder,
  serpentineDraw,
  setupSeason,
  validateLeagueSchedule,
  type LeagueSchedule,
} from './index';

const content = fixtureContent();
const rs = content.leagues.regularSeason;
const MUSTER = asId<TierId>('saltmarch-muster');
const BANNER = asId<TierId>('saltmarch-banner');
const CROWN = asId<TierId>('saltmarch-crown');
const c = (n: number): ClubId => asId<ClubId>(`c${String(n).padStart(2, '0')}`);
const C16 = Array.from({ length: 16 }, (_, i) => c(i + 1));

function schedule(seedOrder: readonly ClubId[], season = 1, rootSeed = 'schedule-test'): LeagueSchedule {
  return buildLeagueSchedule({ rootSeed, season, tierId: MUSTER, seedOrder }, content);
}

function find(s: LeagueSchedule, matchweek: number, club: ClubId): Fixture {
  const f = s.fixtures.find((x) => x.matchweek === matchweek && (x.homeClubId === club || x.awayClubId === club));
  if (!f) throw new Error(`no fixture for ${club} in MW${matchweek}`);
  return f;
}

/** Independent le-001 check (does not trust validateLeagueSchedule). */
function expectLe001(s: LeagueSchedule): void {
  const wingOf = new Map<ClubId, string>();
  for (const w of s.wings) for (const id of w.clubIds) wingOf.set(id, w.wingId);
  expect(wingOf.size).toBe(16);
  for (let mw = 1; mw <= 16; mw++) {
    const week = s.fixtures.filter((f) => f.matchweek === mw);
    expect(week).toHaveLength(8);
    const clubs = week.flatMap((f) => [f.homeClubId, f.awayClubId]);
    expect(new Set(clubs).size).toBe(16); // every club exactly once: no byes, no doubles
  }
  for (const club of wingOf.keys()) {
    const mine = s.fixtures.filter((f) => f.homeClubId === club || f.awayClubId === club);
    expect(mine).toHaveLength(16);
    expect(mine.filter((f) => f.homeClubId === club)).toHaveLength(8);
    const wingRivals = mine.filter((f) => f.wing !== 'cross');
    for (const rival of wingOf.keys()) {
      if (rival === club || wingOf.get(rival) !== wingOf.get(club)) continue;
      expect(wingRivals.filter((f) => f.homeClubId === club && f.awayClubId === rival)).toHaveLength(1);
      expect(wingRivals.filter((f) => f.homeClubId === rival && f.awayClubId === club)).toHaveLength(1);
    }
    const cross = mine.filter((f) => f.wing === 'cross');
    expect(cross.map((f) => f.matchweek).sort((a, b) => a! - b!)).toEqual(rs.crossWingMatchweeks);
    const opponents = cross.map((f) => (f.homeClubId === club ? f.awayClubId : f.homeClubId));
    expect(new Set(opponents).size).toBe(2);
    for (const o of opponents) expect(wingOf.get(o)).not.toBe(wingOf.get(club));
    expect(cross.filter((f) => f.homeClubId === club)).toHaveLength(1);
  }
}

describe('serpentine wing draw and cross-wing weeks (le-002)', () => {
  it('splits seeds c01..c16 into Dawn and Dusk by the serpentine', () => {
    const wings = serpentineDraw(C16, content);
    expect(wings.map((w) => w.wingId)).toEqual(['dawn', 'dusk']);
    expect(wings[0]!.clubIds).toEqual([1, 4, 5, 8, 9, 12, 13, 16].map(c));
    expect(wings[1]!.clubIds).toEqual([2, 3, 6, 7, 10, 11, 14, 15].map(c));
    // Each wing's seed numbers sum to 68.
    const sum = (ids: readonly ClubId[]) => ids.reduce((s, id) => s + Number(id.slice(1)), 0);
    expect(sum(wings[0]!.clubIds)).toBe(68);
    expect(sum(wings[1]!.clubIds)).toBe(68);
  });

  it('pairs dawn[k] v dusk[k] at MW5 and dawn[k] v dusk[7-k] at MW12; dawn hosts MW5 in odd seasons', () => {
    const s1 = schedule(C16, 1);
    expect(find(s1, 5, c(1))).toMatchObject({ homeClubId: c(1), awayClubId: c(2), wing: 'cross' });
    expect(find(s1, 5, c(4))).toMatchObject({ homeClubId: c(4), awayClubId: c(3) });
    expect(find(s1, 12, c(1))).toMatchObject({ homeClubId: c(15), awayClubId: c(1), wing: 'cross' });
    expect(find(s1, 12, c(4))).toMatchObject({ homeClubId: c(14), awayClubId: c(4) });
    // Season 2 swaps the hosts.
    const s2 = schedule(C16, 2);
    expect(find(s2, 5, c(1))).toMatchObject({ homeClubId: c(2), awayClubId: c(1) });
    expect(find(s2, 12, c(1))).toMatchObject({ homeClubId: c(1), awayClubId: c(15) });
  });

  it('rejects a seed order that does not fill both wings', () => {
    expect(() => serpentineDraw(C16.slice(0, 15), content)).toThrow(InvariantError);
    expect(() => schedule([...C16.slice(0, 15), c(1)])).toThrow(InvariantError);
  });
});

describe('regular-season schedule (le-001)', () => {
  it('holds for 300 random seed orders in odd and even seasons', () => {
    const rng = Rng.create('le-001');
    let longestRun = 0;
    for (let i = 0; i < 300; i++) {
      const s = schedule(rng.shuffle(C16), 1 + (i % 2), `root-${i}`);
      expectLe001(s);
      for (const club of C16) {
        let run = 0;
        let last: boolean | null = null;
        for (const f of s.fixtures.filter((x) => x.homeClubId === club || x.awayClubId === club)) {
          const home = f.homeClubId === club;
          run = home === last ? run + 1 : 1;
          last = home;
          longestRun = Math.max(longestRun, run);
        }
      }
    }
    // 03-league-economy reports a longest home or away run of 3 for this algorithm.
    expect(longestRun).toBeLessThanOrEqual(3);
  });

  it('mirrors the first half in the second with venues swapped', () => {
    const s = schedule(C16);
    const wing = rs.wingRoundMatchweeks;
    const half = wing.length / 2;
    for (let j = 0; j < half; j++) {
      const first = s.fixtures.filter((f) => f.matchweek === wing[j]).map((f) => `${f.homeClubId}>${f.awayClubId}`).sort(compareStrings);
      const second = s.fixtures.filter((f) => f.matchweek === wing[j + half]).map((f) => `${f.awayClubId}>${f.homeClubId}`).sort(compareStrings);
      expect(second).toEqual(first);
    }
  });

  it('uses identity fixture ids, best-of-3, the home arena and the right calendar weeks', () => {
    const s = schedule(C16);
    const f = find(s, 5, c(1));
    expect(f.id).toBe('lg:1:saltmarch-muster:MW5:c01:c02');
    expect(f).toMatchObject({ competitionId: 'lg:1:saltmarch-muster', weekIndex: 9, weekId: 'MW5', stage: 'league', bestOf: 3, venueId: null, status: 'scheduled' });
    for (const x of s.fixtures) {
      expect(x.id).toBe(`lg:1:saltmarch-muster:${x.weekId}:${x.homeClubId}:${x.awayClubId}`);
      expect(x.weekId).toBe(`MW${x.matchweek}`);
    }
    // Schedule order: week, then id.
    const sorted = [...s.fixtures].sort((a, b) => a.weekIndex - b.weekIndex || compareStrings(a.id, b.id));
    expect(s.fixtures.map((x) => x.id)).toEqual(sorted.map((x) => x.id));
  });

  it('shuffles wing slots per root seed (stream schedule) while keeping the wing draw', () => {
    const a = schedule(C16, 1, 'root-a');
    expect(schedule(C16, 1, 'root-a')).toEqual(a);
    const b = schedule(C16, 1, 'root-b');
    expect(b.wings).toEqual(a.wings);
    expect(b.fixtures.map((f) => f.id)).not.toEqual(a.fixtures.map((f) => f.id));
  });

  it('validation throws on a broken schedule', () => {
    const good = schedule(C16);
    const flipped = cloneJson(good);
    const f = flipped.fixtures[0]!;
    [f.homeClubId, f.awayClubId] = [f.awayClubId, f.homeClubId];
    expect(() => validateLeagueSchedule(flipped, content)).toThrow(InvariantError);
    const missing = cloneJson(good);
    missing.fixtures.pop();
    expect(() => validateLeagueSchedule(missing, content)).toThrow(InvariantError);
    const duplicate = cloneJson(good);
    duplicate.fixtures[1]!.id = duplicate.fixtures[0]!.id;
    expect(() => validateLeagueSchedule(duplicate, content)).toThrow(InvariantError);
    const doubleBooked = cloneJson(good);
    const g = doubleBooked.fixtures.find((x) => x.matchweek === 2)!;
    g.matchweek = 1;
    expect(() => validateLeagueSchedule(doubleBooked, content)).toThrow(InvariantError);
  });
});

describe('setupSeason on the 48-club world', () => {
  const tierClubs = (state: GameState, tierId: TierId): ClubId[] =>
    Object.values(state.clubs).filter((x) => x.tierId === tierId).map((x) => x.id);

  it('creates one league per tier with 128 fixtures, wings and the season-1 seed order', () => {
    const state = buildFixtureWorld();
    setupSeason(state, 1, content);
    expect(Object.keys(state.competitions).sort(compareStrings)).toEqual(['lg:1:saltmarch-banner', 'lg:1:saltmarch-crown', 'lg:1:saltmarch-muster']);
    expect(Object.keys(state.fixtures)).toHaveLength(384);
    for (const tierId of [CROWN, BANNER, MUSTER]) {
      const comp = state.competitions[leagueCompetitionId(1, tierId)]!;
      expect(leagueCompetitionOf(state, 1, tierId)).toBe(comp.id);
      expect(comp).toMatchObject({ kind: 'league', season: 1, tierId, bracket: null, status: 'scheduled' });
      expect(comp.fixtureIds).toHaveLength(128);
      expect(competitionFixtures(state, comp.id)).toEqual(comp.fixtureIds);
      // Season 1: start prestige descending, ties by club id.
      const prestige = (id: ClubId) => content.clubs.require(id).startPrestige;
      const expected = tierClubs(state, tierId).sort((a, b) => prestige(b) - prestige(a) || compareStrings(a, b));
      expect(comp.seedOrder).toEqual(expected);
      expect(comp.wings.map((w) => w.clubIds)).toEqual(serpentineDraw(expected, content).map((w) => w.clubIds));
      for (const w of comp.wings) for (const id of w.clubIds) expect(state.clubs[id]!.wingId).toBe(w.wingId);
      expectLe001({ competitionId: comp.id, wings: comp.wings, fixtures: comp.fixtureIds.map((id) => state.fixtures[id]!) });
    }
    expect(leagueCompetitionOf(state, 2, CROWN)).toBeNull();
  });

  it('serves fixtures by week (tier level, then id), by club and per schedule', () => {
    const state = buildFixtureWorld();
    setupSeason(state, 1, content);
    expect(fixturesForWeek(state, 1, content)).toEqual([]);
    const mw1 = fixturesForWeek(state, 5, content);
    expect(mw1).toHaveLength(24);
    const levels = mw1.map((f) => content.tiers.require(f.tierId).level);
    expect(levels).toEqual([...Array(8).fill(1), ...Array(8).fill(2), ...Array(8).fill(3)]);
    for (let i = 1; i < 8; i++) expect(compareStrings(mw1[i - 1]!.id, mw1[i]!.id)).toBeLessThan(0);
    // Without content: deterministic fixture-id order.
    expect(fixturesForWeek(state, 5).map((f) => f.id)).toEqual(mw1.map((f) => f.id).sort(compareStrings));

    const club = asId<ClubId>('varrow-lanternguard');
    const sched = clubSchedule(state, club);
    expect(sched).toHaveLength(16);
    expect(sched.map((f) => f.weekIndex)).toEqual(Array.from({ length: 16 }, (_, i) => i + 5));
    expect(clubFixture(state, club, 9)).toEqual(sched[4]);
    expect(clubFixture(state, club, 2)).toBeNull();
  });

  it('is deterministic per root seed and refuses to set up a season twice', () => {
    const a = buildFixtureWorld();
    const b = buildFixtureWorld();
    setupSeason(a, 1, content);
    setupSeason(b, 1, content);
    expect(b).toEqual(a);
    expect(() => setupSeason(a, 1, content)).toThrow(InvariantError);
  });

  it('throws when a tier does not hold leagues.json clubCount clubs', () => {
    const state = buildFixtureWorld();
    state.clubs[asId<ClubId>('varrow-lanternguard')]!.tierId = BANNER;
    expect(() => setupSeason(state, 1, content)).toThrow(InvariantError);
    const unknownTier = buildFixtureWorld();
    unknownTier.clubs[asId<ClubId>('varrow-lanternguard')]!.tierId = asId<TierId>('nowhere');
    expect(() => setupSeason(unknownTier, 1, content)).toThrow(InvariantError);
  });
});

describe('seed order after season 1 (relegated, stayed, promoted)', () => {
  const row = (clubId: ClubId, position: number): StandingRow => ({
    clubId,
    position,
    played: 16,
    matchWins: 0,
    matchLosses: 0,
    points: 0,
    roundsWon: 0,
    roundsLost: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    results: { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 },
    form: [],
  });

  it('orders relegated clubs by upper tier rank, then stayers by rank, then the champion and the Shield route', () => {
    const state = buildFixtureWorld();
    const byTier = (t: TierId) => Object.values(state.clubs).filter((x) => x.tierId === t).map((x) => x.id).sort(compareStrings);
    // Final tier tables of season 1: reverse id order, so ranks differ from every default ordering.
    const tables = new Map([CROWN, BANNER, MUSTER].map((t) => [t, byTier(t).reverse()]));
    const crown = tables.get(CROWN)!;
    const banner = tables.get(BANNER)!;
    const muster = tables.get(MUSTER)!;
    const record: SeasonRecord = {
      season: 1,
      tiers: [CROWN, BANNER, MUSTER].map((tierId) => ({
        tierId,
        wingTables: [],
        tierTable: tables.get(tierId)!.map((id, i) => row(id, i + 1)),
        reckoningChampionId: null,
        reckoningRunnerUpId: null,
        shieldWinnerId: tables.get(tierId)![0]!,
        promotedIds: [],
        relegatedIds: [],
      })),
      retirements: [],
      rookieIds: [],
    };
    // Banner: relegates its ranks 15 and 9; promotes its #4 (champion) and #1 (Shield). Muster promotes #6 (champion) and #1.
    const [crownTier, bannerTier, musterTier] = record.tiers as [typeof record.tiers[0], typeof record.tiers[0], typeof record.tiers[0]];
    crownTier.relegatedIds = [crown[14]!, crown[8]!];
    bannerTier.promotedIds = [banner[3]!, banner[0]!];
    bannerTier.relegatedIds = [banner[15]!, banner[10]!];
    musterTier.promotedIds = [muster[5]!, muster[0]!];
    state.history.push(record);
    for (const id of crownTier.relegatedIds) state.clubs[id]!.tierId = BANNER;
    for (const id of bannerTier.promotedIds) state.clubs[id]!.tierId = CROWN;
    for (const id of bannerTier.relegatedIds) state.clubs[id]!.tierId = MUSTER;
    for (const id of musterTier.promotedIds) state.clubs[id]!.tierId = BANNER;

    const order = seasonSeedOrder(state, BANNER, 2, content);
    const stayed = banner.filter((id) => ![...bannerTier.promotedIds, ...bannerTier.relegatedIds].includes(id));
    expect(order).toEqual([crown[8]!, crown[14]!, ...stayed, muster[5]!, muster[0]!]);
    expect(seasonSeedOrder(state, CROWN, 2, content).slice(-2)).toEqual([banner[3]!, banner[0]!]);
    expect(seasonSeedOrder(state, MUSTER, 2, content).slice(0, 2)).toEqual([banner[10]!, banner[15]!]);

    // Season 2 then draws from that order.
    setupSeason(state, 2, content);
    expect(state.competitions[leagueCompetitionId(2, BANNER)]!.seedOrder).toEqual(order);
  });

  it('throws for a club that played in no adjacent tier last season', () => {
    const state = buildFixtureWorld();
    const crownIds = Object.values(state.clubs).filter((x) => x.tierId === CROWN).map((x) => x.id);
    state.history.push({
      season: 1,
      tiers: [{ tierId: CROWN, wingTables: [], tierTable: crownIds.map((id, i) => row(id, i + 1)), reckoningChampionId: null, reckoningRunnerUpId: null, shieldWinnerId: null, promotedIds: [], relegatedIds: [] }],
      retirements: [],
      rookieIds: [],
    });
    expect(seasonSeedOrder(state, CROWN, 2, content)).toEqual(crownIds);
    expect(() => seasonSeedOrder(state, MUSTER, 2, content)).toThrow(InvariantError);
  });
});
