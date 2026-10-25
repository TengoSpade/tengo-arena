/**
 * Read helpers over GameState for economy rules. Pure. Rosters are derived
 * from Fighter.clubId + status 'active' (05 §3.2: the roster is never stored).
 */
import type { ContentDB, TierDef, TierProfile } from '../content';
import type { Club, ClubId, Fighter, FighterId, GameState, Negotiation, Offer } from '../model';
import { clubRoster, freeAgentList, idNumber } from '../model';
import { InvariantError, compareStrings } from '../util';
import { fighterRating } from './fighter-values';

export function requireClub(state: GameState, clubId: ClubId): Club {
  const club = state.clubs[clubId];
  if (!club) throw new InvariantError(`economy: unknown club "${clubId}"`);
  return club;
}

export function requireFighter(state: GameState, fighterId: FighterId): Fighter {
  const f = state.fighters[fighterId];
  if (!f) throw new InvariantError(`economy: unknown fighter "${fighterId}"`);
  return f;
}

export function tierOf(club: Club, content: ContentDB): TierDef {
  return content.tiers.require(club.tierId);
}

export function profileOf(club: Club, content: ContentDB): TierProfile {
  return content.tierProfile(tierOf(club, content).level);
}

/** Total order on fighters: allocation number, then id. */
export function compareFighterIds(a: string, b: string): number {
  return idNumber(a) - idNumber(b) || compareStrings(a, b);
}

/** Clubs in processing order: tier level, then club id (05 §3.1). */
export function clubsInOrder(state: GameState, content: ContentDB): Club[] {
  return Object.values(state.clubs).sort(
    (a, b) => tierOf(a, content).level - tierOf(b, content).level || compareStrings(a.id, b.id),
  );
}

/** Roster fighters of a club (status active), in id order. */
export function rosterOf(state: GameState, clubId: ClubId): Fighter[] {
  return [...clubRoster(state, clubId)];
}

/** The club whose exclusive trials rookie this fighter is (Trials Day), or null. */
export function trialsClubOf(state: GameState, fighterId: FighterId): ClubId | null {
  for (const clubId of Object.keys(state.market.trialsRookies).sort()) {
    if (state.market.trialsRookies[clubId as ClubId]?.includes(fighterId)) return clubId as ClubId;
  }
  return null;
}

/** In the free-agent pool: a free agent who is not an exclusive trials rookie. */
export function isInPool(state: GameState, fighter: Fighter): boolean {
  return fighter.status === 'free-agent' && trialsClubOf(state, fighter.id) === null;
}

/** The free-agent pool in id order. */
export function poolFighters(state: GameState): Fighter[] {
  const exclusive = new Set<string>();
  for (const ids of Object.values(state.market.trialsRookies)) for (const id of ids ?? []) exclusive.add(id);
  return freeAgentList(state).filter((f) => !exclusive.has(f.id));
}

export function pendingOffersOf(state: GameState, clubId: ClubId): Offer[] {
  return state.market.offers.filter((o) => o.clubId === clubId);
}

/** Weekly wages of current contracts (roster fighters). */
export function wageBillOf(state: GameState, clubId: ClubId): number {
  let total = 0;
  for (const f of rosterOf(state, clubId)) total += f.contract?.wagePerWeek ?? 0;
  return total;
}

// ---- negotiation memory (03-league-economy sys-contracts) --------------------------------------------

export function findNegotiation(
  state: GameState,
  fighterId: FighterId,
  clubId: ClubId,
  kind: Negotiation['kind'],
  season: number,
): Negotiation | undefined {
  return state.market.negotiations.find(
    (n) => n.fighterId === fighterId && n.clubId === clubId && n.kind === kind && n.season === season,
  );
}

/**
 * The agreed, not yet started renewal of a fighter (Contract.next): its wage
 * starts at next-season setup; the contract's endSeason already includes it.
 * 'season' is when it was agreed.
 */
export function agreedRenewal(state: GameState, fighterId: FighterId): { clubId: ClubId; wagePerWeek: number; season: number } | null {
  const c = state.fighters[fighterId]?.contract;
  if (!c || !c.next) return null;
  return { clubId: c.clubId, wagePerWeek: c.next.wagePerWeek, season: c.signedAt.season };
}

/** Weekly bill the commitment rule uses: current wages, or the agreed renewal wage when higher. */
export function committedBillOf(state: GameState, clubId: ClubId): number {
  let total = 0;
  for (const f of rosterOf(state, clubId)) {
    const current = f.contract?.wagePerWeek ?? 0;
    const next = agreedRenewal(state, f.id);
    total += next && next.clubId === clubId ? Math.max(current, next.wagePerWeek) : current;
  }
  return total;
}

/** Ratings of a club's roster, for the starter check. */
export function wouldStart(state: GameState, fighter: Fighter, clubId: ClubId, content: ContentDB): boolean {
  const r = fighterRating(fighter, content);
  let better = 0;
  for (const other of rosterOf(state, clubId)) {
    if (other.id !== fighter.id && fighterRating(other, content) > r) better += 1;
  }
  return better < content.economy.market.starterRankAtMost;
}

/** Role families of a class (hybrids count for both): tank, dps, controller, healer. */
export function roleFamiliesOf(classId: string, content: ContentDB): Set<string> {
  const out = new Set<string>();
  for (const a of content.classes.require(classId).archetypes) {
    out.add(a === 'melee' || a === 'ranged' ? 'dps' : a);
  }
  return out;
}
