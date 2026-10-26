/**
 * core/fighters — fighter lifecycle (03-fighter-lifecycle: sys-races,
 * sys-fighters, sys-youth-intake, sys-development, aging and retirement,
 * sys-injury, sys-traits, sys-captaincy, sys-chemistry). Owner: WP2.
 * CONTRACT: signatures fixed (implemented); additive exports below the contract.
 *
 * Reads are pure functions of (fighter, content). Pipeline steps mutate a
 * DRAFT GameState handed in by core/game and derive their own RNG streams
 * from draft.rng.root with core/rng STREAM paths (season, week, fixture,
 * fighter id, purpose), so draws never depend on iteration order.
 *
 * Orchestrator decisions 2026-10-25 (pending owner confirmation):
 * - a fighter who starts no rounds gets 0 XP and 0 development; the training
 *   emphasis only decides which stats the EARNED growth goes to;
 * - mental decline scales by race lifespan (development.json flag);
 * - chemistry in M1 comes only from trait and captain lineup modifiers.
 */
import type { CaptaincyGradeDef, ContentDB } from '../content';
import { Rng, STREAM } from '../rng';
import type {
  ClassId,
  ClubId,
  Fighter,
  FighterId,
  GameState,
  MatchResult,
  NewsId,
  PersonName,
  RaceId,
  RegionId,
  RetirementRecord,
  StatId,
  LevelUpResolution,
  MatchState,
  ResolvedLevelUp,
  RoundOutcome,
} from '../model';
import { captaincyAt, chemistryBreakdown, isFitFighter } from './captaincy';
import { createFighterOn } from './generation';
import { typicalRoundChanceBp } from './injury';
import { applyMatch } from './match';
import { enterLifecycleStep, leaveLifecycleStep } from './memo';
import { generateNameWith, livingNames } from './names';
import {
  announceFinalSeasonsOn,
  generateRookiesOn,
  liveRetirementChance,
  offseasonRecoveryOn,
  seasonEndDevelopmentOn,
  seasonEndRetirementsOn,
  trendId,
} from './season';
import { effectiveStatsOf, fighterHumanAge100, potentialOf, ratingOf } from './stats';
import { lockLineup, weekly } from './weekly';
import { migrateFightersV3 } from './levels';
import * as progression from './progression';
import type { EngineError, Result } from '../util';

/** Run a lifecycle step that can change ratings or fitness: memoized derived values are dropped before and after (./memo.ts). */
function mutating<T>(step: () => T): T {
  enterLifecycleStep();
  try {
    return step();
  } finally {
    leaveLifecycleStep();
  }
}

// ---- generation ---------------------------------------------------------------------------

export type GenerationKind = 'worldgen' | 'rookie' | 'free-agent' | 'journeyman' | 'hired-blade';

export interface FighterSpec {
  kind: GenerationKind;
  /** Potential shift in rating points (leagues.json worldGenPotentialShift / generationShifts). */
  potentialShift: number;
  regionId: RegionId;
  /** Optional constraints; otherwise rolled from race intake weights and class affinity. */
  raceId?: RaceId;
  classId?: ClassId;
  /** Inclusive human-age band; default from development.json generation. */
  humanAge?: { min: number; max: number };
  /** Hired blades: target rating (tier band minimum). */
  ratingTarget?: number;
}

/** Create a fighter on the draft (allocates its id, rolls everything, inserts into draft.fighters). Economy fills contractProfile. */
export function createFighter(draft: GameState, spec: FighterSpec, content: ContentDB): FighterId {
  return mutating(() => createFighterOn(draft, spec, content));
}

/** A unique name for the race (names.json rules). */
export function generateName(draft: GameState, raceId: RaceId, content: ContentDB): PersonName {
  // Standalone calls are keyed by a counter on the draft (createFighter keys names by fighter id).
  const n = (draft.rng.counters['names'] ?? 0) + 1;
  draft.rng.counters['names'] = n;
  return generateNameWith(Rng.create(draft.rng.root, STREAM.names, 'standalone', n), raceId, content, livingNames(draft));
}

// ---- derived values (pure) --------------------------------------------------------------------

/** humanAge = age × 80 / lifespan, in hundredths of a year (integer). */
export function humanAge100(fighter: Fighter, content: ContentDB): number {
  return fighterHumanAge100(fighter, content);
}

export interface StatContext {
  /** Tournament matches enable contextStat effects. */
  matchType?: 'league' | 'tournament';
  /** Lineup chemistry (-5..5): composure + chemistry ÷ 2 at lineup lock. */
  chemistry?: number;
  /** Acting captain who is not the club captain gets the CQ penalty (applies to captaincy only). */
  actingCaptain?: boolean;
}

/** Effective display stats 1-20 (caps × maturity − wear, race, traits, statuses, injury effects, context). The one function every caller uses. */
export function effectiveStats(fighter: Fighter, content: ContentDB, context?: StatContext): Record<StatId, number> {
  const ctx: { matchType?: 'league' | 'tournament'; chemistry?: number } = {};
  if (context?.matchType !== undefined) ctx.matchType = context.matchType;
  if (context?.chemistry !== undefined) ctx.chemistry = context.chemistry;
  return effectiveStatsOf(fighter, content, ctx);
}

/** Rating 1-100 = round(5 × Σ class ratingWeights × stat). */
export function rating(fighter: Fighter, content: ContentDB): number {
  return ratingOf(fighter, content);
}

/** Potential 1-100 (displayed as stars). */
export function potential(fighter: Fighter, content: ContentDB): number {
  return potentialOf(fighter, content);
}

export interface CaptaincyValue {
  /** CQ 1-100. */
  cq: number;
  grade: CaptaincyGradeDef;
}

/** Captaincy of a fighter at a club (standing uses the club's top-five ratings). */
export function captaincy(state: GameState, fighterId: FighterId, clubId: ClubId, content: ContentDB): CaptaincyValue {
  const b = captaincyAt(state, fighterId, clubId, content);
  return { cq: b.cq, grade: b.grade };
}

/** Lineup chemistry -5..5 from trait chemistry effects and the captain's grade. */
export function lineupChemistry(state: GameState, clubId: ClubId, fighterIds: readonly FighterId[], captainId: FighterId | null, content: ContentDB): number {
  return chemistryBreakdown(state, clubId, fighterIds, captainId, content).total;
}

/** Fit to be named in a lineup this week (not injured, not retired). */
export function isFit(fighter: Fighter): boolean {
  return isFitFighter(fighter);
}

/** Per-round injury chance in basis points (lineup screen odds). */
export function injuryChanceBp(fighter: Fighter, content: ContentDB): number {
  return typicalRoundChanceBp(fighter, content);
}

/** Retirement chance this season in basis points (shown on the fighter profile). */
export function retirementChanceBp(state: GameState, fighterId: FighterId, content: ContentDB): number {
  const f = state.fighters[fighterId];
  if (!f) throw new RangeError(`Unknown fighter ${fighterId}`);
  return liveRetirementChance(state, f, content);
}

/** Development trend id (development.json trend.levels). */
export function trend(fighter: Fighter, content: ContentDB): string {
  return trendId(fighter, content);
}

// ---- pipeline steps (mutate the draft) ---------------------------------------------------------

/** Lineup lock for a club: captain strip/snubbed/passed-over rules, acting captain. */
export function lineupLock(draft: GameState, clubId: ClubId, content: ContentDB): NewsId[] {
  return mutating(() => lockLineup(draft, clubId, content));
}

export interface MatchLifecycleOutcome {
  xp: Record<FighterId, number>;
  injuries: { fighterId: FighterId; severity: 'knock' | 'minor' | 'moderate' | 'serious'; weeksOut: number }[];
  newsIds: NewsId[];
}

/** After a match: XP (rounds started only), injury rolls (max 1 per match), career totals, statuses, event traits. */
export function applyMatchLifecycle(draft: GameState, result: MatchResult, content: ContentDB): MatchLifecycleOutcome {
  return mutating(() => applyMatch(draft, result, content));
}

/** Week processing step 3: injury and status countdown, emphasis weeks, captain streaks, weekly trait checks. */
export function weeklyLifecycle(draft: GameState, content: ContentDB): NewsId[] {
  return mutating(() => weekly(draft, content));
}

/** Season end step 6: development and decline (pre-increment age), then +1 age; history rows. */
export function seasonEndDevelopment(draft: GameState, content: ContentDB): NewsId[] {
  return mutating(() => seasonEndDevelopmentOn(draft, content));
}

/** Season end step 7: retirements (final-season fighters, rolls, forced). Contracts end without payout. */
export function seasonEndRetirements(draft: GameState, content: ContentDB): RetirementRecord[] {
  return mutating(() => seasonEndRetirementsOn(draft, content));
}

/** Season end step 9: off-season injury recovery. */
export function offseasonRecovery(draft: GameState, content: ContentDB): void {
  mutating(() => offseasonRecoveryOn(draft, content));
}

/**
 * Season end step 13: rookie intake count and generation (economy assigns them to clubs for Trials Day).
 * `count` overrides the intake formula (world creation: one rookie per club for season 1, D-P).
 */
export function generateRookies(draft: GameState, content: ContentDB, count?: number): FighterId[] {
  return mutating(() => generateRookiesOn(draft, content, count));
}

/** P1: final-season announcements. */
export function announceFinalSeasons(draft: GameState, content: ContentDB): NewsId[] {
  return mutating(() => announceFinalSeasonsOn(draft, content));
}

// ---- additive exports (not part of the phase-B contract) ----------------------------------------

export { CAREER_ENDING_WEEKS, captaincyBreakdown, chemistryBreakdown, gradeFor, isCareerEnded, lineupCaptainOf as lineupCaptain } from './captaincy';
export type { CaptaincyBreakdown, ChemistryBreakdown, LineupCaptain } from './captaincy';
export { chemistryComposure, maturityBp, ratingFromStats } from './stats';
export { careerEndingChancePerMatchBp, isAtRisk, pronenessIndexBp, pronenessLabel, roundInjuryChanceBp } from './injury';
export { captainChangeConsequences, interimCaptainOf as interimCaptain } from './weekly';
export { withDerivedMemo } from './memo';
export type { CaptainChangeConsequences, SnubExemption } from './weekly';
export { rookieCount, trendDelta } from './season';
export { rolledPolarity, scarCount } from './traits';
export { usageBpOf } from './development';
export { PROVISIONAL_JOURNEYMAN_HUMAN_AGE } from './generation';
export { lifecycleContentIssues } from './invariants';

// ---- M1.1 contract (WP-B; docs/design/05 M1.1 addendum) -----------------------------------------
// Implemented in the contracts phase (./levels.ts): levels, XP per level, Freshness reads, the v2 -> v3 migration.
// Stubs (./progression.ts, NotImplementedError): offers, auto-pick, drain and recovery, match hooks, level-up resolution.

export {
  freshnessInjuryMultBp,
  freshnessLabel,
  freshnessOf,
  initProgression,
  initialLevel,
  levelMentorMult,
  physicalWeightShare,
  trainFromClocks,
  trainedRating,
  xpNeededFor,
} from './levels';
export type { XpNeededContext } from './levels';
export { autoPickChoice, effectiveLevelUpMode, levelEtaMatches, levelOptionLegal, typicalRoundDrain10, weeklyRest10 } from './progression';
export type { LevelUpChoice, MatchProgressionOutcome } from './progression';

/** v2 -> v3 save migration of every fighter (core/save migrateV2ToV3; progression.md §6). */
export function migrateFightersToV3(state: GameState, content: ContentDB): void {
  mutating(() => migrateFightersV3(state, content));
}

/** Orchestrator hook after each round: Freshness drain. */
export function freshnessAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): void {
  mutating(() => progression.freshnessAfterRound(draft, ms, outcome, content));
}

/** Orchestrator hook after each round: round XP. */
export function xpAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): void {
  mutating(() => progression.xpAfterRound(draft, ms, outcome, content));
}

/** Orchestrator hook after each round: immediate injuries; returns the newly injured. */
export function injuriesAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): FighterId[] {
  return mutating(() => progression.injuriesAfterRound(draft, ms, outcome, content));
}

/** Orchestrator hook at each between-round step: perk Freshness gains. */
export function freshnessBetweenRounds(draft: GameState, ms: MatchState, content: ContentDB): void {
  mutating(() => progression.freshnessBetweenRounds(draft, ms, content));
}

/** Match end: bench XP, level-ups and offers, auto-resolution. */
export function matchEndProgression(draft: GameState, result: MatchResult, content: ContentDB): progression.MatchProgressionOutcome {
  return mutating(() => progression.matchEndProgression(draft, result, content));
}

/** Resolve one pending level-up (levelup.choose, policies, a full queue, season end). */
export function resolveLevelUp(
  draft: GameState,
  fighterId: FighterId,
  level: number,
  choice: progression.LevelUpChoice,
  how: LevelUpResolution,
  content: ContentDB,
): Result<ResolvedLevelUp, EngineError> {
  return mutating(() => progression.resolveLevelUp(draft, fighterId, level, choice, how, content));
}
