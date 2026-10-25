/**
 * core/economy — finance, contracts and the free-agent market
 * (03-league-economy sys-finance, sys-contracts, sys-transfers, sys-roster cap
 * and hired blades). Owner: WP4. CONTRACT: signatures fixed (05 §9.2);
 * additional exports are additive.
 *
 * Integer gold and basis points only; each formula rounds once at its end
 * toward zero, then wages/asks floor to 5 and costs/prizes to 10 gold.
 * post() is the ONLY writer of Club.finance.balance and GameState.ledger.
 * M1 has no patron goal (GameOptions.patronGoals false).
 */
import type { ContentDB } from '../content';
import type {
  ClubId,
  FighterId,
  GameState,
  Gold,
  LedgerCategory,
  NewsId,
  OfferResponse,
  SeasonRecord,
} from '../model';
import type { EngineError, Result } from '../util';
import { postAt } from './ledger';
import {
  evaluateOffer,
  makeOfferImpl,
  pendingWagesOf,
  releaseFighterImpl,
  renewContractImpl,
  resolveFreeAgentOffersImpl,
  signTrialsRookieImpl,
  withdrawOfferImpl,
} from './offers';
import {
  assignHiredBladesImpl,
  poolMaintenanceImpl,
  releaseTrialsRookiesImpl,
  rollContractProfileImpl,
  topUpFreeAgentPoolImpl,
} from './pool';
import { requireClub, requireFighter, wageBillOf } from './queries';
import {
  contractExpiriesImpl,
  financialStatusImpl,
  initialFinancesImpl,
  nextSeasonFinanceSetupImpl,
  seasonPrizesImpl,
  updatePrestigeImpl,
  weeklyCostsImpl,
  weeklyIncomeImpl,
} from './season';
import { commandStamp } from './time';
import { financeViewImpl } from './view';
import { askOf, marketWageOf } from './wages';

// ---- ledger --------------------------------------------------------------------------------------

export interface PostEntry {
  clubId: ClubId;
  amount: Gold;
  category: LedgerCategory;
  fighterId?: FighterId;
  fixtureId?: string;
}

/** Record a gold movement and update the club balance (same transition). */
export function post(draft: GameState, entry: PostEntry): void {
  postAt(draft, entry, commandStamp(draft));
}

// ---- reads (pure) ---------------------------------------------------------------------------------

/** Weekly wages of current contracts. */
export function wageBill(state: GameState, clubId: ClubId): Gold {
  requireClub(state, clubId);
  return wageBillOf(state, clubId);
}

/** Weekly wages reserved by pending offers. */
export function pendingWages(state: GameState, clubId: ClubId): Gold {
  requireClub(state, clubId);
  return pendingWagesOf(state, clubId);
}

/** A fighter's market wage (curve of rating and potential × age, traits, role). */
export function marketWage(state: GameState, fighterId: FighterId, content: ContentDB): Gold {
  return marketWageOf(requireFighter(state, fighterId), content);
}

/** The fighter's ask from a club for a length (free agent or renewal). */
export function ask(state: GameState, fighterId: FighterId, clubId: ClubId, seasons: number, content: ContentDB): Gold {
  return askOf(state, requireFighter(state, fighterId), clubId, seasons, content);
}

export interface OfferCheck {
  signingCost: Gold;
  wageRoomAfter: Gold;
}

/** Legality of an offer/renewal/trials signing now: cap, commitment rule, embargo, blocks (no mutation). */
export function checkOffer(
  state: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number; kind: 'free-agent' | 'renewal' | 'trials' },
  content: ContentDB,
): Result<OfferCheck, EngineError> {
  return evaluateOffer(state, offer, content);
}

export interface FinanceView {
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

/** Everything the finance screen shows. */
export function financeView(state: GameState, clubId: ClubId, content: ContentDB): FinanceView {
  return financeViewImpl(state, clubId, content);
}

// ---- commands (mutate the draft; called by core/game applyCommand) -----------------------------------

export function makeOffer(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number; acceptCounter: boolean },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  return makeOfferImpl(draft, offer, content);
}

export function withdrawOffer(draft: GameState, clubId: ClubId, fighterId: FighterId): Result<void, EngineError> {
  return withdrawOfferImpl(draft, clubId, fighterId);
}

/** Renewal in the contract's final season; answered at once. */
export function renewContract(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  return renewContractImpl(draft, offer, content);
}

/** Trials-day rookie signing (P1 exclusive); answered at once. */
export function signTrialsRookie(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  return signTrialsRookieImpl(draft, offer, content);
}

/** Release (payout per economy.json; payout-free cap relief after relegation). */
export function releaseFighter(draft: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): Result<{ payout: Gold }, EngineError> {
  return releaseFighterImpl(draft, clubId, fighterId, content);
}

// ---- week processing steps -------------------------------------------------------------------------------

/** Step 3b: hired blades for clubs short of 5 fit fighters at lock (open-006). Returns their ids per club. */
export function assignHiredBlades(draft: GameState, content: ContentDB): Record<ClubId, FighterId[]> {
  return assignHiredBladesImpl(draft, content);
}

/** Step 4: gate, sponsor retainer, win bonuses, scheduled grant installment. */
export function weeklyIncome(draft: GameState, content: ContentDB): void {
  weeklyIncomeImpl(draft, content);
}

/** Step 5: wages, hired blades, operations. */
export function weeklyCosts(draft: GameState, content: ContentDB): void {
  weeklyCostsImpl(draft, content);
}

/** Step 6: watch / embargo / debt weeks / Registry advance. */
export function financialStatus(draft: GameState, content: ContentDB): NewsId[] {
  return financialStatusImpl(draft, content);
}

/** Step 7 (P1 only): unsigned trials rookies enter the pool. */
export function releaseTrialsRookies(draft: GameState, _content: ContentDB): void {
  releaseTrialsRookiesImpl(draft);
}

/** Step 8: free agents answer pending offers (best acceptable, market-wage order). */
export function resolveFreeAgentOffers(draft: GameState, content: ContentDB): NewsId[] {
  return resolveFreeAgentOffersImpl(draft, content);
}

/** Step 10: keep the pool at its floor (journeymen via fighters.createFighter). */
export function topUpFreeAgentPool(draft: GameState, content: ContentDB): void {
  topUpFreeAgentPoolImpl(draft, content);
}

// ---- season end ---------------------------------------------------------------------------------------------

/** Step 2: table and tournament prizes, sponsor tournament bonuses. */
export function seasonPrizes(draft: GameState, record: SeasonRecord, content: ContentDB): void {
  seasonPrizesImpl(draft, record, content);
}

/** Step 4: prestige update. */
export function updatePrestige(draft: GameState, record: SeasonRecord, content: ContentDB): void {
  updatePrestigeImpl(draft, record, content);
}

/** Step 8: expiries -> free agents (formerClubId kept). */
export function contractExpiries(draft: GameState, _content: ContentDB): FighterId[] {
  return contractExpiriesImpl(draft);
}

/** Step 12: free agents unsigned at N consecutive season ends leave. */
export function poolMaintenance(draft: GameState, content: ContentDB): FighterId[] {
  return poolMaintenanceImpl(draft, content);
}

/** Step 13 (finance part): drop clause, tier minimum raise, Registry deduction, grant installment 1, parachute, promotion grant, budgets, embargo; trials rookie assignment; greed for new fighters. */
export function nextSeasonFinanceSetup(draft: GameState, rookieIds: readonly FighterId[], content: ContentDB): void {
  nextSeasonFinanceSetupImpl(draft, rookieIds, content);
}

/** New game: starting balances, budgets and greed for every generated fighter. */
export function initialFinances(draft: GameState, content: ContentDB): void {
  initialFinancesImpl(draft, content);
}

/** Roll greed (contractProfile.greedBp) for a newly created fighter on STREAM.market. */
export function rollContractProfile(draft: GameState, fighterId: FighterId, content: ContentDB): void {
  rollContractProfileImpl(draft, fighterId, content);
}

// ---- additional exports (additive; for core/ai, core/game, the UI and the soak harness) ----------------------------

export { ledgerInvariantViolations, ledgerByCategory } from './ledger';
export { SETUP_WEEK_INDEX, marketTime } from './time';
export {
  isInPool,
  poolFighters,
  rosterOf,
  trialsClubOf,
  wouldStart,
  agreedRenewal,
  committedBillOf as committedWageBill,
  roleFamiliesOf,
} from './queries';
export {
  askDetails,
  marketWageDetails,
  calibreLevel,
  greedLabel,
  potentialBonus,
  preferredLength,
  type AskDetails,
  type MarketWageDetails,
} from './wages';
export {
  retainerOf as sponsorRetainer,
  gateFor,
  projectedRegularGate,
  seasonBudgetOf,
  currentSeasonBudgetParts,
  reserveContribution,
  wageBudgetOf,
  registryDeduction,
  type SeasonBudgetParts,
  type GateInput,
} from './budget';
export {
  capReliefAllowance,
  freeAgentSigningCost,
  renewalSigningCost,
  pendingSigningCostsOf as pendingSigningCosts,
  releasePayoutOf as releasePayout,
  rivalOfferCount,
  validCounter,
} from './offers';
export { assignTrialsRookies, poolCounts, PROVISIONAL_JOURNEYMAN_HUMAN_AGE } from './pool';
export { reckoningStages, watchProjection, PROVISIONAL_WORLDGEN_BILL_SHARE_BP } from './season';
export { financeDetails, type FinanceDetails } from './view';

/** Initial finances with the digest items it produced (status changes at setup). */
export function initialFinancesWithNews(draft: GameState, content: ContentDB): NewsId[] {
  return initialFinancesImpl(draft, content);
}

/** Next-season setup with the digest items it produced. */
export function nextSeasonFinanceSetupWithNews(draft: GameState, rookieIds: readonly FighterId[], content: ContentDB): NewsId[] {
  return nextSeasonFinanceSetupImpl(draft, rookieIds, content);
}

/** Pool top-up returning the journeymen it created. */
export function topUpFreeAgentPoolWithIds(draft: GameState, content: ContentDB): FighterId[] {
  return topUpFreeAgentPoolImpl(draft, content);
}
