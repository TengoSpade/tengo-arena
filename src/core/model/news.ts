import type { ClubId, FighterId, FixtureId, NewsId } from './ids';

/**
 * Inbox / news item. Core never stores player-facing prose: `key` selects a
 * text template (UI text table or content), `params` fills it. This keeps
 * theme wording in data and makes localization possible.
 */
export interface NewsItem {
  id: NewsId;
  season: number;
  week: number;
  /** e.g. "match.result", "contract.expiring", "fighter.retired". */
  key: string;
  params: Record<string, string | number>;
  refs: { clubId?: ClubId; fighterId?: FighterId; fixtureId?: FixtureId };
  /** Shown prominently / may block advancing until acknowledged. [phase B] which items block. */
  important: boolean;
  read: boolean;
}
