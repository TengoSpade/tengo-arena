import type { ClubId, FighterId, FixtureId } from './ids';

/**
 * Gold, the single currency (01 §7): an integer. Displayed with the theme's
 * name (economy.json currency, e.g. "tessel"). Ratios are basis points.
 * Each formula rounds once at its end, toward zero (03 §1).
 */
export type Gold = number;

/** 03-league-economy sys-finance ledger categories (closed list). */
export const LEDGER_CATEGORIES = [
  'centralGrant',
  'parachute',
  'promotionGrant',
  'sponsorRetainer',
  'sponsorWinBonus',
  'sponsorTournamentBonus',
  'gate',
  'tablePrize',
  'tournamentPrize',
  'patronBonus',
  'registryAdvance',
  'wages',
  'hiredBlades',
  'signingCost',
  'releasePayout',
  'operations',
] as const;
export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];

/**
 * One gold movement of the current season. core/economy is the only writer;
 * every balance change has exactly one entry in the same transition, so
 * balance == opening balance + Σ entries holds per club (soak check).
 */
export interface LedgerEntry {
  seq: number;
  season: number;
  weekIndex: number;
  clubId: ClubId;
  /** Signed: income > 0, cost < 0. */
  amount: Gold;
  category: LedgerCategory;
  fighterId?: FighterId;
  fixtureId?: FixtureId;
}

export interface Ledger {
  nextSeq: number;
  /** Balance per club at next-season setup (before the first entry of the season). */
  openingBalances: Record<ClubId, Gold>;
  /** Current season only; at season end the season is summarized into ClubSeasonRow and cleared. */
  entries: LedgerEntry[];
}
