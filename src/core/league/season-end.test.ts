import { describe, expect, it } from 'vitest';
import {
  asId,
  leagueCompetitionId,
  reckoningCompetitionId,
  type ClubId,
  type FighterId,
  type GameState,
  type SeasonRecord,
  type TierId,
} from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { InvariantError, cloneJson, stableStringify } from '../util';
import {
  applyTierMoves,
  archiveSeason,
  clubSchedule,
  compactHistory,
  isCompactedResult,
  leagueRecords,
  leagueSeasonColumns,
  promotionRelegation,
  seasonStartCalendar,
  setupSeason,
  standings,
  type TierMove,
} from './index';
import { byStrength, playSeason, playWeek, type Decide } from './test-support';

const content = fixtureContent();
const CROWN = asId<TierId>('saltmarch-crown');
const BANNER = asId<TierId>('saltmarch-banner');
const MUSTER = asId<TierId>('saltmarch-muster');
const strength = (c: ClubId) => content.clubs.require(c).startPrestige;
const tierTable = (state: GameState, tierId: TierId, season = state.calendar.season) =>
  standings(state, leagueCompetitionId(season, tierId), 'tier', content);

/**
 * Season 1 headless: the stronger club wins every league match; in the
 * Reckoning `hero(state)` (picked once the regular season is over) wins every tie of its tier.
 */
function seasonWithReckoningHero(hero: (state: GameState) => ClubId): GameState {
  const state = buildFixtureWorld();
  setupSeason(state, 1, content);
  const base = byStrength(strength);
  while (state.calendar.weekIndex <= 20) playWeek(state, content, base);
  const winner = hero(state);
  const decide: Decide = (f) => {
    const need = (f.bestOf + 1) / 2;
    if (f.homeClubId === winner) return { home: need, away: 0 };
    if (f.awayClubId === winner) return { home: 0, away: need };
    return base(f);
  };
  playSeason(state, content, decide);
  return state;
}

/** The lowest-ranked Muster qualifier wins the Muster Reckoning (le-007). */
const lowQualifier = (state: GameState): ClubId => {
  const seeds = state.competitions[reckoningCompetitionId(1, MUSTER)]!.bracket!.seeds;
  const table = tierTable(state, MUSTER);
  return [...seeds].sort((a, b) => table.find((r) => r.clubId === b)!.position - table.find((r) => r.clubId === a)!.position)[0]!;
};
/** Muster's tier-table #1 wins the Muster Reckoning (le-008). */
const tierLeader = (state: GameState): ClubId => tierTable(state, MUSTER)[0]!.clubId;

function wingEighths(state: GameState, tierId: TierId): ClubId[] {
  const comp = state.competitions[leagueCompetitionId(1, tierId)]!;
  return comp.wings.map((w) => standings(state, comp.id, w.wingId, content)[7]!.clubId);
}

describe('promotion and relegation', () => {
  it('le-007: the Muster champion (low in the table) and the Shield winner go up; each wing 8th goes down', () => {
    const state = seasonWithReckoningHero(lowQualifier);
    const musterTable = tierTable(state, MUSTER);
    const champion = state.competitions[reckoningCompetitionId(1, MUSTER)]!.bracket!.championId!;
    const championRank = musterTable.find((r) => r.clubId === champion)!.position;
    expect(championRank).toBeGreaterThan(1);
    const bannerEighths = wingEighths(state, BANNER);
    const crownEighths = wingEighths(state, CROWN);

    const moves = promotionRelegation(state, content);
    expect(moves).toHaveLength(8);
    const up = (t: TierId) => moves.filter((m) => m.from === t && m.reason !== 'relegated');
    const down = (t: TierId) => moves.filter((m) => m.from === t && m.reason === 'relegated');
    expect(up(MUSTER)).toEqual([
      { clubId: champion, from: MUSTER, to: BANNER, reason: 'reckoning' },
      { clubId: musterTable[0]!.clubId, from: MUSTER, to: BANNER, reason: 'shield' },
    ]);
    expect(new Set(down(BANNER).map((m) => m.clubId))).toEqual(new Set(bannerEighths));
    expect(down(BANNER).every((m) => m.to === MUSTER)).toBe(true);
    expect(new Set(down(CROWN).map((m) => m.clubId))).toEqual(new Set(crownEighths));
    expect(up(CROWN)).toEqual([]);
    expect(down(MUSTER)).toEqual([]);
    expect(up(BANNER).map((m) => m.to)).toEqual([CROWN, CROWN]);

    applyTierMoves(state, moves);
    for (const t of [CROWN, BANNER, MUSTER]) {
      expect(Object.values(state.clubs).filter((c) => c.tierId === t)).toHaveLength(16);
    }
    expect(state.clubs[champion]!.tierId).toBe(BANNER);
  });

  it('le-008: when the tier-table #1 also wins the Reckoning, #2 goes up with it', () => {
    const state = seasonWithReckoningHero(tierLeader);
    const musterTable = tierTable(state, MUSTER);
    const moves = promotionRelegation(state, content).filter((m) => m.from === MUSTER);
    expect(moves.map((m) => [m.clubId, m.reason])).toEqual([
      [musterTable[0]!.clubId, 'reckoning'],
      [musterTable[1]!.clubId, 'shield'],
    ]);
  });

  it('is pure and refuses to decide before the Reckoning has a champion', () => {
    const state = seasonWithReckoningHero(tierLeader);
    const before = cloneJson(state);
    promotionRelegation(state, content);
    expect(state).toEqual(before);
    const early = buildFixtureWorld();
    setupSeason(early, 1, content);
    expect(() => promotionRelegation(early, content)).toThrow(InvariantError);
  });

  it('applyTierMoves validates every move before changing any club', () => {
    const state = buildFixtureWorld();
    const crownClub = Object.values(state.clubs).find((c) => c.tierId === CROWN)!.id;
    const bannerClub = Object.values(state.clubs).find((c) => c.tierId === BANNER)!.id;
    const before = cloneJson(state);
    const good: TierMove = { clubId: bannerClub, from: BANNER, to: CROWN, reason: 'shield' };
    expect(() => applyTierMoves(state, [good, { clubId: crownClub, from: BANNER, to: MUSTER, reason: 'relegated' }])).toThrow(InvariantError);
    expect(() => applyTierMoves(state, [good, good])).toThrow(InvariantError);
    expect(() => applyTierMoves(state, [{ ...good, clubId: asId<ClubId>('nobody') }])).toThrow(InvariantError);
    expect(state).toEqual(before);
    applyTierMoves(state, [good]);
    expect(state.clubs[bannerClub]!.tierId).toBe(CROWN);
  });
});

describe('archive and next season', () => {
  function archived(): { state: GameState; moves: TierMove[]; record: SeasonRecord } {
    const state = seasonWithReckoningHero(lowQualifier);
    const moves = promotionRelegation(state, content);
    return { state, moves, record: archiveSeason(state, moves, content) };
  }

  it('archives wing and tier tables, the Reckoning podium, the Shield and the movements per tier', () => {
    const { state, moves, record } = archived();
    expect(record.season).toBe(1);
    expect(record.retirements).toEqual([]);
    expect(record.rookieIds).toEqual([]);
    expect(record.tiers.map((t) => t.tierId)).toEqual([CROWN, BANNER, MUSTER]);
    for (const t of record.tiers) {
      const rk = state.competitions[reckoningCompetitionId(1, t.tierId)]!.bracket!;
      expect(t.tierTable).toEqual(tierTable(state, t.tierId));
      expect(t.wingTables.map((w) => [w.wingId, w.rows.length])).toEqual([['dawn', 8], ['dusk', 8]]);
      expect(t.reckoningChampionId).toBe(rk.championId);
      expect(t.reckoningRunnerUpId).toBe(rk.runnerUpId);
      const stages = t.reckoningStages ?? {};
      expect(Object.keys(stages).sort()).toEqual([...rk.seeds].sort());
      expect(stages[rk.championId!]).toBe('champion');
      expect(stages[rk.runnerUpId!]).toBe('final');
      for (const c of rk.seeds) expect(leagueSeasonColumns(state, record, c)?.reckoning).toBe(stages[c]);
      expect(t.shieldWinnerId).toBe(t.tierTable[0]!.clubId);
      expect(t.promotedIds).toEqual(moves.filter((m) => m.from === t.tierId && m.reason !== 'relegated').map((m) => m.clubId));
      expect(t.relegatedIds).toEqual(moves.filter((m) => m.from === t.tierId && m.reason === 'relegated').map((m) => m.clubId));
    }
    expect(record.tiers[0]!.promotedIds).toEqual([]);
    expect(record.tiers[2]!.relegatedIds).toEqual([]);
  });

  it('provides the league columns of each club season row', () => {
    const { state, record } = archived();
    const muster = record.tiers[2]!;
    const champion = muster.reckoningChampionId!;
    const champRow = muster.tierTable.find((r) => r.clubId === champion)!;
    expect(leagueSeasonColumns(state, record, champion)).toEqual({
      season: 1,
      tierId: MUSTER,
      wingId: state.clubs[champion]!.wingId,
      wingPosition: muster.wingTables.flatMap((w) => w.rows).find((r) => r.clubId === champion)!.position,
      tierPosition: champRow.position,
      points: champRow.points,
      matchWins: champRow.matchWins,
      matchLosses: champRow.matchLosses,
      reckoning: 'champion',
      shield: false,
      promoted: true,
      relegated: false,
    });
    const shield = leagueSeasonColumns(state, record, muster.shieldWinnerId!)!;
    expect(shield).toMatchObject({ tierPosition: 1, shield: true, promoted: true });
    const relegated = leagueSeasonColumns(state, record, record.tiers[0]!.relegatedIds[0]!)!;
    expect(relegated).toMatchObject({ tierId: CROWN, wingPosition: 8, relegated: true, promoted: false });
    const outsider = muster.wingTables[0]!.rows[7]!.clubId;
    expect(leagueSeasonColumns(state, record, outsider)!.reckoning).toBeNull();
    expect(leagueSeasonColumns(state, record, asId<ClubId>('nobody'))).toBeNull();
  });

  it('sets up season 2 from the archive: new seed orders, wings, swapped cross-wing hosts', () => {
    const { state, moves, record } = archived();
    state.history.push(record);
    applyTierMoves(state, moves);
    setupSeason(state, 2, content);
    state.calendar = seasonStartCalendar(2, content);

    const banner = state.competitions[leagueCompetitionId(2, BANNER)]!;
    const fromCrown = record.tiers[0]!.relegatedIds;
    const crownRank = (c: ClubId) => record.tiers[0]!.tierTable.find((r) => r.clubId === c)!.position;
    const fromMuster = record.tiers[2]!.promotedIds;
    expect(banner.seedOrder.slice(0, 2)).toEqual([...fromCrown].sort((a, b) => crownRank(a) - crownRank(b)));
    expect(banner.seedOrder.slice(-2)).toEqual(fromMuster);
    const stayed = record.tiers[1]!.tierTable.map((r) => r.clubId).filter((c) => !record.tiers[1]!.promotedIds.includes(c) && !record.tiers[1]!.relegatedIds.includes(c));
    expect(banner.seedOrder.slice(2, -2)).toEqual(stayed);

    // Even season: dusk hosts the first cross-wing week.
    const [dawn, dusk] = banner.wings;
    const mw5 = clubSchedule(state, dawn!.clubIds[0]!).find((f) => f.weekId === 'MW5')!;
    expect(mw5).toMatchObject({ homeClubId: dusk!.clubIds[0], awayClubId: dawn!.clubIds[0] });
    for (const id of Object.keys(state.clubs) as ClubId[]) expect(clubSchedule(state, id)).toHaveLength(16);
    expect(Object.keys(state.fixtures)).toHaveLength(2 * 384 + 21);
  });
});

describe('result compaction', () => {
  it('compacts the previous season except the player club matches and drops older seasons (05 §5)', () => {
    const state = seasonWithReckoningHero(tierLeader);
    const player = state.playerClubId;
    const ids = Object.keys(state.results) as (keyof GameState['results'])[];
    const plays = (id: keyof GameState['results'], club: ClubId | null) => state.results[id]!.homeClubId === club || state.results[id]!.awayClubId === club;
    const aiId = ids.find((id) => !plays(id, player))!;
    const ownId = player === null ? undefined : ids.find((id) => plays(id, player));
    state.results[aiId]!.rounds = [
      { round: 1, seed: 's', winner: 'home', endReason: 'elimination', tiebreakStep: null, durationTicks: 400, survivors: { home: 2, away: 0 }, downs: { home: 3, away: 5 }, finalHp: [1, 2, 3, 4, 5, 0, 0, 0, 0, 0], checksum: 'c', eventHash: null },
    ];
    const before = cloneJson(state);
    compactHistory(state, content);
    expect(state).toEqual(before); // season 1 is the current season: kept in full

    state.calendar = seasonStartCalendar(2, content);
    const original = cloneJson(state.results[aiId]!);
    compactHistory(state, content);
    const r = state.results[aiId]!;
    expect(isCompactedResult(r)).toBe(true);
    expect(isCompactedResult(original)).toBe(false);
    expect(r.score).toEqual(original.score);
    expect(r.winnerClubId).toBe(original.winnerClubId);
    expect(r.input.seed).toBe(original.input.seed);
    expect(r.fighterStats).toEqual({});
    expect(r.rounds[0]).toMatchObject({ winner: 'home', durationTicks: 400, finalHp: [] });
    if (ownId !== undefined) expect(isCompactedResult(state.results[ownId]!)).toBe(false); // the player's own matches stay in full
    expect(Object.keys(state.results)).toHaveLength(ids.length);
    const once = cloneJson(state);
    compactHistory(state, content);
    expect(state).toEqual(once);

    state.calendar = seasonStartCalendar(3, content);
    compactHistory(state, content);
    expect(Object.keys(state.results)).toHaveLength(0);
    expect(Object.values(state.fixtures).filter((f) => f.season === 1)).toHaveLength(0);
    expect(Object.values(state.competitions).filter((c) => c.season === 1)).toHaveLength(0);
  });
});

describe('result compaction: the M1.1 per-round records go, the attribution stays', () => {
  it('drops reserveInputs, roundLineups, betweenRounds and fighterStats; keeps squads (without rows), emergency entrants and per-fighter totals with the side', () => {
    const state = seasonWithReckoningHero(tierLeader);
    const id = (Object.keys(state.results) as (keyof GameState['results'])[]).find((x) => state.results[x]!.homeClubId !== state.playerClubId && state.results[x]!.awayClubId !== state.playerClubId)!;
    const r = cloneJson(state.results[id]!);
    const stats = (clubId: ClubId, n: number) => ({
      clubId, roundsPlayed: n, roundsSurvived: 1, ticksOnArena: 90, damageDealt: 100 * n, damageToShields: 1, damageTaken: 50, healingDone: 7 * n, shieldingDone: 2, overheal: 0,
      ccAppliedTicks: 3, ccReceivedTicks: 4, downsInflicted: n, downsSuffered: 1, assists: 0, focusSpent: 10, casts: {}, ruleFires: [1, 2], ruleCommittedTicks: [3, 4], rulesNeverFired: [], downs: [], opponentIds: [],
    });
    const [a, b, e, x] = ['f-901', 'f-902', 'f-903', 'f-904'].map((f) => asId<FighterId>(f));
    r.fighterStats = { [a!]: stats(r.homeClubId, 3), [b!]: stats(r.homeClubId, 1), [e!]: stats(r.homeClubId, 2), [x!]: stats(r.awayClubId, 3) };
    const squad = (starters: FighterId[]) => ({ starters, reserves: [], rows: { [a!]: 'front' as const }, captainId: null, viceCaptainId: null });
    r.squads = { home: squad([a!, b!]), away: squad([x!]) };
    r.emergencyEntrants = [e!];
    r.reserveInputs = { home: [], away: [] };
    r.roundLineups = [];
    r.betweenRounds = [];
    state.results[id] = r;
    state.calendar = seasonStartCalendar(2, content);
    state.playerClubId = null;
    compactHistory(state, content);
    const c = state.results[id]!;
    expect(isCompactedResult(c)).toBe(true);
    for (const dropped of ['reserveInputs', 'roundLineups', 'betweenRounds'] as const) expect(c[dropped]).toBeUndefined();
    expect(c.fighterStats).toEqual({});
    expect(c.emergencyEntrants).toEqual([e]);
    expect(c.squads!.home.starters).toEqual([a, b]);
    expect(c.squads!.home.rows).toEqual({});
    expect(c.fighterTotals).toEqual({
      [a!]: [0, 3, 3, 1, 300, 21],
      [b!]: [0, 1, 1, 1, 100, 7],
      [e!]: [0, 2, 2, 1, 200, 14],
      [x!]: [1, 3, 3, 1, 300, 21],
    });
    // About 30 bytes a fighter.
    expect(JSON.stringify(c.fighterTotals![a!]).length).toBeLessThan(30);
    // The original result is untouched (results are write-once).
    expect(r.reserveInputs).toBeDefined();
  });
});

describe('records and determinism', () => {
  it('derives all-time Reckoning titles and Shields from history', () => {
    const state = buildFixtureWorld();
    const tier = (champion: string | null, shield: string | null) => ({
      tierId: MUSTER,
      wingTables: [],
      tierTable: [],
      reckoningChampionId: champion as ClubId | null,
      reckoningRunnerUpId: null,
      shieldWinnerId: shield as ClubId | null,
      promotedIds: [],
      relegatedIds: [],
    });
    state.history.push(
      { season: 1, tiers: [tier('b', 'a'), tier('c', 'c')], retirements: [], rookieIds: [] },
      { season: 2, tiers: [tier('a', 'a'), tier('c', null)], retirements: [], rookieIds: [] },
    );
    expect(leagueRecords(state)).toEqual({
      mostReckoningTitles: [{ clubId: 'c', titles: 2 }, { clubId: 'a', titles: 1 }, { clubId: 'b', titles: 1 }],
      mostShields: [{ clubId: 'a', shields: 2 }, { clubId: 'c', shields: 1 }],
      seasonsPlayed: 2,
    });
    expect(leagueRecords(buildFixtureWorld())).toEqual({ mostReckoningTitles: [], mostShields: [], seasonsPlayed: 0 });
  });

  it('reproduces two seasons bit for bit from the same root seed', () => {
    const run = (): string => {
      const state = buildFixtureWorld();
      setupSeason(state, 1, content);
      for (let season = 1; season <= 2; season++) {
        playSeason(state, content, byStrength(strength));
        const moves = promotionRelegation(state, content);
        state.history.push(archiveSeason(state, moves, content));
        applyTierMoves(state, moves);
        setupSeason(state, season + 1, content);
        state.calendar = seasonStartCalendar(season + 1, content);
        compactHistory(state, content);
      }
      return stableStringify(state);
    };
    expect(run()).toBe(run());
  });
});
