/**
 * TEST SUPPORT: a headless one-season finance simulation over a world
 * (05 §9.2 WP4 acceptance). It stands in for core/league (schedule, tables,
 * Reckoning, tier moves) and core/ai (a minimal market policy) so that every
 * economy step runs in the real week-processing order on all 48 clubs:
 * income, costs, status, trials release, free-agent decisions, AI offers and
 * renewals, pool top-up, then the season-end economy steps.
 *
 * Results are random but seeded. Not used by production code. Pure.
 */
import type { ContentDB } from '../content';
import type { Club, ClubId, Competition, Fighter, FighterId, Fixture, GameState, LedgerCategory, SeasonRecord, TierId } from '../model';
import { asId, reckoningCompetitionId } from '../model';
import { Rng } from '../rng';
import { compareStrings } from '../util';
import {
  agreedRenewal,
  ask,
  committedWageBill,
  contractExpiries,
  financialStatus,
  isInPool,
  makeOffer,
  nextSeasonFinanceSetup,
  pendingWages,
  poolFighters,
  poolMaintenance,
  preferredLength,
  releaseTrialsRookies,
  renewContract,
  resolveFreeAgentOffers,
  rosterOf,
  seasonPrizes,
  topUpFreeAgentPool,
  updatePrestige,
  weeklyCosts,
  weeklyIncome,
} from './index';
import { fighterRating } from './fighter-values';
import { addPlayedFixture, recordResult, setWeek, standingRow, toSeasonEnd } from './testing';

export interface TierFlows {
  tierLevel: number;
  clubs: number;
  /** Means per club (integers). */
  seasonBudget: number;
  wageBudgetPerWeek: number;
  income: number;
  costs: number;
  wages: number;
  byCategory: Partial<Record<LedgerCategory, number>>;
  /** Tier sums: wages ÷ income and (income − costs) ÷ SB, in bp. */
  wageToIncomeBp: number;
  surplusToSbBp: number;
}

export interface SimResult {
  flows: TierFlows[];
  record: SeasonRecord;
  /** Checks run (ledger invariant after every operation). */
  checks: number;
}

interface Table {
  clubId: ClubId;
  points: number;
  wins: number;
}

function weekOfMatchweek(content: ContentDB, matchweek: number): number {
  return content.leagues.calendar.weeks.find((w) => w.matchweek === matchweek)!.index;
}

function weekOfRound(content: ContentDB, round: string): number {
  return content.leagues.calendar.weeks.find((w) => w.round === round)!.index;
}

/** Two serpentine wings, double round-robin (circle method) plus two cross-wing weeks (03 sys-league). */
function scheduleTier(state: GameState, content: ContentDB, tierId: TierId, season: number): Map<ClubId, string> {
  const clubs = Object.values(state.clubs)
    .filter((c) => c.tierId === tierId)
    .sort((a, b) => b.prestige - a.prestige || compareStrings(a.id, b.id));
  const pattern = content.leagues.wings.serpentinePattern;
  const wings: Record<string, ClubId[]> = { dawn: [], dusk: [] };
  clubs.forEach((c, i) => wings[pattern[i % pattern.length]!]!.push(c.id));
  const wingOf = new Map<ClubId, string>();
  for (const [w, ids] of Object.entries(wings)) for (const id of ids) wingOf.set(id, w);
  const rs = content.leagues.regularSeason;
  const add = (mw: number, home: ClubId, away: ClubId) =>
    addPlayedFixture(state, content, { weekIndex: weekOfMatchweek(content, mw), home, away, winner: home, season, played: false });
  for (const ids of Object.values(wings)) {
    for (let half = 0; half < 2; half++) {
      for (let r = 0; r < 7; r++) {
        const mw = rs.wingRoundMatchweeks[half * 7 + r]!;
        const pairs: [number, number][] = [r % 2 === 1 ? [7, r] : [r, 7]];
        for (let k = 1; k <= 3; k++) {
          const a = (r + k) % 7;
          const b = (r - k + 7) % 7;
          pairs.push(k % 2 === 1 ? [a, b] : [b, a]);
        }
        for (const [h, aw] of pairs) {
          const [home, away] = half === 0 ? [ids[h]!, ids[aw]!] : [ids[aw]!, ids[h]!];
          add(mw, home, away);
        }
      }
    }
  }
  const [c1, c2] = rs.crossWingMatchweeks as [number, number];
  for (let k = 0; k < 8; k++) {
    const dawnHostsFirst = season % 2 === 1;
    const d1 = wings.dawn![k]!;
    const u1 = wings.dusk![k]!;
    add(c1, dawnHostsFirst ? d1 : u1, dawnHostsFirst ? u1 : d1);
    const u2 = wings.dusk![7 - k]!;
    add(c2, dawnHostsFirst ? u2 : d1, dawnHostsFirst ? d1 : u2);
  }
  return wingOf;
}

function lineupOf(state: GameState, clubId: ClubId, content: ContentDB): FighterId[] {
  return rosterOf(state, clubId)
    .map((f) => ({ f, r: fighterRating(f, content) }))
    .sort((a, b) => b.r - a.r || compareStrings(a.f.id, b.f.id))
    .slice(0, 5)
    .map((x) => x.f.id);
}

function play(state: GameState, fx: Fixture, content: ContentDB): void {
  const rng = Rng.create(state.rng.root, 'finance-sim', fx.id);
  const winner = rng.int(0, 1) === 0 ? fx.homeClubId : fx.awayClubId;
  recordResult(state, fx, winner, lineupOf(state, fx.homeClubId, content), lineupOf(state, fx.awayClubId, content), rng.int(0, 1) === 0 ? '2-0' : '2-1');
}

function tables(state: GameState, season: number, tierId: TierId): Table[] {
  const rows = new Map<ClubId, Table>();
  for (const c of Object.values(state.clubs)) if (c.tierId === tierId) rows.set(c.id, { clubId: c.id, points: 0, wins: 0 });
  for (const r of Object.values(state.results)) {
    if (r.season !== season || r.stage !== 'league' || !rows.has(r.homeClubId)) continue;
    const homeWon = r.winnerClubId === r.homeClubId;
    const margin2 = r.score.home === 0 || r.score.away === 0;
    const w = rows.get(r.winnerClubId)!;
    const l = rows.get(homeWon ? r.awayClubId : r.homeClubId)!;
    w.wins += 1;
    w.points += margin2 ? 3 : 2;
    l.points += margin2 ? 0 : 1;
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || compareStrings(a.clubId, b.clubId));
}

/** A minimal AI market policy: renew the best expiring fighters at their ask; fill the roster up to the cap within the wage budget, at asks. */
function marketPolicy(state: GameState, content: ContentDB): void {
  const season = state.calendar.season;
  const pool = poolFighters(state)
    .map((f) => ({ f, r: fighterRating(f, content) }))
    .sort((a, b) => b.r - a.r || compareStrings(a.f.id, b.f.id));
  for (const club of Object.values(state.clubs).sort((a, b) => compareStrings(a.id, b.id))) {
    const tier = content.tiers.require(club.tierId);
    const roster = rosterOf(state, club.id)
      .map((f) => ({ f, r: fighterRating(f, content) }))
      .sort((a, b) => b.r - a.r || compareStrings(a.f.id, b.f.id));
    if (state.calendar.weekIndex >= 8) {
      roster.slice(0, tier.rosterCap - 2).forEach(({ f }) => {
        if (!f.contract || f.contract.endSeason !== season || agreedRenewal(state, f.id) || f.finalSeason) return;
        const seasons = preferredLength(state, f.id, content);
        const r = renewContract(state, { clubId: club.id, fighterId: f.id, wagePerWeek: ask(state, f.id, club.id, seasons, content), seasons }, content);
        if (r.ok && r.value.kind === 'countered') renewContract(state, { clubId: club.id, fighterId: f.id, wagePerWeek: r.value.counterWage, seasons }, content);
      });
    }
    const replacement = content.economy.ai.replacementRatingByTier[String(tier.level)] ?? 0;
    const offered = new Set(state.market.offers.filter((o) => o.clubId === club.id).map((o) => o.fighterId));
    let pending = offered.size;
    let room = club.finance.wageBudgetPerWeek - committedWageBill(state, club.id) - pendingWages(state, club.id);
    let made = 0;
    for (const { f, r } of pool) {
      if (made >= 2 || roster.length + pending + 1 > tier.rosterCap || r < replacement) break;
      if (offered.has(f.id) || !isInPool(state, f)) continue;
      const wage = ask(state, f.id, club.id, 2, content);
      if (wage > room) continue;
      if (makeOffer(state, { clubId: club.id, fighterId: f.id, wagePerWeek: wage, seasons: 2, acceptCounter: false }, content).ok) {
        made += 1;
        pending += 1;
        room -= wage;
      }
    }
  }
}

function addReckoning(state: GameState, content: ContentDB, season: number, tierId: TierId, wingOf: Map<ClubId, string>): Competition {
  const table = tables(state, season, tierId);
  const pos = new Map(table.map((t, i) => [t.clubId, i]));
  const per = content.leagues.tournament.qualifiersPerWing;
  const byWing = ['dawn', 'dusk'].map((w) => table.filter((t) => wingOf.get(t.clubId) === w).slice(0, per).map((t) => t.clubId));
  const winners = byWing.map((w) => w[0]!).sort((a, b) => pos.get(a)! - pos.get(b)!);
  const rest = byWing.flatMap((w) => w.slice(1)).sort((a, b) => pos.get(a)! - pos.get(b)!);
  const seeds = [...winners, ...rest];
  const comp: Competition = {
    id: reckoningCompetitionId(season, tierId),
    kind: 'reckoning',
    season,
    tierId,
    clubIds: seeds,
    wings: [],
    seedOrder: [],
    fixtureIds: [],
    bracket: { seeds, rounds: [], championId: null, runnerUpId: null },
    status: 'in-progress',
  };
  state.competitions[comp.id] = comp;
  return comp;
}

function addRound(state: GameState, content: ContentDB, comp: Competition, roundId: 'quarterfinal' | 'semifinal' | 'final', pairs: [ClubId, ClubId][]): void {
  const week = weekOfRound(content, roundId);
  const ties = pairs.map(([home, away], i) => {
    const fx = addPlayedFixture(state, content, { weekIndex: week, home, away, winner: home, stage: roundId, season: comp.season, played: false });
    return { slot: i + 1, home: { kind: 'seed' as const, seed: 1 }, away: { kind: 'seed' as const, seed: 2 }, fixtureId: fx.id, winnerClubId: null as ClubId | null };
  });
  comp.bracket!.rounds.push({ roundId, weekId: asId(content.weekByIndex(week).id), bestOf: roundId === 'final' ? 5 : 3, ties });
}

function winnersOf(state: GameState, comp: Competition, roundId: string): ClubId[] {
  const round = comp.bracket!.rounds.find((r) => r.roundId === roundId)!;
  return round.ties.map((t) => {
    const w = state.results[t.fixtureId!]!.winnerClubId;
    t.winnerClubId = w;
    return w;
  });
}

function seedOf(comp: Competition, id: ClubId): number {
  return comp.bracket!.seeds.indexOf(id);
}

function hostFirst(comp: Competition, a: ClubId, b: ClubId): [ClubId, ClubId] {
  return seedOf(comp, a) <= seedOf(comp, b) ? [a, b] : [b, a];
}

function sumCategory(state: GameState, clubIds: readonly ClubId[], category: LedgerCategory): number {
  const set = new Set<string>(clubIds);
  return state.ledger.entries.filter((e) => set.has(e.clubId) && e.category === category).reduce((s, e) => s + e.amount, 0);
}

/**
 * Run one season (P1..TW3 and the season-end economy steps) on a world whose
 * finances are already set up (initialFinances or nextSeasonFinanceSetup).
 * `check(label)` runs after every economy operation.
 */
export function simulateFinanceSeason(state: GameState, content: ContentDB, check: (label: string) => void): SimResult {
  const season = state.calendar.season;
  let checks = 0;
  const step = (label: string, f: () => void) => {
    f();
    check(label);
    checks += 1;
  };
  const tierOfClub = new Map<ClubId, TierId>(Object.values(state.clubs).map((c) => [c.id, c.tierId]));
  const tiers = [...content.tiers.list].sort((a, b) => a.level - b.level);
  const wingOf = new Map<ClubId, string>();
  for (const t of tiers) for (const [k, v] of scheduleTier(state, content, asId<TierId>(t.id), season)) wingOf.set(k, v);
  const comps = new Map<string, Competition>();
  const weeks = content.leagues.calendar.weeks.length;
  for (let w = 1; w <= weeks; w++) {
    setWeek(state, content, w, season);
    for (const fx of Object.values(state.fixtures).sort((a, b) => compareStrings(a.id, b.id))) {
      if (fx.season === season && fx.weekIndex === w && fx.status === 'scheduled') play(state, fx, content);
    }
    step(`income w${w}`, () => weeklyIncome(state, content));
    step(`costs w${w}`, () => weeklyCosts(state, content));
    step(`status w${w}`, () => financialStatus(state, content));
    if (w === 1) step('trials', () => releaseTrialsRookies(state, content));
    step(`decisions w${w}`, () => resolveFreeAgentOffers(state, content));
    step(`ai w${w}`, () => marketPolicy(state, content));
    step(`top-up w${w}`, () => topUpFreeAgentPool(state, content));
    for (const t of tiers) {
      const tierId = asId<TierId>(t.id);
      const round = content.weekByIndex(w);
      if (round.matchweek === content.leagues.regularSeason.matchesPerClub) {
        const comp = addReckoning(state, content, season, tierId, wingOf);
        comps.set(tierId, comp);
        const s = comp.bracket!.seeds;
        const pairs = content.leagues.tournament.rounds[0]!.pairs as [number, number][];
        addRound(state, content, comp, 'quarterfinal', pairs.map(([a, b]) => [s[a - 1]!, s[b - 1]!]));
      } else if (round.round === 'quarterfinal') {
        const comp = comps.get(tierId)!;
        const q = winnersOf(state, comp, 'quarterfinal');
        addRound(state, content, comp, 'semifinal', [hostFirst(comp, q[0]!, q[1]!), hostFirst(comp, q[2]!, q[3]!)]);
      } else if (round.round === 'semifinal') {
        const comp = comps.get(tierId)!;
        const sf = winnersOf(state, comp, 'semifinal');
        addRound(state, content, comp, 'final', [hostFirst(comp, sf[0]!, sf[1]!)]);
      } else if (round.round === 'final') {
        const comp = comps.get(tierId)!;
        const [champ] = winnersOf(state, comp, 'final');
        const fx = state.fixtures[comp.bracket!.rounds[2]!.ties[0]!.fixtureId!]!;
        comp.bracket!.championId = champ!;
        comp.bracket!.runnerUpId = champ === fx.homeClubId ? fx.awayClubId : fx.homeClubId;
        comp.status = 'completed';
      }
    }
  }

  // ---- season end (economy steps in seasonEndOrder; league moves emulated) ----
  toSeasonEnd(state, content);
  const record: SeasonRecord = { season, tiers: [], retirements: [], rookieIds: [] };
  for (const t of tiers) {
    const tierId = asId<TierId>(t.id);
    const table = tables(state, season, tierId);
    const comp = comps.get(tierId)!;
    const shield = table[0]!.clubId;
    const champion = comp.bracket!.championId!;
    const promoted = t.level > 1 ? [champion, champion === shield ? table[1]!.clubId : shield] : [];
    const relegated =
      t.level < tiers.length ? ['dawn', 'dusk'].map((w) => table.filter((r) => wingOf.get(r.clubId) === w)[7]!.clubId) : [];
    record.tiers.push({
      tierId,
      wingTables: [],
      tierTable: table.map((r, i) => standingRow(r.clubId, i + 1)),
      reckoningChampionId: champion,
      reckoningRunnerUpId: comp.bracket!.runnerUpId,
      shieldWinnerId: shield,
      promotedIds: promoted,
      relegatedIds: relegated,
    });
  }
  state.history.push(record);
  step('prizes', () => seasonPrizes(state, record, content));
  const flows = tiers.map((t) => {
    const ids = [...tierOfClub.entries()].filter(([, tier]) => tier === t.id).map(([id]) => id);
    const clubs = ids.map((id) => state.clubs[id]!) as Club[];
    const cats = new Set(state.ledger.entries.map((e) => e.category));
    const byCategory: Partial<Record<LedgerCategory, number>> = {};
    for (const c of cats) byCategory[c] = Math.trunc(sumCategory(state, ids, c) / ids.length);
    const income = state.ledger.entries.filter((e) => ids.includes(e.clubId) && e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const costs = -state.ledger.entries.filter((e) => ids.includes(e.clubId) && e.amount < 0).reduce((s, e) => s + e.amount, 0);
    const wages = -sumCategory(state, ids, 'wages');
    const sb = clubs.reduce((s, c) => s + c.finance.seasonBudget, 0);
    return {
      tierLevel: t.level,
      clubs: ids.length,
      seasonBudget: Math.trunc(sb / ids.length),
      wageBudgetPerWeek: Math.trunc(clubs.reduce((s, c) => s + c.finance.wageBudgetPerWeek, 0) / ids.length),
      income: Math.trunc(income / ids.length),
      costs: Math.trunc(costs / ids.length),
      wages: Math.trunc(wages / ids.length),
      byCategory,
      wageToIncomeBp: Math.trunc((wages * 10_000) / income),
      surplusToSbBp: Math.trunc(((income - costs) * 10_000) / sb),
    };
  });
  // Promotion and relegation (league's applyTierMoves), then the remaining economy steps.
  for (let i = 0; i < record.tiers.length; i++) {
    const t = record.tiers[i]!;
    for (const id of t.promotedIds) state.clubs[id]!.tierId = record.tiers[i - 1]!.tierId;
    for (const id of t.relegatedIds) state.clubs[id]!.tierId = record.tiers[i + 1]!.tierId;
  }
  step('prestige', () => updatePrestige(state, record, content));
  step('expiries', () => contractExpiries(state, content));
  step('pool maintenance', () => poolMaintenance(state, content));
  step('setup', () => nextSeasonFinanceSetup(state, [], content));
  return { flows, record, checks };
}

/** Fighters of a roster (test convenience). */
export function rosterFighters(state: GameState, clubId: ClubId): Fighter[] {
  return rosterOf(state, clubId);
}
