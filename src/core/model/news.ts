import type { GameTime } from './calendar';
import type { ClubId, FighterId, FixtureId, NewsId } from './ids';

/**
 * Digest / inbox item. Core stores no prose: `key` selects a text template
 * (UI text table), `params` fill it (03-league-economy digest triggers,
 * 03-fighter-lifecycle notifications).
 */
export interface NewsItem {
  id: NewsId;
  at: GameTime;
  /** e.g. "match.result", "offer.accepted", "contract.expiring", "fighter.injured", "finance.embargo". */
  key: string;
  params: Record<string, string | number>;
  /** Which club's digest shows it (null = league-wide). */
  clubId: ClubId | null;
  refs: { fighterId?: FighterId; fixtureId?: FixtureId; otherClubId?: ClubId };
  importance: 'info' | 'notable' | 'urgent';
  read: boolean;
}
