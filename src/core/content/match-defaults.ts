/**
 * M1.1 club match-day defaults from content (combat.json match,
 * levels.json autoPick / pacing / aiSubstitution): world creation, the
 * v2 -> v3 save migration and test fixtures all start clubs from here.
 */
import type { AutoSwapMode, AutoSwapRules, FreshnessLabel, LevelUpMode, LevelUpPacing, PauseBetweenRounds, RankableSlot } from '../model';
import type { ContentDB } from './db';
import type { AUTO_SWAP_MODES, FRESHNESS_LABELS, LEVEL_UP_MODES, LEVEL_UP_PACING, PAUSE_BETWEEN_ROUNDS, RANKABLE_SLOTS } from './schema';

// The model's M1.1 unions equal the content's closed lists (compile-time; a mismatch fails the typecheck).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const VOCABULARY_MATCHES: [
  Same<LevelUpMode, (typeof LEVEL_UP_MODES)[number]>,
  Same<LevelUpPacing, (typeof LEVEL_UP_PACING)[number]>,
  Same<AutoSwapMode, (typeof AUTO_SWAP_MODES)[number]>,
  Same<PauseBetweenRounds, (typeof PAUSE_BETWEEN_ROUNDS)[number]>,
  Same<RankableSlot, (typeof RANKABLE_SLOTS)[number]>,
  Same<FreshnessLabel, (typeof FRESHNESS_LABELS)[number]>,
] = [true, true, true, true, true, true];
void VOCABULARY_MATCHES;

export interface ClubMatchDefaults {
  levelUpDefault: LevelUpMode;
  levelUpPacing: LevelUpPacing;
  autoSwap: AutoSwapRules;
  pauseBetweenRounds: PauseBetweenRounds;
}

/**
 * Auto-swap rules: combat.json match.autoSwapDefaults, the threshold from
 * levels.json aiSubstitution (per AI personality, or playerAutoDefault) and
 * the lost-round bonus (adopted for every club, 05 M1.1 addendum).
 */
export function autoSwapRulesFor(content: ContentDB, who: { player: true } | { player: false; personalityId: string }): AutoSwapRules {
  const d = content.combat.match.autoSwapDefaults;
  const sub = content.levels.aiSubstitution;
  const below = who.player ? sub.playerAutoDefault : (sub.freshnessBelowByPersonality[who.personalityId] ?? sub.freshnessBelow);
  return {
    mode: d.mode,
    freshnessBelow: below,
    reserveMargin: d.reserveMargin,
    maxRatingGap: d.maxRatingGap,
    keepOneForInjury: d.keepOneForInjury,
    sameRoleFamilyFirst: d.sameRoleFamilyFirst,
    lostRoundBonus: sub.lostRoundThresholdBonus,
  };
}

/** Defaults for a new (or migrated) club: the player's club asks about level-ups and pauses; AI clubs auto-pick. */
export function clubMatchDefaults(content: ContentDB, who: { player: true } | { player: false; personalityId: string }): ClubMatchDefaults {
  return {
    levelUpDefault: who.player ? content.levels.autoPick.playerClubDefault : content.levels.autoPick.aiMode,
    levelUpPacing: content.levels.pacing.default,
    autoSwap: autoSwapRulesFor(content, who),
    pauseBetweenRounds: content.combat.match.pauseBetweenRounds.defaultM11,
  };
}
