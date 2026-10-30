/**
 * Digest items written by lifecycle steps. Core stores no prose: `key`
 * selects a UI text template, `params` fill it (03-fighter-lifecycle player
 * information sections). Keys used by this module:
 *
 *   fighter.injured            {severity, weeksOut, round}           urgent for the club
 *   fighter.career_ended       {}                                   urgent
 *   fighter.scarred            {traitId}
 *   fighter.trait_gained       {traitId}
 *   fighter.trait_lost         {traitId}
 *   fighter.trait_skipped      {traitId}  (trait cap reached, trait-007 log)
 *   fighter.final_season       {age}
 *   fighter.retired            {age, cause}
 *   captaincy.snubbed          {}
 *   captaincy.passed_over      {}
 *   captaincy.losing_the_room  {}
 *   captaincy.departed         {}
 *   captaincy.interim          {}
 */
import { allocateId, type ClubId, type FighterId, type FixtureId, type GameState, type NewsId, type NewsItem } from '../model';

export interface NewsInput {
  key: string;
  clubId: ClubId | null;
  fighterId?: FighterId;
  fixtureId?: FixtureId;
  params?: Record<string, string | number>;
  importance?: NewsItem['importance'];
}

export function pushNews(draft: GameState, input: NewsInput): NewsId {
  const id = allocateId(draft.ids, 'news');
  const refs: NewsItem['refs'] = {};
  if (input.fighterId) refs.fighterId = input.fighterId;
  if (input.fixtureId) refs.fixtureId = input.fixtureId;
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
