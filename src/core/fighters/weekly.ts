/**
 * Lineup lock (captain strip, Snubbed, Passed Over, Losing the Room) and the
 * weekly lifecycle step 3 (injury and status countdown, emphasis weeks,
 * matchweeks at club and as captain, Wore the Armband, captain vacancy, and
 * M1.1 Freshness recovery: rest for every fighter who started no round this
 * week, 80% for an unused squad reserve; +50 × age a preseason week).
 */
import type { ContentDB } from '../content';
import { idNumber, type Club, type ClubId, type Fighter, type FighterId, type GameState, type NewsId } from '../model';
import { checkThresholds } from './acquired';
import { captaincyBreakdown, clubFighters, isCareerEnded, isFitFighter, topFiveMean } from './captaincy';
import { hasStatus } from './effects';
import {
  CAPTAIN_DEPARTED,
  PROVISIONAL_PASSED_OVER_WEEKS,
  PROVISIONAL_SNUBBED_WEEKS,
  PROVISIONAL_STRIP_INJURY_EXEMPT_WEEKS,
  PROVISIONAL_STRIP_MIN_MATCHWEEKS,
  captainLeft,
  matchweeksBetween,
} from './match';
import { pushNews } from './news';
import { fighterHumanAge100, ratingOf } from './stats';
import { tables } from './tables';
import { freshness10Of, preseasonRest10, rest10, setFreshness10 } from './freshness';
import { freshnessOf } from './levels';
import { weekParticipation } from './progression';

export const SNUBBED = 'snubbed';
export const PASSED_OVER = 'passed_over';
export const LOSING_THE_ROOM = 'losing_the_room';

function now(state: GameState): { season: number; weekIndex: number } {
  return { season: state.calendar.season, weekIndex: state.calendar.weekIndex };
}

function isMatchweek(state: GameState, content: ContentDB): boolean {
  if (state.calendar.phase === 'season-end') return false;
  const week = content.weeks.list.find((w) => w.index === state.calendar.weekIndex);
  return week !== undefined && (week.phase === 'regular' || week.phase === 'tournament');
}

function setStatus(f: Fighter, id: string, weeks: number | null, since: { season: number; weekIndex: number }): void {
  f.statuses = f.statuses.filter((s) => s.id !== id);
  f.statuses.push({ id, remainingWeeks: weeks, remainingMatches: null, since });
}

function clearStatus(f: Fighter, id: string): boolean {
  const before = f.statuses.length;
  f.statuses = f.statuses.filter((s) => s.id !== id);
  return f.statuses.length !== before;
}

function atClub(f: Fighter | undefined, clubId: ClubId): f is Fighter {
  return f !== undefined && f.clubId === clubId && f.status === 'active';
}

/**
 * Lineup lock for one club (week processing step 1, before its match).
 * Compares the club captain with the one at the previous lock, so changing
 * captain back and forth between matches is free (cap-003).
 */
export function lockLineup(draft: GameState, clubId: ClubId, content: ContentDB): NewsId[] {
  const club = draft.clubs[clubId];
  if (!club) return [];
  const news: NewsId[] = [];
  const t = now(draft);
  // M1.1: "fielded" = started a round or named a match-squad reserve (development.json losingTheRoom.fieldedMeans).
  const fielded = new Set<string>([...club.lineup.fighters.map((e) => e.fighterId), ...(club.lineup.reserves ?? [])]);

  // Passed Over clears when the fighter is made vice-captain.
  const vice = club.viceCaptainId ? draft.fighters[club.viceCaptainId] : undefined;
  if (vice) clearStatus(vice, PASSED_OVER);

  if (club.captainAtLastLock !== null && club.captainId !== club.captainAtLastLock) {
    news.push(...evaluateCaptainChange(draft, club, club.captainAtLastLock, content));
  }
  if (club.captainId !== club.captainAtLastLock || club.captainSince === null) {
    club.captainSince = club.captainId ? t : null;
  }
  club.captainAtLastLock = club.captainId;

  // Losing the Room: a fit club captain not fielded in 4+ consecutive matches (status before this match counts them).
  const captain = club.captainId ? draft.fighters[club.captainId] : undefined;
  const threshold = content.development.captaincy.losingTheRoom.consecutiveMatchesNotFieldedWhileFit;
  if (captain && atClub(captain, clubId)) {
    if (fielded.has(captain.id)) {
      clearStatus(captain, LOSING_THE_ROOM);
      club.captainNotFieldedStreak = 0;
    } else if (isFitFighter(captain) && freshnessOf(captain) < content.development.captaincy.losingTheRoom.freshnessRestExemptBelow) {
      // A rest (cap-011): a tired captain left out of the squad neither extends nor resets the count.
    } else if (isFitFighter(captain)) {
      if (club.captainNotFieldedStreak >= threshold && !hasStatus(captain, LOSING_THE_ROOM)) {
        setStatus(captain, LOSING_THE_ROOM, null, t);
        news.push(pushNews(draft, { key: 'captaincy.losing_the_room', clubId, fighterId: captain.id, importance: 'notable' }));
      }
      club.captainNotFieldedStreak += 1;
    }
  } else {
    club.captainNotFieldedStreak = 0;
  }
  return news;
}

/** Why a replaced club captain is not Snubbed (or null when he is). */
export type SnubExemption = 'preseason' | 'injured' | 'final-season' | 'made-vice' | 'short-tenure' | 'not-at-club';

export interface CaptainChangeConsequences {
  /** The replaced captain who gets Snubbed at the next lineup lock, if any. */
  snubbedId: FighterId | null;
  /** Why the replaced captain is spared, when there is one and he is not Snubbed. */
  snubExemption: SnubExemption | null;
  /** Club-mates who get Passed Over. */
  passedOverIds: FighterId[];
}

/** Whether replacing previousId Snubs him at a lineup lock in the current week (pure). */
export function snubOutcome(
  state: GameState,
  clubId: ClubId,
  previousId: FighterId | null,
  captainId: FighterId | null,
  viceId: FighterId | null,
  captainSince: { season: number; weekIndex: number } | null,
  content: ContentDB,
): { snubbedId: FighterId | null; snubExemption: SnubExemption | null } {
  if (previousId === null || previousId === captainId) return { snubbedId: null, snubExemption: null };
  const t = now(state);
  const prev = state.fighters[previousId];
  // "Change made before MW1": at the season's first match lock every change since the
  // previous lock happened in the off-season or preseason.
  const firstMatchweek = tables(content).matchweekIndexes[0];
  const preseason = state.calendar.phase === 'preseason' || state.calendar.weekIndex === firstMatchweek;
  // Snubbed: the previous captain, still at the club and fit, who held the role >= 4 matchweeks, unless exempt.
  if (prev && atClub(prev, clubId) && isFitFighter(prev) && captainSince) {
    const held = matchweeksBetween(captainSince, t, content);
    const injuredLong = prev.injury !== null && prev.injury.weeksOut >= PROVISIONAL_STRIP_INJURY_EXEMPT_WEEKS;
    const exemption: SnubExemption | null = injuredLong
      ? 'injured'
      : prev.finalSeason
        ? 'final-season'
        : preseason
          ? 'preseason'
          : viceId === prev.id
            ? 'made-vice'
            : held < PROVISIONAL_STRIP_MIN_MATCHWEEKS
              ? 'short-tenure'
              : null;
    return exemption === null ? { snubbedId: prev.id, snubExemption: null } : { snubbedId: null, snubExemption: exemption };
  }
  return { snubbedId: null, snubExemption: prev ? 'not-at-club' : null };
}

/** Passed Over: fit club-mates with human-age >= 30 and CQ >= new captain's CQ + 15, not vice-captain (pure). */
export function passedOverIds(state: GameState, clubId: ClubId, captainId: FighterId | null, viceId: FighterId | null, content: ContentDB): FighterId[] {
  const out: FighterId[] = [];
  const newCaptain = captainId ? state.fighters[captainId] : undefined;
  if (!newCaptain) return out;
  const po = content.development.captaincy.passedOver;
  const mean = topFiveMean(state, clubId, content);
  const newCq = captaincyBreakdown(newCaptain, content, mean).cq;
  for (const f of clubFighters(state, clubId)) {
    if (f.id === newCaptain.id || f.id === viceId || !isFitFighter(f)) continue;
    if (fighterHumanAge100(f, content) < po.minHumanAge * 100) continue;
    if (captaincyBreakdown(f, content, mean).cq < newCq + po.cqGap) continue;
    out.push(f.id);
  }
  return out;
}

/**
 * The status consequences of replacing previousId by captainId (vice viceId)
 * at a lineup lock in the current week, exactly as lockLineup applies them
 * (Snubbed first, then Passed Over with the Snubbed status in place). Pure:
 * the captaincy preview (core/game) shows them before the player commits.
 */
export function captainChangeConsequences(
  state: GameState,
  clubId: ClubId,
  previousId: FighterId | null,
  captainId: FighterId | null,
  viceId: FighterId | null,
  captainSince: { season: number; weekIndex: number } | null,
  content: ContentDB,
): CaptainChangeConsequences {
  if (previousId === null || previousId === captainId) return { snubbedId: null, snubExemption: null, passedOverIds: [] };
  const snub = snubOutcome(state, clubId, previousId, captainId, viceId, captainSince, content);
  let view = state;
  if (snub.snubbedId !== null) {
    const prev: Fighter = { ...state.fighters[snub.snubbedId]!, statuses: [...state.fighters[snub.snubbedId]!.statuses] };
    setStatus(prev, content.development.captaincy.strip.penaltyStatus || SNUBBED, PROVISIONAL_SNUBBED_WEEKS, now(state));
    view = { ...state, fighters: { ...state.fighters, [prev.id]: prev } };
  }
  return { ...snub, passedOverIds: passedOverIds(view, clubId, captainId, viceId, content) };
}

function evaluateCaptainChange(draft: GameState, club: Club, previousId: FighterId, content: ContentDB): NewsId[] {
  const news: NewsId[] = [];
  const t = now(draft);
  const snub = snubOutcome(draft, club.id, previousId, club.captainId, club.viceCaptainId, club.captainSince, content);
  if (snub.snubbedId !== null) {
    const prev = draft.fighters[snub.snubbedId]!;
    setStatus(prev, content.development.captaincy.strip.penaltyStatus || SNUBBED, PROVISIONAL_SNUBBED_WEEKS, t);
    news.push(pushNews(draft, { key: 'captaincy.snubbed', clubId: club.id, fighterId: prev.id, importance: 'notable' }));
  }
  const po = content.development.captaincy.passedOver;
  for (const id of passedOverIds(draft, club.id, club.captainId, club.viceCaptainId, content)) {
    setStatus(draft.fighters[id]!, po.status || PASSED_OVER, PROVISIONAL_PASSED_OVER_WEEKS, t);
    news.push(pushNews(draft, { key: 'captaincy.passed_over', clubId: club.id, fighterId: id }));
  }
  return news;
}

/** Interim captain by the AI rule: highest CQ among fit roster fighters (ties: seniority, rating, id). */
export function interimCaptainOf(state: GameState, clubId: ClubId, content: ContentDB, exclude: FighterId | null = null): FighterId | null {
  const mean = topFiveMean(state, clubId, content);
  const ranked = clubFighters(state, clubId)
    .filter((f) => f.id !== exclude && isFitFighter(f))
    .map((f) => ({ f, cq: captaincyBreakdown(f, content, mean).cq, rating: ratingOf(f, content) }))
    .sort(
      (a, b) =>
        b.cq - a.cq ||
        b.f.career.matchweeksAtClub - a.f.career.matchweeksAtClub ||
        b.rating - a.rating ||
        idNumber(a.f.id) - idNumber(b.f.id) ||
        (a.f.id < b.f.id ? -1 : 1),
    );
  return ranked[0]?.f.id ?? null;
}

export function weekly(draft: GameState, content: ContentDB): NewsId[] {
  const news: NewsId[] = [];
  const t = now(draft);
  const matchweek = isMatchweek(draft, content);
  const trainingOn = content.development.training.enabled && draft.options.trainingEmphasis;
  const fighters = Object.values(draft.fighters).sort((a, b) => idNumber(a.id) - idNumber(b.id) || (a.id < b.id ? -1 : 1));
  const preseason = draft.calendar.phase === 'preseason';
  const played = matchweek ? weekParticipation(draft) : null;

  for (const f of fighters) {
    if (f.status === 'retired') continue;
    // Freshness recovery (sys-freshness): before the injury countdown, from this week's results.
    if (preseason) setFreshness10(f, freshness10Of(f) + preseasonRest10(f, content));
    else if (played && !played.started.has(f.id)) {
      setFreshness10(f, freshness10Of(f) + rest10(f, content, played.reserves.has(f.id)));
      f.season.restWeeks += 1;
    }
    // Injury countdown (not the week the injury happened; career-ending injuries never count down).
    if (f.injury && f.injury.weeksOut > 0 && !isCareerEnded(f)) {
      const fresh = f.injury.since.season === t.season && f.injury.since.weekIndex === t.weekIndex;
      if (!fresh) {
        f.injury.weeksOut -= 1;
        if (f.injury.weeksOut <= 0) {
          f.injury.weeksOut = 0;
          if (f.injury.severity !== 'serious') f.injury = null;
        }
      }
    }
    // Week-counted statuses run on matchweeks.
    if (matchweek) {
      for (const s of f.statuses) if (s.remainingWeeks !== null) s.remainingWeeks -= 1;
      f.statuses = f.statuses.filter((s) => s.remainingWeeks === null || s.remainingWeeks > 0);
    }
    // Emphasis weeks (everyone; an emphasis set while injured still counts).
    const emphasis = trainingOn ? f.trainingEmphasis : 'balanced';
    f.season.emphasisWeeks[emphasis] = (f.season.emphasisWeeks[emphasis] ?? 0) + 1;
    if (matchweek && f.clubId && f.status === 'active') f.career.matchweeksAtClub += 1;
  }

  for (const club of Object.values(draft.clubs).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (matchweek) {
      for (const s of club.statuses) if (s.remainingWeeks !== null) s.remainingWeeks -= 1;
      club.statuses = club.statuses.filter((s) => s.remainingWeeks === null || s.remainingWeeks > 0);
    }
    if (!club.captainId) continue;
    const captain = draft.fighters[club.captainId];
    const vacant = !captain || captain.clubId !== club.id || captain.status !== 'active' || isCareerEnded(captain);
    if (vacant) {
      // Departed mid-season (release, career-ending injury): Captain Departed if held >= 19 matchweeks
      // (a career-ending injury already applied it at match end), then an interim captain by the AI rule.
      if (!(captain && isCareerEnded(captain)) && !club.statuses.some((s) => s.id === CAPTAIN_DEPARTED)) news.push(...captainLeft(draft, club.id, content));
      const interim = interimCaptainOf(draft, club.id, content, club.captainId);
      club.captainId = interim;
      if (club.viceCaptainId === interim) club.viceCaptainId = null;
      club.captainSince = interim ? t : null;
      club.captainAtLastLock = interim;
      club.captainNotFieldedStreak = 0;
      if (interim) news.push(pushNews(draft, { key: 'captaincy.interim', clubId: club.id, fighterId: interim, importance: 'notable' }));
      continue;
    }
    if (matchweek) {
      captain.career.matchweeksAsClubCaptain += 1;
      captain.season.captainWeeksByClub[club.id] = (captain.season.captainWeeksByClub[club.id] ?? 0) + 1;
      for (const c of checkThresholds(captain, 'weekProcessing', t.season, content, draft.rng.root)) {
        news.push(pushNews(draft, { key: c.change === 'skipped' ? 'fighter.trait_skipped' : `fighter.trait_${c.change}`, clubId: club.id, fighterId: captain.id, params: { traitId: c.traitId } }));
      }
    }
  }
  return news;
}
