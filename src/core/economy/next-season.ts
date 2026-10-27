/**
 * Next-season wage room (R2-T006): "when renewing, use funds that are expected to be available the following year".
 *
 * A renewal's new terms start at next-season setup, and a contract that ends this season is gone by then, so a
 * renewal (and any signing that starts next season) is judged against what the club will have to pay next season, not
 * against this season's bill. Pure reads over GameState; the one rulebook for the player and the AI (offers.ts
 * evaluateOffer applies it; core/ai reads `nextSeasonCommitmentsOf` for its own renewal budget).
 *
 *   room = projected wage budget - commitments
 *
 *   projected wage budget  the club's current wage budget per week. A projection, not a promise: it assumes no
 *                          promotion or relegation and an unchanged prestige and reserve; the real budget is set at the
 *                          next-season setup.
 *   commitments            contracts that continue into next season (endSeason after the current season) at their
 *                          current wage, plus agreed renewals (Contract.next) at the agreed wage, plus pending offers
 *                          that would run into next season (made for next season, or for 2+ seasons).
 *   not counted            contracts ending this season that have not been renewed.
 *
 * Not projected: tier-minimum raises and the relegation drop clause applied at setup (both need a tier change or a
 * contract below the minimum), and wage changes from level-ups (wages are contract terms).
 */
import type { ClubId, FighterId, GameState, Gold, Offer } from '../model';
import { pendingOffersOf, requireClub, rosterOf } from './queries';

export interface NextSeasonWage {
  /** The season the figures are for: the current season + 1. */
  season: number;
  /** Projected wage budget per week: the club's current wage budget (see the file comment: assumes no promotion or relegation). */
  projectedWageBudget: Gold;
  /** Contracts that continue into next season, at their current wage (agreed renewals are in `agreedRenewals`). */
  continuing: Gold;
  /** Agreed renewals, at the agreed wage they start next season. */
  agreedRenewals: Gold;
  /** Pending offers that would run into next season (made for next season, or for 2+ seasons), at their offered wage. */
  pendingOffers: Gold;
  /** continuing + agreedRenewals + pendingOffers. */
  commitments: Gold;
  /** projectedWageBudget - commitments: what a renewal (or a signing that starts next season) may cost per week; negative when over. */
  wageRoom: Gold;
  /** Contracts ending this season and not renewed: not counted in the commitments. `wagePerWeek` is what they cost this season. */
  expiring: { fighterIds: FighterId[]; wagePerWeek: Gold };
  /** Always true today: the projection assumes the club stays in its tier. */
  assumesNoTierChange: boolean;
}

/** Whether a pending offer, answered at its market week, would still be running next season (current season + 1). */
export function offerRunsIntoNextSeason(o: Pick<Offer, 'madeAt' | 'seasons'>, currentSeason: number): boolean {
  return o.madeAt.season + o.seasons - 1 > currentSeason;
}

/**
 * Next-season commitments of a club, with their parts. `offers` are the pending offers to count (default: all of the
 * club's; evaluateOffer passes the ones left after the offer being replaced or resolved).
 */
export function nextSeasonCommitmentsOf(
  state: GameState,
  clubId: ClubId,
  offers: readonly Offer[] = pendingOffersOf(state, clubId),
): Pick<NextSeasonWage, 'continuing' | 'agreedRenewals' | 'pendingOffers' | 'commitments' | 'expiring'> {
  const season = state.calendar.season;
  let continuing = 0;
  let agreedRenewals = 0;
  let expiringWages = 0;
  const expiringIds: FighterId[] = [];
  for (const f of rosterOf(state, clubId)) {
    const c = f.contract;
    if (!c) continue;
    if (c.next && c.clubId === clubId) agreedRenewals += c.next.wagePerWeek;
    else if (c.endSeason > season) continuing += c.wagePerWeek;
    else {
      expiringWages += c.wagePerWeek;
      expiringIds.push(f.id);
    }
  }
  let pendingOffers = 0;
  for (const o of offers) if (offerRunsIntoNextSeason(o, season)) pendingOffers += o.wagePerWeek;
  return { continuing, agreedRenewals, pendingOffers, commitments: continuing + agreedRenewals + pendingOffers, expiring: { fighterIds: expiringIds, wagePerWeek: expiringWages } };
}

/** The club's projected next-season wage room with its breakdown (FinanceView.nextSeason). */
export function nextSeasonWageOf(state: GameState, clubId: ClubId): NextSeasonWage {
  const club = requireClub(state, clubId);
  const parts = nextSeasonCommitmentsOf(state, clubId);
  const projectedWageBudget = club.finance.wageBudgetPerWeek;
  return { season: state.calendar.season + 1, projectedWageBudget, ...parts, wageRoom: projectedWageBudget - parts.commitments, assumesNoTierChange: true };
}
