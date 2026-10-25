/**
 * STAND-IN for core/league (WP3): a simplified two-wing schedule (circle
 * method + 2 cross weeks), points tables without the full tie-break chain, a
 * Reckoning bracket and promotion/relegation. Test and pre-integration use
 * only; the real rules live in core/league.
 */
import type { ContentDB } from '../../content';
import type { TierMove } from '../../league';
import {
  asId,
  leagueCompetitionId,
  leagueFixtureId,
  reckoningCompetitionId,
  reckoningFixtureId,
  type Bracket,
  type BracketSlot,
  type Calendar,
  type ClubId,
  type Competition,
  type CompetitionId,
  type Fixture,
  type GameState,
  type MatchResult,
  type SeasonRecord,
  type StandingRow,
  type TierId,
  type VenueId,
  type WeekId,
  type WingId,
} from '../../model';
import type { GamePorts } from '../ports';

type Port = GamePorts['league'];

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function calendarAt(content: ContentDB, season: number, weekIndex: number): Calendar {
  const w = content.weekByIndex(weekIndex);
  return { season, weekIndex, weekId: asId<WeekId>(w.id), phase: w.phase };
}

function weekOfMatchweek(content: ContentDB, mw: number): { index: number; id: WeekId } {
  const w = content.leagues.calendar.weeks.find((x) => x.matchweek === mw)!;
  return { index: w.index, id: asId<WeekId>(w.id) };
}

function addFixture(draft: GameState, comp: Competition, f: Fixture): void {
  draft.fixtures[f.id] = f;
  comp.fixtureIds.push(f.id);
}

function setupSeason(draft: GameState, season: number, content: ContentDB): void {
  const lg = content.leagues;
  for (const tier of [...content.tiers.list].sort((a, b) => a.level - b.level)) {
    const tierId = asId<TierId>(tier.id);
    const clubs = Object.values(draft.clubs)
      .filter((c) => c.tierId === tierId)
      .sort((a, b) => b.prestige - a.prestige || cmp(a.id, b.id));
    const seedOrder = clubs.map((c) => c.id);
    const wings: Record<string, ClubId[]> = {};
    for (const w of lg.wings.list) wings[w.id] = [];
    seedOrder.forEach((id, i) => {
      const wing = lg.wings.serpentinePattern[i % lg.wings.serpentinePattern.length]!;
      wings[wing]!.push(id);
      draft.clubs[id]!.wingId = asId<WingId>(wing);
    });
    const comp: Competition = {
      id: leagueCompetitionId(season, tierId),
      kind: 'league',
      season,
      tierId,
      clubIds: [...seedOrder],
      wings: lg.wings.list.map((w) => ({ wingId: asId<WingId>(w.id), clubIds: [...wings[w.id]!] })),
      seedOrder,
      fixtureIds: [],
      bracket: null,
      status: 'scheduled',
    };
    draft.competitions[comp.id] = comp;
    const mk = (mw: number, home: ClubId, away: ClubId, wing: WingId | 'cross'): Fixture => {
      const wk = weekOfMatchweek(content, mw);
      return {
        id: leagueFixtureId(season, tierId, wk.id, home, away),
        competitionId: comp.id,
        season,
        tierId,
        weekIndex: wk.index,
        weekId: wk.id,
        stage: 'league',
        matchweek: mw,
        wing,
        homeClubId: home,
        awayClubId: away,
        bestOf: lg.regularSeason.matchBestOf,
        venueId: null,
        status: 'scheduled',
      };
    };
    for (const w of comp.wings) {
      const s = w.clubIds;
      const rounds: [number, number][][] = [];
      for (let r = 0; r < 7; r++) {
        const pairs: [number, number][] = [r % 2 === 1 ? [7, r] : [r, 7]];
        for (let k = 1; k <= 3; k++) {
          const a = (r + k) % 7;
          const b = (r - k + 7) % 7;
          pairs.push(k % 2 === 1 ? [a, b] : [b, a]);
        }
        rounds.push(pairs);
      }
      const all = [...rounds, ...rounds.map((ps) => ps.map(([h, a]) => [a, h] as [number, number]))];
      all.forEach((pairs, i) => {
        const mw = lg.regularSeason.wingRoundMatchweeks[i]!;
        for (const [h, a] of pairs) addFixture(draft, comp, mk(mw, s[h]!, s[a]!, w.wingId));
      });
    }
    const [dawn, dusk] = [comp.wings[0]!.clubIds, comp.wings[1]!.clubIds];
    const [cw1, cw2] = lg.regularSeason.crossWingMatchweeks;
    const odd = season % 2 === 1;
    for (let k = 0; k < dawn.length; k++) {
      const a = dawn[k]!;
      const b = dusk[k]!;
      addFixture(draft, comp, odd ? mk(cw1!, a, b, 'cross') : mk(cw1!, b, a, 'cross'));
      const c = dusk[dawn.length - 1 - k]!;
      addFixture(draft, comp, odd ? mk(cw2!, c, a, 'cross') : mk(cw2!, a, c, 'cross'));
    }
  }
}

function fixturesForWeek(state: GameState, weekIndex: number): Fixture[] {
  return Object.values(state.fixtures)
    .filter((f) => f.season === state.calendar.season && f.weekIndex === weekIndex)
    .sort((a, b) => cmp(a.id, b.id));
}

function clubFixture(state: GameState, clubId: ClubId, weekIndex: number): Fixture | null {
  return fixturesForWeek(state, weekIndex).find((f) => f.homeClubId === clubId || f.awayClubId === clubId) ?? null;
}

function emptyRow(clubId: ClubId): StandingRow {
  return { clubId, position: 0, played: 0, matchWins: 0, matchLosses: 0, points: 0, roundsWon: 0, roundsLost: 0, downsInflicted: 0, downsSuffered: 0, results: { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 }, form: [] };
}

function standings(state: GameState, competitionId: CompetitionId, scope: WingId | 'tier', content: ContentDB): StandingRow[] {
  const comp = state.competitions[competitionId];
  if (!comp) return [];
  const ids = scope === 'tier' ? comp.clubIds : (comp.wings.find((w) => w.wingId === scope)?.clubIds ?? []);
  const rows = new Map(ids.map((id) => [id, emptyRow(id)]));
  const pts = content.leagues.standings.pointsByResult as Record<string, number>;
  for (const fid of comp.fixtureIds) {
    const r = state.results[fid];
    if (!r || r.stage !== 'league') continue;
    for (const [club, mine, theirs] of [
      [r.homeClubId, r.score.home, r.score.away],
      [r.awayClubId, r.score.away, r.score.home],
    ] as const) {
      const row = rows.get(club);
      if (!row) continue;
      row.played++;
      const key = `${mine}-${theirs}` as keyof StandingRow['results'];
      if (row.results[key] !== undefined) row.results[key]++;
      row.points += pts[key] ?? 0;
      if (mine > theirs) row.matchWins++;
      else row.matchLosses++;
      row.roundsWon += mine;
      row.roundsLost += theirs;
      row.form = [...row.form, mine > theirs ? ('W' as const) : ('L' as const)].slice(-5);
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.matchWins - a.matchWins || b.roundsWon - b.roundsLost - (a.roundsWon - a.roundsLost) || cmp(a.clubId, b.clubId),
  );
  sorted.forEach((r, i) => (r.position = i + 1));
  return sorted;
}

function leagueCompetitionOf(state: GameState, season: number, tierId: TierId): CompetitionId | null {
  const id = leagueCompetitionId(season, tierId);
  return state.competitions[id] ? id : null;
}

function seedOf(bracket: Bracket, clubId: ClubId): number {
  return bracket.seeds.indexOf(clubId) + 1;
}

function resolveSlot(bracket: Bracket, slot: BracketSlot): ClubId | null {
  if (slot.kind === 'seed') return bracket.seeds[slot.seed - 1] ?? null;
  return bracket.rounds.find((r) => r.roundId === slot.roundId)?.ties.find((t) => t.slot === slot.slot)?.winnerClubId ?? null;
}

function createTieFixtures(draft: GameState, comp: Competition, content: ContentDB): void {
  const bracket = comp.bracket!;
  for (const round of bracket.rounds) {
    const def = content.leagues.tournament.rounds.find((r) => r.id === round.roundId)!;
    const week = content.weeks.require(round.weekId);
    for (const tie of round.ties) {
      if (tie.fixtureId !== null) continue;
      const a = resolveSlot(bracket, tie.home);
      const b = resolveSlot(bracket, tie.away);
      if (a === null || b === null) continue;
      const [home, away] = seedOf(bracket, a) <= seedOf(bracket, b) ? [a, b] : [b, a];
      const id = reckoningFixtureId(comp.season, comp.tierId, round.roundId, tie.slot);
      tie.fixtureId = id;
      const venue = (def as { venueId?: string }).venueId;
      draft.fixtures[id] = {
        id,
        competitionId: comp.id,
        season: comp.season,
        tierId: comp.tierId,
        weekIndex: week.index,
        weekId: asId<WeekId>(week.id),
        stage: round.roundId,
        matchweek: null,
        wing: null,
        homeClubId: home,
        awayClubId: away,
        bestOf: round.bestOf,
        venueId: venue ? asId<VenueId>(venue) : null,
        status: 'scheduled',
      };
      comp.fixtureIds.push(id);
    }
  }
}

function seedReckonings(draft: GameState, content: ContentDB): void {
  const season = draft.calendar.season;
  const t = content.leagues.tournament;
  for (const tier of [...content.tiers.list].sort((a, b) => a.level - b.level)) {
    const tierId = asId<TierId>(tier.id);
    const lgId = leagueCompetitionId(season, tierId);
    const lgComp = draft.competitions[lgId];
    if (!lgComp) continue;
    const table = standings(draft, lgId, 'tier', content).map((r) => r.clubId);
    const qualified: ClubId[] = [];
    const winners: ClubId[] = [];
    for (const w of lgComp.wings) {
      const rows = standings(draft, lgId, w.wingId, content).slice(0, t.qualifiersPerWing).map((r) => r.clubId);
      qualified.push(...rows);
      if (rows[0]) winners.push(rows[0]);
    }
    const byTable = (a: ClubId, b: ClubId): number => table.indexOf(a) - table.indexOf(b);
    const seeds = [...winners.sort(byTable), ...qualified.filter((c) => !winners.includes(c)).sort(byTable)];
    const qf = t.rounds[0]!;
    const bracket: Bracket = {
      seeds,
      rounds: [
        {
          roundId: 'quarterfinal',
          weekId: asId<WeekId>(qf.week),
          bestOf: qf.bestOf,
          ties: (qf.pairs as number[][]).map((p, i) => ({ slot: i + 1, home: { kind: 'seed', seed: p[0]! }, away: { kind: 'seed', seed: p[1]! }, fixtureId: null, winnerClubId: null })),
        },
        {
          roundId: 'semifinal',
          weekId: asId<WeekId>(t.rounds[1]!.week),
          bestOf: t.rounds[1]!.bestOf,
          ties: [
            { slot: 1, home: { kind: 'winner-of', roundId: 'quarterfinal', slot: 1 }, away: { kind: 'winner-of', roundId: 'quarterfinal', slot: 2 }, fixtureId: null, winnerClubId: null },
            { slot: 2, home: { kind: 'winner-of', roundId: 'quarterfinal', slot: 3 }, away: { kind: 'winner-of', roundId: 'quarterfinal', slot: 4 }, fixtureId: null, winnerClubId: null },
          ],
        },
        {
          roundId: 'final',
          weekId: asId<WeekId>(t.rounds[2]!.week),
          bestOf: t.rounds[2]!.bestOf,
          ties: [{ slot: 1, home: { kind: 'winner-of', roundId: 'semifinal', slot: 1 }, away: { kind: 'winner-of', roundId: 'semifinal', slot: 2 }, fixtureId: null, winnerClubId: null }],
        },
      ],
      championId: null,
      runnerUpId: null,
    };
    const comp: Competition = {
      id: reckoningCompetitionId(season, tierId),
      kind: 'reckoning',
      season,
      tierId,
      clubIds: seeds,
      wings: [],
      seedOrder: seeds,
      fixtureIds: [],
      bracket,
      status: 'in-progress',
    };
    draft.competitions[comp.id] = comp;
    lgComp.status = 'completed';
    createTieFixtures(draft, comp, content);
  }
}

function recordResult(draft: GameState, result: MatchResult, content: ContentDB): void {
  const fx = draft.fixtures[result.fixtureId];
  if (!fx) return;
  fx.status = 'played';
  const comp = draft.competitions[fx.competitionId];
  if (!comp) return;
  if (comp.kind === 'league') {
    comp.status = 'in-progress';
    return;
  }
  const bracket = comp.bracket!;
  for (const round of bracket.rounds) {
    const tie = round.ties.find((t) => t.fixtureId === fx.id);
    if (!tie) continue;
    tie.winnerClubId = result.winnerClubId;
    if (round.roundId === 'final') {
      bracket.championId = result.winnerClubId;
      bracket.runnerUpId = result.winnerClubId === fx.homeClubId ? fx.awayClubId : fx.homeClubId;
      comp.status = 'completed';
    }
  }
  createTieFixtures(draft, comp, content);
}

function reckoningStage(state: GameState, clubId: ClubId): 'quarterfinal' | 'semifinal' | 'final' | 'champion' | null {
  let best: 'quarterfinal' | 'semifinal' | 'final' | 'champion' | null = null;
  const order = ['quarterfinal', 'semifinal', 'final', 'champion'];
  for (const comp of Object.values(state.competitions)) {
    if (comp.kind !== 'reckoning' || comp.season !== state.calendar.season || !comp.bracket) continue;
    if (comp.bracket.championId === clubId) return 'champion';
    for (const round of comp.bracket.rounds) {
      for (const tie of round.ties) {
        const fx = tie.fixtureId ? state.fixtures[tie.fixtureId] : undefined;
        if (fx && (fx.homeClubId === clubId || fx.awayClubId === clubId)) {
          if (best === null || order.indexOf(round.roundId) > order.indexOf(best)) best = round.roundId;
        }
      }
    }
  }
  return best;
}

function promotionRelegation(state: GameState, content: ContentDB): TierMove[] {
  const season = state.calendar.season;
  const tiers = [...content.tiers.list].sort((a, b) => a.level - b.level);
  const moves: TierMove[] = [];
  for (let i = 0; i + 1 < tiers.length; i++) {
    const upper = asId<TierId>(tiers[i]!.id);
    const lower = asId<TierId>(tiers[i + 1]!.id);
    const up = state.competitions[leagueCompetitionId(season, upper)];
    if (up) {
      for (const w of up.wings) {
        const last = standings(state, up.id, w.wingId, content).at(-1);
        if (last) moves.push({ clubId: last.clubId, from: upper, to: lower, reason: 'relegated' });
      }
    }
    const champion = state.competitions[reckoningCompetitionId(season, lower)]?.bracket?.championId ?? null;
    const table = standings(state, leagueCompetitionId(season, lower), 'tier', content).map((r) => r.clubId);
    if (champion) moves.push({ clubId: champion, from: lower, to: upper, reason: 'reckoning' });
    const shield = table.find((c) => c !== champion);
    if (shield) moves.push({ clubId: shield, from: lower, to: upper, reason: 'shield' });
  }
  return moves;
}

function archiveSeason(state: GameState, moves: readonly TierMove[], content: ContentDB): SeasonRecord {
  const season = state.calendar.season;
  return {
    season,
    tiers: [...content.tiers.list]
      .sort((a, b) => a.level - b.level)
      .map((tier) => {
        const tierId = asId<TierId>(tier.id);
        const lg = state.competitions[leagueCompetitionId(season, tierId)];
        const rk = state.competitions[reckoningCompetitionId(season, tierId)];
        const tierTable = lg ? standings(state, lg.id, 'tier', content) : [];
        return {
          tierId,
          wingTables: lg ? lg.wings.map((w) => ({ wingId: w.wingId, rows: standings(state, lg.id, w.wingId, content) })) : [],
          tierTable,
          reckoningChampionId: rk?.bracket?.championId ?? null,
          reckoningRunnerUpId: rk?.bracket?.runnerUpId ?? null,
          shieldWinnerId: tierTable[0]?.clubId ?? null,
          promotedIds: moves.filter((m) => m.from === tierId && m.reason !== 'relegated').map((m) => m.clubId),
          relegatedIds: moves.filter((m) => m.from === tierId && m.reason === 'relegated').map((m) => m.clubId),
        };
      }),
    retirements: [],
    rookieIds: [],
  };
}

function compactHistory(draft: GameState): void {
  const keepFrom = draft.calendar.season - 1;
  for (const [id, r] of Object.entries(draft.results)) if (r.season < keepFrom) delete draft.results[id as keyof typeof draft.results];
  for (const [id, f] of Object.entries(draft.fixtures)) if (f.season < keepFrom) delete draft.fixtures[id as keyof typeof draft.fixtures];
  for (const [id, c] of Object.entries(draft.competitions)) if (c.season < keepFrom) delete draft.competitions[id as keyof typeof draft.competitions];
}

export function standInLeague(): Port {
  return {
    nextCalendar: (cal, content) => {
      const n = content.leagues.calendar.weeks.length;
      return cal.weekIndex < n ? calendarAt(content, cal.season, cal.weekIndex + 1) : { season: cal.season, weekIndex: n + 1, weekId: null, phase: 'season-end' };
    },
    seasonStartCalendar: (season, content) => calendarAt(content, season, 1),
    setupSeason,
    fixturesForWeek,
    clubFixture,
    recordResult,
    standings,
    seedReckonings,
    reckoningStage,
    promotionRelegation,
    applyTierMoves: (draft, moves) => {
      for (const m of moves) draft.clubs[m.clubId]!.tierId = m.to;
    },
    archiveSeason,
    leagueSeasonColumns: (state, record, clubId) => {
      for (const t of record.tiers) {
        const row = t.tierTable.find((r) => r.clubId === clubId);
        if (!row) continue;
        const wing = t.wingTables.find((w) => w.rows.some((r) => r.clubId === clubId));
        return {
          season: record.season,
          tierId: t.tierId,
          wingId: wing?.wingId ?? null,
          wingPosition: wing?.rows.find((r) => r.clubId === clubId)?.position ?? 0,
          tierPosition: row.position,
          points: row.points,
          matchWins: row.matchWins,
          matchLosses: row.matchLosses,
          reckoning: reckoningStage(state, clubId),
          shield: t.shieldWinnerId === clubId,
          promoted: t.promotedIds.includes(clubId),
          relegated: t.relegatedIds.includes(clubId),
        };
      }
      return null;
    },
    compactHistory,
    lastRegularWeekIndex: (content) => Math.max(...content.leagues.calendar.weeks.filter((w) => w.phase === 'regular').map((w) => w.index)),
    isCompactedResult: (r) => r.input.home.fighters.length === 0 && r.input.away.fighters.length === 0,
  };
}

export { leagueCompetitionOf as standInLeagueCompetitionOf };
