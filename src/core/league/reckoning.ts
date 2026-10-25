/**
 * The Reckoning (03-league-economy sys-tournament; leagues.json tournament):
 * the top qualifiersPerWing of each wing table; wing winners are seeds 1..W
 * ordered by the tier table, the other qualifiers follow in tier-table order;
 * round 1 pairs seeds as listed (1v8, 4v5, 2v7, 3v6); later rounds pair
 * winners of earlier ties ("QF1" = winner of quarterfinal tie 1). Fixtures
 * are created as soon as both clubs of a tie are known. Hosts: the higher
 * seed; a neutral round is played at its venue with the higher seed as the
 * sim's home side. Single matches, no replays, no byes.
 *
 * BracketTie.home/away are bracket positions (content order); the fixture's
 * home club is decided by the round's host rule once both clubs are known.
 */
import type { ContentDB, TournamentRoundDef } from '../content';
import {
  putFixture,
  asId,
  leagueCompetitionId,
  reckoningCompetitionId,
  reckoningFixtureId,
  type Bracket,
  type BracketRound,
  type BracketSlot,
  type BracketTie,
  type ClubId,
  type Competition,
  type Fixture,
  type GameState,
  type StandingRow,
  type TierId,
  type VenueId,
  type WeekId,
  type WingId,
} from '../model';
import { InvariantError, invariant } from '../util';
import { seasonCompetitions, tiersByLevel } from './common';
import { standingsImpl } from './standings';

type RoundId = TournamentRoundDef['id'];
type EarlierRoundId = 'quarterfinal' | 'semifinal';
export type ReckoningStage = 'quarterfinal' | 'semifinal' | 'final' | 'champion';

/** Short codes used by leagues.json pair tokens ("QF1", "SF2"); the round ids are a closed vocabulary. */
const ROUND_CODES: Readonly<Record<RoundId, string>> = { quarterfinal: 'QF', semifinal: 'SF', final: 'F' };

// ---- seeding -----------------------------------------------------------------------------------------------

/**
 * Seeds 1..N from final tables: each wing's top qualifiersPerWing qualify;
 * wing winners take the first seeds in tier-table order, the remaining
 * qualifiers follow in tier-table order (le-005).
 */
export function reckoningSeeds(
  wingTables: readonly { wingId: WingId; rows: readonly StandingRow[] }[],
  tierTable: readonly StandingRow[],
  content: ContentDB,
): ClubId[] {
  const perWing = content.leagues.tournament.qualifiersPerWing;
  const rank = new Map(tierTable.map((r) => [r.clubId, r.position]));
  const rankOf = (id: ClubId): number => {
    const r = rank.get(id);
    invariant(r !== undefined, `reckoning: qualifier ${id} is missing from the tier table`);
    return r;
  };
  const winners: ClubId[] = [];
  const others: ClubId[] = [];
  for (const wing of wingTables) {
    invariant(wing.rows.length >= perWing, `reckoning: wing ${wing.wingId} has fewer than ${perWing} clubs`);
    wing.rows.slice(0, perWing).forEach((row, i) => (i === 0 ? winners : others).push(row.clubId));
  }
  const byRank = (a: ClubId, b: ClubId): number => rankOf(a) - rankOf(b);
  return [...winners.sort(byRank), ...others.sort(byRank)];
}

// ---- bracket construction -------------------------------------------------------------------------------------

function parseSlot(token: number | string, roundIndex: number, rounds: readonly TournamentRoundDef[], seeds: number): BracketSlot {
  if (typeof token === 'number') {
    invariant(roundIndex === 0, `reckoning: seed ${token} entered after round 1 (byes are not supported)`);
    invariant(Number.isInteger(token) && token >= 1 && token <= seeds, `reckoning: seed ${token} is outside 1..${seeds}`);
    return { kind: 'seed', seed: token };
  }
  const match = /^([A-Z]+)(\d+)$/.exec(token);
  invariant(match, `reckoning: cannot read bracket token "${token}"`);
  const source = rounds.slice(0, roundIndex).find((r) => ROUND_CODES[r.id] === match[1]);
  invariant(source && source.id !== 'final', `reckoning: token "${token}" names no earlier round`);
  return { kind: 'winner-of', roundId: source.id as EarlierRoundId, slot: Number(match[2]) };
}

/** Empty bracket for the seeds (round structure from leagues.json tournament.rounds). */
export function buildBracket(seeds: readonly ClubId[], content: ContentDB): Bracket {
  const defs = content.leagues.tournament.rounds;
  invariant(defs.length > 0, 'reckoning: no tournament rounds');
  invariant(new Set(seeds).size === seeds.length, 'reckoning: a club is seeded twice');
  const rounds: BracketRound[] = [];
  defs.forEach((def, i) => {
    let pairs: [BracketSlot, BracketSlot][];
    if (def.pairs) {
      pairs = def.pairs.map(([a, b]) => [parseSlot(a, i, defs, seeds.length), parseSlot(b, i, defs, seeds.length)]);
    } else {
      // No explicit pairs: winners of the previous round's ties in order (1v2, 3v4, ...).
      invariant(i > 0, 'reckoning: the first round must list its seed pairs');
      const prev = rounds[i - 1]!;
      invariant(prev.roundId !== 'final', 'reckoning: no round can follow the final');
      invariant(prev.ties.length % 2 === 0, `reckoning: round ${prev.roundId} has an odd number of ties`);
      pairs = [];
      for (let t = 0; t < prev.ties.length; t += 2) {
        pairs.push([
          { kind: 'winner-of', roundId: prev.roundId as EarlierRoundId, slot: t + 1 },
          { kind: 'winner-of', roundId: prev.roundId as EarlierRoundId, slot: t + 2 },
        ]);
      }
    }
    const ties: BracketTie[] = pairs.map(([home, away], t) => ({ slot: t + 1, home, away, fixtureId: null, winnerClubId: null }));
    rounds.push({ roundId: def.id, weekId: asId<WeekId>(def.week), bestOf: def.bestOf, ties });
  });

  // Every seed enters once; every non-final tie feeds exactly one later tie; the last round is a single final tie.
  const seen = new Set<number>();
  const fed = new Map<string, number>();
  for (const round of rounds) {
    for (const tie of round.ties) {
      for (const slot of [tie.home, tie.away]) {
        if (slot.kind === 'seed') {
          invariant(!seen.has(slot.seed), `reckoning: seed ${slot.seed} appears twice`);
          seen.add(slot.seed);
        } else {
          const source = rounds.find((r) => r.roundId === slot.roundId);
          invariant(source && source.ties.some((t) => t.slot === slot.slot), `reckoning: ${slot.roundId} tie ${slot.slot} does not exist`);
          const key = `${slot.roundId}:${slot.slot}`;
          fed.set(key, (fed.get(key) ?? 0) + 1);
        }
      }
    }
  }
  invariant(seen.size === seeds.length, `reckoning: ${seen.size} of ${seeds.length} seeds enter the bracket`);
  const last = rounds[rounds.length - 1]!;
  invariant(last.ties.length === 1, 'reckoning: the last round must be a single tie');
  for (const round of rounds.slice(0, -1)) {
    for (const tie of round.ties) {
      invariant(fed.get(`${round.roundId}:${tie.slot}`) === 1, `reckoning: the winner of ${round.roundId} tie ${tie.slot} must advance exactly once`);
    }
  }
  return { seeds: [...seeds], rounds, championId: null, runnerUpId: null };
}

// ---- progression --------------------------------------------------------------------------------------------------

function slotClub(bracket: Bracket, slot: BracketSlot): ClubId | null {
  if (slot.kind === 'seed') return bracket.seeds[slot.seed - 1] ?? null;
  const round = bracket.rounds.find((r) => r.roundId === slot.roundId);
  return round?.ties.find((t) => t.slot === slot.slot)?.winnerClubId ?? null;
}

function seedOf(bracket: Bracket, clubId: ClubId): number {
  const i = bracket.seeds.indexOf(clubId);
  invariant(i >= 0, `reckoning: ${clubId} is not seeded`);
  return i + 1;
}

/** Create the fixture of every tie whose two clubs are known and that has none yet. */
function createReadyFixtures(draft: GameState, comp: Competition, content: ContentDB): void {
  const bracket = comp.bracket!;
  for (const round of bracket.rounds) {
    const def = content.leagues.tournament.rounds.find((r) => r.id === round.roundId);
    invariant(def, `reckoning: round ${round.roundId} is not in leagues.json`);
    for (const tie of round.ties) {
      if (tie.fixtureId !== null) continue;
      const a = slotClub(bracket, tie.home);
      const b = slotClub(bracket, tie.away);
      if (a === null || b === null) continue;
      const [higher, lower] = seedOf(bracket, a) < seedOf(bracket, b) ? [a, b] : [b, a];
      let venueId: VenueId | null = null;
      if (def.host === 'neutral') {
        invariant(def.venueId, `reckoning: neutral round ${def.id} has no venue`);
        venueId = asId<VenueId>(def.venueId);
      }
      // 'higher_seed' hosts, and a neutral round's homeSideForSim is the higher seed (the only supported value).
      const week = content.weeks.require(def.week);
      const fixture: Fixture = {
        id: reckoningFixtureId(comp.season, comp.tierId, round.roundId, tie.slot),
        competitionId: comp.id,
        season: comp.season,
        tierId: comp.tierId,
        weekIndex: week.index,
        weekId: asId<WeekId>(week.id),
        stage: round.roundId,
        matchweek: null,
        wing: null,
        homeClubId: higher,
        awayClubId: lower,
        bestOf: round.bestOf,
        venueId,
        status: 'scheduled',
      };
      invariant(!draft.fixtures[fixture.id], `reckoning: fixture ${fixture.id} already exists`);
      putFixture(draft, fixture);
      tie.fixtureId = fixture.id;
      comp.fixtureIds.push(fixture.id);
    }
  }
}

/** Create a tier's Reckoning competition from its seeds, with the round-1 fixtures. */
export function createReckoning(draft: GameState, season: number, tierId: TierId, seeds: readonly ClubId[], content: ContentDB): Competition {
  const id = reckoningCompetitionId(season, tierId);
  invariant(!draft.competitions[id], `reckoning: ${id} already exists`);
  const comp: Competition = {
    id,
    kind: 'reckoning',
    season,
    tierId,
    clubIds: [...seeds],
    wings: [],
    seedOrder: [],
    fixtureIds: [],
    bracket: buildBracket(seeds, content),
    status: 'scheduled',
  };
  draft.competitions[id] = comp;
  createReadyFixtures(draft, comp, content);
  return comp;
}

/** Seed every tier's Reckoning from the completed regular season of the current season. */
export function seedReckoningsImpl(draft: GameState, content: ContentDB): void {
  const season = draft.calendar.season;
  for (const tier of tiersByLevel(content)) {
    const tierId = asId<TierId>(tier.id);
    const league = draft.competitions[leagueCompetitionId(season, tierId)];
    if (!league) continue;
    for (const fid of league.fixtureIds) {
      invariant(draft.fixtures[fid]?.status === 'played', `seedReckonings: ${fid} is not played yet`);
    }
    const wingTables = league.wings.map((w) => ({ wingId: w.wingId, rows: standingsImpl(draft, league.id, w.wingId, content) }));
    const tierTable = standingsImpl(draft, league.id, 'tier', content);
    createReckoning(draft, season, tierId, reckoningSeeds(wingTables, tierTable, content), content);
    league.status = 'completed';
  }
}

/** Record a played Reckoning fixture: the tie's winner, newly known fixtures, and the champion after the final. */
export function advanceBracket(draft: GameState, comp: Competition, fixtureId: Fixture['id'], winner: ClubId, content: ContentDB): void {
  const bracket = comp.bracket;
  invariant(bracket, `reckoning: ${comp.id} has no bracket`);
  const roundIndex = bracket.rounds.findIndex((r) => r.ties.some((t) => t.fixtureId === fixtureId));
  invariant(roundIndex >= 0, `reckoning: ${fixtureId} is not a tie of ${comp.id}`);
  const round = bracket.rounds[roundIndex]!;
  const tie = round.ties.find((t) => t.fixtureId === fixtureId)!;
  invariant(tie.winnerClubId === null, `reckoning: ${fixtureId} already has a winner`);
  const home = slotClub(bracket, tie.home);
  const away = slotClub(bracket, tie.away);
  invariant(winner === home || winner === away, `reckoning: ${winner} did not play ${fixtureId}`);
  tie.winnerClubId = winner;
  comp.status = 'in-progress';
  if (roundIndex === bracket.rounds.length - 1) {
    bracket.championId = winner;
    bracket.runnerUpId = winner === home ? away : home;
    comp.status = 'completed';
    return;
  }
  createReadyFixtures(draft, comp, content);
}

// ---- queries ---------------------------------------------------------------------------------------------------------

/** Furthest stage a club reached in one Reckoning, or null if it did not qualify. */
export function reckoningStageIn(comp: Competition, clubId: ClubId): ReckoningStage | null {
  const bracket = comp.bracket;
  if (!bracket || !bracket.seeds.includes(clubId)) return null;
  if (bracket.championId === clubId) return 'champion';
  let stage: ReckoningStage | null = null;
  for (const round of bracket.rounds) {
    if (round.ties.some((t) => slotClub(bracket, t.home) === clubId || slotClub(bracket, t.away) === clubId)) stage = round.roundId;
  }
  if (stage === null) throw new InvariantError(`reckoning: seeded club ${clubId} appears in no round of ${comp.id}`);
  return stage;
}

/** Furthest Reckoning stage of a club in a season, over every tier's Reckoning. */
export function reckoningStageForSeason(state: GameState, season: number, clubId: ClubId): ReckoningStage | null {
  for (const comp of seasonCompetitions(state, season, 'reckoning')) {
    const stage = reckoningStageIn(comp, clubId);
    if (stage !== null) return stage;
  }
  return null;
}
