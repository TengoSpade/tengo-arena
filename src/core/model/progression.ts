/**
 * M1.1 progression and match-day settings (state schema v3): levels and
 * level-up offers, ability ranks and perks, Freshness, auto-pick, auto-swap
 * and pacing. Specs: docs/design/_drafts/m1.1/progression.md (lifecycle) and
 * combat-skills.md (combat). Closed vocabularies mirror core/content
 * (LEVEL_UP_MODES, LEVEL_UP_PACING, AUTO_SWAP_MODES, PAUSE_BETWEEN_ROUNDS,
 * RANKABLE_SLOTS, FRESHNESS_LABELS); core/content/match-defaults.ts checks
 * they are equal at compile time, and the save schema uses the content lists.
 */
import type { AbilityId, PerkId, StatId, TraitId } from './ids';

// ---- level-ups (sys-development) -----------------------------------------------------------------

/** How a fighter's level-ups are resolved (levels.json autoPick.playerModes). AI clubs always use 'auto'. */
export type LevelUpMode = 'manual' | 'auto' | 'auto_stats' | 'auto_skills';
/** Per fighter; 'inherit' follows Club.levelUpDefault. */
export type LevelUpModeSetting = 'inherit' | LevelUpMode;
/** Club setting: when the level-up dialog opens (levels.json pacing). */
export type LevelUpPacing = 'detailed' | 'balanced' | 'fast';

/** Ability slots that rank 1 -> 3 (basic attacks never rank). */
export type RankableSlot = 'a1' | 'a2' | 'passive';
export type AbilityRank = 1 | 2 | 3;
export type AbilityRanks = Record<RankableSlot, AbilityRank>;

/** One option of a level-up offer (generated once at match end and stored; P-05). */
export type LevelOption =
  /** +gain100 centipoints to a stat with room (min(100, cap100 − train100)). */
  | { kind: 'stat'; stat: StatId; gain100: number }
  /** The next rank of the ability in `slot` (combat's ability-ranks.json). */
  | { kind: 'rank'; slot: RankableSlot; abilityId: AbilityId; toRank: 2 | 3 }
  /** A perk from combat's perks.json. */
  | { kind: 'perk'; perkId: PerkId };

/** A level reached and waiting for a choice (Fighter.pendingLevelUps, oldest first, at most levels.json offers.pending.maxQueued). */
export interface PendingLevelUp {
  /** The level this offer belongs to (Fighter.level already counts it). */
  level: number;
  season: number;
  weekIndex: number;
  /** Usually 3; fewer when nothing else is available; empty = an empty level (still counts). */
  options: LevelOption[];
  /** Optional trait offer: two trait ids (option 1 always positive), or null when none was rolled. "Neither" is a valid answer. */
  traitOffer: TraitId[] | null;
}

/** How a level-up was resolved. */
export type LevelUpResolution = 'player' | 'auto' | 'queue_full' | 'season_end';

/** A resolved level-up (Fighter.season.levelLog): the season progression report and the digest read it. */
export interface ResolvedLevelUp {
  level: number;
  season: number;
  weekIndex: number;
  /** The option taken, or null for an empty level. An option that became illegal resolves to null. */
  picked: LevelOption | null;
  /** The trait learned from the trait offer, or null (none offered, or "neither"). */
  trait: TraitId | null;
  how: LevelUpResolution;
}

// ---- Freshness (sys-freshness) --------------------------------------------------------------------

/** Fighter.freshness10 at full rest (tenths of a point; the sim and UI read floor(freshness10 ÷ 10)). */
export const FRESHNESS10_MAX = 1000;
export type FreshnessLabel = 'fresh' | 'ready' | 'tired' | 'spent';

/** Every rankable slot at rank 1 (a fresh fighter, and every migrated v2 fighter). */
export function defaultAbilityRanks(): AbilityRanks {
  return { a1: 1, a2: 1, passive: 1 };
}

// ---- match-day settings (combat sys-match; Club fields) ---------------------------------------------

export type AutoSwapMode = 'off' | 'injured_only' | 'threshold';
export type PauseBetweenRounds = 'always' | 'when_urgent' | 'never';

/**
 * A club's auto-swap rules (combat.json match.autoSwapDefaults; AI clubs use
 * levels.json aiSubstitution with their personality threshold). The same
 * procedure suggests swaps on the player's between-round screen and decides
 * them for AI clubs and paceless player matches (one rulebook, P-04).
 */
export interface AutoSwapRules {
  mode: AutoSwapMode;
  /** Threshold step: active fighters below this Freshness (0-100) are swapped, lowest first. */
  freshnessBelow: number;
  /** The reserve needs at least the starter's Freshness + this. */
  reserveMargin: number;
  /** The reserve's rating may be at most this much below the starter's. */
  maxRatingGap: number;
  /** The last swap is not spent on Freshness before the last possible between-round step. */
  keepOneForInjury: boolean;
  sameRoleFamilyFirst: boolean;
  /**
   * Added to freshnessBelow for the side that lost the round just played
   * (levels.json aiSubstitution.lostRoundThresholdBonus; adopted in the 05
   * M1.1 addendum, for AI and player auto-swap alike).
   */
  lostRoundBonus: number;
}
