/**
 * Read-only finance views for the UI (03-league-economy sys-finance "Player
 * information"). Pure. Labels are keys (UI text tables), never prose.
 */
import type { ContentDB } from '../content';
import type { ClubId, GameState, Gold, LedgerCategory } from '../model';
import { currentSeasonBudgetParts, registryDeduction } from './budget';
import { ledgerByCategory } from './ledger';
import { capReliefAllowance, pendingSigningCostsOf, pendingWagesOf } from './offers';
import { committedBillOf, profileOf, requireClub, wageBillOf } from './queries';
import { projectedCashFlow, watchProjection } from './season';
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
}

/** Status reason keys: 'balance-below-zero' (embargo), 'projected-shortfall' (watch). */
export function financeViewImpl(state: GameState, clubId: ClubId, content: ContentDB): FinanceViewShape {
  const club = requireClub(state, clubId);
  const parts = currentSeasonBudgetParts(state, club, content);
  const inSeason = state.calendar.phase !== 'season-end';
  const projected = inSeason
    ? club.finance.balance +
      projectedCashFlow(state, club, state.calendar.season, state.calendar.weekIndex - 1, weeksPerSeason(content), content) -
      pendingSigningCostsOf(state, clubId, content)
    : club.finance.balance;
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
  };
}

export interface FinanceDetails {
  /** Wage room for new commitments now: WB − (committed bill + pending wages). */
  wageRoom: Gold;
  /** Bill including agreed renewal raises (used by the commitment rule). */
  committedBill: Gold;
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
  return {
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
