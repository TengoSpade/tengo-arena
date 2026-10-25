/**
 * Which digest items need the player, without the digest's copy. The frame's badges and
 * "Skip to Matchweek 1" only need this count, so the wording (store/digest.ts) stays in the Home
 * chunk instead of the main bundle (05 bundle budget).
 */
import type { Blocker, ClubId, GameState, NewsItem } from '../../core/model';
import { distinctBlockers } from './messages';

/** At most this many items carry "Needs action" (04 §6.2 notification budget). */
export const NEEDS_ACTION_LIMIT = 2;

/** News keys that need the player whatever their importance. */
export const NEEDS_ACTION_KEYS: ReadonlySet<string> = new Set([
  'fighter.injured',
  'fighter.career_ended',
  'captaincy.losing_the_room',
  'captaincy.interim',
  'captain.interim',
  'finance.registry-advance',
  'contract.expiring',
  'offer.countered',
  'finance.watch',
  'finance.embargo',
]);

/** An injury needs action only while the fighter is in the lineup and still out. */
export function injuryNeedsAction(item: NewsItem, state: GameState | undefined): boolean {
  if (!state || !item.refs.fighterId) return true;
  const f = state.fighters[item.refs.fighterId];
  const club = f?.clubId ? state.clubs[f.clubId] : undefined;
  return !!f?.injury && f.injury.weeksOut > 0 && !!club?.lineup.fighters.some((e) => e.fighterId === f.id);
}

export function newsNeedsAction(item: NewsItem, state: GameState | undefined): boolean {
  if (item.key === 'fighter.injured') return injuryNeedsAction(item, state);
  return item.importance === 'urgent' || NEEDS_ACTION_KEYS.has(item.key);
}

/** The digest's news window: the last processed week and this one, this season, for the club. */
export function digestNews(state: GameState, clubId: ClubId): NewsItem[] {
  const recentWeek = state.calendar.weekIndex - 1;
  return state.news.filter((n) => (n.clubId === clubId || n.clubId === null) && n.at.season === state.calendar.season && n.at.weekIndex >= recentWeek);
}

/** The blockers the digest lists (season end is not one; a consequence blocker is folded into its cause). */
export function digestBlockers(blockers: readonly Blocker[]): Blocker[] {
  return distinctBlockers(blockers.filter((b) => b.code !== 'phase.season-end'));
}

/** How many digest items carry "Needs action" (capped by the notification budget): the badges. */
export function needsActionNow(state: GameState, clubId: ClubId, blockers: readonly Blocker[]): number {
  const n = digestBlockers(blockers).length + digestNews(state, clubId).filter((item) => newsNeedsAction(item, state)).length;
  return Math.min(NEEDS_ACTION_LIMIT, n);
}
