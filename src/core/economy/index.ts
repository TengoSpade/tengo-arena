/**
 * core/economy — finance, contracts and the free-agent market
 * (03-league-economy sys-finance, sys-contracts, sys-transfers, sys-roster cap
 * and hired blades). Owner: WP4. CONTRACT: signatures fixed; bodies are stubs.
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
import { notImplemented, type EngineError, type Result } from '../util';

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
  return notImplemented('economy.post', draft, entry);
}

// ---- reads (pure) ---------------------------------------------------------------------------------

/** Weekly wages of current contracts. */
export function wageBill(state: GameState, clubId: ClubId): Gold {
  return notImplemented('economy.wageBill', state, clubId);
}

/** Weekly wages reserved by pending offers. */
export function pendingWages(state: GameState, clubId: ClubId): Gold {
  return notImplemented('economy.pendingWages', state, clubId);
}

/** A fighter's market wage (curve of rating and potential × age, traits, role). */
export function marketWage(state: GameState, fighterId: FighterId, content: ContentDB): Gold {
  return notImplemented('economy.marketWage', state, fighterId, content);
}

/** The fighter's ask from a club for a length (free agent or renewal). */
export function ask(state: GameState, fighterId: FighterId, clubId: ClubId, seasons: number, content: ContentDB): Gold {
  return notImplemented('economy.ask', state, fighterId, clubId, seasons, content);
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
  return notImplemented('economy.checkOffer', state, offer, content);
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
  return notImplemented('economy.financeView', state, clubId, content);
}

// ---- commands (mutate the draft; called by core/game applyCommand) -----------------------------------

export function makeOffer(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number; acceptCounter: boolean },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  return notImplemented('economy.makeOffer', draft, offer, content);
}

export function withdrawOffer(draft: GameState, clubId: ClubId, fighterId: FighterId): Result<void, EngineError> {
  return notImplemented('economy.withdrawOffer', draft, clubId, fighterId);
}

/** Renewal in the contract's final season; answered at once. */
export function renewContract(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  return notImplemented('economy.renewContract', draft, offer, content);
}

/** Trials-day rookie signing (P1 exclusive); answered at once. */
export function signTrialsRookie(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: Gold; seasons: number },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  return notImplemented('economy.signTrialsRookie', draft, offer, content);
}

/** Release (payout per economy.json; payout-free cap relief after relegation). */
export function releaseFighter(draft: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): Result<{ payout: Gold }, EngineError> {
  return notImplemented('economy.releaseFighter', draft, clubId, fighterId, content);
}

// ---- week processing steps -------------------------------------------------------------------------------

/** Step 3b: hired blades for clubs short of 5 fit fighters at lock (open-006). Returns their ids per club. */
export function assignHiredBlades(draft: GameState, content: ContentDB): Record<ClubId, FighterId[]> {
  return notImplemented('economy.assignHiredBlades', draft, content);
}

/** Step 4: gate, sponsor retainer, win bonuses, scheduled grant installment. */
export function weeklyIncome(draft: GameState, content: ContentDB): void {
  return notImplemented('economy.weeklyIncome', draft, content);
}

/** Step 5: wages, hired blades, operations. */
export function weeklyCosts(draft: GameState, content: ContentDB): void {
  return notImplemented('economy.weeklyCosts', draft, content);
}

/** Step 6: watch / embargo / debt weeks / Registry advance. */
export function financialStatus(draft: GameState, content: ContentDB): NewsId[] {
  return notImplemented('economy.financialStatus', draft, content);
}

/** Step 7 (P1 only): unsigned trials rookies enter the pool. */
export function releaseTrialsRookies(draft: GameState, content: ContentDB): void {
  return notImplemented('economy.releaseTrialsRookies', draft, content);
}

/** Step 8: free agents answer pending offers (best acceptable, market-wage order). */
export function resolveFreeAgentOffers(draft: GameState, content: ContentDB): NewsId[] {
  return notImplemented('economy.resolveFreeAgentOffers', draft, content);
}

/** Step 10: keep the pool at its floor (journeymen via fighters.createFighter). */
export function topUpFreeAgentPool(draft: GameState, content: ContentDB): void {
  return notImplemented('economy.topUpFreeAgentPool', draft, content);
}

// ---- season end ---------------------------------------------------------------------------------------------

/** Step 2: table and tournament prizes, sponsor tournament bonuses. */
export function seasonPrizes(draft: GameState, record: SeasonRecord, content: ContentDB): void {
  return notImplemented('economy.seasonPrizes', draft, record, content);
}

/** Step 4: prestige update. */
export function updatePrestige(draft: GameState, record: SeasonRecord, content: ContentDB): void {
  return notImplemented('economy.updatePrestige', draft, record, content);
}

/** Step 8: expiries -> free agents (formerClubId kept). */
export function contractExpiries(draft: GameState, content: ContentDB): FighterId[] {
  return notImplemented('economy.contractExpiries', draft, content);
}

/** Step 12: free agents unsigned at N consecutive season ends leave. */
export function poolMaintenance(draft: GameState, content: ContentDB): FighterId[] {
  return notImplemented('economy.poolMaintenance', draft, content);
}

/** Step 13 (finance part): drop clause, tier minimum raise, Registry deduction, grant installment 1, parachute, promotion grant, budgets, embargo; trials rookie assignment; greed for new fighters. */
export function nextSeasonFinanceSetup(draft: GameState, rookieIds: readonly FighterId[], content: ContentDB): void {
  return notImplemented('economy.nextSeasonFinanceSetup', draft, rookieIds, content);
}

/** New game: starting balances, budgets and greed for every generated fighter. */
export function initialFinances(draft: GameState, content: ContentDB): void {
  return notImplemented('economy.initialFinances', draft, content);
}

/** Roll greed (contractProfile.greedBp) for a newly created fighter on STREAM.market. */
export function rollContractProfile(draft: GameState, fighterId: FighterId, content: ContentDB): void {
  return notImplemented('economy.rollContractProfile', draft, fighterId, content);
}
