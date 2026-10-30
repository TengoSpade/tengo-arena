/**
 * Derived wing and tier tables (03-league-economy sys-league "Standings and
 * tiebreaks"; leagues.json standings). Never stored: rows are rebuilt from
 * GameState.results of the competition's played fixtures.
 *
 * Tie-break chain (content order): points, match wins, round difference,
 * head-to-head points among the tied clubs (only when every pair of them met
 * equally often), rounds won, downs difference, lot. Criteria before
 * head-to-head describe a club's whole record and apply lexicographically;
 * once head-to-head or a later criterion splits a tied group, every remaining
 * tied subgroup restarts at head-to-head (leagues.json restartOnSplit).
 * The lot is ascending deriveSeed(root, schedule, season, tierId, clubId).
 */
import type { ContentDB } from '../content';
import type { ClubId, Competition, CompetitionId, GameState, StandingRow, WingId } from '../model';
import { STREAM, deriveSeed } from '../rng';
import { InvariantError, compareStrings, invariant } from '../util';
import { requireCompetition } from './common';

export type ResultKey = keyof StandingRow['results'];

/** A played league match reduced to what the tables need. */
export interface PlayedMatch {
  fixtureId: string;
  weekIndex: number;
  home: ClubId;
  away: ClubId;
  homeRounds: number;
  awayRounds: number;
  /** Downs suffered by each side: Σ FighterMatchStats.downsSuffered of the side's fighters (incl. hired blades). */
  homeDowns: number;
  awayDowns: number;
}

/** Played fixtures of a league competition in schedule order (fixtures with a stored result). */
export function playedLeagueMatches(state: GameState, competition: Competition): PlayedMatch[] {
  const out: PlayedMatch[] = [];
  for (const id of competition.fixtureIds) {
    const result = state.results[id];
    if (!result) continue;
    const fixture = state.fixtures[id];
    invariant(fixture, `standings: result for unknown fixture ${id}`);
    invariant(
      result.homeClubId === fixture.homeClubId && result.awayClubId === fixture.awayClubId,
      `standings: result ${id} does not match its fixture's clubs`,
    );
    let homeDowns = 0;
    let awayDowns = 0;
    for (const stats of Object.values(result.fighterStats)) {
      if (stats.clubId === fixture.homeClubId) homeDowns += stats.downsSuffered;
      else if (stats.clubId === fixture.awayClubId) awayDowns += stats.downsSuffered;
    }
    // A compacted result has no per-fighter stats, but its fighter totals hold the same downs suffered (side 0 = home):
    // the tables and the downs tie-break must not depend on whether a match was compacted.
    for (const total of Object.values(result.fighterTotals ?? {})) {
      if (total[0] === 0) homeDowns += total[3];
      else awayDowns += total[3];
    }
    out.push({
      fixtureId: id,
      weekIndex: fixture.weekIndex,
      home: fixture.homeClubId,
      away: fixture.awayClubId,
      homeRounds: result.score.home,
      awayRounds: result.score.away,
      homeDowns,
      awayDowns,
    });
  }
  return out;
}

/** Table points of one side's result (leagues.json pointsByResult, e.g. 2-1 -> 2). */
export function matchPoints(ownRounds: number, oppRounds: number, content: ContentDB): number {
  const key = `${ownRounds}-${oppRounds}`;
  const points = (content.leagues.standings.pointsByResult as Record<string, number>)[key];
  if (points === undefined) throw new InvariantError(`standings: no points defined for a ${key} result`);
  return points;
}

type Tally = Omit<StandingRow, 'position'>;

function emptyTally(clubId: ClubId): Tally {
  return {
    clubId,
    played: 0,
    matchWins: 0,
    matchLosses: 0,
    points: 0,
    roundsWon: 0,
    roundsLost: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    results: { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 },
    form: [],
  };
}

const FORM_LENGTH = 5;

/** Season totals per club of the competition (every club, played or not). */
export function tallyMatches(clubIds: readonly ClubId[], matches: readonly PlayedMatch[], content: ContentDB): Map<ClubId, Tally> {
  const tallies = new Map<ClubId, Tally>();
  for (const id of clubIds) tallies.set(id, emptyTally(id));
  const apply = (club: ClubId, own: number, opp: number, downsFor: number, downsAgainst: number): void => {
    const t = tallies.get(club);
    invariant(t, `standings: club ${club} is not in the competition`);
    const key = `${own}-${opp}` as ResultKey;
    invariant(key in t.results, `standings: unsupported league score ${key}`);
    t.played++;
    if (own > opp) t.matchWins++;
    else t.matchLosses++;
    t.points += matchPoints(own, opp, content);
    t.roundsWon += own;
    t.roundsLost += opp;
    t.downsInflicted += downsFor;
    t.downsSuffered += downsAgainst;
    t.results[key]++;
    t.form.push(own > opp ? 'W' : 'L');
    if (t.form.length > FORM_LENGTH) t.form.shift();
  };
  for (const m of matches) {
    apply(m.home, m.homeRounds, m.awayRounds, m.awayDowns, m.homeDowns);
    apply(m.away, m.awayRounds, m.homeRounds, m.homeDowns, m.awayDowns);
  }
  return tallies;
}

export interface RankContext {
  tallies: ReadonlyMap<ClubId, Tally>;
  matches: readonly PlayedMatch[];
  /** Lot key per club: lower ranks first. */
  lotKey: (clubId: ClubId) => string;
  content: ContentDB;
}

/** Order clubs by the leagues.json tie-break chain (see file header). */
export function rankClubs(clubIds: readonly ClubId[], ctx: RankContext): ClubId[] {
  const criteria = ctx.content.leagues.standings.tieBreakers;
  const restart = criteria.findIndex((c) => c.id === 'headToHeadPoints');
  const tally = (id: ClubId): Tally => {
    const t = ctx.tallies.get(id);
    invariant(t, `standings: no tally for ${id}`);
    return t;
  };
  const lotCache = new Map<ClubId, string>();
  const lot = (id: ClubId): string => {
    let key = lotCache.get(id);
    if (key === undefined) {
      key = ctx.lotKey(id);
      lotCache.set(id, key);
    }
    return key;
  };

  /** Comparator for criterion i over `group` (negative: a ranks ahead), or null when it does not apply. */
  const comparatorFor = (i: number, group: readonly ClubId[]): ((a: ClubId, b: ClubId) => number) | null => {
    const c = criteria[i]!;
    switch (c.id) {
      case 'points':
        return (a, b) => tally(b).points - tally(a).points;
      case 'matchWins':
        return (a, b) => tally(b).matchWins - tally(a).matchWins;
      case 'roundDifference':
        return (a, b) => tally(b).roundsWon - tally(b).roundsLost - (tally(a).roundsWon - tally(a).roundsLost);
      case 'roundsWon':
        return (a, b) => tally(b).roundsWon - tally(a).roundsWon;
      case 'downsDifference':
        return (a, b) => tally(b).downsInflicted - tally(b).downsSuffered - (tally(a).downsInflicted - tally(a).downsSuffered);
      case 'lot':
        return (a, b) => compareStrings(lot(a), lot(b)) || compareStrings(a, b);
      case 'headToHeadPoints': {
        const members = new Set(group);
        const h2h = new Map<ClubId, number>(group.map((id) => [id, 0]));
        const met = new Map<string, number>();
        for (const m of ctx.matches) {
          if (!members.has(m.home) || !members.has(m.away)) continue;
          h2h.set(m.home, h2h.get(m.home)! + matchPoints(m.homeRounds, m.awayRounds, ctx.content));
          h2h.set(m.away, h2h.get(m.away)! + matchPoints(m.awayRounds, m.homeRounds, ctx.content));
          const key = compareStrings(m.home, m.away) < 0 ? `${m.home}|${m.away}` : `${m.away}|${m.home}`;
          met.set(key, (met.get(key) ?? 0) + 1);
        }
        if (c.onlyIfAllTiedClubsMetEquallyOften) {
          const counts = new Set<number>();
          for (let x = 0; x < group.length; x++) {
            for (let y = x + 1; y < group.length; y++) {
              const a = group[x]!;
              const b = group[y]!;
              counts.add(met.get(compareStrings(a, b) < 0 ? `${a}|${b}` : `${b}|${a}`) ?? 0);
            }
          }
          if (counts.size > 1) return null;
        }
        return (a, b) => h2h.get(b)! - h2h.get(a)!;
      }
    }
  };

  const order = (group: readonly ClubId[], from: number): ClubId[] => {
    if (group.length <= 1) return [...group];
    for (let i = from; i < criteria.length; i++) {
      const cmp = comparatorFor(i, group);
      if (!cmp) continue;
      const sorted = [...group].sort((a, b) => cmp(a, b) || compareStrings(a, b));
      const runs: ClubId[][] = [];
      for (const id of sorted) {
        const run = runs[runs.length - 1];
        if (run && cmp(run[0]!, id) === 0) run.push(id);
        else runs.push([id]);
      }
      if (runs.length === 1) continue;
      const next = restart >= 0 && i >= restart ? restart : i + 1;
      return runs.flatMap((run) => order(run, next));
    }
    return [...group].sort(compareStrings);
  };

  return order(clubIds, 0);
}

/** Wing table (scope = wing id) or tier table ('tier') of a league competition. */
export function standingsImpl(state: GameState, competitionId: CompetitionId, scope: WingId | 'tier', content: ContentDB): StandingRow[] {
  const comp = requireCompetition(state, competitionId);
  invariant(comp.kind === 'league', `standings: ${competitionId} is a ${comp.kind}, not a league`);
  let clubIds: readonly ClubId[];
  if (scope === 'tier') clubIds = comp.clubIds;
  else {
    const wing = comp.wings.find((w) => w.wingId === scope);
    invariant(wing, `standings: ${competitionId} has no wing ${scope}`);
    clubIds = wing.clubIds;
  }
  const matches = playedLeagueMatches(state, comp);
  const tallies = tallyMatches(comp.clubIds, matches, content);
  const root = state.rng.root;
  const order = rankClubs(clubIds, {
    tallies,
    matches,
    lotKey: (id) => deriveSeed(root, STREAM.schedule, comp.season, comp.tierId, id),
    content,
  });
  return order.map((id, i) => ({ ...tallies.get(id)!, position: i + 1 }));
}
