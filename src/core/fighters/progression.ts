/**
 * M1.1 lifecycle contract stubs (WP-B; docs/design/05 M1.1 addendum §WP-B).
 * Specs: progression.md sys-development (XP, bench XP, offers, auto-pick),
 * sys-freshness, sys-injury amendment; combat-skills.md sys-perks /
 * sys-ability-ranks eligibility (perks.json rules, ability-ranks.json).
 *
 * Signatures are the contract; bodies throw NotImplementedError until WP-B
 * lands them. Already implemented (./levels.ts): initialLevel, xpNeededFor,
 * levelMentorMult, initProgression, freshnessOf, freshnessLabel,
 * freshnessInjuryMultBp, migrateFightersV3.
 */
import type { ContentDB } from '../content';
import type {
  Fighter,
  FighterId,
  GameState,
  LevelOption,
  LevelUpMode,
  LevelUpResolution,
  MatchResult,
  MatchState,
  NewsId,
  PendingLevelUp,
  ResolvedLevelUp,
  RoundOutcome,
} from '../model';
import { notImplemented, type EngineError, type Result } from '../util';

// ---- pure reads ----------------------------------------------------------------------------------

/** Answer to one pending level-up: index into its options (null only for an empty level) and the trait offer (index, or null = neither). */
export interface LevelUpChoice {
  optionIndex: number | null;
  traitIndex: number | null;
}

/** Whether an option is still legal now (stat below cap, rank below 3, perk eligible); illegal options show greyed out. */
export function levelOptionLegal(fighter: Fighter, option: LevelOption, content: ContentDB): boolean {
  return notImplemented('fighters.levelOptionLegal (M1.1 WP-B)', fighter, option, content);
}

/** The policy's pick for an offer (lvl-011, lvl-012): highest score, ties stat before skill, then lower index; never a burden trait. */
export function autoPickChoice(fighter: Fighter, offer: PendingLevelUp, mode: Exclude<LevelUpMode, 'manual'>, content: ContentDB): LevelUpChoice {
  return notImplemented('fighters.autoPickChoice (M1.1 WP-B)', fighter, offer, mode, content);
}

/** The fighter's effective policy: his levelUpMode, or the club's levelUpDefault for 'inherit'; free agents and hired blades 'auto'. */
export function effectiveLevelUpMode(state: GameState, fighter: Fighter): LevelUpMode {
  if (fighter.levelUpMode !== 'inherit') return fighter.levelUpMode;
  const club = fighter.clubId === null ? undefined : state.clubs[fighter.clubId];
  return club && fighter.status === 'active' ? club.levelUpDefault : 'auto';
}

/** Typical Freshness drain of one round, tenths (intensity 1.0; young and perk multipliers): UI forecasts and AI rotation. */
export function typicalRoundDrain10(fighter: Fighter, content: ContentDB): number {
  return notImplemented('fighters.typicalRoundDrain10 (M1.1 WP-B)', fighter, content);
}

/** Weekly rest gain in tenths for a week with no round started (× squadReserveRestShare for an unused squad reserve). */
export function weeklyRest10(fighter: Fighter, content: ContentDB, wasSquadReserve: boolean): number {
  return notImplemented('fighters.weeklyRest10 (M1.1 WP-B)', fighter, content, wasSquadReserve);
}

/** "Next level in ≈ N matches" (null when no match XP is expected): ceil(remaining ÷ mean match XP this season; 32 starter / 11 bench before his first match). */
export function levelEtaMatches(fighter: Fighter, content: ContentDB): number | null {
  return notImplemented('fighters.levelEtaMatches (M1.1 WP-B)', fighter, content);
}

// ---- match hooks (core/game orchestrator calls them on the draft; levels.json hooks) -----------------------

/** After each round: drain Freshness of everyone who started it (round intensity, young and perk multipliers); tired/spent counters. */
export function freshnessAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): void {
  notImplemented('fighters.freshnessAfterRound (M1.1 WP-B)', draft, ms, outcome, content);
}

/** After each round: round XP of everyone who started it (×1.25 Reckoning, trait multipliers; floored once per round). */
export function xpAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): void {
  notImplemented('fighters.xpAfterRound (M1.1 WP-B)', draft, ms, outcome, content);
}

/** After each round: immediate injury rolls (Freshness multiplier from the round start); returns the newly injured, who play no later round. */
export function injuriesAfterRound(draft: GameState, ms: MatchState, outcome: RoundOutcome, content: ContentDB): FighterId[] {
  return notImplemented('fighters.injuriesAfterRound (M1.1 WP-B)', draft, ms, outcome, content);
}

/** At each between-round step, after the swaps: freshnessBetweenRounds perk gains for active fighters and unused reserves (not withdrawn, not injured). */
export function freshnessBetweenRounds(draft: GameState, ms: MatchState, content: ContentDB): void {
  notImplemented('fighters.freshnessBetweenRounds (M1.1 WP-B)', draft, ms, content);
}

export interface MatchProgressionOutcome {
  /** Bench XP per fit roster fighter of both clubs who started no round (squad reserves included). */
  benchXp: Record<FighterId, number>;
  /** Level-ups gained (at most levels.json maxLevelUpsPerMatch per fighter), with offers stored in pendingLevelUps. */
  levelUps: { fighterId: FighterId; level: number }[];
  /** Pending level-ups resolved by policy (auto modes, AI clubs, a full queue). */
  autoResolved: ResolvedLevelUp[];
  newsIds: NewsId[];
}

/** Match end (levels.json hooks.matchEnd): bench XP, career and season counters, level-up checks, offers, auto-resolution. */
export function matchEndProgression(draft: GameState, result: MatchResult, content: ContentDB): MatchProgressionOutcome {
  return notImplemented('fighters.matchEndProgression (M1.1 WP-B)', draft, result, content);
}

// ---- commands -----------------------------------------------------------------------------------------------

/**
 * Resolve one pending level-up of `fighterId` (levelup.choose, auto-pick,
 * queue overflow, season end): apply the pick (train100 += gain, rank, perk,
 * learned trait), log it in season.levelLog, drop it from pendingLevelUps.
 * Errors: levelup.unknown, levelup.option, levelup.trait (core/game validates
 * club ownership and the match-in-progress rule first).
 */
export function resolveLevelUp(
  draft: GameState,
  fighterId: FighterId,
  level: number,
  choice: LevelUpChoice,
  how: LevelUpResolution,
  content: ContentDB,
): Result<ResolvedLevelUp, EngineError> {
  return notImplemented('fighters.resolveLevelUp (M1.1 WP-B)', draft, fighterId, level, choice, how, content);
}
