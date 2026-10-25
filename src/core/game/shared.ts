/**
 * Small helpers shared by the season engine: news, rosters, ordering, the
 * lineup-captain rule and post-transition tidying of game-owned club fields
 * (lineup, tactics, captaincy; 05 §3.2).
 */
import type { ContentDB } from '../content';
import {
  allocateId,
  clubRoster,
  idNumber,
  type Club,
  type ClubId,
  type Fighter,
  type FighterId,
  type GameState,
  type LineupEntry,
  type NewsId,
  type NewsItem,
  type TacticsAssignment,
  type TacticsPresetId,
} from '../model';
import { engineError, getOwn, type EngineError } from '../util';
import type { GamePorts } from './ports';

export function fail(code: string, message: string, details?: Record<string, unknown>): { ok: false; error: EngineError } {
  return { ok: false, error: engineError(code, message, details) };
}

export function compareIds(a: string, b: string): number {
  return idNumber(a) - idNumber(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Clubs in tier level, then club id order (05 §3.1). */
export function clubsInOrder(state: GameState, content: ContentDB): Club[] {
  return Object.values(state.clubs).sort((a, b) => {
    const la = content.tiers.get(a.tierId)?.level ?? 99;
    const lb = content.tiers.get(b.tierId)?.level ?? 99;
    return la - lb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

/** Active roster of a club, in fighter id order (a copy: callers may sort it). */
export function rosterOf(state: GameState, clubId: ClubId): Fighter[] {
  return [...clubRoster(state, clubId)];
}

export function onRoster(state: GameState, clubId: ClubId, fighterId: FighterId): Fighter | null {
  const f = getOwn(state.fighters, fighterId);
  return f && f.clubId === clubId && f.status === 'active' ? f : null;
}

export function defaultTactics(content: ContentDB, f: Fighter): TacticsAssignment {
  return { kind: 'preset', presetId: content.classes.require(f.classId).defaultPresetId as TacticsPresetId };
}

/** Append a news item (game is the writer of news; other modules may also allocate and push). */
export function addNews(
  draft: GameState,
  item: { key: string; clubId: ClubId | null; params?: NewsItem['params']; refs?: NewsItem['refs']; importance?: NewsItem['importance'] },
): NewsId {
  const id = allocateId(draft.ids, 'news');
  draft.news.push({
    id,
    at: { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex },
    key: item.key,
    params: item.params ?? {},
    clubId: item.clubId,
    refs: item.refs ?? {},
    importance: item.importance ?? 'info',
    read: false,
  });
  return id;
}

/** News allocated since the counter had the value `fromCounter`. */
export function newsSince(state: GameState, fromCounter: number): NewsId[] {
  const out: NewsId[] = [];
  for (const n of state.news) if (idNumber(n.id) >= fromCounter) out.push(n.id);
  return out;
}

/**
 * Keep game-owned club fields consistent with the roster after anything that
 * can move fighters: lineup entries, tactics, match-captain override and
 * captaincy of fighters who left are removed. A club captain who left is
 * replaced by an interim captain named by the AI rule (03 sys-captaincy:
 * "the game names an interim captain by the AI rule and flags it in the
 * digest").
 */
export function tidyClub(ports: GamePorts, draft: GameState, clubId: ClubId, content: ContentDB): void {
  const club = draft.clubs[clubId];
  if (!club) return;
  const keep = (id: FighterId | null): boolean => id !== null && onRoster(draft, clubId, id) !== null;
  const entries: LineupEntry[] = club.lineup.fighters.filter((e) => keep(e.fighterId));
  if (entries.length !== club.lineup.fighters.length) club.lineup.fighters = entries;
  if (club.lineup.matchCaptainId !== null && !entries.some((e) => e.fighterId === club.lineup.matchCaptainId)) club.lineup.matchCaptainId = null;
  for (const fid of Object.keys(club.lineup.tactics) as FighterId[]) if (!keep(fid)) delete club.lineup.tactics[fid];
  const captainLeft = club.captainId !== null && !keep(club.captainId);
  if (club.viceCaptainId !== null && !keep(club.viceCaptainId)) club.viceCaptainId = null;
  if (captainLeft) {
    club.captainId = null;
    if (rosterOf(draft, clubId).length > 0) {
      const pick = ports.ai.chooseCaptains(draft, clubId, content, 'week');
      club.captainId = pick.captainId;
      if (club.viceCaptainId === null || club.viceCaptainId === club.captainId) club.viceCaptainId = pick.viceCaptainId === club.captainId ? null : pick.viceCaptainId;
      if (clubId === draft.playerClubId && pick.captainId !== null) {
        addNews(draft, { key: GAME_NEWS_KEYS.captainInterim, clubId, refs: { fighterId: pick.captainId }, importance: 'notable' });
      }
    }
  }
}

export function tidyAll(ports: GamePorts, draft: GameState, content: ContentDB): void {
  for (const id of Object.keys(draft.clubs).sort() as ClubId[]) tidyClub(ports, draft, id, content);
}

/** Calendar week id of the trials day (the first week of the calendar). */
export function isFirstWeek(state: GameState): boolean {
  return state.calendar.weekIndex === 1;
}

/** News keys core/game itself writes (other modules document theirs). UI digest templates match on these. */
export const GAME_NEWS_KEYS = {
  /** One per club per played fixture (clubId = that club). params: won (1/0), for, against, opponent (club name), opponentId, venue (home/away); x:<fighterId> = XP and i:<fighterId> = "<severity>:<weeksOut>" for that club's fighters. refs.fixtureId, refs.otherClubId. */
  matchResult: 'match.result',
  /** Player club: the game named an interim captain after the captain left. refs.fighterId = the new captain. */
  captainInterim: 'captain.interim',
} as const;
