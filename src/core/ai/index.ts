/**
 * core/ai — AI club managers under the same rulebook (P-04;
 * 03-league-economy sys-ai-manager, 03-fighter-lifecycle §5). Owner: WP5.
 *
 * AI clubs act ONLY by returning Commands, validated by core/game exactly
 * like the player's. No direct writes, no hidden bonuses, no knowledge of the
 * player's future inputs, no reactive counter-building. Personalities are
 * data (economy.json aiPersonalities). Decisions are deterministic given the
 * state: ties break on stable keys (rating, CQ, fighter id), so no RNG draw
 * is needed (STREAM.ai stays reserved for future tie lots).
 *
 * The functions below use the real fighters/economy modules. createAi(ports)
 * builds the same API over other implementations (tests, stand-ins).
 */
import type { ContentDB } from '../content';
import type { ClubId, Command, FighterId, GameState } from '../model';
import { createAi, type LineupChoice } from './policy';
import { realAiPorts } from './ports';

export { createAi, emphasisFor, roleFamilies, stylePreset } from './policy';
export type { AiApi, CaptainChoice, LineupChoice, RoleFamily } from './policy';
export type { AiPorts } from './ports';
export { realAiPorts } from './ports';

const real = createAi(realAiPorts);

/** Week step 9 for one AI club: renewals, releases, new offers, counter replies, captain, training, next week's lineup. */
export function planWeek(state: GameState, clubId: ClubId, content: ContentDB): Command[] {
  return real.planWeek(state, clubId, content);
}

/** Season-end step 14 for one AI club: trials-rookie signings, cap-relief releases, opening offers for P1. */
export function planSeasonEnd(state: GameState, clubId: ClubId, content: ContentDB): Command[] {
  return real.planSeasonEnd(state, clubId, content);
}

/**
 * Best legal lineup for a club's next fixture (5 fit fighters, rows from
 * class startingRow, the club's tacticsStyle preset per fighter). Also used
 * by the player's "auto-pick" button.
 */
export function chooseLineup(state: GameState, clubId: ClubId, content: ContentDB): LineupChoice {
  return real.chooseLineup(state, clubId, content);
}

/** AI valuation of a fighter for a club (need, quality, age, wage), used for offers and releases. */
export function valueFighter(state: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): number {
  return real.valueFighter(state, clubId, fighterId, content);
}
