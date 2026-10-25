import { describe, expect, it } from 'vitest';
import {
  asId,
  leagueCompetitionId,
  leagueFixtureId,
  type ClubId,
  type Competition,
  type CompetitionId,
  type Fixture,
  type GameState,
  type TierId,
  type WeekId,
  type WingId,
} from '../model';
import { STREAM, deriveSeed } from '../rng';
import { fixtureContent, fixtureState } from '../testkit';
import { InvariantError, compareStrings } from '../util';
import { matchPoints, recordResult, standings } from './index';
import { fakeResult, play, type FakeScore } from './test-support';

const content = fixtureContent();
const TIER = asId<TierId>('saltmarch-muster');
const DAWN = asId<WingId>('dawn');
const DUSK = asId<WingId>('dusk');
const id = (s: string): ClubId => asId<ClubId>(s);

/** A hand-made league (any number of clubs per wing) to stage table situations. */
class MiniLeague {
  readonly state: GameState = fixtureState();
  readonly comp: Competition;
  private week = 0;

  constructor(dawn: string[], dusk: string[] = []) {
    const clubIds = [...dawn, ...dusk].map(id);
    this.comp = {
      id: leagueCompetitionId(1, TIER),
      kind: 'league',
      season: 1,
      tierId: TIER,
      clubIds,
      wings: [
        { wingId: DAWN, clubIds: dawn.map(id) },
        { wingId: DUSK, clubIds: dusk.map(id) },
      ],
      seedOrder: clubIds,
      fixtureIds: [],
      bracket: null,
      status: 'scheduled',
    };
    this.state.competitions[this.comp.id] = this.comp;
  }

  fixture(home: string, away: string): Fixture {
    this.week++;
    const weekId = asId<WeekId>(`MW${this.week}`);
    const f: Fixture = {
      id: leagueFixtureId(1, TIER, weekId, id(home), id(away)),
      competitionId: this.comp.id,
      season: 1,
      tierId: TIER,
      weekIndex: 4 + this.week,
      weekId,
      stage: 'league',
      matchweek: this.week,
      wing: this.comp.wings[0]!.clubIds.includes(id(home)) === this.comp.wings[0]!.clubIds.includes(id(away)) ? DAWN : 'cross',
      homeClubId: id(home),
      awayClubId: id(away),
      bestOf: 3,
      venueId: null,
      status: 'scheduled',
    };
    this.state.fixtures[f.id] = f;
    this.comp.fixtureIds.push(f.id);
    return f;
  }

  /** Play home v away with the given rounds (default downs: 5 per round lost). */
  play(home: string, away: string, h: number, a: number, downs: Partial<FakeScore> = {}): Fixture {
    const f = this.fixture(home, away);
    play(this.state, f, { home: h, away: a, ...downs }, content);
    return f;
  }

  table(scope: WingId | 'tier' = 'tier') {
    return standings(this.state, this.comp.id, scope, content);
  }

  order(scope: WingId | 'tier' = 'tier'): string[] {
    return this.table(scope).map((r) => r.clubId);
  }

  lot(club: string): string {
    return deriveSeed(this.state.rng.root, STREAM.schedule, 1, TIER, club);
  }
}

describe('points (le-003)', () => {
  it('awards 3/2/1/0 for 2-0/2-1/1-2/0-2 from leagues.json', () => {
    expect([matchPoints(2, 0, content), matchPoints(2, 1, content), matchPoints(1, 2, content), matchPoints(0, 2, content)]).toEqual([3, 2, 1, 0]);
    expect(() => matchPoints(3, 0, content)).toThrow(InvariantError);
  });

  it('records a 2-1: winner +2, loser +1, rounds, results, form and downs', () => {
    const lg = new MiniLeague(['x', 'y']);
    lg.play('x', 'y', 2, 1, { homeDowns: 7, awayDowns: 11 });
    const [x, y] = lg.table();
    expect(x).toMatchObject({ clubId: 'x', position: 1, played: 1, matchWins: 1, matchLosses: 0, points: 2, roundsWon: 2, roundsLost: 1, downsInflicted: 11, downsSuffered: 7, form: ['W'] });
    expect(x!.results).toEqual({ '2-0': 0, '2-1': 1, '1-2': 0, '0-2': 0 });
    expect(y).toMatchObject({ clubId: 'y', position: 2, played: 1, matchWins: 0, matchLosses: 1, points: 1, roundsWon: 1, roundsLost: 2, downsInflicted: 7, downsSuffered: 11, form: ['L'] });
    expect(y!.results).toEqual({ '2-0': 0, '2-1': 0, '1-2': 1, '0-2': 0 });
  });

  it('counts only played fixtures and keeps the last five results, newest last', () => {
    const lg = new MiniLeague(['x', 'y']);
    lg.fixture('y', 'x'); // scheduled, never played
    lg.play('x', 'y', 2, 0);
    lg.play('y', 'x', 2, 0);
    lg.play('x', 'y', 2, 0);
    lg.play('x', 'y', 0, 2);
    lg.play('y', 'x', 1, 2);
    lg.play('x', 'y', 0, 2);
    const x = lg.table().find((r) => r.clubId === 'x')!;
    expect(x.played).toBe(6);
    expect(x.points).toBe(3 + 0 + 3 + 0 + 2 + 0);
    expect(x.form).toEqual(['L', 'W', 'L', 'W', 'L']);
  });

  it('takes downs from the per-fighter stats of each side (hired blades included)', () => {
    const lg = new MiniLeague(['x', 'y']);
    const f = lg.fixture('x', 'y');
    const result = fakeResult(f, { home: 2, away: 0, homeDowns: 3, awayDowns: 9 });
    const blade = Object.values(result.fighterStats).find((s) => s.clubId === 'x')!;
    result.fighterStats[asId('blade-1')] = { ...blade, downsSuffered: 1 };
    lg.state.results[f.id] = result;
    recordResult(lg.state, result, content);
    expect(lg.table()[0]).toMatchObject({ clubId: 'x', downsSuffered: 4, downsInflicted: 9 });
  });
});

describe('tie-break chain', () => {
  it('le-004: level on points, match wins and round difference -> head-to-head points (X 2, Y 4: Y ahead)', () => {
    const lg = new MiniLeague(['x', 'y', 'z', 'w']);
    lg.play('x', 'y', 2, 1);
    lg.play('y', 'x', 2, 0);
    lg.play('x', 'z', 2, 0);
    lg.play('x', 'w', 1, 2);
    lg.play('y', 'z', 2, 1);
    lg.play('y', 'w', 0, 2);
    const rows = lg.table(DAWN);
    const x = rows.find((r) => r.clubId === 'x')!;
    const y = rows.find((r) => r.clubId === 'y')!;
    expect([x.points, x.matchWins, x.roundsWon - x.roundsLost, x.roundsWon]).toEqual([6, 2, 0, 5]);
    expect([y.points, y.matchWins, y.roundsWon - y.roundsLost, y.roundsWon]).toEqual([6, 2, 0, 5]);
    expect(lg.order(DAWN)).toEqual(['y', 'x', 'w', 'z']);
  });

  it('le-004: level on head-to-head too -> rounds won', () => {
    const lg = new MiniLeague(['x', 'y', 'z', 'w']);
    lg.play('x', 'y', 2, 1);
    lg.play('y', 'x', 2, 1);
    lg.play('x', 'z', 2, 0);
    lg.play('x', 'w', 0, 2);
    lg.play('y', 'z', 2, 1);
    lg.play('y', 'w', 1, 2);
    const [first, second] = lg.table(DAWN).filter((r) => r.clubId === 'x' || r.clubId === 'y');
    expect(first).toMatchObject({ clubId: 'y', points: 6, roundsWon: 6 });
    expect(second).toMatchObject({ clubId: 'x', points: 6, roundsWon: 5 });
  });

  it('le-004: then downs difference', () => {
    const lg = new MiniLeague(['x', 'y', 'z', 'w']);
    lg.play('x', 'y', 2, 1);
    lg.play('y', 'x', 2, 1);
    lg.play('x', 'z', 2, 0, { homeDowns: 0, awayDowns: 10 });
    lg.play('y', 'w', 2, 0, { homeDowns: 0, awayDowns: 8 });
    expect(lg.order(DAWN).slice(0, 2)).toEqual(['x', 'y']);
  });

  it('le-004: then the seeded lot, ascending hash(root, schedule, season, tierId, clubId)', () => {
    const lg = new MiniLeague(['x', 'y', 'v', 'u']);
    lg.play('x', 'y', 2, 1);
    lg.play('y', 'x', 2, 1);
    lg.play('v', 'u', 2, 1);
    lg.play('u', 'v', 2, 1);
    // All four are level on every criterion: the lot orders them.
    const expected = ['x', 'y', 'v', 'u'].sort((a, b) => compareStrings(lg.lot(a), lg.lot(b)));
    expect(lg.order(DAWN)).toEqual(expected);
    // Unplayed tables are ordered by lot as well, identically on every call.
    const empty = new MiniLeague(['x', 'y', 'v', 'u']);
    expect(empty.order(DAWN)).toEqual(expected);
  });

  it('skips head-to-head when the tied clubs did not all meet equally often (tier table)', () => {
    const lg = new MiniLeague(['a', 'b', 'd'], ['c', 'e']);
    lg.play('a', 'b', 2, 0);
    lg.play('a', 'd', 0, 2);
    lg.play('b', 'e', 2, 0, { homeDowns: 0, awayDowns: 12 });
    lg.play('c', 'e', 2, 0);
    lg.play('c', 'd', 0, 2);
    const tied = lg.table('tier').filter((r) => ['a', 'b', 'c'].includes(r.clubId));
    for (const r of tied) expect([r.points, r.matchWins, r.roundsWon, r.roundsLost]).toEqual([3, 1, 2, 2]);
    // a beat b, but c met neither: head-to-head is skipped; b leads on downs difference; a and c (never met) go to the lot.
    const rest = ['a', 'c'].sort((x, y) => compareStrings(lg.lot(x), lg.lot(y)));
    expect(tied.map((r) => r.clubId)).toEqual(['b', ...rest]);
  });

  it('restarts a split group at head-to-head', () => {
    const lg = new MiniLeague(['a', 'b', 'c', 'd', 'e']);
    // Cyclic head-to-head: level at 3 each, so rounds won splits a from {b, c}.
    lg.play('a', 'b', 2, 0);
    lg.play('b', 'c', 2, 0);
    lg.play('c', 'a', 2, 0);
    lg.play('a', 'd', 2, 1);
    lg.play('a', 'e', 1, 2);
    lg.play('b', 'd', 2, 0);
    lg.play('b', 'e', 0, 2);
    lg.play('c', 'd', 2, 0, { homeDowns: 0, awayDowns: 15 });
    lg.play('c', 'e', 0, 2);
    const t = lg.table(DAWN);
    const pick = (c: string) => t.find((r) => r.clubId === c)!;
    expect([pick('a').points, pick('b').points, pick('c').points]).toEqual([6, 6, 6]);
    expect([pick('a').roundsWon, pick('b').roundsWon, pick('c').roundsWon]).toEqual([5, 4, 4]);
    // c has the better downs difference, but {b, c} restarts at head-to-head, where b beat c.
    expect(pick('c').downsInflicted - pick('c').downsSuffered).toBeGreaterThan(pick('b').downsInflicted - pick('b').downsSuffered);
    expect(t.map((r) => r.clubId)).toEqual(['e', 'a', 'b', 'c', 'd']);
  });
});

describe('tables', () => {
  it('ranks a wing on full-season records (cross-wing matches count) and the tier on all clubs', () => {
    const lg = new MiniLeague(['a', 'b'], ['c', 'd']);
    lg.play('a', 'c', 0, 2);
    lg.play('b', 'd', 2, 0);
    lg.play('a', 'b', 2, 1);
    expect(lg.order(DAWN)).toEqual(['b', 'a']); // b: 3 + 1 = 4; a: 0 + 2 = 2
    expect(lg.table(DUSK).map((r) => [r.clubId, r.position, r.points])).toEqual([
      ['c', 1, 3],
      ['d', 2, 0],
    ]);
    expect(lg.order('tier')).toEqual(['b', 'c', 'a', 'd']);
    expect(lg.table('tier').map((r) => r.position)).toEqual([1, 2, 3, 4]);
  });

  it('throws for unknown competitions and wings, Reckonings, and scores outside the points table', () => {
    const lg = new MiniLeague(['x', 'y']);
    expect(() => standings(lg.state, asId<CompetitionId>('lg:9:none'), 'tier', content)).toThrow(InvariantError);
    expect(() => lg.table(asId<WingId>('noon'))).toThrow(InvariantError);
    lg.state.competitions[asId<CompetitionId>('rk:1:x')] = { ...lg.comp, id: asId('rk:1:x'), kind: 'reckoning' };
    expect(() => standings(lg.state, asId<CompetitionId>('rk:1:x'), 'tier', content)).toThrow(InvariantError);
    const f = lg.fixture('x', 'y');
    lg.state.results[f.id] = fakeResult(f, { home: 3, away: 0 });
    expect(() => lg.table()).toThrow(InvariantError);
  });
});

describe('recordResult', () => {
  it('marks league fixtures played and moves the competition to in-progress, then completed', () => {
    const lg = new MiniLeague(['x', 'y']);
    const f1 = lg.fixture('x', 'y');
    const f2 = lg.fixture('y', 'x');
    play(lg.state, f1, { home: 2, away: 0 }, content);
    expect(lg.state.fixtures[f1.id]!.status).toBe('played');
    expect(lg.comp.status).toBe('in-progress');
    play(lg.state, f2, { home: 1, away: 2 }, content);
    expect(lg.comp.status).toBe('completed');
  });

  it('refuses unknown or already played fixtures, other clubs, undecided scores and a wrong winner', () => {
    const lg = new MiniLeague(['x', 'y']);
    const f = lg.fixture('x', 'y');
    const good = fakeResult(f, { home: 2, away: 1 });
    expect(() => recordResult(lg.state, { ...good, fixtureId: asId('lg:1:none') }, content)).toThrow(InvariantError);
    expect(() => recordResult(lg.state, { ...good, homeClubId: id('y'), awayClubId: id('x') }, content)).toThrow(InvariantError);
    expect(() => recordResult(lg.state, { ...good, score: { home: 1, away: 1 } }, content)).toThrow(InvariantError);
    expect(() => recordResult(lg.state, { ...good, score: { home: 3, away: 0 } }, content)).toThrow(InvariantError);
    expect(() => recordResult(lg.state, { ...good, winnerClubId: id('y') }, content)).toThrow(InvariantError);
    expect(lg.state.fixtures[f.id]!.status).toBe('scheduled');
    recordResult(lg.state, good, content);
    expect(() => recordResult(lg.state, good, content)).toThrow(InvariantError);
  });
});
