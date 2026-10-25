/**
 * core/fighters — fighter lifecycle (03-fighter-lifecycle: sys-races,
 * sys-fighters, sys-youth-intake, sys-development, aging and retirement,
 * sys-injury, sys-traits, sys-captaincy, sys-chemistry). Owner: WP2.
 * CONTRACT: signatures fixed; bodies are stubs.
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
} from '../model';
import { notImplemented } from '../util';

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
  return notImplemented('fighters.createFighter', draft, spec, content);
}

/** A unique name for the race (names.json rules). */
export function generateName(draft: GameState, raceId: RaceId, content: ContentDB): PersonName {
  return notImplemented('fighters.generateName', draft, raceId, content);
}

// ---- derived values (pure) --------------------------------------------------------------------

/** humanAge = age × 80 / lifespan, in hundredths of a year (integer). */
export function humanAge100(fighter: Fighter, content: ContentDB): number {
  return notImplemented('fighters.humanAge100', fighter, content);
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
  return notImplemented('fighters.effectiveStats', fighter, content, context);
}

/** Rating 1-100 = round(5 × Σ class ratingWeights × stat). */
export function rating(fighter: Fighter, content: ContentDB): number {
  return notImplemented('fighters.rating', fighter, content);
}

/** Potential 1-100 (displayed as stars). */
export function potential(fighter: Fighter, content: ContentDB): number {
  return notImplemented('fighters.potential', fighter, content);
}

export interface CaptaincyValue {
  /** CQ 1-100. */
  cq: number;
  grade: CaptaincyGradeDef;
}

/** Captaincy of a fighter at a club (standing uses the club's top-five ratings). */
export function captaincy(state: GameState, fighterId: FighterId, clubId: ClubId, content: ContentDB): CaptaincyValue {
  return notImplemented('fighters.captaincy', state, fighterId, clubId, content);
}

/** Lineup chemistry -5..5 from trait chemistry effects and the captain's grade. */
export function lineupChemistry(state: GameState, clubId: ClubId, fighterIds: readonly FighterId[], captainId: FighterId | null, content: ContentDB): number {
  return notImplemented('fighters.lineupChemistry', state, clubId, fighterIds, captainId, content);
}

/** Fit to be named in a lineup this week (not injured, not retired). */
export function isFit(fighter: Fighter): boolean {
  return notImplemented('fighters.isFit', fighter);
}

/** Per-round injury chance in basis points (lineup screen odds). */
export function injuryChanceBp(fighter: Fighter, content: ContentDB): number {
  return notImplemented('fighters.injuryChanceBp', fighter, content);
}

/** Retirement chance this season in basis points (shown on the fighter profile). */
export function retirementChanceBp(state: GameState, fighterId: FighterId, content: ContentDB): number {
  return notImplemented('fighters.retirementChanceBp', state, fighterId, content);
}

/** Development trend id (development.json trend.levels). */
export function trend(fighter: Fighter, content: ContentDB): string {
  return notImplemented('fighters.trend', fighter, content);
}

// ---- pipeline steps (mutate the draft) ---------------------------------------------------------

/** Lineup lock for a club: captain strip/snubbed/passed-over rules, acting captain. */
export function lineupLock(draft: GameState, clubId: ClubId, content: ContentDB): NewsId[] {
  return notImplemented('fighters.lineupLock', draft, clubId, content);
}

export interface MatchLifecycleOutcome {
  xp: Record<FighterId, number>;
  injuries: { fighterId: FighterId; severity: 'knock' | 'minor' | 'moderate' | 'serious'; weeksOut: number }[];
  newsIds: NewsId[];
}

/** After a match: XP (rounds started only), injury rolls (max 1 per match), career totals, statuses, event traits. */
export function applyMatchLifecycle(draft: GameState, result: MatchResult, content: ContentDB): MatchLifecycleOutcome {
  return notImplemented('fighters.applyMatchLifecycle', draft, result, content);
}

/** Week processing step 3: injury and status countdown, emphasis weeks, captain streaks, weekly trait checks. */
export function weeklyLifecycle(draft: GameState, content: ContentDB): NewsId[] {
  return notImplemented('fighters.weeklyLifecycle', draft, content);
}

/** Season end step 6: development and decline (pre-increment age), then +1 age; history rows. */
export function seasonEndDevelopment(draft: GameState, content: ContentDB): NewsId[] {
  return notImplemented('fighters.seasonEndDevelopment', draft, content);
}

/** Season end step 7: retirements (final-season fighters, rolls, forced). Contracts end without payout. */
export function seasonEndRetirements(draft: GameState, content: ContentDB): RetirementRecord[] {
  return notImplemented('fighters.seasonEndRetirements', draft, content);
}

/** Season end step 9: off-season injury recovery. */
export function offseasonRecovery(draft: GameState, content: ContentDB): void {
  return notImplemented('fighters.offseasonRecovery', draft, content);
}

/** Season end step 13: rookie intake count and generation (economy assigns them to clubs for Trials Day). */
export function generateRookies(draft: GameState, content: ContentDB): FighterId[] {
  return notImplemented('fighters.generateRookies', draft, content);
}

/** P1: final-season announcements. */
export function announceFinalSeasons(draft: GameState, content: ContentDB): NewsId[] {
  return notImplemented('fighters.announceFinalSeasons', draft, content);
}
