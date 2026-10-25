/**
 * Week processing money steps (income, costs, financial status) and the
 * season-end economy steps (prizes, prestige, expiries, next-season setup,
 * new-career finances). 03-league-economy sys-finance, sys-calendar,
 * sys-contracts; 05 §3.3 pipelines.
 */
import type { ContentDB } from '../content';
import type { Club, ClubId, Fighter, FighterId, GameState, GameTime, NewsId, SeasonRecord, TierId, WageRaise } from '../model';
import { reckoningCompetitionId, setMembership, weekFixtures } from '../model';
import { Rng, STREAM } from '../rng';
import { clamp } from '../util';
import {
  currentSeasonBudgetParts,
  formBefore,
  gateFor,
  grantInstallmentAt,
  homeFanAppeal,
  registryDeduction,
  reserveContribution,
  retainerOf,
  retainerPart,
  seasonBudgetOf,
  splitFinalGate,
  stageOf,
  wageBudgetOf,
} from './budget';
import { fighterHumanAge, fighterPotential, fighterRating } from './fighter-values';
import { postAt } from './ledger';
import { floorTo, mulDiv } from './math';
import { addClubNews, pushNews } from './news';
import { pendingSigningCostsOf } from './offers';
import { assignTrialsRookies, makeFreeAgent, nowOf, rollContractProfileImpl } from './pool';
import { agreedRenewal, clubsInOrder, compareFighterIds, poolFighters, profileOf, rosterOf, tierOf, wageBillOf } from './queries';
import { grantSchedule, processingStamp, seasonEndWeekIndex, SETUP_WEEK_INDEX, setupSeason, weeksPerSeason } from './time';
import { askOf, potentialBonus } from './wages';

const BP = 10_000;

// ---- week processing ---------------------------------------------------------------------------------------

/** Step 4: sponsor retainer part, scheduled grant installment, home gates and win bonuses. */
export function weeklyIncomeImpl(draft: GameState, content: ContentDB): void {
  const at = processingStamp(draft);
  const grantWeek = grantSchedule(content).some((g) => g.processingWeek === at.weekIndex && at.weekIndex >= 1);
  for (const club of clubsInOrder(draft, content)) {
    postAt(draft, { clubId: club.id, amount: retainerPart(retainerOf(club, content), at.weekIndex, content), category: 'sponsorRetainer' }, at);
    if (grantWeek) {
      const grantDue = currentSeasonBudgetParts(draft, club, content).grantDue;
      postAt(draft, { clubId: club.id, amount: grantInstallmentAt(grantDue, at.weekIndex, content), category: 'centralGrant' }, at);
    }
  }
  const fixtures = Object.values(draft.fixtures)
    .filter((fx) => fx.season === at.season && fx.weekIndex === at.weekIndex && draft.results[fx.id] !== undefined)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const fx of fixtures) {
    const result = draft.results[fx.id]!;
    const home = draft.clubs[fx.homeClubId];
    if (!home) continue;
    const stage = stageOf(fx);
    const form = formBefore(draft, home.id, at.season, fx.weekIndex);
    const gate = gateFor(home, { ...form, fanAppealPoints: homeFanAppeal(result, content), stage }, content);
    if (stage === 'final') {
      const split = splitFinalGate(gate);
      postAt(draft, { clubId: fx.homeClubId, amount: split.home, category: 'gate', fixtureId: fx.id }, at);
      postAt(draft, { clubId: fx.awayClubId, amount: split.away, category: 'gate', fixtureId: fx.id }, at);
    } else {
      postAt(draft, { clubId: fx.homeClubId, amount: gate, category: 'gate', fixtureId: fx.id }, at);
    }
    const winner = draft.clubs[result.winnerClubId];
    if (winner) {
      postAt(draft, { clubId: winner.id, amount: profileOf(winner, content).sponsorWinBonus, category: 'sponsorWinBonus', fixtureId: fx.id }, at);
    }
  }
}

/** Step 5: wages of everyone on a roster at the start of processing, hired blades used this week, operating cost. */
export function weeklyCostsImpl(draft: GameState, content: ContentDB): void {
  const at = processingStamp(draft);
  const blades = Object.values(draft.fighters)
    .filter((f) => f.status === 'hired-blade' && f.clubId !== null)
    .sort((a, b) => compareFighterIds(a.id, b.id));
  for (const club of clubsInOrder(draft, content)) {
    postAt(draft, { clubId: club.id, amount: -wageBillOf(draft, club.id), category: 'wages' }, at);
    for (const blade of blades) {
      if (blade.clubId !== club.id) continue;
      const wage = blade.contract?.wagePerWeek ?? profileOf(club, content).tierMinWage;
      postAt(draft, { clubId: club.id, amount: -wage, category: 'hiredBlades', fighterId: blade.id }, at);
      // The blade leaves after the match (not on any roster, record kept for reports).
      setMembership(draft, blade, null, 'hired-blade');
      blade.contract = null;
    }
    postAt(draft, { clubId: club.id, amount: -profileOf(club, content).opsCostPerWeek, category: 'operations' }, at);
  }
}

/** Projected home gates of scheduled fixtures in one week (current form, no fan appeal). */
function projectedGatesInWeek(state: GameState, club: Club, season: number, weekIndex: number, content: ContentDB): number {
  let total = 0;
  for (const fx of weekFixtures(state, season, weekIndex)) {
    if (fx.status !== 'scheduled') continue;
    if (fx.homeClubId !== club.id && !(fx.stage === 'final' && fx.awayClubId === club.id)) continue;
    const host = state.clubs[fx.homeClubId];
    if (!host) continue;
    const form = formBefore(state, host.id, season, weekIndex);
    const gate = gateFor(host, { ...form, fanAppealPoints: 0, stage: stageOf(fx) }, content);
    if (fx.stage === 'final') {
      const split = splitFinalGate(gate);
      total += fx.homeClubId === club.id ? split.home : split.away;
    } else total += gate;
  }
  return total;
}

/** Scheduled cash flow of processings fromWeek+1 .. toWeek: retainer, grants, projected gates − bill − ops. */
export function projectedCashFlow(state: GameState, club: Club, season: number, fromWeek: number, toWeek: number, content: ContentDB): number {
  const w = weeksPerSeason(content);
  const retainer = retainerOf(club, content);
  const grantDue = currentSeasonBudgetParts(state, club, content).grantDue;
  const bill = wageBillOf(state, club.id);
  const ops = profileOf(club, content).opsCostPerWeek;
  let total = 0;
  for (let k = fromWeek + 1; k <= Math.min(toWeek, w); k++) {
    total += retainerPart(retainer, k, content) + grantInstallmentAt(grantDue, k, content) + projectedGatesInWeek(state, club, season, k, content) - bill - ops;
  }
  return total;
}

/** The same flows week by week (finance screen projection). Sum of income - costs equals projectedCashFlow. */
export function projectedWeeks(
  state: GameState,
  club: Club,
  season: number,
  fromWeek: number,
  toWeek: number,
  content: ContentDB,
): { weekIndex: number; income: number; costs: number }[] {
  const w = weeksPerSeason(content);
  const retainer = retainerOf(club, content);
  const grantDue = currentSeasonBudgetParts(state, club, content).grantDue;
  const bill = wageBillOf(state, club.id);
  const ops = profileOf(club, content).opsCostPerWeek;
  const out: { weekIndex: number; income: number; costs: number }[] = [];
  for (let k = fromWeek + 1; k <= Math.min(toWeek, w); k++) {
    const income = retainerPart(retainer, k, content) + grantInstallmentAt(grantDue, k, content) + projectedGatesInWeek(state, club, season, k, content);
    out.push({ weekIndex: k, income, costs: bill + ops });
  }
  return out;
}

/** Watch (advisory): balance + next 4 weeks of scheduled flows − pending signing costs < 0. */
export function watchProjection(state: GameState, club: Club, season: number, afterWeek: number, content: ContentDB): number {
  const horizon = content.economy.finance.watchHorizonWeeks;
  return club.finance.balance + projectedCashFlow(state, club, season, afterWeek, afterWeek + horizon, content) - pendingSigningCostsOf(state, club.id, content);
}

function setStatus(draft: GameState, club: Club, season: number, afterWeek: number, content: ContentDB, news: NewsId[]): void {
  const before = club.finance.status;
  const trigger = content.economy.finance.embargo.triggerBalanceBelow;
  const next = club.finance.balance < trigger ? 'embargo' : watchProjection(draft, club, season, afterWeek, content) < 0 ? 'watch' : 'healthy';
  club.finance.status = next;
  if (next === before) return;
  const params = { balance: club.finance.balance };
  if (next === 'embargo') pushNews(news, addClubNews(draft, { key: 'finance.embargo', clubId: club.id, params, importance: 'urgent' }));
  else if (before === 'embargo') pushNews(news, addClubNews(draft, { key: 'finance.embargo-lifted', clubId: club.id, params, importance: 'notable' }));
  if (next === 'watch') pushNews(news, addClubNews(draft, { key: 'finance.watch', clubId: club.id, params, importance: 'notable' }));
}

/** Step 6: debt weeks, Registry advance after N consecutive processings below 0, then watch / embargo. */
export function financialStatusImpl(draft: GameState, content: ContentDB): NewsId[] {
  const news: NewsId[] = [];
  const at = processingStamp(draft);
  const ra = content.economy.finance.registryAdvance;
  const trigger = content.economy.finance.embargo.triggerBalanceBelow;
  for (const club of clubsInOrder(draft, content)) {
    const fin = club.finance;
    if (fin.balance < trigger) {
      fin.debtWeeks += 1;
      if (fin.debtWeeks >= ra.consecutiveWeeksInDebt) {
        // The Charter Registry clears the debt; deducted from future grants (prestige penalty at season end).
        const amount = -fin.balance;
        postAt(draft, { clubId: club.id, amount, category: 'registryAdvance' }, at);
        fin.registryDebt += amount;
        fin.debtWeeks = 0;
        pushNews(news, addClubNews(draft, { key: 'finance.registry-advance', clubId: club.id, params: { amount, registryDebt: fin.registryDebt }, importance: 'urgent' }));
      }
    } else {
      fin.debtWeeks = 0;
    }
    setStatus(draft, club, at.season, at.weekIndex, content, news);
  }
  return news;
}

// ---- season end ------------------------------------------------------------------------------------------------

type Stage = 'quarterfinal' | 'semifinal' | 'finalist' | 'champion';

/** Furthest Reckoning stage per club of one tier (from the bracket; the record as a fallback). */
export function reckoningStages(state: GameState, season: number, tierId: TierId, record?: SeasonRecord): Map<ClubId, Stage> {
  const out = new Map<ClubId, Stage>();
  const bracket = state.competitions[reckoningCompetitionId(season, tierId)]?.bracket ?? null;
  const rank: Record<Stage, number> = { quarterfinal: 1, semifinal: 2, finalist: 3, champion: 4 };
  const raise = (id: ClubId | null | undefined, stage: Stage): void => {
    if (!id) return;
    const cur = out.get(id);
    if (!cur || rank[stage] > rank[cur]) out.set(id, stage);
  };
  if (bracket) {
    for (const id of bracket.seeds) raise(id, 'quarterfinal');
    for (const round of bracket.rounds) {
      for (const tie of round.ties) {
        const fx = tie.fixtureId ? state.fixtures[tie.fixtureId] : undefined;
        const reached: Stage = round.roundId === 'quarterfinal' ? 'quarterfinal' : round.roundId === 'semifinal' ? 'semifinal' : 'finalist';
        if (fx) {
          raise(fx.homeClubId, reached);
          raise(fx.awayClubId, reached);
        }
        if (round.roundId === 'quarterfinal') raise(tie.winnerClubId, 'semifinal');
        else if (round.roundId === 'semifinal') raise(tie.winnerClubId, 'finalist');
        else raise(tie.winnerClubId, 'champion');
      }
    }
    raise(bracket.runnerUpId, 'finalist');
    raise(bracket.championId, 'champion');
  }
  const tierRecord = record?.tiers.find((t) => t.tierId === tierId);
  raise(tierRecord?.reckoningRunnerUpId, 'finalist');
  raise(tierRecord?.reckoningChampionId, 'champion');
  return out;
}

/** Step 2: table prizes, Reckoning prizes by furthest round, sponsor tournament bonus per qualifier. */
export function seasonPrizesImpl(draft: GameState, record: SeasonRecord, content: ContentDB): void {
  const at: GameTime = { season: record.season, weekIndex: seasonEndWeekIndex(content) };
  for (const t of record.tiers) {
    const tier = content.tiers.require(t.tierId);
    const profile = content.tierProfile(tier.level);
    const n = tier.clubCount;
    const rows = [...t.tierTable].sort((a, b) => a.position - b.position);
    for (const row of rows) {
      if (!draft.clubs[row.clubId]) continue;
      const prize = floorTo(mulDiv(profile.tablePrizeTop, n + 1 - row.position, n), content.economy.income.tablePrize.roundDownTo);
      postAt(draft, { clubId: row.clubId, amount: Math.max(0, prize), category: 'tablePrize' }, at);
    }
    const stages = reckoningStages(draft, record.season, t.tierId, record);
    for (const clubId of [...stages.keys()].sort()) {
      if (!draft.clubs[clubId]) continue;
      postAt(draft, { clubId, amount: profile.tournamentPrize[stages.get(clubId)!], category: 'tournamentPrize' }, at);
      postAt(draft, { clubId, amount: profile.sponsorTournamentBonus, category: 'sponsorTournamentBonus' }, at);
    }
  }
}

/** Step 4: prestige update; tier moves are already applied (club.tierId is the new tier). */
export function updatePrestigeImpl(draft: GameState, record: SeasonRecord, content: ContentDB): void {
  const p = content.economy.prestige;
  const penalty = content.economy.finance.registryAdvance.prestigePenalty;
  for (const t of record.tiers) {
    const tier = content.tiers.require(t.tierId);
    const stages = reckoningStages(draft, record.season, t.tierId, record);
    const promoted = new Set<string>(t.promotedIds);
    const relegated = new Set<string>(t.relegatedIds);
    for (const row of t.tierTable) {
      const club = draft.clubs[row.clubId];
      if (!club) continue;
      const tableTerm = Math.trunc(((tier.clubCount + 1 - 2 * row.position) * p.tableNumerator) / p.tableDenominator);
      const stage = stages.get(club.id);
      const tournamentTerm = stage ? p.tournament[stage] : 0;
      const movementTerm = promoted.has(club.id) ? p.promoted : relegated.has(club.id) ? p.relegated : 0;
      const advances = draft.ledger.entries.filter(
        (e) => e.clubId === club.id && e.season === record.season && e.category === 'registryAdvance' && e.amount > 0,
      ).length;
      const x = club.prestige + tableTerm + tournamentTerm + movementTerm - penalty * advances;
      const base = tierOf(club, content).basePrestige;
      club.prestige = clamp(x - Math.trunc(((x - base) * p.reversionBp) / BP), p.min, p.max);
    }
  }
}

/** Step 8: unrenewed contracts of the ending season end; the fighter becomes a free agent (formerClubId kept). */
export function contractExpiriesImpl(draft: GameState): FighterId[] {
  const season = draft.calendar.season;
  const expired: FighterId[] = [];
  for (const f of Object.values(draft.fighters).sort((a, b) => compareFighterIds(a.id, b.id))) {
    if (f.status === 'retired') {
      // Retirement ends a contract with no payout (lifecycle step 7).
      if (f.contract || f.clubId) {
        f.contract = null;
        setMembership(draft, f, null, 'retired');
      }
      continue;
    }
    if (f.status !== 'active' || !f.contract || f.contract.endSeason > season) continue;
    const formerClubId = f.contract.clubId;
    setMembership(draft, f, null, 'free-agent');
    f.contract = null;
    f.freeAgency = { unsignedSeasonEnds: 0, formerClubId, releasedByClubId: null, releasedSeason: null, enteredAt: nowOf(draft) };
    expired.push(f.id);
  }
  const live = new Set<string>(poolFighters(draft).map((f) => f.id));
  draft.market.offers = draft.market.offers.filter((o) => live.has(o.fighterId));
  draft.market.negotiations = draft.market.negotiations.filter((n) => {
    if (n.kind !== 'renewal' || n.counterWage === null || n.validUntilWeek !== null) return true;
    const f = draft.fighters[n.fighterId];
    return f !== undefined && f.status === 'active' && f.clubId === n.clubId;
  });
  return expired;
}

/** Tier level a club played in during `season` (archived tables, else that season's league competition). */
function tierLevelInSeason(state: GameState, clubId: ClubId, season: number, content: ContentDB): number | null {
  const rec = state.history.find((h) => h.season === season);
  if (rec) {
    for (const t of rec.tiers) if (t.tierTable.some((r) => r.clubId === clubId)) return content.tiers.require(t.tierId).level;
  }
  for (const comp of Object.values(state.competitions)) {
    if (comp.kind === 'league' && comp.season === season && comp.clubIds.includes(clubId)) return content.tiers.require(comp.tierId).level;
  }
  return null;
}

interface ClubSetup {
  season: number;
  balanceAtSetup: number;
  promoted: boolean;
  relegated: boolean;
}

/** Per-club finance setup: Registry deduction, grant installment 1, parachute, promotion grant, SB, WB, status. */
function setupClubFinances(draft: GameState, club: Club, s: ClubSetup, content: ContentDB, news: NewsId[]): void {
  const e = content.economy;
  const fin = club.finance;
  const at: GameTime = { season: s.season, weekIndex: SETUP_WEEK_INDEX };
  const level = tierOf(club, content).level;
  const profile = content.tierProfile(level);
  // Soft-landing flags: parachute payments left (incl. this one) and ascension seasons left (incl. this one).
  const parachuteSeries = e.income.parachuteBpOfGrantGap.bySeasonAfterRelegation;
  if (s.relegated) {
    fin.parachuteSeasonsLeft = parachuteSeries.length;
    fin.ascensionSeasonsLeft = 0;
  } else if (s.promoted) {
    fin.parachuteSeasonsLeft = 0;
    fin.ascensionSeasonsLeft = e.budget.ascensionSeasons;
  } else {
    if (fin.parachuteSeasonsLeft > 0) fin.parachuteSeasonsLeft -= 1;
    if (fin.ascensionSeasonsLeft > 0) fin.ascensionSeasonsLeft -= 1;
  }
  const deduction = registryDeduction(fin.registryDebt, profile.centralGrant, content);
  fin.registryDebt -= deduction;
  const grantDue = profile.centralGrant - deduction;
  postAt(draft, { clubId: club.id, amount: grantInstallmentAt(grantDue, SETUP_WEEK_INDEX, content), category: 'centralGrant' }, at);
  let parachute = 0;
  if (fin.parachuteSeasonsLeft > 0 && level > 1) {
    const gap = content.tierProfile(level - 1).centralGrant - profile.centralGrant;
    parachute = Math.max(0, mulDiv(gap, parachuteSeries[parachuteSeries.length - fin.parachuteSeasonsLeft] ?? 0, BP));
    postAt(draft, { clubId: club.id, amount: parachute, category: 'parachute' }, at);
  }
  const promotionGrant = s.promoted ? profile.promotionGrantOnArrival : 0;
  postAt(draft, { clubId: club.id, amount: promotionGrant, category: 'promotionGrant' }, at);
  const sb = seasonBudgetOf(club, { grantDue, parachute, promotionGrant }, content).seasonBudget;
  const ratio = profile.wageRatioBp + (fin.ascensionSeasonsLeft > 0 ? e.budget.ascensionWageRatioBonusBp : 0);
  fin.seasonBudget = sb;
  fin.wageBudgetPerWeek = wageBudgetOf(sb, ratio, reserveContribution(sb, s.balanceAtSetup, content), content);
  // Embargo re-evaluated; the debt counter carries over unless the balance is >= 0 at setup.
  if (fin.balance >= e.finance.embargo.triggerBalanceBelow) fin.debtWeeks = 0;
  setStatus(draft, club, s.season, SETUP_WEEK_INDEX, content, news);
}

function applyContractSetupRules(draft: GameState, club: Club, relegated: boolean, season: number, content: ContentDB, raises: WageRaise[]): void {
  const c = content.economy.contracts;
  const min = profileOf(club, content).tierMinWage;
  const step = content.economy.wage.roundDownToMultiple;
  for (const f of rosterOf(draft, club.id)) {
    const contract = f.contract;
    if (!contract) continue;
    const agreed = agreedRenewal(draft, f.id);
    if (agreed && agreed.clubId === club.id) {
      // Renewed terms start now: a new contract (the drop clause may apply to it again).
      contract.wagePerWeek = agreed.wagePerWeek;
      contract.startSeason = season;
      contract.dropClauseApplied = false;
    }
    if (contract.next) contract.next = null;
    if (relegated && !contract.dropClauseApplied) {
      contract.wagePerWeek = Math.max(min, floorTo(mulDiv(contract.wagePerWeek, BP - c.dropClauseBp, BP), step));
      contract.dropClauseApplied = true;
    }
    if (c.raiseToTierMinimumAtSetup && contract.wagePerWeek < min) {
      raises.push({ clubId: club.id, fighterId: f.id, from: contract.wagePerWeek, to: min });
      contract.wagePerWeek = min;
    }
  }
}

/** Write the ending season's money totals into the club's history row (finance columns), if league archived it. */
function summarizeSeason(draft: GameState, club: Club, season: number): void {
  const row = club.history.find((h) => h.season === season);
  if (!row) return;
  let income = 0;
  let costs = 0;
  for (const e of draft.ledger.entries) {
    if (e.clubId !== club.id || e.season !== season) continue;
    if (e.amount > 0) income += e.amount;
    else costs -= e.amount;
  }
  row.income = income;
  row.costs = costs;
  row.endBalance = club.finance.balance;
}

/** Step 13 (finance part). */
export function nextSeasonFinanceSetupImpl(draft: GameState, rookieIds: readonly FighterId[], content: ContentDB): NewsId[] {
  const news: NewsId[] = [];
  const season = setupSeason(draft);
  const ending = season - 1;
  const clubs = clubsInOrder(draft, content);
  for (const club of clubs) summarizeSeason(draft, club, ending);
  // New season ledger: opening balance = balance before the first setup entry.
  draft.ledger.entries = [];
  draft.ledger.openingBalances = {};
  for (const club of clubs) draft.ledger.openingBalances[club.id] = club.finance.balance;
  const raises: WageRaise[] = [];
  for (const club of clubs) {
    const before = tierLevelInSeason(draft, club.id, ending, content);
    const now = tierOf(club, content).level;
    const promoted = before !== null && now < before;
    const relegated = before !== null && now > before;
    applyContractSetupRules(draft, club, relegated, season, content, raises);
    setupClubFinances(draft, club, { season, balanceAtSetup: club.finance.balance, promoted, relegated }, content, news);
  }
  // Season memory of the market resets; agreed renewals were applied above.
  draft.market.negotiations = [];
  draft.market.refusalsThisSeason = {};
  draft.market.releasedThisSeason = [];
  const live = new Set<string>(poolFighters(draft).map((f) => f.id));
  draft.market.offers = draft.market.offers.filter((o) => live.has(o.fighterId));
  for (const f of Object.values(draft.fighters)) if (f.status === 'free-agent' && !f.freeAgency) makeFreeAgent(draft, f);
  assignTrialsRookies(draft, rookieIds, season, content);
  // Tier-minimum raises: on the ending season's record (season review) and, for the player's club, as news.
  const record = draft.history.find((h) => h.season === ending);
  if (record && raises.length > 0) {
    // Written in this season-end step, so still editable; a shared (frozen) record is replaced instead.
    if (Object.isFrozen(record)) draft.history[draft.history.indexOf(record)] = { ...record, wageRaises: raises };
    else record.wageRaises = raises;
  }
  for (const r of raises) {
    pushNews(news, addClubNews(draft, { key: 'contract.minimum_raise', clubId: r.clubId, fighterId: r.fighterId, params: { from: r.from, to: r.to }, importance: 'notable' }));
  }
  return news;
}

// ---- new career --------------------------------------------------------------------------------------------------


function startingBalance(club: Club, content: ContentDB): number {
  const sb = content.economy.income.startingBalance;
  const tier = tierOf(club, content);
  const adj = clamp(sb.bpPerPrestigePoint * (club.prestige - tier.basePrestige), sb.minAdjBp, sb.maxAdjBp);
  return floorTo(mulDiv(profileOf(club, content).startingBalanceBase, BP + adj, BP), content.economy.income.tablePrize.roundDownTo);
}

/**
 * New career: rescale a club's opening contracts so its wage bill lands in
 * economy.json budget.worldGenBillBandBp of WB (default 82-92%), so every club,
 * the player's included, starts able to sign (tuning CR-1; it replaces the
 * 95% drop-trim). Wages keep their proportions to the nearest band edge,
 * floor to the wage multiple and stay within [tier minimum, maxWeeklyWage];
 * a shortfall after rounding is topped up one multiple at a time (fighter id
 * order). Only when the tier minimum keeps the bill above the band is the
 * lowest value-per-wage fighter released (never below the AI roster minimum)
 * and the rest rescaled again.
 */
function fitWorldGenBill(draft: GameState, club: Club, content: ContentDB): void {
  const band = content.economy.budget.worldGenBillBandBp;
  const wb = club.finance.wageBudgetPerWeek;
  const lo = mulDiv(wb, band.minBp, BP);
  const hi = mulDiv(wb, band.maxBp, BP);
  const keep = content.economy.ai.rosterMinimum;
  for (;;) {
    rescaleBill(draft, club, lo, hi, content);
    const roster = rosterOf(draft, club.id);
    if (wageBillOf(draft, club.id) <= hi || roster.length <= keep) return;
    // The tier minimum keeps the bill above the band: release the lowest value per wage, then rescale again.
    const worst = roster
      .map((f) => ({ f, v: valuePerWage(f, club, content) }))
      .sort((a, b) => a.v - b.v || compareFighterIds(b.f.id, a.f.id))[0]!.f;
    makeFreeAgent(draft, worst);
    worst.freeAgency = { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null, enteredAt: nowOf(draft) };
  }
}

/** Scale every contract of the club toward the nearest band edge [lo, hi] (no-op inside the band). */
function rescaleBill(draft: GameState, club: Club, lo: number, hi: number, content: ContentDB): void {
  const bill = wageBillOf(draft, club.id);
  if (bill === 0 || (bill >= lo && bill <= hi)) return;
  const target = bill > hi ? hi : lo;
  const step = content.economy.wage.roundDownToMultiple;
  const min = profileOf(club, content).tierMinWage;
  const max = content.economy.wage.maxWeeklyWage;
  const signed = rosterOf(draft, club.id).filter((f) => f.contract !== null);
  for (const f of signed) f.contract!.wagePerWeek = clamp(floorTo(mulDiv(f.contract!.wagePerWeek, target, bill), step), min, max);
  let now = wageBillOf(draft, club.id);
  for (let i = 0; now < lo && i < signed.length * 1000; i++) {
    const c = signed[i % signed.length]!.contract!;
    if (c.wagePerWeek + step > max) continue;
    c.wagePerWeek += step;
    now += step;
  }
}

/** Surplus over the tier's replacement level per gold of wage (world generation fallback). */
function valuePerWage(f: Fighter, club: Club, content: ContentDB): number {
  const rating = fighterRating(f, content);
  const bonus = potentialBonus(rating, fighterPotential(f, content), fighterHumanAge(f, content), content);
  const replacement = content.economy.ai.replacementRatingByTier[String(tierOf(club, content).level)] ?? 0;
  const wage = Math.max(1, f.contract?.wagePerWeek ?? 1);
  return mulDiv(rating + bonus - replacement, 1_000_000, wage);
}

/** New game: starting balances, greed for every fighter, contracts at asks, budgets, bills rescaled into the world-gen band, statuses. */
export function initialFinancesImpl(draft: GameState, content: ContentDB): NewsId[] {
  const news: NewsId[] = [];
  const season = draft.calendar.season;
  const clubs = clubsInOrder(draft, content);
  const lengths = content.economy.contracts.lengthsSeasons;
  for (const f of Object.values(draft.fighters).sort((a, b) => compareFighterIds(a.id, b.id))) {
    if (f.status === 'retired') continue;
    rollContractProfileImpl(draft, f.id, content);
    if (f.status === 'free-agent' && !f.freeAgency) makeFreeAgent(draft, f);
  }
  draft.ledger.entries = [];
  draft.ledger.openingBalances = {};
  for (const club of clubs) {
    const fin = club.finance;
    fin.balance = startingBalance(club, content);
    fin.status = 'healthy';
    fin.debtWeeks = 0;
    fin.registryDebt = 0;
    fin.parachuteSeasonsLeft = 0;
    fin.ascensionSeasonsLeft = 0;
    draft.ledger.openingBalances[club.id] = fin.balance;
    // Contracts of 1/2/3 seasons in equal shares (seeded rotation), wages at each fighter's ask for his club.
    const unsigned = rosterOf(draft, club.id).filter((f) => !f.contract);
    const order = Rng.create(draft.rng.root, STREAM.market, season, club.id, 'worldgen-lengths').shuffle(unsigned.map((f) => f.id));
    order.forEach((id, i) => {
      const f = draft.fighters[id]!;
      const seasons = lengths[i % lengths.length]!;
      f.contract = {
        clubId: club.id,
        wagePerWeek: askOf(draft, f, club.id, seasons, content),
        startSeason: season,
        endSeason: season + seasons - 1,
        signedAt: { season, weekIndex: SETUP_WEEK_INDEX },
        dropClauseApplied: false,
        next: null,
      };
    });
  }
  for (const club of clubs) {
    setupClubFinances(draft, club, { season, balanceAtSetup: club.finance.balance, promoted: false, relegated: false }, content, news);
    fitWorldGenBill(draft, club, content);
    setStatus(draft, club, season, SETUP_WEEK_INDEX, content, news);
  }
  draft.market.negotiations = [];
  draft.market.refusalsThisSeason = {};
  draft.market.releasedThisSeason = [];
  return news;
}
