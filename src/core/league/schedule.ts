/**
 * Regular-season schedule (03-league-economy sys-league "Schedule
 * generation"; leagues.json wings + regularSeason): seed order, serpentine
 * wing draw, seeded slot shuffle per wing, circle-method double round-robin
 * with a venue-swapped second half, two cross-wing matchweeks, and a
 * validation pass that throws on any broken invariant (a programming error,
 * never a game state).
 */
import type { ContentDB } from '../content';
import {
  putFixture,
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
  type WingDraw,
  type WingId,
} from '../model';
import { Rng, STREAM, type Seed } from '../rng';
import { InvariantError, compareStrings, invariant } from '../util';
import { matchweekWeek } from './calendar';
import { adjacentTier, clubsInTier, compareFixtures, tiersByLevel } from './common';

// ---- seed order --------------------------------------------------------------------------------------

/**
 * Seed order of a tier for a season (leagues.json regularSeason.seedOrder).
 * First season of a career (no archived previous season): start prestige
 * descending (clubs.json startPrestige; the club's prestige if it has no
 * template), ties by club id. Later seasons, in the content's group order:
 * clubs relegated from the tier above (by their final tier-table rank there),
 * clubs that stayed (by final tier-table rank), clubs promoted from below
 * (in the archived promotion order: Reckoning champion first, then the Shield
 * route). Club tiers must already hold next season's membership.
 */
export function seasonSeedOrder(state: GameState, tierId: TierId, season: number, content: ContentDB): ClubId[] {
  const clubs = clubsInTier(state, tierId);
  const previous = state.history.find((r) => r.season === season - 1);
  if (!previous) {
    const prestigeOf = (id: ClubId): number => content.clubs.get(id)?.startPrestige ?? state.clubs[id]!.prestige;
    return clubs.sort((a, b) => prestigeOf(b) - prestigeOf(a) || compareStrings(a, b));
  }
  const recordOf = (t: string | undefined) => (t === undefined ? undefined : previous.tiers.find((r) => r.tierId === t));
  const own = recordOf(tierId);
  const above = recordOf(adjacentTier(content, tierId, -1)?.id);
  const below = recordOf(adjacentTier(content, tierId, 1)?.id);
  const rankIn = (rows: readonly { clubId: ClubId; position: number }[] | undefined, id: ClubId): number | undefined =>
    rows?.find((r) => r.clubId === id)?.position;

  const groups: Record<'relegatedFromAbove' | 'stayed' | 'promotedFromBelow', { id: ClubId; key: number; rank: number }[]> = {
    relegatedFromAbove: [],
    stayed: [],
    promotedFromBelow: [],
  };
  for (const id of clubs) {
    const stayedRank = rankIn(own?.tierTable, id);
    if (stayedRank !== undefined) {
      groups.stayed.push({ id, key: stayedRank, rank: stayedRank });
      continue;
    }
    const aboveRank = rankIn(above?.tierTable, id);
    if (aboveRank !== undefined) {
      groups.relegatedFromAbove.push({ id, key: aboveRank, rank: aboveRank });
      continue;
    }
    const belowRank = rankIn(below?.tierTable, id);
    if (belowRank !== undefined) {
      const route = below!.promotedIds.indexOf(id);
      groups.promotedFromBelow.push({ id, key: route < 0 ? Number.MAX_SAFE_INTEGER : route, rank: belowRank });
      continue;
    }
    throw new InvariantError(`seed order: club ${id} is in tier ${tierId} but in no adjacent tier table of season ${season - 1}`);
  }
  const order: ClubId[] = [];
  for (const group of content.leagues.regularSeason.seedOrder.later) {
    const list = groups[group].sort((a, b) => a.key - b.key || a.rank - b.rank || compareStrings(a.id, b.id));
    for (const entry of list) order.push(entry.id);
  }
  invariant(order.length === clubs.length, `seed order: seedOrder.later must list every group (got ${order.length} of ${clubs.length} clubs)`);
  return order;
}

// ---- wing draw ---------------------------------------------------------------------------------------------

/**
 * Serpentine wing draw: seed position i (0-based) goes to wing
 * serpentinePattern[i mod pattern length]. Each wing's clubs are listed in
 * seed order, so a club's index in `clubIds` is its wing index k (used by the
 * cross-wing pairing). Wings follow leagues.json wings.list order.
 */
export function serpentineDraw(seedOrder: readonly ClubId[], content: ContentDB): WingDraw[] {
  const { list, size, serpentinePattern } = content.leagues.wings;
  invariant(serpentinePattern.length > 0, 'wings.serpentinePattern is empty');
  const wings: WingDraw[] = list.map((w) => ({ wingId: asId<WingId>(w.id), clubIds: [] }));
  seedOrder.forEach((clubId, i) => {
    const wingId = serpentinePattern[i % serpentinePattern.length]!;
    const wing = wings.find((w) => w.wingId === wingId);
    invariant(wing, `serpentine pattern names unknown wing ${wingId}`);
    wing.clubIds.push(clubId);
  });
  for (const w of wings) {
    invariant(w.clubIds.length === size, `wing draw: wing ${w.wingId} has ${w.clubIds.length} clubs, expected ${size}`);
  }
  return wings;
}

// ---- fixtures ------------------------------------------------------------------------------------------------------

export interface LeagueScheduleParams {
  rootSeed: Seed;
  season: number;
  tierId: TierId;
  /** All clubs of the tier, best seed first. */
  seedOrder: readonly ClubId[];
}

export interface LeagueSchedule {
  competitionId: CompetitionId;
  wings: WingDraw[];
  /** Schedule order: week, then fixture id. */
  fixtures: Fixture[];
}

interface Pairing {
  home: ClubId;
  away: ClubId;
}

/** Circle method over slots 0..n-1 (n even): rounds r = 0..n-2 (03-league-economy step 4). */
function circleRounds(slots: readonly ClubId[]): Pairing[][] {
  const n = slots.length;
  invariant(n >= 2 && n % 2 === 0, `circle method needs an even wing size, got ${n}`);
  const m = n - 1;
  const rounds: Pairing[][] = [];
  for (let r = 0; r < m; r++) {
    const last = slots[m]!;
    const other = slots[r]!;
    const round: Pairing[] = [r % 2 === 1 ? { home: last, away: other } : { home: other, away: last }];
    for (let k = 1; k < n / 2; k++) {
      const a = slots[(r + k) % m]!;
      const b = slots[(r - k + m) % m]!;
      round.push(k % 2 === 1 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(round);
  }
  return rounds;
}

/**
 * The full regular season of one tier: wing draw, both halves of the wing
 * double round-robin and the cross-wing matchweeks, validated. Pure: the
 * slot shuffle draws from Rng(root, schedule, season, tierId, wingId).
 */
export function buildLeagueSchedule(params: LeagueScheduleParams, content: ContentDB): LeagueSchedule {
  const { rootSeed, season, tierId, seedOrder } = params;
  const rs = content.leagues.regularSeason;
  const wingDefs = content.leagues.wings.list;
  invariant(rs.format === 'two_wing_double_round_robin_plus_cross', `unsupported regular-season format ${rs.format}`);
  invariant(wingDefs.length === 2, `format ${rs.format} needs exactly 2 wings, got ${wingDefs.length}`);
  invariant(rs.byes === 0, 'byes are not supported by the two-wing format');
  invariant(rs.crossWingMatchweeks.length === 2, 'the two-wing format has exactly 2 cross-wing matchweeks');
  invariant(new Set(seedOrder).size === seedOrder.length, 'seed order lists a club twice');

  const competitionId = leagueCompetitionId(season, tierId);
  const wings = serpentineDraw(seedOrder, content);
  const fixtures: Fixture[] = [];
  const add = (matchweek: number, wing: WingId | 'cross', p: Pairing): void => {
    const week = matchweekWeek(content, matchweek);
    const weekId = asId<WeekId>(week.id);
    fixtures.push({
      id: leagueFixtureId(season, tierId, weekId, p.home, p.away),
      competitionId,
      season,
      tierId,
      weekIndex: week.index,
      weekId,
      stage: 'league',
      matchweek,
      wing,
      homeClubId: p.home,
      awayClubId: p.away,
      bestOf: rs.matchBestOf,
      venueId: null,
      status: 'scheduled',
    });
  };

  // Wing double round-robin: first half by the circle method on shuffled slots, second half mirrored.
  for (const wing of wings) {
    const slots = Rng.create(rootSeed, STREAM.schedule, season, tierId, wing.wingId).shuffle(wing.clubIds);
    const firstHalf = circleRounds(slots);
    const allRounds = [...firstHalf, ...firstHalf.map((round) => round.map((p) => ({ home: p.away, away: p.home })))];
    invariant(allRounds.length === rs.wingRoundMatchweeks.length, `wing has ${allRounds.length} rounds but ${rs.wingRoundMatchweeks.length} wing matchweeks`);
    allRounds.forEach((round, j) => {
      for (const p of round) add(rs.wingRoundMatchweeks[j]!, wing.wingId, p);
    });
  }

  // Cross-wing weeks: odd seasons the first wing hosts cross week 1 and the second wing cross week 2; even seasons swap.
  const [first, second] = wings as [WingDraw, WingDraw];
  const size = first.clubIds.length;
  const pairings = [rs.crossPairing.week1, rs.crossPairing.week2];
  rs.crossWingMatchweeks.forEach((matchweek, i) => {
    const firstHosts = (i === 0) === (season % 2 === 1);
    for (let k = 0; k < size; k++) {
      const a = first.clubIds[k]!;
      const b = second.clubIds[pairings[i] === 'same_k' ? k : size - 1 - k]!;
      add(matchweek, 'cross', firstHosts ? { home: a, away: b } : { home: b, away: a });
    }
  });

  fixtures.sort(compareFixtures);
  const schedule = { competitionId, wings, fixtures };
  validateLeagueSchedule(schedule, content);
  return schedule;
}

/**
 * 03-league-economy step 8: every club plays matchesPerClub fixtures, half at
 * home; exactly once in every matchweek (no byes); each wing pair meets
 * twice with venues swapped; distinct cross-wing opponents with one home and
 * one away; clubs ÷ 2 fixtures per matchweek; unique fixture ids.
 * Throws InvariantError on the first violation.
 */
export function validateLeagueSchedule(schedule: LeagueSchedule, content: ContentDB): void {
  const rs = content.leagues.regularSeason;
  const fail = (msg: string): never => {
    throw new InvariantError(`schedule ${schedule.competitionId}: ${msg}`);
  };
  const clubs = schedule.wings.flatMap((w) => w.clubIds);
  const wingOf = new Map<ClubId, WingId>();
  for (const w of schedule.wings) for (const c of w.clubIds) wingOf.set(c, w.wingId);
  if (rs.matchesPerClub % 2 !== 0) fail(`matchesPerClub ${rs.matchesPerClub} cannot split evenly into home and away`);

  const ids = new Set<string>();
  const perWeek = new Map<number, Set<ClubId>>();
  const tally = new Map<ClubId, { total: number; home: number; crossOpp: Set<ClubId>; crossHome: number }>();
  for (const c of clubs) tally.set(c, { total: 0, home: 0, crossOpp: new Set(), crossHome: 0 });
  const meetings = new Map<string, number>();

  for (const f of schedule.fixtures) {
    if (ids.has(f.id)) fail(`duplicate fixture id ${f.id}`);
    ids.add(f.id);
    if (f.homeClubId === f.awayClubId) fail(`${f.id} pairs a club with itself`);
    const home = tally.get(f.homeClubId);
    const away = tally.get(f.awayClubId);
    if (!home || !away) fail(`${f.id} involves a club outside the tier`);
    const mw = f.matchweek ?? fail(`${f.id} has no matchweek`);
    const week = perWeek.get(mw) ?? new Set<ClubId>();
    perWeek.set(mw, week);
    for (const c of [f.homeClubId, f.awayClubId]) {
      if (week.has(c)) fail(`club ${c} plays twice in matchweek ${mw}`);
      week.add(c);
    }
    home!.total++;
    home!.home++;
    away!.total++;
    if (f.wing === 'cross') {
      if (wingOf.get(f.homeClubId) === wingOf.get(f.awayClubId)) fail(`${f.id} is a cross-wing fixture inside one wing`);
      if (!rs.crossWingMatchweeks.includes(mw)) fail(`${f.id} is cross-wing outside a cross-wing matchweek`);
      home!.crossOpp.add(f.awayClubId);
      away!.crossOpp.add(f.homeClubId);
      home!.crossHome++;
    } else {
      if (f.wing !== wingOf.get(f.homeClubId) || f.wing !== wingOf.get(f.awayClubId)) fail(`${f.id} is labelled wing ${f.wing} but its clubs differ`);
      if (!rs.wingRoundMatchweeks.includes(mw)) fail(`${f.id} is a wing fixture in a cross-wing matchweek`);
      const key = `${f.homeClubId}>${f.awayClubId}`;
      meetings.set(key, (meetings.get(key) ?? 0) + 1);
    }
  }

  const half = rs.matchesPerClub / 2;
  const crossWeeks = rs.crossWingMatchweeks.length;
  for (const c of clubs) {
    const t = tally.get(c)!;
    if (t.total !== rs.matchesPerClub) fail(`club ${c} has ${t.total} fixtures, expected ${rs.matchesPerClub}`);
    if (t.home !== half) fail(`club ${c} has ${t.home} home fixtures, expected ${half}`);
    if (t.crossOpp.size !== crossWeeks) fail(`club ${c} has ${t.crossOpp.size} distinct cross-wing opponents, expected ${crossWeeks}`);
    if (t.crossHome * 2 !== crossWeeks) fail(`club ${c} hosts ${t.crossHome} of ${crossWeeks} cross-wing fixtures`);
  }
  for (const w of schedule.wings) {
    for (const a of w.clubIds) {
      for (const b of w.clubIds) {
        if (a !== b && meetings.get(`${a}>${b}`) !== 1) fail(`wing ${w.wingId}: ${a} hosts ${b} ${meetings.get(`${a}>${b}`) ?? 0} times, expected 1`);
      }
    }
  }
  for (let mw = 1; mw <= rs.matchesPerClub; mw++) {
    const n = perWeek.get(mw)?.size ?? 0;
    if (n !== clubs.length) fail(`matchweek ${mw} has ${n / 2} fixtures, expected ${clubs.length / 2} (no byes)`);
  }
}

// ---- season setup ----------------------------------------------------------------------------------------------------

/**
 * Next-season setup (season-end step 13, and new game): for every tier from
 * the top, the seed order, the serpentine wing draw and every regular-season
 * fixture; one league Competition per tier; each club's wingId. Club tiers
 * must already be set. Throws if the season is already set up or a tier's
 * club count differs from leagues.json.
 */
export function setupSeasonImpl(draft: GameState, season: number, content: ContentDB): void {
  invariant(Number.isSafeInteger(season) && season >= 1, `setupSeason: invalid season ${season}`);
  const tiers = tiersByLevel(content);
  const known = new Set(tiers.map((t) => t.id));
  for (const club of Object.values(draft.clubs)) {
    invariant(known.has(club.tierId), `setupSeason: club ${club.id} is in unknown tier ${club.tierId}`);
  }
  for (const tier of tiers) {
    const tierId = asId<TierId>(tier.id);
    const competitionId = leagueCompetitionId(season, tierId);
    invariant(!draft.competitions[competitionId], `setupSeason: ${competitionId} already exists`);
    const members = clubsInTier(draft, tierId);
    invariant(members.length === tier.clubCount, `setupSeason: tier ${tierId} has ${members.length} clubs, expected ${tier.clubCount}`);
    const seedOrder = seasonSeedOrder(draft, tierId, season, content);
    const schedule = buildLeagueSchedule({ rootSeed: draft.rng.root, season, tierId, seedOrder }, content);
    for (const f of schedule.fixtures) {
      invariant(!draft.fixtures[f.id], `setupSeason: fixture ${f.id} already exists`);
      putFixture(draft, f);
    }
    const competition: Competition = {
      id: competitionId,
      kind: 'league',
      season,
      tierId,
      clubIds: [...seedOrder],
      wings: schedule.wings,
      seedOrder: [...seedOrder],
      fixtureIds: schedule.fixtures.map((f) => f.id),
      bracket: null,
      status: 'scheduled',
    };
    draft.competitions[competitionId] = competition;
    for (const wing of schedule.wings) {
      for (const clubId of wing.clubIds) draft.clubs[clubId]!.wingId = wing.wingId;
    }
  }
}
