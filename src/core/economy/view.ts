/**
 * Read-only finance views for the UI (03-league-economy sys-finance "Player
 * information"). Pure. Labels are keys (UI text tables), never prose.
 */
import type { ContentDB } from '../content';
import type { ClubId, GameState, Gold, LedgerCategory } from '../model';
import { currentSeasonBudgetParts, registryDeduction } from './budget';
import { ledgerByCategory } from './ledger';
import { nextSeasonWageOf, type NextSeasonWage } from './next-season';
import { capReliefAllowance, pendingSigningCostsOf, pendingWagesOf } from './offers';
import { committedBillOf, profileOf, requireClub, wageBillOf } from './queries';
import { projectedCashFlow, projectedWeeks, watchProjection } from './season';
import { weeksPerSeason } from './time';

export interface FinanceViewShape {
  balance: Gold;
  seasonBudget: Gold;
  seasonBudgetParts: { label: string; amount: Gold }[];
  wageBudgetPerWeek: Gold;
  wageBill: Gold;
  pendingWages: Gold;
  status: 'healthy' | 'watch' | 'embargo';
  statusReason: string | null;
  projectedSeasonEndBalance: Gold;
  registryDebt: Gold;
  byCategory: Partial<Record<LedgerCategory, Gold>>;
  /** R2-T006: next-season wage room and its breakdown (see economy/next-season.ts). */
  nextSeasonWageRoom: Gold;
  nextSeason: NextSeasonWage;
  weeklyProjection: WeekProjectionShape[];
}

export interface WeekProjectionShape {
  weekIndex: number;
  weekId: string;
  income: Gold;
  costs: Gold;
  net: Gold;
  balance: Gold;
}

/** Status reason keys: 'balance-below-zero' (embargo), 'projected-shortfall' (watch). */
export function financeViewImpl(state: GameState, clubId: ClubId, content: ContentDB): FinanceViewShape {
  const club = requireClub(state, clubId);
  const parts = currentSeasonBudgetParts(state, club, content);
  const inSeason = state.calendar.phase !== 'season-end';
  const pendingCosts = inSeason ? pendingSigningCostsOf(state, clubId, content) : 0;
  const weeks = inSeason ? projectedWeeks(state, club, state.calendar.season, state.calendar.weekIndex - 1, weeksPerSeason(content), content) : [];
  let running = club.finance.balance - pendingCosts;
  const weeklyProjection: WeekProjectionShape[] = weeks.map((w) => {
    running += w.income - w.costs;
    return { weekIndex: w.weekIndex, weekId: content.weekByIndex(w.weekIndex).id, income: w.income, costs: w.costs, net: w.income - w.costs, balance: running };
  });
  const nextSeason = nextSeasonWageOf(state, clubId);
  const projected = inSeason ? club.finance.balance + projectedCashFlow(state, club, state.calendar.season, state.calendar.weekIndex - 1, weeksPerSeason(content), content) - pendingCosts : club.finance.balance;
  return {
    balance: club.finance.balance,
    seasonBudget: club.finance.seasonBudget,
    seasonBudgetParts: [
      { label: 'centralGrant', amount: parts.grantDue },
      { label: 'parachute', amount: parts.parachute },
      { label: 'promotionGrant', amount: parts.promotionGrant },
      { label: 'sponsorRetainer', amount: parts.sponsorRetainer },
      { label: 'projectedGate', amount: parts.projectedGate },
    ],
    wageBudgetPerWeek: club.finance.wageBudgetPerWeek,
    wageBill: wageBillOf(state, clubId),
    pendingWages: pendingWagesOf(state, clubId),
    status: club.finance.status,
    statusReason: club.finance.status === 'embargo' ? 'balance-below-zero' : club.finance.status === 'watch' ? 'projected-shortfall' : null,
    projectedSeasonEndBalance: projected,
    registryDebt: club.finance.registryDebt,
    byCategory: ledgerByCategory(state, clubId),
    nextSeasonWageRoom: nextSeason.wageRoom,
    nextSeason,
    weeklyProjection,
  };
}

export interface FinanceDetails {
  /** Wage room for new commitments now: WB − (committed bill + pending wages). */
  wageRoom: Gold;
  /** Bill including agreed renewal raises (used by the commitment rule for signings that start this season). */
  committedBill: Gold;
  /** R2-T006: wage room a renewal is judged against (projected next-season wage budget - next-season commitments); `nextSeason` is the breakdown. */
  nextSeasonWageRoom: Gold;
  nextSeason: NextSeasonWage;
  pendingSigningCosts: Gold;
  debtWeeks: number;
  /** Next season's Registry deduction at the current tier's grant. */
  nextSeasonDeduction: Gold;
  parachuteSeasonsLeft: number;
  ascensionSeasonsLeft: number;
  /** Payout-free releases still allowed (cap relief after relegation). */
  capReliefAllowance: number;
  tierMinWage: Gold;
  /** Balance + next 4 weeks of scheduled flows − pending signing costs (Watch when < 0). */
  watchProjection: Gold;
}

export function financeDetails(state: GameState, clubId: ClubId, content: ContentDB): FinanceDetails {
  const club = requireClub(state, clubId);
  const profile = profileOf(club, content);
  const committedBill = committedBillOf(state, clubId);
  const pending = pendingWagesOf(state, clubId);
  const nextSeason = nextSeasonWageOf(state, clubId);
  return {
    nextSeasonWageRoom: nextSeason.wageRoom,
    nextSeason,
    wageRoom: club.finance.wageBudgetPerWeek - committedBill - pending,
    committedBill,
    pendingSigningCosts: pendingSigningCostsOf(state, clubId, content),
    debtWeeks: club.finance.debtWeeks,
    nextSeasonDeduction: registryDeduction(club.finance.registryDebt, profile.centralGrant, content),
    parachuteSeasonsLeft: club.finance.parachuteSeasonsLeft,
    ascensionSeasonsLeft: club.finance.ascensionSeasonsLeft,
    capReliefAllowance: capReliefAllowance(state, clubId, content),
    tierMinWage: profile.tierMinWage,
    watchProjection:
      state.calendar.phase === 'season-end'
        ? club.finance.balance
        : watchProjection(state, club, state.calendar.season, state.calendar.weekIndex - 1, content),
  };
}
