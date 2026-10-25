/**
 * TEST DOUBLES for the core views WP7 screens read, used only by WP7 tests
 * (through vi.mock) and the local visual preview while core/league,
 * core/economy and core/game are contract stubs. They are deliberately
 * simple approximations of 03 (not the rules): never import them from
 * production code.
 */
import type { ContentDB } from '../../../../core/content';
import type { FinanceView, OfferCheck } from '../../../../core/economy';
import type { FighterView } from '../../../../core/game';
import {
  type ClubId,
  type CompetitionId,
  type Fighter,
  type FighterId,
  type FixtureId,
  type GameState,
  type LedgerCategory,
  type MatchReport,
  type ReportEvent,
  type StandingRow,
  type StatId,
  type WingId,
} from '../../../../core/model';
import { compareStrings, engineError, err, ok, type EngineError, type Result } from '../../../../core/util';

// ---- league ---------------------------------------------------------------------------------

export function standings(state: GameState, competitionId: CompetitionId, scope: WingId | 'tier', content: ContentDB): StandingRow[] {
  const comp = state.competitions[competitionId];
  if (!comp) return [];
  const clubIds = scope === 'tier' ? comp.clubIds : (comp.wings.find((w) => w.wingId === scope)?.clubIds ?? []);
  const points = content.leagues.standings.pointsByResult as Record<string, number>;
  const rows = new Map<ClubId, StandingRow & { _forms: { week: number; r: 'W' | 'L' }[] }>();
  for (const id of clubIds) {
    rows.set(id, {
      clubId: id,
      position: 0,
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
      _forms: [],
    });
  }
  for (const fid of comp.fixtureIds) {
    const r = state.results[fid];
    if (!r) continue;
    for (const side of ['home', 'away'] as const) {
      const clubId = side === 'home' ? r.homeClubId : r.awayClubId;
      const row = rows.get(clubId);
      if (!row) continue;
      const mine = r.score[side];
      const theirs = r.score[side === 'home' ? 'away' : 'home'];
      const key = `${mine}-${theirs}`;
      row.played++;
      row.roundsWon += mine;
      row.roundsLost += theirs;
      if (mine > theirs) row.matchWins++;
      else row.matchLosses++;
      row.points += points[key] ?? 0;
      if (key in row.results) row.results[key as keyof StandingRow['results']]++;
      for (const round of r.rounds) {
        row.downsInflicted += side === 'home' ? round.downs.away : round.downs.home;
        row.downsSuffered += side === 'home' ? round.downs.home : round.downs.away;
      }
      row._forms.push({ week: r.weekIndex, r: mine > theirs ? 'W' : 'L' });
    }
  }
  const list = [...rows.values()];
  list.sort(
    (a, b) =>
      b.points - a.points ||
      b.matchWins - a.matchWins ||
      b.roundsWon - b.roundsLost - (a.roundsWon - a.roundsLost) ||
      b.roundsWon - a.roundsWon ||
      b.downsInflicted - b.downsSuffered - (a.downsInflicted - a.downsSuffered) ||
      compareStrings(a.clubId, b.clubId),
  );
  return list.map((row, i) => {
    const { _forms, ...rest } = row;
    _forms.sort((x, y) => x.week - y.week);
    return { ...rest, position: i + 1, form: _forms.slice(-5).map((f) => f.r) };
  });
}

// ---- fighters / game ----------------------------------------------------------------------------

function hashNum(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function floorTo(n: number, step: number): number {
  return Math.floor(n / step) * step;
}

export function fakeStats(f: Fighter): Record<StatId, number> {
  const out: Record<string, number> = {};
  for (const [id, cap] of Object.entries(f.cap100)) {
    const wear = f.wear100[id as StatId] ?? 0;
    out[id] = Math.max(1, Math.min(20, Math.round((cap - wear) / 100) - 2 + (hashNum(f.id + id) % 4)));
  }
  return out as Record<StatId, number>;
}

export function fakeRating(f: Fighter): number {
  const stats = Object.values(fakeStats(f));
  const avg = stats.reduce((a, b) => a + b, 0) / Math.max(1, stats.length);
  const r = Math.round(avg * 4.6) - 14 + (hashNum(f.id) % 14);
  return Math.max(18, Math.min(92, r));
}

export function marketWage(state: GameState, fighterId: FighterId, _content?: ContentDB): number {
  const f = state.fighters[fighterId];
  if (!f) return 0;
  const rating = fakeRating(f);
  return Math.max(60, floorTo(200 * 2 ** ((rating - 50) / 12), 5));
}

function preferredLength(f: Fighter): number {
  if (f.age <= 22) return 1;
  if (f.age >= 31) return 3;
  return 2;
}

export function fighterView(state: GameState, fighterId: FighterId, content: ContentDB): FighterView {
  const fighter = state.fighters[fighterId];
  if (!fighter) throw new Error(`fake fighterView: unknown fighter ${fighterId}`);
  const rating = fakeRating(fighter);
  const race = content.races.get(fighter.raceId);
  const cq = 30 + (hashNum(`cq${fighterId}`) % 60);
  const grade = content.development.captaincy.grades.find((g) => cq >= g.minCq) ?? content.development.captaincy.grades.at(-1)!;
  const trends = content.development.trend.levels;
  return {
    fighter,
    stats: fakeStats(fighter),
    rating,
    potential: Math.max(rating, Math.min(99, fighter.potentialRoll + 10)),
    humanAge: Math.round((fighter.age * 80) / (race?.lifespan ?? 80)),
    captaincy: { cq, gradeId: grade.id, letter: grade.letter },
    trend: trends[hashNum(`t${fighterId}`) % trends.length]!.id,
    injuryChanceBp: 300 + (hashNum(`i${fighterId}`) % 400),
    retirementChanceBp: fighter.age > 30 ? (fighter.age - 30) * 400 : 0,
    marketWage: marketWage(state, fighterId),
    askFromPlayer: state.playerClubId ? ask(state, fighterId, state.playerClubId, preferredLength(fighter), content) : null,
    available: !fighter.injury || fighter.injury.weeksOut === 0,
  };
}

export function freeAgents(state: GameState): Fighter[] {
  return Object.values(state.fighters)
    .filter((f) => f.status === 'free-agent' && !Object.values(state.market.trialsRookies).some((ids) => ids.includes(f.id)))
    .sort((a, b) => marketWage(state, b.id) - marketWage(state, a.id) || compareStrings(a.id, b.id));
}

export function buildMatchReport(state: GameState, fixtureId: FixtureId, content: ContentDB): Result<MatchReport, EngineError> {
  const r = state.results[fixtureId];
  if (!r) return err(engineError('report.not-played', `No result for ${fixtureId}`));
  const sideOf = (clubId: ClubId) => (clubId === r.homeClubId ? 'home' : 'away');
  const fighters = Object.entries(r.fighterStats).map(([id, stats]) => {
    const side = sideOf(stats.clubId);
    const input = r.input[side];
    const idx = input.fighters.findIndex((x) => x.fighterId === id);
    const rules = stats.ruleFires.map((fires, index) => ({
      index,
      isStance: index === stats.ruleFires.length - 1,
      fires,
      committedTicks: stats.ruleCommittedTicks[index] ?? 0,
      neverFired: stats.rulesNeverFired.includes(index),
    }));
    return {
      fighterId: id as FighterId,
      clubId: stats.clubId,
      isCaptain: idx === input.captainIndex,
      stats,
      rules,
      downs: stats.downs.map((d) => ({ round: d.round, tick: d.tick, byFighterId: d.byFighterId, abilityId: d.abilityId, hit: d.hit })),
    };
  });
  const rounds = r.rounds.map((round) => {
    const events: ReportEvent[] = [];
    for (const f of fighters) {
      for (const d of f.stats.downs.filter((x) => x.round === round.round)) {
        events.push({ tick: d.tick, kind: f.isCaptain ? 'captain_down' : 'down', actorId: d.byFighterId, targetId: f.fighterId, abilityId: d.abilityId, amount: d.hit });
      }
    }
    events.sort((a, b) => a.tick - b.tick);
    // A rally after the first non-captain down of each side, an interrupt early on, overtime past 45 s.
    for (const side of ['home', 'away'] as const) {
      const input = r.input[side];
      const firstDown = events.find((e) => e.kind === 'down' && input.fighters.some((x) => x.fighterId === e.targetId));
      const cap = input.fighters[input.captainIndex];
      if (firstDown && cap) events.push({ tick: firstDown.tick + 1, kind: 'rally', actorId: cap.fighterId, targetId: null, abilityId: null, amount: null });
    }
    const caster = r.input.home.fighters[(round.round + 1) % 5];
    const victim = r.input.away.fighters[(round.round + 3) % 5];
    if (caster && victim) {
      events.push({ tick: 90 + round.round * 13, kind: 'interrupt', actorId: caster.fighterId, targetId: victim.fighterId, abilityId: content.classAbility(caster.classId, 'a2').id as never, amount: null });
    }
    if (round.durationTicks > 900) events.push({ tick: 900, kind: 'overtime', actorId: null, targetId: null, abilityId: null, amount: null });
    events.sort((a, b) => a.tick - b.tick);
    return { round: round.round, winner: round.winner, endReason: round.endReason, tiebreakStep: round.tiebreakStep, durationTicks: round.durationTicks, keyEvents: events };
  });
  const xp: Record<FighterId, number> = {};
  for (const f of fighters) xp[f.fighterId] = f.stats.roundsPlayed * 12 + f.stats.downsInflicted * 2 + (f.stats.clubId === r.winnerClubId ? 6 : 0);
  const injuries = Object.values(state.fighters)
    .filter((f) => f.injury?.fixtureId === fixtureId)
    .map((f) => ({ fighterId: f.id, severity: f.injury!.severity, weeksOut: f.injury!.weeksOut }));
  const homeClub = state.clubs[r.homeClubId];
  const tierLevel = homeClub ? (content.tiers.get(homeClub.tierId)?.level ?? 1) : 1;
  const gate = content.tierProfile(tierLevel).gateBase;
  return ok({
    fixtureId,
    stage: r.stage,
    weekId: r.weekId,
    season: r.season,
    home: { clubId: r.homeClubId, captainId: r.input.home.fighters[r.input.home.captainIndex]?.fighterId ?? null, chemistry: r.input.home.chemistry, fighterIds: r.input.home.fighters.map((f) => f.fighterId) },
    away: { clubId: r.awayClubId, captainId: r.input.away.fighters[r.input.away.captainIndex]?.fighterId ?? null, chemistry: r.input.away.chemistry, fighterIds: r.input.away.fighters.map((f) => f.fighterId) },
    score: r.score,
    winnerClubId: r.winnerClubId,
    rounds,
    fighters,
    mvpFighterId: r.mvpFighterId,
    timelineAvailable: true,
    aftermath: {
      xp,
      injuries,
      gold: [
        { clubId: r.homeClubId, amount: gate, reason: 'gate' },
        { clubId: r.winnerClubId, amount: content.tierProfile(tierLevel).sponsorWinBonus, reason: 'winBonus' },
      ],
    },
  });
}

// ---- economy ------------------------------------------------------------------------------------

export function wageBill(state: GameState, clubId: ClubId): number {
  return Object.values(state.fighters)
    .filter((f) => f.clubId === clubId && f.status === 'active' && f.contract)
    .reduce((s, f) => s + (f.contract?.wagePerWeek ?? 0), 0);
}

export function pendingWages(state: GameState, clubId: ClubId): number {
  return state.market.offers.filter((o) => o.clubId === clubId).reduce((s, o) => s + o.wagePerWeek, 0);
}

export function ask(state: GameState, fighterId: FighterId, clubId: ClubId, seasons: number, content: ContentDB): number {
  const f = state.fighters[fighterId];
  const club = state.clubs[clubId];
  if (!f || !club) return 0;
  const mw = marketWage(state, fighterId);
  const pref = preferredLength(f);
  const greed = f.contractProfile.greedBp;
  const raw = (mw * (10000 + 500 * Math.abs(seasons - pref) + greed)) / 10000;
  const tierMin = content.tierProfile(content.tiers.get(club.tierId)?.level ?? 1).tierMinWage;
  return Math.max(tierMin, floorTo(raw, 5));
}

function remainingPaidWeeks(state: GameState, content: ContentDB, seasons: number): number {
  const weeks = content.weeks.list.length;
  const left = Math.max(0, weeks - state.calendar.weekIndex);
  return left + (seasons - 1) * weeks;
}

export function checkOffer(
  state: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: number; seasons: number; kind: 'free-agent' | 'renewal' | 'trials' },
  content: ContentDB,
): Result<OfferCheck, EngineError> {
  const club = state.clubs[offer.clubId];
  if (!club) return err(engineError('club.unknown', 'Unknown club'));
  const cap = content.tiers.get(club.tierId)?.rosterCap ?? 0;
  const roster = Object.values(state.fighters).filter((f) => f.clubId === club.id && f.status === 'active').length;
  const pending = state.market.offers.filter((o) => o.clubId === club.id && o.fighterId !== offer.fighterId).length;
  if (offer.kind !== 'renewal' && roster + pending + 1 > cap) return err(engineError('roster.full', 'Roster full', { roster, pending, cap }));
  const replaced = offer.kind === 'renewal' ? (state.fighters[offer.fighterId]?.contract?.wagePerWeek ?? 0) : 0;
  const ownPending = state.market.offers.find((o) => o.clubId === club.id && o.fighterId === offer.fighterId)?.wagePerWeek ?? 0;
  const room = club.finance.wageBudgetPerWeek - wageBill(state, club.id) - (pendingWages(state, club.id) - ownPending);
  const after = room - offer.wagePerWeek + replaced;
  if (after < 0) return err(engineError('wage.budget', 'Over the wage budget', { excess: -after }));
  if (club.finance.status === 'embargo') {
    const tierMin = content.tierProfile(content.tiers.get(club.tierId)?.level ?? 1).tierMinWage;
    if (offer.wagePerWeek > tierMin) return err(engineError('finance.embargo', 'Embargo', { tierMinWage: tierMin }));
  }
  const bp = offer.kind === 'trials' ? 0 : 1000;
  const signingCost = floorTo((offer.wagePerWeek * remainingPaidWeeks(state, content, offer.seasons) * bp) / 10000, 10);
  if (signingCost > club.finance.balance) return err(engineError('cash.balance', 'Signing cost exceeds balance', { signingCost }));
  return ok({ signingCost, wageRoomAfter: after });
}

export function financeView(state: GameState, clubId: ClubId, content: ContentDB): FinanceView {
  const club = state.clubs[clubId];
  if (!club) throw new Error('fake financeView: unknown club');
  const level = content.tiers.get(club.tierId)?.level ?? 1;
  const p = content.tierProfile(level);
  const byCategory: Partial<Record<LedgerCategory, number>> = {};
  for (const e of state.ledger.entries) if (e.clubId === clubId) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  const bill = wageBill(state, clubId);
  const weeksLeft = Math.max(0, content.weeks.list.length - state.calendar.weekIndex + 1);
  const retainerWeek = Math.floor(p.sponsorRetainerBase / content.weeks.list.length);
  const grantLeft = state.calendar.weekIndex <= 12 ? p.centralGrant / 2 : 0;
  const projected = club.finance.balance + grantLeft + weeksLeft * (retainerWeek - bill - p.opsCostPerWeek) + Math.ceil(weeksLeft / 2) * p.gateBase;
  return {
    balance: club.finance.balance,
    seasonBudget: club.finance.seasonBudget,
    seasonBudgetParts: [
      { label: 'Central grant (2 instalments)', amount: p.centralGrant },
      { label: 'Sponsor retainer', amount: p.sponsorRetainerBase },
      { label: 'Projected gate (8 home matches)', amount: 8 * p.gateBase },
    ],
    wageBudgetPerWeek: club.finance.wageBudgetPerWeek,
    wageBill: bill,
    pendingWages: pendingWages(state, clubId),
    status: club.finance.status,
    statusReason: club.finance.status === 'healthy' ? null : `${club.finance.balance} ts after the last week processing`,
    projectedSeasonEndBalance: projected,
    registryDebt: club.finance.registryDebt,
    byCategory,
  };
}

/** Everything WP7 screens import from core/league, core/game and core/economy, faked. */
export const FAKE_LEAGUE = { standings };
export const FAKE_GAME = { fighterView, freeAgents, buildMatchReport };
export const FAKE_ECONOMY = { wageBill, pendingWages, ask, checkOffer, financeView, marketWage };
