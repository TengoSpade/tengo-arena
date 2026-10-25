/**
 * core/ai — AI club managers under the same rulebook (P-04;
 * 03-league-economy sys-ai-manager, 03-fighter-lifecycle §5). Owner: WP5.
 * CONTRACT: signatures fixed; bodies are stubs.
 *
 * AI clubs act ONLY by returning Commands, validated by core/game exactly
 * like the player's. No direct writes, no hidden bonuses, no knowledge of the
 * player's future inputs, no reactive counter-building. Personalities are
 * data (economy.json aiPersonalities). Randomness: Rng.create(root,
 * STREAM.ai, season, weekIndex, clubId).
 */
import type { ContentDB } from '../content';
import type { ClubId, Command, FighterId, GameState, LineupEntry, TacticsAssignment } from '../model';
import { notImplemented } from '../util';

/** Week step 9 for one AI club: renewals, releases, new offers, counter replies, captain, training, next week's lineup. */
export function planWeek(state: GameState, clubId: ClubId, content: ContentDB): Command[] {
  return notImplemented('ai.planWeek', state, clubId, content);
}

/** Season-end step 14 for one AI club: trials-rookie signings, cap-relief releases, opening offers for P1. */
export function planSeasonEnd(state: GameState, clubId: ClubId, content: ContentDB): Command[] {
  return notImplemented('ai.planSeasonEnd', state, clubId, content);
}

export interface LineupChoice {
  fighters: LineupEntry[];
  matchCaptainId: FighterId | null;
  tactics: Record<FighterId, TacticsAssignment>;
}

/**
 * Best legal lineup for a club's next fixture (5 fit fighters, rows from
 * class startingRow, the club's tacticsStyle preset per fighter). Also used
 * by the player's "auto-pick" button.
 */
export function chooseLineup(state: GameState, clubId: ClubId, content: ContentDB): LineupChoice {
  return notImplemented('ai.chooseLineup', state, clubId, content);
}

/** AI valuation of a fighter for a club (need, quality, age, wage), used for offers and releases. */
export function valueFighter(state: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): number {
  return notImplemented('ai.valueFighter', state, clubId, fighterId, content);
}
