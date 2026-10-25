/**
 * Offers, renewals, trials signings and releases (03-league-economy
 * sys-contracts, sys-transfers, sys-roster cap; sys-finance commitment rule
 * and embargo). Same rules for the player and AI clubs (P-04).
 *
 * Legality (cap, hard commitment rule, cash for the signing cost, embargo,
 * blocks) runs at submission and again at resolution, where a failing offer
 * is void. Pending offers reserve cap, wage room and signing cost.
 */
import type { ContentDB } from '../content';
import type { ClubId, Fighter, FighterId, GameState, GameTime, Negotiation, NewsId, Offer, OfferResponse } from '../model';
import { Rng, STREAM } from '../rng';
import { compareStrings, engineError, err, ok, type EngineError, type Result } from '../util';
import { fighterIsFit } from './fighter-values';
import { postAt } from './ledger';
import { floorTo, mulDiv } from './math';
import { addClubNews, pushNews } from './news';
import {
  agreedRenewal,
  committedBillOf,
  compareFighterIds,
  findNegotiation,
  isInPool,
  pendingOffersOf,
  profileOf,
  requireClub,
  rosterOf,
  tierOf,
  trialsClubOf,
  wouldStart,
} from './queries';
import {
  commandStamp,
  kickOffWeekIndex,
  marketTime,
  paidWeeksAfterSigning,
  paidWeeksTrials,
  processingStamp,
  remainingWeeksInclusive,
  weeksPerSeason,
} from './time';
import { askOf, greedLabel, marketWageOf } from './wages';

const BP = 10_000;

export type OfferKind = 'free-agent' | 'renewal' | 'trials';

export interface OfferRequest {
  clubId: ClubId;
  fighterId: FighterId;
  wagePerWeek: number;
  seasons: number;
  kind: OfferKind;
}

export interface OfferCheckResult {
  signingCost: number;
  wageRoomAfter: number;
}

type Key = { clubId: ClubId; fighterId: FighterId };

function sameKey(o: Key, k: Key): boolean {
  return o.clubId === k.clubId && o.fighterId === k.fighterId;
}

function fail(code: string, message: string, details?: Record<string, unknown>): { ok: false; error: EngineError } {
  return err(engineError(code, message, details));
}

/** Embargo terms for a free-agent offer: tier minimum, length 1, no signing cost. */
function embargoTerms(state: GameState, clubId: ClubId, wage: number, seasons: number, content: ContentDB): boolean {
  const club = requireClub(state, clubId);
  return club.finance.status === 'embargo' && seasons === 1 && wage === profileOf(club, content).tierMinWage;
}

/** Signing cost of a free-agent offer answered at processing `weekIndex`. */
export function freeAgentSigningCost(wage: number, seasons: number, weekIndex: number, content: ContentDB): number {
  const c = content.economy.contracts;
  return floorTo(mulDiv(wage * paidWeeksAfterSigning(weekIndex, seasons, content), c.signingCostBp, BP), c.signingCostRoundDownTo);
}

export function renewalSigningCost(wage: number, seasons: number, content: ContentDB): number {
  const c = content.economy.contracts;
  return floorTo(mulDiv(wage * weeksPerSeason(content) * seasons, c.renewalSigningCostBp, BP), c.signingCostRoundDownTo);
}

export function trialsSigningCost(wage: number, seasons: number, weekIndex: number, content: ContentDB): number {
  const c = content.economy.contracts;
  return floorTo(mulDiv(wage * paidWeeksTrials(weekIndex, seasons, content), c.trialsRookieSigningCostBp, BP), c.signingCostRoundDownTo);
}

function pendingOfferCost(state: GameState, o: Offer, at: GameTime, content: ContentDB): number {
  if (embargoTerms(state, o.clubId, o.wagePerWeek, o.seasons, content)) return 0;
  return freeAgentSigningCost(o.wagePerWeek, o.seasons, at.weekIndex, content);
}

/** Σ signing costs reserved by a club's pending offers (answered at the market week's processing). */
export function pendingSigningCostsOf(state: GameState, clubId: ClubId, content: ContentDB, exclude?: Key): number {
  const at = marketTime(state);
  let total = 0;
  for (const o of pendingOffersOf(state, clubId)) {
    if (exclude && sameKey(o, exclude)) continue;
    total += pendingOfferCost(state, o, at, content);
  }
  return total;
}

export function pendingWagesOf(state: GameState, clubId: ClubId, exclude?: Key): number {
  let total = 0;
  for (const o of pendingOffersOf(state, clubId)) if (!exclude || !sameKey(o, exclude)) total += o.wagePerWeek;
  return total;
}

function negotiationKind(kind: OfferKind): Negotiation['kind'] {
  return kind === 'renewal' ? 'renewal' : 'free-agent';
}

function patienceFor(kind: Negotiation['kind'], content: ContentDB): number {
  const n = content.economy.negotiation;
  return kind === 'renewal' ? n.renewalOffersPerSeason : n.freeAgentRefusalsPerClubPerSeason;
}

function ensureNegotiation(draft: GameState, key: Key, kind: Negotiation['kind'], season: number, content: ContentDB): Negotiation {
  const found = findNegotiation(draft, key.fighterId, key.clubId, kind, season);
  if (found) return found;
  const n: Negotiation = {
    fighterId: key.fighterId,
    clubId: key.clubId,
    season,
    kind,
    patienceLeft: patienceFor(kind, content),
    counterWage: null,
    validUntilWeek: null,
  };
  draft.market.negotiations.push(n);
  return n;
}

/** The club's valid counter price from this fighter (a counter is valid through validUntilWeek's processing). */
export function validCounter(state: GameState, key: Key, kind: Negotiation['kind'], at: GameTime): number | null {
  const n = findNegotiation(state, key.fighterId, key.clubId, kind, at.season);
  if (!n || n.counterWage === null || n.validUntilWeek === null) return null;
  return at.weekIndex <= n.validUntilWeek ? n.counterWage : null;
}

function patienceLeft(state: GameState, key: Key, kind: Negotiation['kind'], season: number, content: ContentDB): number {
  return findNegotiation(state, key.fighterId, key.clubId, kind, season)?.patienceLeft ?? patienceFor(kind, content);
}

/**
 * Full legality of an offer, renewal or trials signing at market time `at`.
 * `exclude` is the pending offer being replaced or resolved (its own reservation is not counted twice).
 */
export function evaluateOffer(
  state: GameState,
  req: OfferRequest,
  content: ContentDB,
  at: GameTime = marketTime(state),
  exclude: Key | undefined = { clubId: req.clubId, fighterId: req.fighterId },
): Result<OfferCheckResult, EngineError> {
  const club = state.clubs[req.clubId];
  if (!club) return fail('club.unknown', `Unknown club ${req.clubId}`);
  const f = state.fighters[req.fighterId];
  if (!f) return fail('fighter.unknown', `Unknown fighter ${req.fighterId}`);
  const e = content.economy;
  if (!e.contracts.lengthsSeasons.includes(req.seasons)) {
    return fail('offer.length', `Contract length ${req.seasons} is not one of ${e.contracts.lengthsSeasons.join('/')}`, { seasons: req.seasons });
  }
  if (!Number.isSafeInteger(req.wagePerWeek) || req.wagePerWeek <= 0) return fail('offer.wage', `Invalid wage ${req.wagePerWeek}`);
  const profile = profileOf(club, content);
  if (req.wagePerWeek < profile.tierMinWage) {
    return fail('offer.below-minimum', `Wage below the tier minimum ${profile.tierMinWage}`, { tierMinWage: profile.tierMinWage });
  }
  const nkind = negotiationKind(req.kind);
  const key = { clubId: req.clubId, fighterId: req.fighterId };

  // ---- eligibility
  if (req.kind === 'free-agent') {
    const trialsClub = trialsClubOf(state, f.id);
    if (trialsClub !== null) return fail('offer.trials-exclusive', 'Trials rookies are exclusive to their club during Trials Day', { clubId: trialsClub });
    if (!isInPool(state, f)) return fail('offer.not-free-agent', 'Not a free agent');
    if (e.market.releasedFighterBlockedFromSameClubThisSeason && state.market.releasedThisSeason.some((r) => sameKey(r, key))) {
      return fail('offer.released-by-club', 'Released by this club this season');
    }
  } else if (req.kind === 'renewal') {
    if (f.status !== 'active' || f.clubId !== req.clubId || f.contract?.clubId !== req.clubId) return fail('renewal.not-own', 'Not under contract with this club');
    if (f.contract.endSeason !== at.season) return fail('renewal.not-final-season', 'Renewals are only allowed in the final season of a contract', { endSeason: f.contract.endSeason });
    if (f.finalSeason) return fail('renewal.retiring', 'The fighter has announced his final season');
  } else {
    if (trialsClubOf(state, f.id) !== req.clubId) return fail('trials.not-yours', 'Not a trials rookie of this club');
    if (at.weekIndex > e.market.trialsDay.exclusiveWeeks) return fail('trials.closed', 'Trials Day is over');
  }
  if (patienceLeft(state, key, nkind, at.season, content) <= 0) {
    return req.kind === 'renewal'
      ? fail('renewal.will-not-renew', 'He will not renew this season')
      : fail('offer.will-not-deal', 'He will not deal with this club again this season');
  }

  const pending = pendingOffersOf(state, req.clubId).filter((o) => !exclude || !sameKey(o, exclude));
  if (req.kind === 'free-agent' && pending.length >= e.market.maxPendingOffersPerClub) {
    return fail('offer.max-pending', `At most ${e.market.maxPendingOffersPerClub} pending offers`, { max: e.market.maxPendingOffersPerClub });
  }

  // ---- embargo (03 sys-finance status ladder 2)
  const embargoed = club.finance.status === 'embargo';
  if (embargoed) {
    if (req.kind === 'trials') return fail('embargo.trials', 'No trials signings while under embargo');
    if (req.wagePerWeek > profile.tierMinWage) return fail('embargo.wage', `Only the tier minimum ${profile.tierMinWage} while under embargo`, { tierMinWage: profile.tierMinWage });
    if (req.kind === 'free-agent') {
      if (req.seasons !== 1) return fail('embargo.length', 'Only one-season deals while under embargo');
      const fit = rosterOf(state, req.clubId).filter((x) => fighterIsFit(x)).length;
      if (fit >= 5) return fail('embargo.roster', 'Free-agent signings under embargo only with fewer than 5 fit fighters', { fit });
    }
  }

  // ---- roster cap (O2): roster + pending + 1 <= cap
  if (req.kind !== 'renewal') {
    const roster = rosterOf(state, req.clubId).length;
    const cap = tierOf(club, content).rosterCap;
    if (roster + pending.length + 1 > cap) {
      return fail('roster.full', `Roster full with pending offers (${roster} + ${pending.length} of ${cap})`, { roster, pending: pending.length, cap });
    }
  }

  // ---- hard commitment rule: bill + pending + new − replaced <= WB, or the change does not raise the bill
  const bill = committedBillOf(state, req.clubId);
  const pendingWages = pending.reduce((s, o) => s + o.wagePerWeek, 0);
  const replaced = req.kind === 'renewal' ? (f.contract?.wagePerWeek ?? 0) : 0;
  const committed = bill + pendingWages + req.wagePerWeek - replaced;
  const wb = club.finance.wageBudgetPerWeek;
  if (req.wagePerWeek > replaced && committed > wb) {
    return fail('budget.wage', `Over wage budget by ${committed - wb} per week`, { over: committed - wb, wageBudget: wb, committed });
  }

  // ---- signing cost against cash: balance − pending signing costs >= cost
  let signingCost: number;
  if (req.kind === 'renewal') signingCost = renewalSigningCost(req.wagePerWeek, req.seasons, content);
  else if (req.kind === 'trials') signingCost = trialsSigningCost(req.wagePerWeek, req.seasons, at.weekIndex, content);
  else signingCost = embargoed ? 0 : freeAgentSigningCost(req.wagePerWeek, req.seasons, at.weekIndex, content);
  if (signingCost > 0) {
    const reserved = pending.reduce((s, o) => s + pendingOfferCost(state, o, at, content), 0);
    const available = club.finance.balance - reserved;
    if (available < signingCost) {
      return fail('budget.cash', `Signing cost ${signingCost} exceeds available ${available}`, { signingCost, available });
    }
  }
  return ok({ signingCost, wageRoomAfter: wb - Math.max(committed, bill + pendingWages) });
}

/** floor5(ask × offerCap ÷ 10,000): the most a fighter will be paid. */
function offerCap(ask: number, content: ContentDB): number {
  return floorTo(mulDiv(ask, content.economy.negotiation.offerCapBpOfAsk, BP), content.economy.wage.roundDownToMultiple);
}

function counterPrice(offer: number, required: number, content: ContentDB): number {
  return floorTo(Math.trunc((offer + required) / 2), content.economy.wage.roundDownToMultiple);
}

// ---- signing --------------------------------------------------------------------------------------------

function signContract(draft: GameState, f: Fighter, clubId: ClubId, wage: number, seasons: number, at: GameTime): void {
  f.contract = {
    clubId,
    wagePerWeek: wage,
    startSeason: at.season,
    endSeason: at.season + seasons - 1,
    signedAt: { season: at.season, weekIndex: at.weekIndex },
    dropClauseApplied: false,
  };
  f.clubId = clubId;
  f.status = 'active';
  f.freeAgency = null;
  draft.market.offers = draft.market.offers.filter((o) => o.fighterId !== f.id);
  for (const ids of Object.values(draft.market.trialsRookies)) {
    const i = ids?.indexOf(f.id) ?? -1;
    if (ids && i >= 0) ids.splice(i, 1);
  }
}

// ---- commands -----------------------------------------------------------------------------------------------

export function makeOfferImpl(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: number; seasons: number; acceptCounter: boolean },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  const at = marketTime(draft);
  const f = draft.fighters[offer.fighterId];
  if (!draft.clubs[offer.clubId]) return fail('club.unknown', `Unknown club ${offer.clubId}`);
  if (!f) return fail('fighter.unknown', `Unknown fighter ${offer.fighterId}`);
  const key = { clubId: offer.clubId, fighterId: offer.fighterId };
  let wage = offer.wagePerWeek;
  if (offer.acceptCounter) {
    const counter = validCounter(draft, key, 'free-agent', at);
    if (counter === null) return fail('offer.no-counter', 'No valid counter from this fighter');
    wage = counter;
  } else if (content.economy.contracts.lengthsSeasons.includes(offer.seasons)) {
    wage = Math.min(wage, offerCap(askOf(draft, f, offer.clubId, offer.seasons, content), content));
  }
  const check = evaluateOffer(draft, { ...key, wagePerWeek: wage, seasons: offer.seasons, kind: 'free-agent' }, content, at);
  if (!check.ok) return check;
  draft.market.offers = draft.market.offers.filter((o) => !sameKey(o, key));
  draft.market.offers.push({
    clubId: offer.clubId,
    fighterId: offer.fighterId,
    wagePerWeek: wage,
    seasons: offer.seasons,
    madeAt: { season: at.season, weekIndex: at.weekIndex },
    isCounterAcceptance: offer.acceptCounter,
  });
  return ok({ kind: 'pending' });
}

export function withdrawOfferImpl(draft: GameState, clubId: ClubId, fighterId: FighterId): Result<void, EngineError> {
  const before = draft.market.offers.length;
  draft.market.offers = draft.market.offers.filter((o) => !(o.clubId === clubId && o.fighterId === fighterId));
  if (draft.market.offers.length === before) return fail('offer.not-found', 'No pending offer to withdraw');
  return ok(undefined);
}

/** Instant answer shared by renewals and trials signings (one offer, one counter). */
function instantAnswer(
  draft: GameState,
  req: OfferRequest,
  content: ContentDB,
  onAccept: (wage: number, signingCost: number, at: GameTime) => void,
): Result<OfferResponse, EngineError> {
  const at = marketTime(draft);
  const f = draft.fighters[req.fighterId];
  if (!draft.clubs[req.clubId]) return fail('club.unknown', `Unknown club ${req.clubId}`);
  if (!f) return fail('fighter.unknown', `Unknown fighter ${req.fighterId}`);
  if (!content.economy.contracts.lengthsSeasons.includes(req.seasons)) {
    return fail('offer.length', `Contract length ${req.seasons} is not one of ${content.economy.contracts.lengthsSeasons.join('/')}`);
  }
  const key = { clubId: req.clubId, fighterId: req.fighterId };
  const nkind = negotiationKind(req.kind);
  const ask = askOf(draft, f, req.clubId, req.seasons, content);
  const wage = Math.min(req.wagePerWeek, offerCap(ask, content));
  const check = evaluateOffer(draft, { ...req, wagePerWeek: wage }, content, at);
  if (!check.ok) return check;
  const required = validCounter(draft, key, nkind, at) ?? ask;
  const ratio = mulDiv(wage, BP, required);
  const n = ensureNegotiation(draft, key, nkind, at.season, content);
  if (wage >= required) {
    n.counterWage = null;
    n.validUntilWeek = null;
    onAccept(wage, check.value.signingCost, at);
    return ok({ kind: 'accepted', wagePerWeek: wage, seasons: req.seasons });
  }
  if (ratio >= BP - greedLabel(f.contractProfile.greedBp, content).flexBp) {
    const counterWage = counterPrice(wage, required, content);
    // Valid until the end of the next week processing, which is this week's.
    const validUntilWeek = at.weekIndex + content.economy.negotiation.counterValidWeekProcessings - 1;
    n.counterWage = counterWage;
    n.validUntilWeek = validUntilWeek;
    return ok({ kind: 'countered', counterWage, validUntilWeek });
  }
  n.patienceLeft = Math.max(0, n.patienceLeft - 1);
  return ok({ kind: 'refused', reason: n.patienceLeft === 0 ? (req.kind === 'renewal' ? 'will-not-renew' : 'will-not-deal') : 'low-offer' });
}

export function renewContractImpl(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: number; seasons: number },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  return instantAnswer(draft, { ...offer, kind: 'renewal' }, content, (wage, cost, at) => {
    const f = draft.fighters[offer.fighterId]!;
    const contract = f.contract!;
    if (cost > 0) postAt(draft, { clubId: offer.clubId, amount: -cost, category: 'signingCost', fighterId: f.id }, commandStamp(draft));
    contract.endSeason += offer.seasons;
    contract.signedAt = { season: at.season, weekIndex: at.weekIndex };
    // Agreed terms start at next-season setup; the old wage continues until then.
    const n = ensureNegotiation(draft, offer, 'renewal', at.season, content);
    n.counterWage = wage;
    n.validUntilWeek = null;
  });
}

export function signTrialsRookieImpl(
  draft: GameState,
  offer: { clubId: ClubId; fighterId: FighterId; wagePerWeek: number; seasons: number },
  content: ContentDB,
): Result<OfferResponse, EngineError> {
  return instantAnswer(draft, { ...offer, kind: 'trials' }, content, (wage, cost, at) => {
    const f = draft.fighters[offer.fighterId]!;
    if (cost > 0) postAt(draft, { clubId: offer.clubId, amount: -cost, category: 'signingCost', fighterId: f.id }, commandStamp(draft));
    signContract(draft, f, offer.clubId, wage, offer.seasons, at);
  });
}

/** Remaining contract wages from this week's processing (inclusive) to the contract's end. */
export function remainingContractWages(state: GameState, f: Fighter, content: ContentDB): number {
  if (!f.contract) return 0;
  const at = marketTime(state);
  const thisSeason = remainingWeeksInclusive(at.weekIndex, content) * f.contract.wagePerWeek;
  const futureSeasons = Math.max(0, f.contract.endSeason - at.season);
  const agreed = agreedRenewal(state, f.id);
  const futureWage = agreed && agreed.clubId === f.contract.clubId ? agreed.wagePerWeek : f.contract.wagePerWeek;
  return thisSeason + futureSeasons * weeksPerSeason(content) * futureWage;
}

/** Cap relief (after relegation): payout-free releases while over the cap, P1 to the Kick off week. */
export function capReliefAllowance(state: GameState, clubId: ClubId, content: ContentDB): number {
  const c = content.economy.contracts.capRelief;
  if (!c.enabled) return 0;
  if (marketTime(state).weekIndex > kickOffWeekIndex(content)) return 0;
  const club = requireClub(state, clubId);
  return Math.max(0, rosterOf(state, clubId).length - tierOf(club, content).rosterCap);
}

/** Payout a release would cost now. */
export function releasePayoutOf(state: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): number {
  const f = state.fighters[fighterId];
  if (!f || f.clubId !== clubId || f.status !== 'active') return 0;
  const c = content.economy.contracts;
  const bp = capReliefAllowance(state, clubId, content) > 0 ? c.capRelief.payoutBp : c.releasePayoutBp;
  return floorTo(mulDiv(remainingContractWages(state, f, content), bp, BP), c.releasePayoutRoundDownTo);
}

export function releaseFighterImpl(draft: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): Result<{ payout: number }, EngineError> {
  if (!draft.clubs[clubId]) return fail('club.unknown', `Unknown club ${clubId}`);
  const f = draft.fighters[fighterId];
  if (!f) return fail('fighter.unknown', `Unknown fighter ${fighterId}`);
  if (f.clubId !== clubId || f.status !== 'active') return fail('release.not-own', 'Not on this club roster');
  const payout = releasePayoutOf(draft, clubId, fighterId, content);
  const at = marketTime(draft);
  postAt(draft, { clubId, amount: -payout, category: 'releasePayout', fighterId }, commandStamp(draft));
  f.clubId = null;
  f.status = 'free-agent';
  f.contract = null;
  f.freeAgency = { unsignedSeasonEnds: 0, formerClubId: clubId, releasedByClubId: clubId, releasedSeason: at.season };
  draft.market.releasedThisSeason.push({ fighterId, clubId });
  draft.market.negotiations = draft.market.negotiations.filter((n) => !(n.fighterId === fighterId && n.kind === 'renewal'));
  return ok({ payout });
}

// ---- week processing step 8: free agents answer ------------------------------------------------------------

interface Candidate {
  offer: Offer;
  required: number;
  ratio: number;
  score: number;
  acceptable: boolean;
  prestige: number;
  tierLevel: number;
  lot: number;
}

export function resolveFreeAgentOffersImpl(draft: GameState, content: ContentDB): NewsId[] {
  const news: NewsId[] = [];
  const at = processingStamp(draft);
  const e = content.economy;
  const byFighter = new Map<FighterId, Offer[]>();
  for (const o of draft.market.offers) {
    const list = byFighter.get(o.fighterId);
    if (list) list.push(o);
    else byFighter.set(o.fighterId, [o]);
  }
  const order = [...byFighter.keys()].map((id) => {
    const f = draft.fighters[id];
    return { id, wage: f ? marketWageOf(f, content) : 0 };
  });
  order.sort((a, b) => b.wage - a.wage || compareFighterIds(a.id, b.id));

  for (const { id } of order) {
    const offers = (byFighter.get(id) ?? []).slice().sort((a, b) => {
      const ca = requireClub(draft, a.clubId);
      const cb = requireClub(draft, b.clubId);
      return tierOf(ca, content).level - tierOf(cb, content).level || compareStrings(a.clubId, b.clubId);
    });
    const removeAll = (): void => {
      draft.market.offers = draft.market.offers.filter((o) => o.fighterId !== id);
    };
    const f = draft.fighters[id];
    if (!f || !isInPool(draft, f)) {
      for (const o of offers) pushNews(news, addClubNews(draft, { key: 'offer.void', clubId: o.clubId, fighterId: id, params: { reason: 'fighter.unavailable' } }));
      removeAll();
      continue;
    }
    const lotRng = Rng.create(draft.rng.root, STREAM.market, at.season, at.weekIndex, id, 'lot');
    const refusedByPatience: Offer[] = [];
    const candidates: Candidate[] = [];
    for (const o of offers) {
      const lot = lotRng.nextU32();
      const key = { clubId: o.clubId, fighterId: id };
      if (patienceLeft(draft, key, 'free-agent', at.season, content) <= 0) {
        refusedByPatience.push(o);
        continue;
      }
      const club = requireClub(draft, o.clubId);
      const required = validCounter(draft, key, 'free-agent', at) ?? askOf(draft, f, o.clubId, o.seasons, content);
      const ratio = mulDiv(o.wagePerWeek, BP, required);
      const score = ratio + (wouldStart(draft, f, o.clubId, content) ? e.market.starterBonusBp : 0);
      candidates.push({
        offer: o,
        required,
        ratio,
        score,
        acceptable: o.wagePerWeek >= required,
        prestige: club.prestige,
        tierLevel: tierOf(club, content).level,
        lot,
      });
    }
    candidates.sort((a, b) => b.score - a.score || b.prestige - a.prestige || a.tierLevel - b.tierLevel || a.lot - b.lot);
    const voided = new Set<Candidate>();
    let winner: Candidate | null = null;
    for (const c of candidates) {
      if (!c.acceptable) continue;
      const check = evaluateOffer(draft, { clubId: c.offer.clubId, fighterId: id, wagePerWeek: c.offer.wagePerWeek, seasons: c.offer.seasons, kind: 'free-agent' }, content, at);
      if (!check.ok) {
        voided.add(c);
        pushNews(news, addClubNews(draft, { key: 'offer.void', clubId: c.offer.clubId, fighterId: id, params: { reason: check.error.code } }));
        continue;
      }
      winner = c;
      if (check.value.signingCost > 0) {
        postAt(draft, { clubId: c.offer.clubId, amount: -check.value.signingCost, category: 'signingCost', fighterId: id }, at);
      }
      signContract(draft, f, c.offer.clubId, c.offer.wagePerWeek, c.offer.seasons, at);
      pushNews(news, addClubNews(draft, { key: 'offer.accepted', clubId: c.offer.clubId, fighterId: id, params: { wage: c.offer.wagePerWeek, seasons: c.offer.seasons }, importance: 'notable' }));
      break;
    }
    const refuse = (o: Offer): void => {
      const n = ensureNegotiation(draft, { clubId: o.clubId, fighterId: id }, 'free-agent', at.season, content);
      n.patienceLeft = Math.max(0, n.patienceLeft - 1);
      draft.market.refusalsThisSeason[o.clubId] = (draft.market.refusalsThisSeason[o.clubId] ?? 0) + 1;
      pushNews(news, addClubNews(draft, { key: 'offer.refused', clubId: o.clubId, fighterId: id, params: { patienceLeft: n.patienceLeft } }));
    };
    if (winner) {
      for (const c of candidates) {
        if (c === winner || voided.has(c)) continue;
        pushNews(news, addClubNews(draft, { key: 'offer.lost', clubId: c.offer.clubId, fighterId: id, otherClubId: winner.offer.clubId }));
      }
      for (const o of refusedByPatience) pushNews(news, addClubNews(draft, { key: 'offer.lost', clubId: o.clubId, fighterId: id, otherClubId: winner.offer.clubId }));
    } else {
      const flex = greedLabel(f.contractProfile.greedBp, content).flexBp;
      const live = candidates.filter((c) => !voided.has(c));
      const countered = live.find((c) => c.ratio >= BP - flex) ?? null;
      for (const c of live) {
        if (c === countered) {
          const n = ensureNegotiation(draft, { clubId: c.offer.clubId, fighterId: id }, 'free-agent', at.season, content);
          n.counterWage = counterPrice(c.offer.wagePerWeek, c.required, content);
          n.validUntilWeek = at.weekIndex + e.negotiation.counterValidWeekProcessings;
          pushNews(news, addClubNews(draft, { key: 'offer.countered', clubId: c.offer.clubId, fighterId: id, params: { counterWage: n.counterWage, validUntilWeek: n.validUntilWeek }, importance: 'notable' }));
        } else refuse(c.offer);
      }
      for (const o of refusedByPatience) pushNews(news, addClubNews(draft, { key: 'offer.refused', clubId: o.clubId, fighterId: id, params: { patienceLeft: 0 } }));
    }
    removeAll();
  }
  return news;
}

/** Number of pending offers on a fighter from other clubs ("rival offers: n"). */
export function rivalOfferCount(state: GameState, fighterId: FighterId, exceptClubId: ClubId | null): number {
  return state.market.offers.filter((o) => o.fighterId === fighterId && o.clubId !== exceptClubId).length;
}
