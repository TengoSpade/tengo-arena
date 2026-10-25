/**
 * Market rows and the terms check (04 ui-market). Everything that is a rule
 * (asks, legality, signing cost, wage bill) comes from core through the
 * engine; this file only gathers it per row and phrases the deterministic
 * terms check (03 sys-contracts "Negotiation": at or above the ask is
 * acceptable; within the greed label's flex the fighter counters at the
 * midpoint; lower is refused). Never a probability forecast (P-13).
 */
import type { ContentDB } from '../../../core/content';
import type { OfferCheck } from '../../../core/economy';
import type { FighterView } from '../../../core/game';
import type { ClubId, Fighter, FighterId, GameState } from '../../../core/model';
import type { EngineError, Result } from '../../../core/util';
import type { Wp7Engine } from '../league/lib/engine';
import { rosterOf } from '../league/lib/season';
import { tryView } from '../league/lib/views';

export type OfferKind = 'free-agent' | 'renewal' | 'trials';

export interface ClubMarket {
  clubId: ClubId;
  cap: number;
  roster: number;
  pendingOffers: number;
  placesLeft: number;
  wageBudget: number;
  wageBill: number;
  pendingWages: number;
  wageRoom: number;
  balance: number;
  embargo: boolean;
  tierMinWage: number;
  /** Rating of the 5th-best rostered fighter: "would start" means a higher rating. */
  starterBar: number | null;
  lengths: number[];
}

export function clubMarket(engine: Wp7Engine, state: GameState, content: ContentDB, clubId: ClubId): ClubMarket {
  const club = state.clubs[clubId]!;
  const tier = content.tiers.get(club.tierId);
  const roster = rosterOf(state, clubId);
  const pendingOffers = state.market.offers.filter((o) => o.clubId === clubId).length;
  const wageBill = tryView(() => engine.wageBill(state, clubId));
  const pendingWages = tryView(() => engine.pendingWages(state, clubId));
  const bill = wageBill.ok ? wageBill.value : roster.reduce((s, f) => s + (f.contract?.wagePerWeek ?? 0), 0);
  const pend = pendingWages.ok ? pendingWages.value : state.market.offers.filter((o) => o.clubId === clubId).reduce((s, o) => s + o.wagePerWeek, 0);
  const ratings = roster
    .map((f) => tryView(() => engine.fighterView(state, f.id, content)))
    .filter((v): v is { ok: true; value: FighterView } => v.ok)
    .map((v) => v.value.rating)
    .sort((a, b) => b - a);
  const cap = tier?.rosterCap ?? 0;
  return {
    clubId,
    cap,
    roster: roster.length,
    pendingOffers,
    placesLeft: cap - roster.length - pendingOffers,
    wageBudget: club.finance.wageBudgetPerWeek,
    wageBill: bill,
    pendingWages: pend,
    wageRoom: club.finance.wageBudgetPerWeek - bill - pend,
    balance: club.finance.balance,
    embargo: club.finance.status === 'embargo',
    tierMinWage: content.tierProfile(tier?.level ?? 1).tierMinWage,
    starterBar: ratings.length >= 5 ? ratings[4]! : null,
    lengths: [...content.economy.contracts.lengthsSeasons],
  };
}

export interface MarketRow {
  fighter: Fighter;
  view: FighterView | null;
  rating: number;
  potential: number;
  /** Ask from our club per contract length. */
  asks: { seasons: number; ask: number }[];
  /** The length with the lowest ask (the fighter's preferred length). */
  preferred: number;
  ask: number;
  check: Result<OfferCheck, EngineError> | null;
  rivals: number;
  /** Patience left with our club this season (03 sys-contracts); null = full. */
  patience: number;
  maxPatience: number;
  wouldStart: boolean;
  pending: { wagePerWeek: number; seasons: number } | null;
  shortlisted: boolean;
  negativeTraits: number;
  /** Entered the pool at the last week processing or since (FreeAgency.enteredAt). */
  isNew: boolean;
}

/**
 * "New this week": entered the free-agent pool at the last week processing or during this week.
 * The starting pool is stamped season 1 week 1 at world creation, so that stamp never counts as new.
 */
export function isNewAgent(fighter: Fighter, state: GameState): boolean {
  const at = fighter.freeAgency?.enteredAt;
  if (!at || (at.season === 1 && at.weekIndex === 1)) return false;
  return at.season === state.calendar.season && at.weekIndex >= state.calendar.weekIndex - 1;
}

export function marketRow(engine: Wp7Engine, state: GameState, content: ContentDB, m: ClubMarket, fighter: Fighter, kind: OfferKind = 'free-agent'): MarketRow {
  const view = tryView(() => engine.fighterView(state, fighter.id, content));
  const v = view.ok ? view.value : null;
  const asks = m.lengths
    .map((seasons) => {
      const a = tryView(() => engine.ask(state, fighter.id, m.clubId, seasons, content));
      return a.ok ? { seasons, ask: a.value } : null;
    })
    .filter((x): x is { seasons: number; ask: number } => x !== null);
  const best = [...asks].sort((a, b) => a.ask - b.ask || a.seasons - b.seasons)[0];
  const preferred = best?.seasons ?? m.lengths[0] ?? 1;
  const ask = best?.ask ?? v?.askFromPlayer ?? v?.marketWage ?? 0;
  const checked = tryView(() => engine.checkOffer(state, { clubId: m.clubId, fighterId: fighter.id, wagePerWeek: ask, seasons: preferred, kind }, content));
  const negKind = kind === 'renewal' ? 'renewal' : 'free-agent';
  const neg = state.market.negotiations.find((n) => n.fighterId === fighter.id && n.clubId === m.clubId && n.season === state.calendar.season && n.kind === negKind);
  const maxPatience = negKind === 'renewal' ? content.economy.negotiation.renewalOffersPerSeason : content.economy.negotiation.freeAgentRefusalsPerClubPerSeason;
  const own = state.market.offers.find((o) => o.fighterId === fighter.id && o.clubId === m.clubId);
  const rating = v?.rating ?? 0;
  return {
    fighter,
    view: v,
    rating,
    potential: v?.potential ?? fighter.potentialRoll,
    asks,
    preferred,
    ask,
    check: checked.ok ? checked.value : null,
    rivals: state.market.offers.filter((o) => o.fighterId === fighter.id && o.clubId !== m.clubId).length,
    patience: neg ? neg.patienceLeft : maxPatience,
    maxPatience,
    wouldStart: m.starterBar === null || rating > m.starterBar,
    pending: own ? { wagePerWeek: own.wagePerWeek, seasons: own.seasons } : null,
    shortlisted: state.clubs[m.clubId]?.shortlist.includes(fighter.id) ?? false,
    negativeTraits: fighter.traits.filter((tr) => content.traits.get(tr.id)?.polarity === 'negative').length,
    isNew: isNewAgent(fighter, state),
  };
}

// ---- terms check ------------------------------------------------------------------------------

export type TermsVerdict = 'acceptable' | 'counter' | 'refused';

export interface Terms {
  verdict: TermsVerdict;
  /** Counter price when the fighter would counter (floor to 5). */
  counter: number | null;
  /** Ratio offer / ask in basis points. */
  ratioBp: number;
  flexBp: number;
  greedLabel: string;
}

export function greedLabel(content: ContentDB, greedBp: number): { label: string; flexBp: number } {
  const labels = content.economy.ask.greed.labels;
  const found = labels.find((l) => greedBp <= l.maxBp) ?? labels[labels.length - 1];
  return { label: found?.label ?? '', flexBp: found?.flexBp ?? 1000 };
}

export function termsCheck(content: ContentDB, fighter: Fighter, offer: number, ask: number): Terms {
  const { label, flexBp } = greedLabel(content, fighter.contractProfile.greedBp);
  const ratioBp = ask > 0 ? Math.floor((offer * 10000) / ask) : 10000;
  if (ratioBp >= 10000) return { verdict: 'acceptable', counter: null, ratioBp, flexBp, greedLabel: label };
  if (ratioBp >= 10000 - flexBp) return { verdict: 'counter', counter: Math.floor((offer + ask) / 2 / 5) * 5, ratioBp, flexBp, greedLabel: label };
  return { verdict: 'refused', counter: null, ratioBp, flexBp, greedLabel: label };
}

/** Pip level for `.willing` (3 full patience ... 0 will not deal). */
export function willingLevel(patience: number, max: number): number {
  if (patience <= 0) return 0;
  if (patience >= max) return 3;
  return Math.max(1, Math.round((patience / max) * 3));
}

export function fighterIdsOf(rows: readonly MarketRow[]): FighterId[] {
  return rows.map((r) => r.fighter.id);
}
