/**
 * Income formulas, season budget (SB) and wage budget (WB)
 * (03-league-economy sys-finance; economy.json income, budget). Pure.
 *
 * Prestige and tier are constant from next-season setup to the season-end
 * prestige update, so the sponsor retainer and the projected gate computed
 * here equal the values fixed at setup for the whole season.
 */
import type { ContentDB } from '../content';
import type { Club, ClubId, Fixture, GameState, MatchResult } from '../model';
import { clamp } from '../util';
import { ledgerSum } from './ledger';
import { divTrunc, mulDiv } from './math';
import { profileOf, tierOf } from './queries';
import { grantSchedule, weeksPerSeason } from './time';
import { economyHookPoints } from './wages';

const BP = 10_000;

/** Season sponsor retainer from prestige (paid in W equal parts, remainder with the last week). */
export function retainerOf(club: Club, content: ContentDB): number {
  const r = content.economy.income.sponsorRetainer;
  const tier = tierOf(club, content);
  const adj = clamp(r.prestigeBpPerPoint * (club.prestige - tier.basePrestige), r.minAdjBp, r.maxAdjBp);
  return mulDiv(profileOf(club, content).sponsorRetainerBase, BP + adj, BP);
}

/** Retainer installment paid at the processing of week `weekIndex` (1..W). */
export function retainerPart(retainer: number, weekIndex: number, content: ContentDB): number {
  const w = weeksPerSeason(content);
  if (weekIndex < 1 || weekIndex > w) return 0;
  const part = divTrunc(retainer, w);
  return weekIndex === w ? retainer - part * (w - 1) : part;
}

export type GateStage = 'regular' | 'quarterfinal' | 'semifinal' | 'final';

export interface GateInput {
  /** Home club's league wins and matches this season before this fixture (league and Reckoning). */
  wins: number;
  matches: number;
  /** Fan-appeal trait points in the home lineup. */
  fanAppealPoints: number;
  stage: GateStage;
}

/**
 * gate = gateBase × (10,000 + prestigeAdj + formAdj + fanAppealAdj) × stageBp ÷ 10⁸, one truncation,
 * with formAdj = formMin + formSpan × wins ÷ matches kept exact (0 before the first match).
 */
export function gateFor(club: Club, input: GateInput, content: ContentDB): number {
  const g = content.economy.income.gate;
  const tier = tierOf(club, content);
  const base = profileOf(club, content).gateBase;
  const prestigeAdj = clamp(g.prestigeBpPerPoint * (club.prestige - tier.basePrestige), g.prestigeMinAdjBp, g.prestigeMaxAdjBp);
  const fanAdj = Math.min(g.fanAppealBpPerPoint * Math.max(0, input.fanAppealPoints), g.fanAppealMaxBp);
  const stageBp = g.stageBp[input.stage];
  if (input.matches <= 0) return mulDiv(base * (BP + prestigeAdj + fanAdj), stageBp, BP * BP);
  const factorTimesM = (BP + prestigeAdj + fanAdj + g.formMinBp) * input.matches + g.formSpanBp * input.wins;
  return mulDiv(base * factorTimesM, stageBp, BP * BP * input.matches);
}

/** Regular-season home gate at formAdj 0 and no fan appeal (SB projection). */
export function projectedRegularGate(club: Club, content: ContentDB): number {
  return gateFor(club, { wins: 0, matches: 0, fanAppealPoints: 0, stage: 'regular' }, content);
}

/** Club's match wins and matches this season before week `beforeWeekIndex` (league and Reckoning). */
export function formBefore(state: GameState, clubId: ClubId, season: number, beforeWeekIndex: number): { wins: number; matches: number } {
  let wins = 0;
  let matches = 0;
  for (const r of Object.values(state.results)) {
    if (r.season !== season || r.weekIndex >= beforeWeekIndex) continue;
    if (r.homeClubId !== clubId && r.awayClubId !== clubId) continue;
    matches += 1;
    if (r.winnerClubId === clubId) wins += 1;
  }
  return { wins, matches };
}

export function stageOf(fixture: Fixture): GateStage {
  return fixture.stage === 'league' ? 'regular' : fixture.stage;
}

/** Fan-appeal points of the home lineup that played (MatchResult input). */
export function homeFanAppeal(result: MatchResult, content: ContentDB): number {
  let total = 0;
  for (const f of result.input.home.fighters) total += economyHookPoints(f.traitIds, 'fanAppeal', content);
  return total;
}

/** Split of a neutral-venue final gate: even, the odd unit to the higher seed (the home side for the sim). */
export function splitFinalGate(gate: number): { home: number; away: number } {
  const away = divTrunc(gate, 2);
  return { home: gate - away, away };
}

// ---- central grant -------------------------------------------------------------------------------------------

/** Amount of a season's grant (after deduction) credited at `processingWeek` (0 = setup). The last installment takes the remainder. */
export function grantInstallmentAt(grantDue: number, processingWeek: number, content: ContentDB): number {
  const schedule = grantSchedule(content);
  let credited = 0;
  let total = 0;
  schedule.forEach((g, i) => {
    const amount = i === schedule.length - 1 ? grantDue - credited : mulDiv(grantDue, g.shareBp, BP);
    credited += amount;
    if (g.processingWeek === processingWeek) total += amount;
  });
  return total;
}

/** Registry deduction from a grant: min(debt, cap% of the grant). */
export function registryDeduction(registryDebt: number, grant: number, content: ContentDB): number {
  return Math.max(0, Math.min(registryDebt, mulDiv(grant, content.economy.finance.registryAdvance.deductionCapBpOfGrant, BP)));
}

// ---- season budget and wage budget ---------------------------------------------------------------------------

export interface SeasonBudgetParts {
  grantDue: number;
  parachute: number;
  promotionGrant: number;
  sponsorRetainer: number;
  /** homeFixturesPerClub × projected regular-season gate. */
  projectedGate: number;
  seasonBudget: number;
}

export function seasonBudgetOf(
  club: Club,
  extra: { grantDue: number; parachute: number; promotionGrant: number },
  content: ContentDB,
): SeasonBudgetParts {
  const sponsorRetainer = retainerOf(club, content);
  const projectedGate = content.economy.season.homeFixturesPerClub * projectedRegularGate(club, content);
  return {
    ...extra,
    sponsorRetainer,
    projectedGate,
    seasonBudget: extra.grantDue + extra.parachute + extra.promotionGrant + sponsorRetainer + projectedGate,
  };
}

/** reserveContribution = min(SB × cap, max(0, balance − SB × floor) × spendRate), one truncation per term. */
export function reserveContribution(seasonBudget: number, balanceAtSetup: number, content: ContentDB): number {
  const b = content.economy.budget;
  const cap = mulDiv(seasonBudget, b.reserveCapBp, BP);
  const spend = Math.max(0, mulDiv(balanceAtSetup * BP - seasonBudget * b.reserveFloorBp, b.reserveSpendRateBp, BP * BP));
  return Math.min(cap, spend);
}

/** WB = floor((SB × (wageRatio + ascension) + reserve × 10,000) ÷ (10,000 × W)). */
export function wageBudgetOf(seasonBudget: number, wageRatioBp: number, reserve: number, content: ContentDB): number {
  return Math.max(0, divTrunc(seasonBudget * wageRatioBp + reserve * BP, BP * weeksPerSeason(content)));
}

/** In-season SB parts: SB is fixed at setup; parachute and promotion grant come from this season's ledger. */
export function currentSeasonBudgetParts(state: GameState, club: Club, content: ContentDB): SeasonBudgetParts {
  const parachute = ledgerSum(state, club.id, 'parachute');
  const promotionGrant = ledgerSum(state, club.id, 'promotionGrant');
  const fixed = seasonBudgetOf(club, { grantDue: 0, parachute, promotionGrant }, content);
  const grantDue = clamp(
    club.finance.seasonBudget - fixed.seasonBudget,
    0,
    profileOf(club, content).centralGrant,
  );
  return { ...fixed, grantDue, seasonBudget: club.finance.seasonBudget };
}
