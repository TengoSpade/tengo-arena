/**
 * The ledger (03-league-economy sys-finance). postAt() is the ONLY writer of
 * Club.finance.balance and GameState.ledger.entries: every balance change has
 * exactly one entry in the same transition, so per club
 *   balance == ledger.openingBalances[club] + Σ entries(club)
 * holds after every economy operation (soak check, 05 §3.2).
 */
import type { ClubId, FighterId, FixtureId, GameState, GameTime, Gold, LedgerCategory, LedgerEntry } from '../model';
import { LEDGER_CATEGORIES } from '../model';
import { InvariantError } from '../util';

export interface PostInput {
  clubId: ClubId;
  amount: Gold;
  category: LedgerCategory;
  fighterId?: FighterId;
  fixtureId?: string;
}

const CATEGORIES: ReadonlySet<string> = new Set(LEDGER_CATEGORIES);

/** Record one gold movement stamped `at`. Zero amounts write nothing. Returns the entry (or null). */
export function postAt(draft: GameState, entry: PostInput, at: GameTime): LedgerEntry | null {
  if (!Number.isSafeInteger(entry.amount)) throw new InvariantError(`economy.post: amount must be an integer, got ${entry.amount}`);
  if (!CATEGORIES.has(entry.category)) throw new InvariantError(`economy.post: unknown ledger category "${entry.category}"`);
  const club = draft.clubs[entry.clubId];
  if (!club) throw new InvariantError(`economy.post: unknown club "${entry.clubId}"`);
  if (entry.amount === 0) return null;
  const row: LedgerEntry = {
    seq: draft.ledger.nextSeq,
    season: at.season,
    weekIndex: at.weekIndex,
    clubId: entry.clubId,
    amount: entry.amount,
    category: entry.category,
  };
  if (entry.fighterId !== undefined) row.fighterId = entry.fighterId;
  if (entry.fixtureId !== undefined) row.fixtureId = entry.fixtureId as FixtureId;
  draft.ledger.nextSeq += 1;
  draft.ledger.entries.push(row);
  if (draft.ledger.openingBalances[entry.clubId] === undefined) {
    // A club without an opening balance gets its pre-entry balance as one, so the invariant holds.
    draft.ledger.openingBalances[entry.clubId] = club.finance.balance;
  }
  club.finance.balance += entry.amount;
  return row;
}

/** Σ of this ledger's entries for one club, optionally one category. */
export function ledgerSum(state: GameState, clubId: ClubId, category?: LedgerCategory): Gold {
  let total = 0;
  for (const e of state.ledger.entries) {
    if (e.clubId === clubId && (category === undefined || e.category === category)) total += e.amount;
  }
  return total;
}

/** Per-category totals of the current ledger for one club. */
export function ledgerByCategory(state: GameState, clubId: ClubId): Partial<Record<LedgerCategory, Gold>> {
  const out: Partial<Record<LedgerCategory, Gold>> = {};
  for (const e of state.ledger.entries) {
    if (e.clubId !== clubId) continue;
    out[e.category] = (out[e.category] ?? 0) + e.amount;
  }
  return out;
}

/**
 * Ledger invariant check for tests and the soak harness: one message per
 * club whose balance differs from opening + Σ entries, or whose entries are
 * not integers / out of sequence.
 */
export function ledgerInvariantViolations(state: GameState): string[] {
  const out: string[] = [];
  const sums = new Map<string, number>();
  let lastSeq = 0;
  for (const e of state.ledger.entries) {
    if (!Number.isSafeInteger(e.amount)) out.push(`entry ${e.seq}: non-integer amount ${e.amount}`);
    if (e.seq <= lastSeq) out.push(`entry ${e.seq}: sequence not increasing`);
    lastSeq = e.seq;
    sums.set(e.clubId, (sums.get(e.clubId) ?? 0) + e.amount);
  }
  if (lastSeq >= state.ledger.nextSeq) out.push(`ledger.nextSeq ${state.ledger.nextSeq} not above last entry ${lastSeq}`);
  for (const id of Object.keys(state.clubs).sort()) {
    const club = state.clubs[id as ClubId]!;
    const opening = state.ledger.openingBalances[id as ClubId] ?? 0;
    const expected = opening + (sums.get(id) ?? 0);
    if (!Number.isSafeInteger(club.finance.balance)) out.push(`${id}: non-integer balance ${club.finance.balance}`);
    if (club.finance.balance !== expected) out.push(`${id}: balance ${club.finance.balance} != opening ${opening} + entries ${sums.get(id) ?? 0}`);
  }
  return out;
}
