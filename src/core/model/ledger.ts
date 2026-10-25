import type { ClubId, CompetitionId, FighterId, FixtureId } from './ids';

/**
 * Gold, the single currency (01 §7): a whole number. Never fractional: round
 * with roundHalfAway (core/util) at the point a fractional amount is computed.
 */
export type Gold = number;

/**
 * Ledger categories. [phase B] final list from 03-league-economy; keep the
 * set closed so finance screens and soak checks can group by category.
 */
export type LedgerCategory =
  | 'wages'
  | 'signing-fee'
  | 'release-fee'
  | 'prize-money'
  | 'gate-revenue'
  | 'budget-allocation'
  | 'operating-cost'
  | 'debt-advance'
  | 'adjustment';

/**
 * One gold movement. core/economy is the only writer; every change to a
 * Club.balance is accompanied by exactly one entry in the same transition, so
 * balance(club) === opening balance + sum(entries for club) always holds
 * (checked by the soak harness).
 */
export interface LedgerEntry {
  /** Game-wide sequence number, strictly increasing. */
  seq: number;
  season: number;
  week: number;
  clubId: ClubId;
  /** Signed: income > 0, expense < 0. */
  amount: Gold;
  category: LedgerCategory;
  /** Text key for the finance screen (UI/content text table), e.g. "ledger.wages.weekly". */
  reasonKey: string;
  fighterId?: FighterId;
  fixtureId?: FixtureId;
  competitionId?: CompetitionId;
}

export interface Ledger {
  nextSeq: number;
  /** Opening balance per club at the start of the current season (for the balance invariant and season summaries). */
  openingBalances: Record<ClubId, Gold>;
  /** Current season (and TUNABLE retention of previous seasons; older seasons are summarized at season end). */
  entries: LedgerEntry[];
}
