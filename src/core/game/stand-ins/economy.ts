/**
 * STAND-IN for core/economy (WP4): a ledger that keeps the balance invariant,
 * a flat wage curve, simple offers answered at processing, wages, gate,
 * retainer, grants and table prizes. Test and pre-integration use only.
 */
import type { ContentDB } from '../../content';
import type { OfferCheck, PostEntry } from '../../economy';
import type { ClubId, FighterId, GameState, LedgerEntry, OfferResponse, SeasonRecord } from '../../model';
import { clamp, engineError, err, ok } from '../../util';
import type { GamePorts } from '../ports';

type Port = GamePorts['economy'];

const BP = 10000;
/** development.json retirement.unsignedSeasonEndsBeforeLeaving in the real module; fixed here. */
const UNSIGNED_SEASON_ENDS_BEFORE_LEAVING = 2;

function profile(state: GameState, clubId: ClubId, content: ContentDB) {
  return content.tierProfile(content.tiers.require(state.clubs[clubId]!.tierId).level);
}

function cap(state: GameState, clubId: ClubId, content: ContentDB): number {
  return content.tiers.require(state.clubs[clubId]!.tierId).rosterCap;
}

function rosterCount(state: GameState, clubId: ClubId): number {
  let n = 0;
  for (const f of Object.values(state.fighters)) if (f.clubId === clubId && f.status === 'active') n++;
  return n;
}

function weeks(content: ContentDB): number {
  return content.leagues.calendar.weeks.length;
}

export function makeStandInEconomy(fighters: GamePorts['fighters']): Port {
  const post = (draft: GameState, e: PostEntry): void => {
    const entry: LedgerEntry = { seq: draft.ledger.nextSeq++, season: draft.calendar.season, weekIndex: draft.calendar.weekIndex, clubId: e.clubId, amount: e.amount, category: e.category };
    if (e.fighterId !== undefined) entry.fighterId = e.fighterId;
    if (e.fixtureId !== undefined) entry.fixtureId = e.fixtureId as LedgerEntry['fixtureId'];
    draft.ledger.entries.push(entry);
    draft.clubs[e.clubId]!.finance.balance += e.amount;
  };
  const wageBill = (state: GameState, clubId: ClubId): number => {
    let s = 0;
    for (const f of Object.values(state.fighters)) if (f.clubId === clubId && f.status === 'active' && f.contract) s += f.contract.wagePerWeek;
    return s;
  };
  const pendingWages = (state: GameState, clubId: ClubId): number => {
    let s = 0;
    for (const o of state.market.offers) if (o.clubId === clubId) s += o.wagePerWeek;
    return s;
  };
  const marketWage = (state: GameState, fighterId: FighterId, content: ContentDB): number => {
    const r = fighters.rating(state.fighters[fighterId]!, content);
    const anchors = content.economy.wage.curveAnchors;
    let w = anchors[0]![1]!;
    for (let i = 0; i + 1 < anchors.length; i++) {
      const [r0, w0] = anchors[i] as [number, number];
      const [r1, w1] = anchors[i + 1] as [number, number];
      if (r >= r0 && r <= r1) w = w0 + Math.trunc(((w1 - w0) * (r - r0)) / (r1 - r0));
    }
    return Math.floor(w / 5) * 5;
  };
  const ask = (state: GameState, fighterId: FighterId, clubId: ClubId, seasons: number, content: ContentDB): number => {
    const base = marketWage(state, fighterId, content);
    const adj = 500 * Math.abs(seasons - 2);
    return clamp(Math.floor((base * (BP + adj)) / BP / 5) * 5, profile(state, clubId, content).tierMinWage, content.economy.wage.maxWeeklyWage);
  };
  const remainingWeeks = (state: GameState, seasons: number, content: ContentDB): number =>
    Math.max(1, weeks(content) - state.calendar.weekIndex) + (seasons - 1) * weeks(content);
  const signingCost = (state: GameState, wage: number, seasons: number, kind: string, content: ContentDB): number => {
    if (kind === 'trials') return 0;
    return Math.floor((wage * remainingWeeks(state, seasons, content) * content.economy.contracts.signingCostBp) / BP / 10) * 10;
  };
  const checkOffer: Port['checkOffer'] = (state, offer, content) => {
    const club = state.clubs[offer.clubId];
    const f = state.fighters[offer.fighterId];
    if (!club || !f) return err(engineError('offer.unknown', 'unknown club or fighter'));
    const existing = state.market.offers.find((o) => o.clubId === offer.clubId && o.fighterId === offer.fighterId);
    if (offer.kind !== 'renewal') {
      const pending = state.market.offers.filter((o) => o.clubId === offer.clubId && o.fighterId !== offer.fighterId).length;
      if (rosterCount(state, offer.clubId) + pending + 1 > cap(state, offer.clubId, content)) return err(engineError('offer.cap', 'roster full'));
    }
    if (club.finance.status === 'embargo' && offer.wagePerWeek > profile(state, offer.clubId, content).tierMinWage) return err(engineError('offer.embargo', 'embargo'));
    const replaced = offer.kind === 'renewal' ? (f.contract?.wagePerWeek ?? 0) : (existing?.wagePerWeek ?? 0);
    const room = club.finance.wageBudgetPerWeek - (wageBill(state, offer.clubId) + pendingWages(state, offer.clubId) - replaced + offer.wagePerWeek);
    if (room < 0 && offer.wagePerWeek > replaced) return err(engineError('offer.wage-budget', `over wage budget by ${-room}`));
    const cost = signingCost(state, offer.wagePerWeek, offer.seasons, offer.kind, content);
    if (club.finance.balance < cost) return err(engineError('offer.cash', 'signing cost exceeds balance'));
    const out: OfferCheck = { signingCost: cost, wageRoomAfter: room };
    return ok(out);
  };
  const sign = (draft: GameState, clubId: ClubId, fighterId: FighterId, wage: number, seasons: number): void => {
    const f = draft.fighters[fighterId]!;
    const season = draft.calendar.season;
    f.clubId = clubId;
    f.status = 'active';
    f.freeAgency = null;
    f.contract = { clubId, wagePerWeek: wage, startSeason: season, endSeason: season + seasons - 1, signedAt: { season, weekIndex: draft.calendar.weekIndex }, dropClauseApplied: false };
  };
  const makeOffer: Port['makeOffer'] = (draft, offer, content) => {
    const check = checkOffer(draft, { ...offer, kind: 'free-agent' }, content);
    if (!check.ok) return check;
    const others = draft.market.offers.filter((o) => o.clubId === offer.clubId && o.fighterId !== offer.fighterId);
    if (others.length >= content.economy.market.maxPendingOffersPerClub) return err(engineError('offer.too-many', 'too many pending offers'));
    draft.market.offers = draft.market.offers.filter((o) => !(o.clubId === offer.clubId && o.fighterId === offer.fighterId));
    draft.market.offers.push({
      clubId: offer.clubId,
      fighterId: offer.fighterId,
      wagePerWeek: offer.wagePerWeek,
      seasons: offer.seasons,
      madeAt: { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex },
      isCounterAcceptance: offer.acceptCounter,
    });
    return ok({ kind: 'pending' });
  };
  const releaseFighter: Port['releaseFighter'] = (draft, clubId, fighterId, content) => {
    const f = draft.fighters[fighterId];
    if (!f || f.clubId !== clubId || !f.contract) return err(engineError('release.not-on-roster', 'not on roster'));
    const relief = draft.calendar.phase === 'preseason' && rosterCount(draft, clubId) > cap(draft, clubId, content);
    const left = Math.max(0, weeks(content) - draft.calendar.weekIndex + 1) + (f.contract.endSeason - draft.calendar.season) * weeks(content);
    const payout = relief ? 0 : Math.floor((f.contract.wagePerWeek * left * content.economy.contracts.releasePayoutBp) / BP / 10) * 10;
    if (payout > 0) post(draft, { clubId, amount: -payout, category: 'releasePayout', fighterId });
    f.clubId = null;
    f.contract = null;
    f.status = 'free-agent';
    f.freeAgency = { unsignedSeasonEnds: 0, formerClubId: clubId, releasedByClubId: clubId, releasedSeason: draft.calendar.season };
    draft.market.releasedThisSeason.push({ fighterId, clubId });
    return ok({ payout });
  };
  const playedThisWeek = (state: GameState) =>
    Object.values(state.results).filter((r) => r.season === state.calendar.season && r.weekIndex === state.calendar.weekIndex);
  const budgets = (draft: GameState, content: ContentDB): void => {
    for (const club of Object.values(draft.clubs)) {
      const p = profile(draft, club.id, content);
      club.finance.seasonBudget = p.centralGrant + p.sponsorRetainerBase + 8 * p.gateBase;
      club.finance.wageBudgetPerWeek = Math.trunc((club.finance.seasonBudget * p.wageRatioBp) / BP / weeks(content));
    }
  };
  const resetSeasonLedger = (draft: GameState, content: ContentDB): void => {
    draft.ledger.entries = [];
    for (const club of Object.values(draft.clubs)) draft.ledger.openingBalances[club.id] = club.finance.balance;
    budgets(draft, content);
    for (const club of Object.values(draft.clubs)) post(draft, { clubId: club.id, amount: Math.trunc(profile(draft, club.id, content).centralGrant / 2), category: 'centralGrant' });
  };

  return {
    post,
    wageBill,
    pendingWages,
    marketWage,
    ask,
    checkOffer,
    makeOffer,
    withdrawOffer: (draft, clubId, fighterId) => {
      const before = draft.market.offers.length;
      draft.market.offers = draft.market.offers.filter((o) => !(o.clubId === clubId && o.fighterId === fighterId));
      return before === draft.market.offers.length ? err(engineError('offer.none', 'no pending offer')) : ok(undefined);
    },
    renewContract: (draft, offer, content) => {
      const f = draft.fighters[offer.fighterId]!;
      if (!f.contract || f.contract.endSeason !== draft.calendar.season) return err(engineError('renew.not-final-season', 'not in final season'));
      const check = checkOffer(draft, { ...offer, kind: 'renewal' }, content);
      if (!check.ok) return check;
      const a = ask(draft, offer.fighterId, offer.clubId, offer.seasons, content);
      if (offer.wagePerWeek * BP < a * 9000) return ok<OfferResponse>({ kind: 'refused', reason: 'below ask' });
      if (check.value.signingCost > 0) post(draft, { clubId: offer.clubId, amount: -check.value.signingCost, category: 'signingCost', fighterId: offer.fighterId });
      f.contract.endSeason = draft.calendar.season + offer.seasons;
      f.contract.wagePerWeek = offer.wagePerWeek;
      return ok<OfferResponse>({ kind: 'accepted', wagePerWeek: offer.wagePerWeek, seasons: offer.seasons });
    },
    signTrialsRookie: (draft, offer, content) => {
      const list = draft.market.trialsRookies[offer.clubId] ?? [];
      if (!list.includes(offer.fighterId) || draft.calendar.weekIndex !== 1) return err(engineError('trials.closed', 'not a trials rookie now'));
      const check = checkOffer(draft, { ...offer, kind: 'trials' }, content);
      if (!check.ok) return check;
      sign(draft, offer.clubId, offer.fighterId, offer.wagePerWeek, offer.seasons);
      draft.market.trialsRookies[offer.clubId] = list.filter((id) => id !== offer.fighterId);
      return ok<OfferResponse>({ kind: 'accepted', wagePerWeek: offer.wagePerWeek, seasons: offer.seasons });
    },
    releaseFighter,
    assignHiredBlades: (draft, content) => {
      const out: Record<ClubId, FighterId[]> = {};
      const fixtures = Object.values(draft.fixtures).filter((x) => x.season === draft.calendar.season && x.weekIndex === draft.calendar.weekIndex && x.status === 'scheduled');
      for (const x of fixtures) {
        for (const clubId of [x.homeClubId, x.awayClubId]) {
          let fit = 0;
          for (const f of Object.values(draft.fighters)) if (f.clubId === clubId && f.status === 'active' && fighters.isFit(f)) fit++;
          const ids: FighterId[] = [];
          const tier = content.tiers.require(draft.clubs[clubId]!.tierId);
          for (let i = fit; i < 5; i++) {
            ids.push(fighters.createFighter(draft, { kind: 'hired-blade', potentialShift: 0, regionId: draft.clubs[clubId]!.regionId, ratingTarget: tier.ratingBand.min }, content));
            post(draft, { clubId, amount: -profile(draft, clubId, content).tierMinWage, category: 'hiredBlades' });
          }
          if (ids.length > 0) out[clubId] = ids;
        }
      }
      return out;
    },
    weeklyIncome: (draft, content) => {
      for (const club of Object.values(draft.clubs)) {
        const p = profile(draft, club.id, content);
        post(draft, { clubId: club.id, amount: Math.trunc(p.sponsorRetainerBase / weeks(content)), category: 'sponsorRetainer' });
        if (draft.calendar.weekId === 'MW8') post(draft, { clubId: club.id, amount: Math.trunc(p.centralGrant / 2), category: 'centralGrant' });
      }
      for (const r of playedThisWeek(draft)) {
        post(draft, { clubId: r.homeClubId, amount: profile(draft, r.homeClubId, content).gateBase, category: 'gate', fixtureId: r.fixtureId });
        post(draft, { clubId: r.winnerClubId, amount: profile(draft, r.winnerClubId, content).sponsorWinBonus, category: 'sponsorWinBonus', fixtureId: r.fixtureId });
      }
    },
    weeklyCosts: (draft, content) => {
      for (const club of Object.values(draft.clubs)) {
        const bill = wageBill(draft, club.id);
        if (bill > 0) post(draft, { clubId: club.id, amount: -bill, category: 'wages' });
        post(draft, { clubId: club.id, amount: -profile(draft, club.id, content).opsCostPerWeek, category: 'operations' });
      }
    },
    financialStatus: (draft) => {
      for (const club of Object.values(draft.clubs)) {
        const f = club.finance;
        f.status = f.balance < 0 ? 'embargo' : 'healthy';
        f.debtWeeks = f.balance < 0 ? f.debtWeeks + 1 : 0;
      }
      return [];
    },
    releaseTrialsRookies: (draft) => {
      draft.market.trialsRookies = {};
    },
    resolveFreeAgentOffers: (draft, content) => {
      const byFighter = new Map<FighterId, typeof draft.market.offers>();
      for (const o of draft.market.offers) byFighter.set(o.fighterId, [...(byFighter.get(o.fighterId) ?? []), o]);
      const ids = [...byFighter.keys()].sort((a, b) => marketWage(draft, b, content) - marketWage(draft, a, content) || (a < b ? -1 : 1));
      for (const fid of ids) {
        const f = draft.fighters[fid];
        if (!f || f.status !== 'free-agent') continue;
        const offers = [...byFighter.get(fid)!].sort((a, b) => b.wagePerWeek - a.wagePerWeek || (a.clubId < b.clubId ? -1 : 1));
        for (const o of offers) {
          if (o.wagePerWeek < ask(draft, fid, o.clubId, o.seasons, content)) continue;
          const check = checkOffer(draft, { clubId: o.clubId, fighterId: fid, wagePerWeek: o.wagePerWeek, seasons: o.seasons, kind: 'free-agent' }, content);
          if (!check.ok) continue;
          sign(draft, o.clubId, fid, o.wagePerWeek, o.seasons);
          if (check.value.signingCost > 0) post(draft, { clubId: o.clubId, amount: -check.value.signingCost, category: 'signingCost', fighterId: fid });
          break;
        }
      }
      draft.market.offers = [];
      return [];
    },
    topUpFreeAgentPool: (draft, content) => {
      let pool = Object.values(draft.fighters).filter((f) => f.status === 'free-agent').length;
      const region = Object.values(draft.clubs)[0]?.regionId;
      if (!region) return;
      while (pool < content.economy.market.pool.inSeasonFloor) {
        fighters.createFighter(draft, { kind: 'journeyman', potentialShift: content.leagues.generationShifts.generatedFreeAgent, regionId: region }, content);
        pool++;
      }
    },
    seasonPrizes: (draft, record: SeasonRecord, content) => {
      for (const t of record.tiers) {
        const top = content.tierProfile(content.tiers.require(t.tierId).level).tablePrizeTop;
        for (const row of t.tierTable) {
          const amount = Math.floor((top * (17 - row.position)) / 16 / 10) * 10;
          if (amount > 0) post(draft, { clubId: row.clubId, amount, category: 'tablePrize' });
        }
      }
    },
    updatePrestige: () => undefined,
    contractExpiries: (draft) => {
      const out: FighterId[] = [];
      for (const f of Object.values(draft.fighters)) {
        if (f.status !== 'active' || !f.contract || f.contract.endSeason > draft.calendar.season) continue;
        const former = f.clubId;
        f.clubId = null;
        f.contract = null;
        f.status = 'free-agent';
        f.freeAgency = { unsignedSeasonEnds: 0, formerClubId: former, releasedByClubId: null, releasedSeason: null };
        out.push(f.id);
      }
      return out;
    },
    poolMaintenance: (draft) => {
      const out: FighterId[] = [];
      for (const f of Object.values(draft.fighters)) {
        if (f.status !== 'free-agent' || !f.freeAgency) continue;
        f.freeAgency.unsignedSeasonEnds += 1;
        if (f.freeAgency.unsignedSeasonEnds >= UNSIGNED_SEASON_ENDS_BEFORE_LEAVING) {
          f.status = 'retired';
          out.push(f.id);
        }
      }
      return out;
    },
    nextSeasonFinanceSetup: (draft, rookieIds, content) => {
      resetSeasonLedger(draft, content);
      draft.market.trialsRookies = {};
      const clubs = Object.keys(draft.clubs).sort() as ClubId[];
      rookieIds.forEach((id, i) => {
        const c = clubs[i % clubs.length]!;
        (draft.market.trialsRookies[c] ??= []).push(id);
      });
      draft.market.refusalsThisSeason = {};
      draft.market.releasedThisSeason = [];
      draft.market.negotiations = [];
    },
    initialFinances: (draft, content) => {
      for (const club of Object.values(draft.clubs)) club.finance.balance = profile(draft, club.id, content).startingBalanceBase;
      resetSeasonLedger(draft, content);
    },
    rollContractProfile: () => undefined,
  };
}

