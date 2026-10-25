/**
 * Helpers for core/league tests only (not exported from index.ts): hand-made
 * MatchResults and a headless season driver that stands in for core/game.
 */
import type { ContentDB } from '../content';
import type {
  ClubId,
  Fighter,
  FighterId,
  FighterMatchStats,
  FightFighterInput,
  Fixture,
  GameState,
  MatchResult,
  SideInput,
} from '../model';
import { asId } from '../model';
import { invariant } from '../util';
import { fixturesForWeek, nextCalendar, recordResult, seedReckonings } from './index';
import { lastRegularWeekIndex, seasonLength } from './calendar';

export interface FakeScore {
  home: number;
  away: number;
  /** Downs suffered by each side (default: losers of each round lose 5, i.e. elimination). */
  homeDowns?: number;
  awayDowns?: number;
}

function stats(clubId: ClubId, downsSuffered: number): FighterMatchStats {
  return {
    clubId,
    roundsPlayed: 0,
    roundsSurvived: 0,
    ticksOnArena: 0,
    damageDealt: 0,
    damageToShields: 0,
    damageTaken: 0,
    healingDone: 0,
    shieldingDone: 0,
    overheal: 0,
    ccAppliedTicks: 0,
    ccReceivedTicks: 0,
    downsInflicted: 0,
    downsSuffered,
    assists: 0,
    focusSpent: 0,
    casts: {},
    ruleFires: [],
    ruleCommittedTicks: [],
    rulesNeverFired: [],
    downs: [],
    opponentIds: [],
  };
}

function side(clubId: ClubId, fighterId: FighterId): SideInput {
  const fighter = { fighterId, slot: 0, row: 'front' } as unknown as FightFighterInput;
  return { clubId, fighters: [fighter], captainIndex: 0, viceCaptainIndex: null, chemistry: 0 };
}

/** A minimal, internally consistent MatchResult for a fixture. */
export function fakeResult(fixture: Fixture, score: FakeScore): MatchResult {
  const homeFighter = asId<FighterId>(`${fixture.homeClubId}#f`);
  const awayFighter = asId<FighterId>(`${fixture.awayClubId}#f`);
  const homeDowns = score.homeDowns ?? 5 * score.away;
  const awayDowns = score.awayDowns ?? 5 * score.home;
  return {
    fixtureId: fixture.id,
    competitionId: fixture.competitionId,
    stage: fixture.stage,
    season: fixture.season,
    weekIndex: fixture.weekIndex,
    weekId: fixture.weekId,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    engineVersion: 0,
    contentHash: 'test',
    input: { seed: 'test', bestOf: fixture.bestOf, home: side(fixture.homeClubId, homeFighter), away: side(fixture.awayClubId, awayFighter) },
    rounds: [],
    score: { home: score.home, away: score.away },
    winnerClubId: score.home > score.away ? fixture.homeClubId : fixture.awayClubId,
    fighterStats: { [homeFighter]: stats(fixture.homeClubId, homeDowns), [awayFighter]: stats(fixture.awayClubId, awayDowns) } as Record<
      Fighter['id'],
      FighterMatchStats
    >,
    mvpFighterId: null,
    hiredBladeIds: [],
  };
}

/** Store a result the way core/game does, then let the league record it. */
export function play(draft: GameState, fixture: Fixture, score: FakeScore, content: ContentDB): MatchResult {
  const result = fakeResult(fixture, score);
  draft.results[fixture.id] = result;
  recordResult(draft, result, content);
  return result;
}

export type Decide = (fixture: Fixture) => FakeScore;

/** Winner-takes-all by a strength function: the stronger club wins 2-0 (or 3-0 in a best-of-5), 2-1 when close. */
export function byStrength(strength: (clubId: ClubId) => number, closeGap = 4): Decide {
  return (f) => {
    const need = (f.bestOf + 1) / 2;
    const h = strength(f.homeClubId);
    const a = strength(f.awayClubId);
    const loserRounds = Math.abs(h - a) <= closeGap ? need - 1 : 0;
    return h > a || (h === a && f.homeClubId < f.awayClubId) ? { home: need, away: loserRounds } : { home: loserRounds, away: need };
  };
}

/** Process one week's fixtures and advance the calendar (seeding the Reckoning after the last regular week). */
export function playWeek(draft: GameState, content: ContentDB, decide: Decide): void {
  const weekIndex = draft.calendar.weekIndex;
  for (const f of fixturesForWeek(draft, weekIndex, content)) {
    if (f.status === 'scheduled') play(draft, f, decide(f), content);
  }
  if (weekIndex === lastRegularWeekIndex(content)) seedReckonings(draft, content);
  draft.calendar = nextCalendar(draft.calendar, content);
}

/** Play every remaining week of the current season (ends in the season-end step). */
export function playSeason(draft: GameState, content: ContentDB, decide: Decide): void {
  invariant(draft.calendar.weekIndex <= seasonLength(content), 'playSeason: the season is already over');
  while (draft.calendar.phase !== 'season-end') playWeek(draft, content, decide);
}
