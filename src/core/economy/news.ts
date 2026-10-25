/**
 * Digest items written by economy (03-league-economy sys-calendar digest
 * triggers). Core stores no prose: `key` selects a UI text template.
 *
 * Only the player's club receives economy digest items (AI clubs never read
 * news; this keeps saves small). Keys:
 *   offer.accepted {wage, seasons}          offer.lost {} refs.otherClubId = signing club
 *   offer.countered {counterWage, validUntilWeek}  offer.refused {patienceLeft}
 *   offer.void {reason}                      finance.watch / finance.embargo / finance.embargo-lifted {balance}
 *   finance.registry-advance {amount, registryDebt}
 */
import type { ClubId, FighterId, GameState, NewsId } from '../model';
import { allocateId } from '../model';

export interface NewsInput {
  key: string;
  clubId: ClubId;
  params?: Record<string, string | number>;
  fighterId?: FighterId;
  otherClubId?: ClubId;
  importance?: 'info' | 'notable' | 'urgent';
}

/** Adds a digest item for the player's club; returns its id, or null for AI clubs. */
export function addClubNews(draft: GameState, input: NewsInput): NewsId | null {
  if (draft.playerClubId === null || input.clubId !== draft.playerClubId) return null;
  const id = allocateId(draft.ids, 'news');
  const refs: { fighterId?: FighterId; otherClubId?: ClubId } = {};
  if (input.fighterId !== undefined) refs.fighterId = input.fighterId;
  if (input.otherClubId !== undefined) refs.otherClubId = input.otherClubId;
  draft.news.push({
    id,
    at: { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex },
    key: input.key,
    params: input.params ?? {},
    clubId: input.clubId,
    refs,
    importance: input.importance ?? 'info',
    read: false,
  });
  return id;
}

export function pushNews(out: NewsId[], id: NewsId | null): void {
  if (id !== null) out.push(id);
}
