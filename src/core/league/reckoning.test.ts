import { describe, expect, it } from 'vitest';
import type { ContentDB } from '../content';
import { asId, reckoningCompetitionId, reckoningFixtureId, type ClubId, type GameState, type StandingRow, type TierId, type WingId } from '../model';
import { buildFixtureWorld, fixtureContent, fixtureState } from '../testkit';
import { InvariantError } from '../util';
import {
  buildBracket,
  clubSchedule,
  createReckoning,
  fixturesForWeek,
  leagueCompetitionOf,
  reckoningSeeds,
  reckoningStage,
  seedReckonings,
  setupSeason,
  standings,
} from './index';
import { byStrength, play, playWeek } from './test-support';

const content = fixtureContent();
const TIER = asId<TierId>('saltmarch-muster');
const id = (s: string): ClubId => asId<ClubId>(s);

function row(clubId: string, points: number, position: number): StandingRow {
  return {
    clubId: id(clubId),
    position,
    played: 16,
    matchWins: 0,
    matchLosses: 0,
    points,
    roundsWon: 0,
    roundsLost: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    results: { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 },
    form: [],
  };
}

/** The final tables of sys-tournament's worked example (le-005). */
function le005Tables() {
  const dawn = [['A', 40], ['B', 36], ['C', 33], ['D', 30], ['P', 28], ['Q', 20], ['R', 15], ['S', 10]] as const;
  const dusk = [['E', 38], ['F', 37], ['G', 31], ['H', 29], ['I', 32], ['J', 22], ['K', 14], ['L', 9]] as const;
  // Dusk's 5th place I has 32 points, more than G and H, but sits 5th in its wing table.
  const wingTables = [
    { wingId: asId<WingId>('dawn'), rows: dawn.map(([c, p], i) => row(c, p, i + 1)) },
    { wingId: asId<WingId>('dusk'), rows: dusk.map(([c, p], i) => row(c, p, i + 1)) },
  ];
  const all = [...dawn, ...dusk].sort((a, b) => b[1] - a[1]);
  const tierTable = all.map(([c, p], i) => row(c, p, i + 1));
  return { wingTables, tierTable };
}

const LE005_SEEDS = ['A', 'E', 'F', 'B', 'C', 'G', 'D', 'H'].map(id);

function reckoningState(seeds: readonly ClubId[] = LE005_SEEDS): GameState {
  const state = fixtureState();
  createReckoning(state, 1, TIER, seeds, content);
  return state;
}

const fx = (state: GameState, round: string, slot: number) => state.fixtures[reckoningFixtureId(1, TIER, round, slot)];

describe('Reckoning seeding (le-005)', () => {
  it('takes the top 4 of each wing; wing winners are seeds 1-2, the rest follow the tier table', () => {
    const { wingTables, tierTable } = le005Tables();
    expect(reckoningSeeds(wingTables, tierTable, content)).toEqual(LE005_SEEDS);
    expect(reckoningSeeds(wingTables, tierTable, content)).not.toContain('I');
  });

  it('pairs QF 1v8, 4v5, 2v7, 3v6 in TW1, best-of-3, hosted by the higher seed', () => {
    const state = reckoningState();
    const comp = state.competitions[reckoningCompetitionId(1, TIER)]!;
    expect(comp).toMatchObject({ kind: 'reckoning', season: 1, tierId: TIER, clubIds: LE005_SEEDS, status: 'scheduled' });
    expect(comp.bracket!.seeds).toEqual(LE005_SEEDS);
    expect(comp.bracket!.rounds.map((r) => [r.roundId, r.weekId, r.bestOf, r.ties.length])).toEqual([
      ['quarterfinal', 'TW1', 3, 4],
      ['semifinal', 'TW2', 3, 2],
      ['final', 'TW3', 5, 1],
    ]);
    const qf = [1, 2, 3, 4].map((s) => fx(state, 'quarterfinal', s)!);
    expect(qf.map((f) => [f.homeClubId, f.awayClubId])).toEqual([['A', 'H'], ['B', 'C'], ['E', 'D'], ['F', 'G']]);
    for (const f of qf) {
      expect(f).toMatchObject({ stage: 'quarterfinal', weekIndex: 21, weekId: 'TW1', bestOf: 3, venueId: null, matchweek: null, wing: null, status: 'scheduled' });
      expect(f.id).toMatch(/^rk:1:saltmarch-muster:quarterfinal:[1-4]$/);
    }
    expect(comp.fixtureIds).toEqual(qf.map((f) => f.id));
    expect(fx(state, 'semifinal', 1)).toBeUndefined();
  });
});

describe('Reckoning progression (le-006)', () => {
  it('builds SF1 A (host) v B and SF2 F (host, seed 3) v D, then a best-of-5 final at the Charterhall', () => {
    const state = reckoningState();
    const comp = state.competitions[reckoningCompetitionId(1, TIER)]!;
    play(state, fx(state, 'quarterfinal', 1)!, { home: 2, away: 0 }, content); // A beats H
    expect(fx(state, 'semifinal', 1)).toBeUndefined();
    play(state, fx(state, 'quarterfinal', 2)!, { home: 2, away: 1 }, content); // B beats C
    expect(fx(state, 'semifinal', 1)).toMatchObject({ homeClubId: 'A', awayClubId: 'B', weekId: 'TW2', bestOf: 3, venueId: null });
    play(state, fx(state, 'quarterfinal', 3)!, { home: 1, away: 2 }, content); // D (7) beats E (2)
    play(state, fx(state, 'quarterfinal', 4)!, { home: 2, away: 0 }, content); // F beats G
    expect(fx(state, 'semifinal', 2)).toMatchObject({ homeClubId: 'F', awayClubId: 'D', weekIndex: 22 });
    expect(comp.status).toBe('in-progress');

    play(state, fx(state, 'semifinal', 1)!, { home: 0, away: 2 }, content); // B beats A
    play(state, fx(state, 'semifinal', 2)!, { home: 2, away: 1 }, content); // F beats D
    const final = fx(state, 'final', 1)!;
    // B is seed 4, F seed 3: F is the sim's home side at the neutral venue.
    expect(final).toMatchObject({ homeClubId: 'F', awayClubId: 'B', stage: 'final', weekIndex: 23, weekId: 'TW3', bestOf: 5, venueId: 'charterhall' });
    expect(() => play(state, final, { home: 2, away: 1 }, content)).toThrow(InvariantError); // best-of-5 needs 3 rounds

    play(state, final, { home: 1, away: 3 }, content);
    expect(comp.bracket).toMatchObject({ championId: 'B', runnerUpId: 'F' });
    expect(comp.status).toBe('completed');
    expect(comp.fixtureIds).toHaveLength(7);
    state.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    const stages = Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((c) => [c, reckoningStage(state, id(c))]));
    expect(stages).toEqual({ A: 'semifinal', B: 'champion', C: 'quarterfinal', D: 'semifinal', E: 'quarterfinal', F: 'final', G: 'quarterfinal', H: 'quarterfinal', I: null });
  });

  it('refuses a second result for a tie', () => {
    const state = reckoningState();
    const qf1 = fx(state, 'quarterfinal', 1)!;
    play(state, qf1, { home: 2, away: 0 }, content);
    expect(() => play(state, qf1, { home: 2, away: 0 }, content)).toThrow(InvariantError);
  });
});

describe('bracket structure from leagues.json', () => {
  const withRounds = (rounds: ContentDB['leagues']['tournament']['rounds']): ContentDB => ({
    ...content,
    leagues: { ...content.leagues, tournament: { ...content.leagues.tournament, rounds } },
  });
  const [qf, sf, final] = content.leagues.tournament.rounds as [
    ContentDB['leagues']['tournament']['rounds'][number],
    ContentDB['leagues']['tournament']['rounds'][number],
    ContentDB['leagues']['tournament']['rounds'][number],
  ];

  it('links later rounds to earlier ties ("QF1") and pairs implicit rounds in order', () => {
    const bracket = buildBracket(LE005_SEEDS, content);
    expect(bracket.rounds[1]!.ties[1]).toMatchObject({ home: { kind: 'winner-of', roundId: 'quarterfinal', slot: 3 }, away: { kind: 'winner-of', roundId: 'quarterfinal', slot: 4 } });
    expect(bracket.rounds[2]!.ties[0]).toMatchObject({ home: { kind: 'winner-of', roundId: 'semifinal', slot: 1 }, away: { kind: 'winner-of', roundId: 'semifinal', slot: 2 } });
  });

  it('throws for seeds out of range or repeated, unknown tokens, byes and a non-single final', () => {
    expect(() => buildBracket(LE005_SEEDS.slice(0, 7), content)).toThrow(InvariantError);
    expect(() => buildBracket([...LE005_SEEDS.slice(0, 7), id('A')], content)).toThrow(InvariantError);
    expect(() => buildBracket(LE005_SEEDS, withRounds([{ ...qf, pairs: [[1, 8], [4, 5], [2, 7], [3, 3]] }, sf, final]))).toThrow(InvariantError);
    expect(() => buildBracket(LE005_SEEDS, withRounds([qf, { ...sf, pairs: [['XX1', 'QF2'], ['QF3', 'QF4']] }, final]))).toThrow(InvariantError);
    expect(() => buildBracket(LE005_SEEDS, withRounds([qf, { ...sf, pairs: [[1, 'QF2'], ['QF3', 'QF4']] }, final]))).toThrow(InvariantError);
    expect(() => buildBracket(LE005_SEEDS, withRounds([qf, sf]))).toThrow(InvariantError);
    expect(() => buildBracket(LE005_SEEDS, withRounds([qf, { ...sf, pairs: [['QF1', 'QF1'], ['QF3', 'QF4']] }, final]))).toThrow(InvariantError);
  });
});

describe('seedReckonings after a full regular season (48 clubs)', () => {
  const strength = (c: ClubId) => content.clubs.require(c).startPrestige;

  function regularSeason(): GameState {
    const state = buildFixtureWorld();
    setupSeason(state, 1, content);
    while (state.calendar.weekIndex <= 20) playWeek(state, content, byStrength(strength));
    return state;
  }

  it('seeds every tier from its final tables and schedules 12 quarterfinals in TW1', () => {
    const state = regularSeason();
    expect(state.calendar).toMatchObject({ weekIndex: 21, phase: 'tournament' });
    for (const tier of content.leagues.tiers) {
      const tierId = asId<TierId>(tier.id);
      const league = state.competitions[leagueCompetitionOf(state, 1, tierId)!]!;
      expect(league.status).toBe('completed');
      const rk = state.competitions[reckoningCompetitionId(1, tierId)]!;
      const seeds = rk.bracket!.seeds;
      const wingTables = league.wings.map((w) => standings(state, league.id, w.wingId, content));
      const tierTable = standings(state, league.id, 'tier', content);
      expect(new Set(seeds)).toEqual(new Set(wingTables.flatMap((t) => t.slice(0, 4).map((r) => r.clubId))));
      expect(new Set(seeds.slice(0, 2))).toEqual(new Set(wingTables.map((t) => t[0]!.clubId)));
      const rank = (c: ClubId) => tierTable.find((r) => r.clubId === c)!.position;
      expect(rank(seeds[0]!)).toBeLessThan(rank(seeds[1]!));
      for (let i = 3; i < 8; i++) expect(rank(seeds[i - 1]!)).toBeLessThan(rank(seeds[i]!));
    }
    const tw1 = fixturesForWeek(state, 21, content);
    expect(tw1).toHaveLength(12);
    expect(tw1.every((f) => f.stage === 'quarterfinal' && f.bestOf === 3)).toBe(true);
    expect(() => seedReckonings(state, content)).toThrow(InvariantError);
  });

  it('plays 21 Reckoning matches over TW1-TW3 and ends in the season-end step', () => {
    const state = regularSeason();
    while (state.calendar.phase !== 'season-end') playWeek(state, content, byStrength(strength));
    const rkFixtures = Object.values(state.fixtures).filter((f) => f.stage !== 'league');
    expect(rkFixtures).toHaveLength(21);
    expect(rkFixtures.filter((f) => f.stage === 'final').every((f) => f.bestOf === 5 && f.venueId === 'charterhall')).toBe(true);
    for (const tier of content.leagues.tiers) {
      const rk = state.competitions[reckoningCompetitionId(1, asId<TierId>(tier.id))]!;
      expect(rk.status).toBe('completed');
      // The strongest seed wins every tie under byStrength.
      expect(rk.bracket!.championId).toBe([...rk.bracket!.seeds].sort((a, b) => strength(b) - strength(a))[0]);
      expect(reckoningStage(state, rk.bracket!.championId!)).toBe('champion');
      expect(clubSchedule(state, rk.bracket!.championId!)).toHaveLength(19);
    }
  });

  it('refuses to seed before the regular season is complete', () => {
    const state = buildFixtureWorld();
    setupSeason(state, 1, content);
    expect(() => seedReckonings(state, content)).toThrow(InvariantError);
  });
});
