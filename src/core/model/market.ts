import type { GameTime } from './calendar';
import type { ClubId, FighterId } from './ids';
import type { Gold } from './ledger';

/**
 * Free-agent market state (03-league-economy sys-transfers, sys-contracts).
 * Owner: core/economy. Free agents themselves are fighters with status
 * 'free-agent' (their FreeAgency data is on the fighter).
 */
export interface MarketState {
  /** Pending offers, answered at week processing. At most one per (club, fighter). */
  offers: Offer[];
  /** Per (fighter, club, season) negotiation memory: patience and counters. */
  negotiations: Negotiation[];
  /** Trials-day rookies exclusive to a club during P1. */
  trialsRookies: Record<ClubId, FighterId[]>;
  /** Free-agent refusals per club this season (cap from economy.json negotiation). */
  refusalsThisSeason: Record<ClubId, number>;
  /** Fighters released this season, blocked from re-signing with the same club. */
  releasedThisSeason: { fighterId: FighterId; clubId: ClubId }[];
}

export interface Offer {
  clubId: ClubId;
  fighterId: FighterId;
  wagePerWeek: Gold;
  /** Whole seasons including the current one. */
  seasons: number;
  madeAt: GameTime;
  /** Accepting a counter the fighter made earlier. */
  isCounterAcceptance: boolean;
}

export interface Negotiation {
  fighterId: FighterId;
  clubId: ClubId;
  season: number;
  kind: 'free-agent' | 'renewal';
  patienceLeft: number;
  /** Counter-demand the fighter made, valid until validUntilWeek. */
  counterWage: Gold | null;
  validUntilWeek: number | null;
}

/** Answer to an offer (instant for renewals and trials; at processing for free agents). */
export type OfferResponse =
  | { kind: 'accepted'; wagePerWeek: Gold; seasons: number }
  | { kind: 'countered'; counterWage: Gold; validUntilWeek: number }
  | { kind: 'refused'; reason: string }
  | { kind: 'lost'; toClubId: ClubId }
  | { kind: 'pending' };

/** Per-club AI memory (03-league-economy schema note 2). */
export interface AiClubMemory {
  voluntaryReleasesThisSeason: number;
}

/** Reserved for M4 (scouting / fuzzy stats). null in M1: every club sees true values (open-026). */
export interface KnowledgeEntry {
  knowledgeBp: number;
  lastContact: GameTime | null;
}
