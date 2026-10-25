/**
 * Market wage and asks (03-league-economy sys-contracts; economy.json wage,
 * ask). Pure. Rating, potential and human-age come from core/fighters
 * through the adapter. Every term is integer bp; each formula truncates once
 * at its end, then wages and asks floor to a multiple of 5.
 */
import type { ContentDB, TraitDef } from '../content';
import { fractionToBp } from '../content';
import type { ClubId, Fighter, FighterId, GameState } from '../model';
import { clamp } from '../util';
import { fighterHumanAge, fighterPotential, fighterRating } from './fighter-values';
import { floorTo, interpolate, mulDiv, stepLookup } from './math';
import { requireClub, requireFighter, tierOf } from './queries';
import { marketTime } from './time';

const BP = 10_000;

function traitDefs(fighter: Fighter, content: ContentDB): TraitDef[] {
  const out: TraitDef[] = [];
  for (const t of fighter.traits) {
    const def = content.traits.get(t.id);
    if (def) out.push(def);
  }
  return out;
}

/** Sum of an economy hook's `add` over a fighter's traits (fanAppeal, loyalty). */
export function economyHookPoints(traitIds: readonly string[], hook: 'fanAppeal' | 'loyalty', content: ContentDB): number {
  let total = 0;
  for (const id of traitIds) {
    const def = content.traits.get(id);
    if (!def) continue;
    for (const e of def.effects) if (e.type === 'economy' && e.hook === hook) total += e.add ?? 0;
  }
  return total;
}

/** wageDemand = Σ (mult − 1) × 10,000 over wageDemandMult hooks (exact bp). */
function wageDemandBp(fighter: Fighter, content: ContentDB): number {
  let total = 0;
  for (const def of traitDefs(fighter, content)) {
    for (const e of def.effects) {
      if (e.type === 'economy' && e.hook === 'wageDemandMult' && e.mult !== undefined) total += fractionToBp(e.mult) - BP;
    }
  }
  return total;
}

export interface MarketWageDetails {
  rating: number;
  potential: number;
  humanAge: number;
  /** Equivalent quality (rating + capped upside × potential weight). */
  eq: number;
  curve: number;
  ageAdjBp: number;
  traitAdjBp: number;
  roleDemandAdjBp: number;
  fanAppealAdjBp: number;
  marketWage: number;
}

/** potentialBonus = min(potential − rating, cap) × potW(humanAge) ÷ 10,000 (also the AI's upside term). */
export function potentialBonus(rating: number, potential: number, humanAge: number, content: ContentDB): number {
  const w = content.economy.wage;
  const gap = clamp(potential - rating, 0, w.potentialGapCap);
  return mulDiv(gap, stepLookup(w.potentialWeightBpByHumanAge, humanAge), BP);
}

export function marketWageDetails(fighter: Fighter, content: ContentDB): MarketWageDetails {
  const w = content.economy.wage;
  const rating = fighterRating(fighter, content);
  const potential = fighterPotential(fighter, content);
  const humanAge = fighterHumanAge(fighter, content);
  const eq = clamp(rating + potentialBonus(rating, potential, humanAge, content), 1, 100);
  const curve = interpolate(w.curveAnchors, eq);
  const ageAdjBp = stepLookup(w.ageAdjBpByHumanAge, humanAge);
  let traitAdjBp = 0;
  for (const def of traitDefs(fighter, content)) {
    const override = w.traitAdj.overridesBp[def.id];
    traitAdjBp += override ?? (def.polarity === 'positive' ? w.traitAdj.positiveBp : w.traitAdj.negativeBp);
  }
  traitAdjBp = clamp(traitAdjBp, w.traitAdj.totalMinBp, w.traitAdj.totalMaxBp);
  const fanAppealAdjBp = w.traitAdj.fanAppealBpPerPoint * economyHookPoints(fighter.traits.map((t) => t.id), 'fanAppeal', content);
  let roleDemandAdjBp = Number.NEGATIVE_INFINITY;
  for (const a of content.classes.require(fighter.classId).archetypes) {
    const key = a === 'melee' ? 'melee_dps' : a === 'ranged' ? 'ranged_dps' : a;
    roleDemandAdjBp = Math.max(roleDemandAdjBp, w.roleDemandBp[key]);
  }
  if (!Number.isFinite(roleDemandAdjBp)) roleDemandAdjBp = 0;
  const factor = BP + ageAdjBp + traitAdjBp + roleDemandAdjBp + fanAppealAdjBp;
  const marketWage = Math.max(0, floorTo(mulDiv(curve, factor, BP), w.roundDownToMultiple));
  return { rating, potential, humanAge, eq, curve, ageAdjBp, traitAdjBp, roleDemandAdjBp, fanAppealAdjBp, marketWage };
}

/** Club-independent market wage. */
export function marketWageOf(fighter: Fighter, content: ContentDB): number {
  return marketWageDetails(fighter, content).marketWage;
}

/** Calibre tier level: the first tier whose minRating <= rating, else the lowest tier. */
export function calibreLevel(rating: number, content: ContentDB): number {
  const rows = [...content.economy.ask.calibreMinRating].sort((a, b) => a.tierLevel - b.tierLevel);
  for (const row of rows) if (rating >= row.minRating) return row.tierLevel;
  return rows[rows.length - 1]?.tierLevel ?? 1;
}

/** Preferred contract length: 1 for a young prospect, 3 for a veteran, else 2. */
export function preferredLengthOf(rating: number, potential: number, humanAge: number, content: ContentDB): number {
  const l = content.economy.ask.length;
  if (humanAge <= l.youngMaxHumanAge && potential - rating >= l.youngMinPotentialGap) return 1;
  if (humanAge >= l.veteranMinHumanAge) return 3;
  return 2;
}

export function preferredLength(state: GameState, fighterId: FighterId, content: ContentDB): number {
  const f = requireFighter(state, fighterId);
  return preferredLengthOf(fighterRating(f, content), fighterPotential(f, content), fighterHumanAge(f, content), content);
}

/** Greed label and counter window (economy.json ask.greed.labels). */
export function greedLabel(greedBp: number, content: ContentDB): { id: string; label: string; flexBp: number } {
  const labels = content.economy.ask.greed.labels;
  for (const l of labels) if (greedBp <= l.maxBp) return { id: l.id, label: l.label, flexBp: l.flexBp };
  const last = labels[labels.length - 1]!;
  return { id: last.id, label: last.label, flexBp: last.flexBp };
}

/** Matches the club played this season and how many of them the fighter started for it. */
export function seasonStarts(state: GameState, fighterId: FighterId, clubId: ClubId, season: number): { started: number; played: number } {
  let started = 0;
  let played = 0;
  for (const r of Object.values(state.results)) {
    if (r.season !== season) continue;
    const side = r.homeClubId === clubId ? r.input.home : r.awayClubId === clubId ? r.input.away : null;
    if (!side) continue;
    played += 1;
    if (side.fighters.some((x) => x.fighterId === fighterId)) started += 1;
  }
  return { started, played };
}

/** Completed seasons in a row at the club (fighter history rows, newest backwards). */
export function seasonsAtClub(fighter: Fighter, clubId: ClubId): number {
  let n = 0;
  for (let i = fighter.history.length - 1; i >= 0; i--) {
    if (fighter.history[i]!.clubId !== clubId) break;
    n += 1;
  }
  return n;
}

export interface AskDetails {
  marketWage: number;
  calibreLevel: number;
  preferredLength: number;
  isRenewal: boolean;
  tierGapBp: number;
  prestigeBp: number;
  lengthBp: number;
  greedBp: number;
  wageDemandBp: number;
  situationBp: number;
  totalBp: number;
  ask: number;
}

/**
 * ask = clamp(floor5(marketWage × (10,000 + clamp(Σ adjustments)) ÷ 10,000), tier minimum, max wage).
 * The renewal situation applies when the club holds the fighter's contract.
 */
export function askDetails(state: GameState, fighter: Fighter, clubId: ClubId, seasons: number, content: ContentDB): AskDetails {
  const e = content.economy;
  const club = requireClub(state, clubId);
  const tier = tierOf(club, content);
  const profile = content.tierProfile(tier.level);
  const mw = marketWageDetails(fighter, content);
  const calibre = calibreLevel(mw.rating, content);
  const tierGapBp =
    tier.level > calibre
      ? (tier.level - calibre) * e.ask.tierGap.premiumBpPerTierBelowCalibre
      : tier.level < calibre
        ? (calibre - tier.level) * e.ask.tierGap.discountBpPerTierAboveCalibre
        : 0;
  const prestigeBp = clamp(e.ask.prestige.bpPerPointAboveTierBase * (club.prestige - tier.basePrestige), e.ask.prestige.minAdjBp, e.ask.prestige.maxAdjBp);
  const preferred = preferredLengthOf(mw.rating, mw.potential, mw.humanAge, content);
  const lengthBp = e.ask.length.mismatchBpPerSeason * Math.abs(seasons - preferred);
  const greedBp = fighter.contractProfile.greedBp;
  const demandBp = wageDemandBp(fighter, content);
  const isRenewal = fighter.clubId === clubId && fighter.status === 'active' && fighter.contract?.clubId === clubId;
  let situationBp = 0;
  if (isRenewal) {
    const s = e.ask.renewalSituation;
    const { started, played } = seasonStarts(state, fighter.id, clubId, marketTime(state).season);
    if (played > 0) {
      const shareBp = mulDiv(started, BP, played);
      if (shareBp < s.lowStartShareBelowBp) situationBp += s.lowStartAdjBp;
      else if (shareBp >= s.highStartShareAtLeastBp) situationBp += s.highStartAdjBp;
    }
    if (seasonsAtClub(fighter, clubId) >= s.loyalSeasonsAtClub) situationBp += s.loyalAdjBp;
    situationBp -= e.wage.traitAdj.loyaltyBpPerPoint * economyHookPoints(fighter.traits.map((t) => t.id), 'loyalty', content);
  }
  const totalBp = clamp(tierGapBp + prestigeBp + lengthBp + greedBp + demandBp + situationBp, e.ask.totalMinBp, e.ask.totalMaxBp);
  const raw = floorTo(mulDiv(mw.marketWage, BP + totalBp, BP), e.wage.roundDownToMultiple);
  const ask = clamp(raw, profile.tierMinWage, e.wage.maxWeeklyWage);
  return {
    marketWage: mw.marketWage,
    calibreLevel: calibre,
    preferredLength: preferred,
    isRenewal,
    tierGapBp,
    prestigeBp,
    lengthBp,
    greedBp,
    wageDemandBp: demandBp,
    situationBp,
    totalBp,
    ask,
  };
}

export function askOf(state: GameState, fighter: Fighter, clubId: ClubId, seasons: number, content: ContentDB): number {
  return askDetails(state, fighter, clubId, seasons, content).ask;
}
