/**
 * Week processing (03 sys-calendar; leagues.json calendar.weekProcessingOrder;
 * 05 §3.3): one atomic commit for every club, in this order:
 *  1 simulate remaining fixtures (lineup lock, hired blades)
 *  2 record results and standings        7 P1 only: unsigned trials rookies to the pool
 *  3 lifecycle weekly                    8 free-agent decisions
 *  4 income                              9 AI action phase (tier, then club id order)
 *  5 costs                              10 pool floor top-up
 *  6 financial status                   11 advance the calendar (+ seed the Reckoning), digest
 *                                       12 compact aged matches between other clubs (matchRecords)
 * The UI store autosaves after success. The input state is never mutated.
 */
import type { ContentDB } from '../content';
import {
  beginTransition,
  idNumber,
  putResult,
  type Club,
  type ClubId,
  type Fighter,
  type FighterId,
  type Fixture,
  type FixtureId,
  type GameState,
  type MatchResult,
  type MatchSquad,
  type MatchState,
  type StartingRow,
  type WeekReport,
} from '../model';
import { NotImplementedError, engineError, err, ok, type EngineError, type Result } from '../util';
import { applyToDraft } from './commands';
import { addMatchNews, eligibleEntries } from './match';
import {
  WatchMismatchError,
  applyBetweenRound,
  autoDecisions,
  betweenRounds,
  finishMatch,
  playMatchAuto,
  playRound,
  playerSideOf,
  startMatch,
  type BetweenRoundView,
  type LockedSquads,
} from './orchestrator';
import type { AdvanceOptions, WatchPause } from './playback';
import type { GamePorts } from './ports';
import { GAME_NEWS_KEYS, addNews, clubsInOrder, compareIds, defaultTactics, newsSince, onRoster, rosterOf, tidyAll } from './shared';
import { getBlockers } from './views';

/** Commands an AI club issued that the rulebook refused (diagnostics; the soak counts them). */
export interface AiRejection {
  clubId: ClubId;
  type: string;
  code: string;
}

export interface PhaseLog {
  rejections: AiRejection[];
}

/** AI action phase over every non-player club (tier level, then club id), applying commands in order. */
export function runAiPhase(
  ports: GamePorts,
  draft: GameState,
  content: ContentDB,
  plan: (state: GameState, clubId: ClubId) => ReturnType<GamePorts['ai']['planWeek']>,
  log: PhaseLog,
): void {
  ports.ai.beginPhase();
  for (const club of clubsInOrder(draft, content)) {
    if (club.id === draft.playerClubId) continue;
    for (const cmd of plan(draft, club.id)) {
      const r = applyToDraft(ports, draft, cmd, content);
      if (!r.ok) log.rejections.push({ clubId: club.id, type: cmd.type, code: r.error.code });
    }
  }
}

/**
 * D-S, at kickoff: a club whose captain is missing (none named, or no longer on
 * its roster) gets one automatically: the vice-captain if fit, else the fit
 * starter with the highest CQ (ties: matchweeks at the club, then id), named
 * interim captain with a captain.interim news item. Same rule for the player's
 * and AI clubs, so a missing captain never blocks Play. A captain who is only
 * unavailable this week keeps the job; the fight is then led by the vice, else
 * the best-CQ starter (fighters.lineupCaptain). A lineup of hired blades only
 * leaves the club without a captain; a blade leads as acting captain.
 */
export function autoCaptain(ports: GamePorts, draft: GameState, club: Club, content: ContentDB): FighterId | null {
  if (club.captainId !== null && onRoster(draft, club.id, club.captainId) !== null) return null;
  const fit = (id: FighterId | null): Fighter | null => {
    const f = id === null ? null : onRoster(draft, club.id, id);
    return f && ports.fighters.isFit(f) ? f : null;
  };
  club.captainId = null;
  const vice = fit(club.viceCaptainId);
  // No vice: the fit starter with the highest CQ (ties: matchweeks at the club, then id).
  let pick = vice?.id ?? null;
  let best = -1;
  for (const e of vice ? [] : club.lineup.fighters) {
    const f = fit(e.fighterId);
    const score = f ? ports.fighters.captaincy(draft, f.id, club.id, content).cq * 10_000 + Math.min(9_999, f.career.matchweeksAtClub) : -1;
    if (f && (score > best || (score === best && compareIds(f.id, pick!) < 0))) [pick, best] = [f.id, score];
  }
  if (pick === null) return null;
  club.captainId = pick;
  if (club.viceCaptainId === pick) club.viceCaptainId = null;
  addNews(draft, { key: GAME_NEWS_KEYS.captainInterim, clubId: club.id, refs: { fighterId: pick }, params: { reason: vice ? 'vice' : 'starter' }, importance: 'notable' });
  return pick;
}

/**
 * "Needs action" (contract.expiring, urgent): at the processing that leaves
 * economy.json contracts.expiryReminderWeeksBeforeEnd weeks in the season, one
 * item per player-club fighter whose contract ends this season, is not renewed
 * and is not retiring. Renewals stay open until the season-end expiry step.
 */
function remindExpiringContracts(draft: GameState, weekIndex: number, content: ContentDB): void {
  const club = draft.playerClubId;
  const weeks = content.leagues.calendar.weeks.length;
  if (club === null || weekIndex !== weeks - content.economy.contracts.expiryReminderWeeksBeforeEnd) return;
  const season = draft.calendar.season;
  const expiring = rosterOf(draft, club).filter((f) => f.contract?.endSeason === season && !f.contract.next && !f.finalSeason);
  for (const f of expiring) {
    addNews(draft, { key: GAME_NEWS_KEYS.contractExpiring, clubId: club, refs: { fighterId: f.id }, params: { count: expiring.length, season, weeksLeft: weeks - weekIndex }, importance: 'urgent' });
  }
}

/**
 * Lock the match squads of the clubs playing this week: 5 starters (hired
 * blades fill short-handed sides, open-006) and 0-2 fit reserves who are not
 * starting. The locked squad is written back to Club.lineup, so a week that
 * waits at the player's between-round step plays the other matches from the
 * same squads when it resumes.
 */
function lockSquads(ports: GamePorts, draft: GameState, fixtures: readonly Fixture[], content: ContentDB): void {
  const playing: ClubId[] = [];
  for (const fx of fixtures) for (const c of [fx.homeClubId, fx.awayClubId]) if (!playing.includes(c)) playing.push(c);
  const ordered = clubsInOrder(draft, content).filter((c) => playing.includes(c.id));
  for (const club of ordered) autoCaptain(ports, draft, club, content);
  for (const club of ordered) ports.fighters.lineupLock(draft, club.id, content);
  const assigned = ports.economy.assignHiredBlades(draft, content);
  const reservesMax = content.combat.match.squad.reservesMax;
  const rowOf = (id: FighterId) => content.classes.require(draft.fighters[id]!.classId).startingRow;

  for (const club of ordered) {
    const entries = eligibleEntries(ports, draft, club).filter((e) => draft.fighters[e.fighterId]?.status !== 'hired-blade');
    const fitReserve = (id: FighterId): boolean => {
      const f = onRoster(draft, club.id, id);
      return f !== null && ports.fighters.isFit(f) && !entries.some((e) => e.fighterId === id);
    };
    for (const id of assigned[club.id] ?? []) {
      if (entries.length >= 5) break;
      const f = draft.fighters[id];
      if (!f || entries.some((e) => e.fighterId === id)) continue;
      entries.push({ fighterId: id, row: rowOf(id) });
    }
    if (entries.length < 5) {
      // Safety net: named reserves first, then fit roster fighters left out (the player is held by getBlockers).
      for (const id of club.lineup.reserves) if (entries.length < 5 && fitReserve(id)) entries.push({ fighterId: id, row: rowOf(id) });
      for (const f of rosterOf(draft, club.id).sort((a, b) => ports.fighters.rating(b, content) - ports.fighters.rating(a, content))) {
        if (entries.length >= 5) break;
        if (!ports.fighters.isFit(f) || entries.some((e) => e.fighterId === f.id)) continue;
        entries.push({ fighterId: f.id, row: rowOf(f.id) });
      }
    }
    if (entries.length < 5) throw new LineupError(club.id, entries.length);
    // The locked squad (hired blades labelled in it) is what the club fields; blades leave after the match.
    club.lineup.fighters = entries.map((e) => ({ fighterId: e.fighterId, row: e.row }));
    club.lineup.reserves = club.lineup.reserves.filter(fitReserve).slice(0, reservesMax);
    for (const id of [...entries.map((e) => e.fighterId), ...club.lineup.reserves]) {
      if (!club.lineup.tactics[id]) club.lineup.tactics[id] = defaultTactics(content, draft.fighters[id]!);
    }
  }
}

/** A club's locked match squad (Club.lineup after lockSquads). */
export function squadOf(draft: GameState, club: Club, content: ContentDB): MatchSquad {
  const rows = {} as Record<FighterId, StartingRow>;
  for (const e of club.lineup.fighters) rows[e.fighterId] = e.row;
  for (const id of club.lineup.reserves) rows[id] = content.classes.require(draft.fighters[id]!.classId).startingRow;
  return {
    starters: club.lineup.fighters.map((e) => e.fighterId),
    reserves: [...club.lineup.reserves],
    rows,
    captainId: club.captainId,
    viceCaptainId: club.viceCaptainId,
  };
}

function squadsOf(draft: GameState, fx: Fixture, content: ContentDB): LockedSquads {
  return { home: squadOf(draft, draft.clubs[fx.homeClubId]!, content), away: squadOf(draft, draft.clubs[fx.awayClubId]!, content) };
}

class LineupError extends Error {
  constructor(
    readonly clubId: ClubId,
    readonly have: number,
  ) {
    super(`${clubId} cannot field 5 fighters (has ${have}, no hired blades assigned)`);
  }
}

export interface WeekOutcome {
  state: GameState;
  report: WeekReport;
  log: PhaseLog;
}

/**
 * advance(): the week's report once it is processed, or the between-round screen of the player's match, or (M2) the
 * player's next round waiting to be watched (state.liveMatch set for both).
 */
export interface LiveWeekOutcome {
  state: GameState;
  report: WeekReport | null;
  pause: BetweenRoundView | null;
  /** M2 (additive): the player's round that waits to be watched (liveMatch phase round_pending, watch.round set). */
  watch?: WatchPause | null;
  log: PhaseLog;
}

interface WeekRun {
  draft: GameState;
  newsFrom: number;
  ledgerFrom: number;
  log: PhaseLog;
}

/** Whether the player's match pauses at this step (combat sys-match pacing; AI-vs-AI matches never pause). */
function pauseHere(draft: GameState, ms: MatchState, view: BetweenRoundView): boolean {
  if (view.playerSide === null) return false;
  switch (draft.clubs[ms[view.playerSide].clubId]?.pauseBetweenRounds) {
    case 'always':
      return true;
    case 'when_urgent':
      return view.urgent;
    default:
      return false;
  }
}

/** Where the player's match stopped: its between-round screen, or (M2, Watch) its next round waiting for the viewer. */
type PlayerMatchStop = { kind: 'pause'; view: BetweenRoundView } | { kind: 'watch' } | null;

/** M2: the player watches this match (liveMatch.watch.mode 'watch'); absent or 'simulate' is the M1.1 flow. */
function watching(ms: MatchState): boolean {
  return ms.watch?.mode === 'watch';
}

/**
 * Play the player's started match on: each between-round step either pauses
 * (`canPause` and the club's pacing) and returns the screen, or takes the
 * decisions (the player's match.swap decisions at the first step if he made
 * them, else the auto-swap suggestions; the other side always decides by its
 * own auto rules, blind) and plays the next round.
 *
 * M2, Watch (05-technical-m2 §A3; owner answer to Q60, option A): a round of a watched match is never played
 * here unless the viewer showed it. The pending round is played (committed) only with `shownLogHash`, the hash
 * of the log the viewer showed, which playRound compares in every build; otherwise the match stops with that round
 * waiting to be watched (`watch.round` set, cursor 0), its inputs already fixed by the lock and the steps before it,
 * and the caller autosaves before the viewer opens.
 */
function runPlayerMatch(
  ports: GamePorts,
  draft: GameState,
  ms: MatchState,
  content: ContentDB,
  canPause: boolean,
  resuming: boolean,
  shownLogHash?: string,
): PlayerMatchStop {
  // Resuming at a between-round step: that step was on screen and the player pressed Continue (his match.swap
  // decisions, else the suggestions). Resuming at a pending round (M2: a watched round, or the round "Simulate the
  // rest" commits) shows the next step as usual.
  let shown = resuming && ms.phase === 'between_rounds';
  let hash = shownLogHash;
  while (ms.phase !== 'done') {
    if (ms.phase === 'between_rounds') {
      if (canPause && !shown) {
        const view = betweenRounds(ports, draft, ms, content);
        if (pauseHere(draft, ms, view)) return { kind: 'pause', view };
      }
      const auto = autoDecisions(ports, draft, ms, content);
      const side = playerSideOf(draft, ms);
      if (side !== null && ms.playerDecisions !== null) auto[side] = ms.playerDecisions;
      applyBetweenRound(ports, draft, ms, auto, content);
      shown = false;
    }
    if (watching(ms)) {
      if (hash === undefined) {
        // The round waits for the viewer: its inputs are fixed now (prepareRound reads nothing that can still change).
        ms.watch = { mode: 'watch', round: ms.rounds.length + 1, cursorTick: 0, calls: [] };
        return { kind: 'watch' };
      }
      playRound(ports, draft, ms, content, { shownLogHash: hash });
      hash = undefined;
      ms.watch = { mode: 'watch', round: null, cursorTick: 0, calls: [] };
      continue;
    }
    playRound(ports, draft, ms, content);
  }
  return null;
}

/** AdvanceOutcome.watch of a match that waits for the viewer. */
function watchPauseOf(ms: MatchState): WatchPause {
  return { fixtureId: ms.fixtureId, round: ms.watch!.round!, cursorTick: ms.watch!.cursorTick };
}

/** The outcome of a player's match that stopped (between rounds or waiting for the viewer): state.liveMatch is set. */
function stopped(draft: GameState, ms: MatchState, stop: Exclude<PlayerMatchStop, null>, log: PhaseLog): LiveWeekOutcome {
  draft.liveMatch = ms;
  return stop.kind === 'pause' ? { state: draft, report: null, pause: stop.view, watch: null, log } : { state: draft, report: null, pause: null, watch: watchPauseOf(ms), log };
}

/** Round XP of the rounds started, the bench XP of the fighters who started none, and the injuries the round hooks set, for one match's news items. */
function matchNewsOutcome(draft: GameState, result: MatchResult, outcome: ReturnType<GamePorts['fighters']['matchEndProgression']>) {
  const xp: Record<FighterId, number> = { ...(outcome.xp ?? {}) };
  const benchXp: Record<FighterId, number> = { ...outcome.benchXp };
  const injuries: { fighterId: FighterId; severity: string; weeksOut: number }[] = [];
  for (const id of Object.keys(result.fighterStats) as FighterId[]) {
    const inj = draft.fighters[id]?.injury;
    if (inj && inj.fixtureId === result.fixtureId) injuries.push({ fighterId: id, severity: inj.severity, weeksOut: inj.weeksOut });
  }
  return { xp, benchXp, injuries };
}

/**
 * Policy level-ups still pending after match end: AI clubs resolve every
 * offer by auto-pick ('auto', P-04: the same resolveLevelUp as the player's
 * levelup.choose), player fighters whose effective mode is not manual by
 * their mode. A no-op when core/fighters' matchEndProgression already did it.
 */
function autoResolveLevelUps(ports: GamePorts, draft: GameState, result: MatchResult, content: ContentDB): void {
  for (const id of clubFighterIds(draft, [result.homeClubId, result.awayClubId])) {
    const f = draft.fighters[id]!;
    if (f.pendingLevelUps.length === 0) continue;
    const mode = f.clubId === draft.playerClubId ? ports.fighters.effectiveLevelUpMode(draft, f) : 'auto';
    if (mode === 'manual') continue;
    for (const offer of [...f.pendingLevelUps]) {
      const choice = ports.fighters.autoPickChoice(f, offer, mode, content, ports.fighters.offerContextOf(draft, f, content));
      const r = ports.fighters.resolveLevelUp(draft, id, offer.level, choice, 'auto', content);
      if (!r.ok) break;
    }
  }
}

function clubFighterIds(draft: GameState, clubIds: readonly ClubId[]): FighterId[] {
  const out: FighterId[] = [];
  for (const c of clubIds) for (const f of rosterOf(draft, c)) out.push(f.id);
  return out;
}

/** Steps 1 (the matches not yet played) to 11, once the player's match is over. */
function finishWeek(ports: GamePorts, run: WeekRun, playerResult: MatchResult | null, content: ContentDB): WeekReport {
  const { draft, log } = run;
  const cal = draft.calendar;
  const fixtures = ports.league.fixturesForWeek(draft, cal.weekIndex, content).filter((f) => f.status === 'scheduled');
  // 1. Simulate every other fixture of the week from the locked squads (auto decisions on both sides).
  const byId = new Map<FixtureId, MatchResult>();
  if (playerResult) {
    putResult(draft, playerResult);
    byId.set(playerResult.fixtureId, playerResult);
  }
  for (const fx of fixtures) {
    if (byId.has(fx.id)) continue;
    const result = playMatchAuto(ports, draft, fx, squadsOf(draft, fx, content), content);
    putResult(draft, result);
    byId.set(fx.id, result);
  }
  const results = fixtures.map((fx) => byId.get(fx.id)!).filter((r) => r !== undefined);
  // 2. Results, standings and brackets.
  for (const r of results) ports.league.recordResult(draft, r, content);
  // 3. Lifecycle: match end per match (round XP committed, bench XP, level-ups), then the weekly step.
  const levelUps: { fighterId: FighterId; level: number }[] = [];
  for (const r of results) {
    const outcome = ports.fighters.matchEndProgression(draft, r, content);
    autoResolveLevelUps(ports, draft, r, content);
    addMatchNews(draft, r, matchNewsOutcome(draft, r, outcome));
    for (const u of outcome.levelUps) if (draft.fighters[u.fighterId]?.clubId === draft.playerClubId && draft.playerClubId !== null) levelUps.push(u);
  }
  ports.fighters.weeklyLifecycle(draft, content);
  // 4-6. Money.
  ports.economy.weeklyIncome(draft, content);
  ports.economy.weeklyCosts(draft, content);
  ports.economy.financialStatus(draft, content);
  // 7. Trials day only.
  if (cal.weekIndex === 1) ports.economy.releaseTrialsRookies(draft, content);
  // 8. Free agents decide.
  ports.economy.resolveFreeAgentOffers(draft, content);
  // Hired blades leave after their match (open-006); lineups drop fighters who left.
  tidyAll(ports, draft, content);
  // 9. AI action phase.
  runAiPhase(ports, draft, content, (s, c) => ports.ai.planWeek(s, c, content), log);
  // 10. Pool floors.
  ports.economy.topUpFreeAgentPool(draft, content);
  remindExpiringContracts(draft, cal.weekIndex, content);
  // 11. The Reckoning is seeded after the last regular week, then the calendar moves on.
  if (cal.weekIndex === ports.league.lastRegularWeekIndex(content)) ports.league.seedReckonings(draft, content);
  draft.calendar = ports.league.nextCalendar(cal, content);
  tidyAll(ports, draft, content);
  // 12. Matches between other clubs that are `matchRecords.compactAiMatchesAfterWeeks` weeks old lose their detail (the
  // last weeks, and the player's matches, stay in full). After every step: nothing above reads an aged match's detail.
  ports.league.compactAgedResults(draft, cal.season, cal.weekIndex, content);

  const playerClubId = draft.playerClubId;
  const playerFixture = playerClubId === null ? undefined : results.find((r) => r.homeClubId === playerClubId || r.awayClubId === playerClubId);
  const report: WeekReport = {
    season: cal.season,
    weekIndex: cal.weekIndex,
    weekId: content.weekByIndex(cal.weekIndex).id as WeekReport['weekId'],
    phaseAfter: draft.calendar.phase,
    fixtureIds: results.map((r) => r.fixtureId),
    playerFixtureId: playerFixture?.fixtureId ?? null,
    newsIds: newsSince(draft, run.newsFrom),
    ledgerSeqFrom: run.ledgerFrom,
    ledgerSeqTo: draft.ledger.nextSeq,
  };
  if (levelUps.length > 0) report.levelUps = levelUps;
  return report;
}

function guarded(run: () => LiveWeekOutcome): Result<LiveWeekOutcome, EngineError> {
  try {
    return ok(run());
  } catch (e) {
    if (e instanceof NotImplementedError) throw e; // a stubbed module: callers (UI dev fallback, soak) handle it
    if (e instanceof LineupError) return err(engineError('lineup.unfillable', e.message, { clubId: e.clubId, have: e.have }));
    if (e instanceof WatchMismatchError) return err(engineError('watch.mismatch', e.message, { fixtureId: e.fixtureId, round: e.round, reason: 'log' }));
    return err(engineError('engine.failure', `Week processing failed: ${e instanceof Error ? e.message : String(e)}`, { name: e instanceof Error ? e.name : 'unknown' }));
  }
}

/** First news counter of this processing on resume: the oldest item stamped with the processing week (commands that write news are refused while a match is live). */
function newsFromOnResume(draft: GameState): number {
  const { season, weekIndex } = draft.calendar;
  const first = draft.news.find((n) => n.at.season === season && n.at.weekIndex === weekIndex);
  return first ? idNumber(first.id) : draft.ids.news;
}

/**
 * M2: may this advance commit the live match's next round? A watched match (liveMatch.watch.mode 'watch') commits a
 * round only with the hash of the log the viewer showed for exactly that round (AdvanceOptions.watched, 05-technical-m2
 * §A3). Refusals, before anything is copied or written:
 * - 'watch.not-shown' (details fixtureId, round): no shown log while a round waits to be watched, or a caller that
 *   cannot stop at the next round (advanceWeek: it would play the next round unshown). The UI routes it to #/arena.
 * - 'watch.mismatch' (details reason 'round'): `watched` names another round, or no round waits to be watched (a
 *   stale or repeated finishRound must never play on, let alone start the next week). A wrong hash for the right
 *   round is refused by playRound ('watch.mismatch', reason 'log').
 */
function watchRefusal(state: GameState, canPause: boolean, options: AdvanceOptions): EngineError | null {
  const ms = state.liveMatch;
  const pending = ms !== null && ms.watch?.mode === 'watch' && ms.phase === 'round_pending' ? ms.watch.round : null;
  if (options.watched !== undefined) {
    if (pending !== null && options.watched.round === pending) return null;
    return engineError('watch.mismatch', pending === null ? 'No watched round is waiting to be committed' : `Round ${pending} is being watched, not round ${options.watched.round}`, {
      fixtureId: ms?.fixtureId ?? null,
      round: pending,
      watchedRound: options.watched.round,
      reason: 'round',
    });
  }
  if (ms !== null && ms.watch?.mode === 'watch' && (pending !== null || !canPause)) {
    return engineError('watch.not-shown', `Round ${pending ?? ms.rounds.length + 1} of the match in progress is being watched: finish it in the arena`, {
      fixtureId: ms.fixtureId,
      round: pending ?? ms.rounds.length + 1,
    });
  }
  return null;
}

/**
 * Week processing with the player's match played round by round (05 M1.1
 * addendum). `canPause` false (advanceWeek, the soak) plays the whole week
 * at once with the auto rules for the player's between-round steps; true
 * (advance) stops at a step per the club's pauseBetweenRounds with
 * GameState.liveMatch set: every completed round is committed (P-05), and the
 * next call resumes from there. The rest of the week runs when the player's
 * match is over. The input state is never mutated.
 *
 * M2 (05-technical-m2 §A3, Q60 option A): with `options.playerMatch` 'watch' (advance only) the lock stops before
 * round 1 with the round waiting to be watched (liveMatch.watch, `watch` outcome): the squads, rows, presets and seed
 * are fixed and the caller autosaves before the viewer opens. Each watched round is committed by an advance with
 * `options.watched` (see watchRefusal); between rounds the M1.1 pause rules apply, and the other fixtures of the week
 * are played after the player's match, as before. AI matches never watch.
 */
export function processWeekLive(ports: GamePorts, state: GameState, content: ContentDB, canPause: boolean, options: AdvanceOptions = {}): Result<LiveWeekOutcome, EngineError> {
  const refused = watchRefusal(state, canPause, options);
  if (refused) return err(refused);
  // Every result of the week records the sim content hash (MatchResult.simHash): computed once per ContentDB, here at
  // the start of the transition rather than in the middle of a match (the first call costs 55-130 ms, then it is cached).
  ports.sim.simContentHash?.(content);
  if (state.liveMatch !== null) {
    const draft = beginTransition(state);
    const run: WeekRun = { draft, newsFrom: newsFromOnResume(draft), ledgerFrom: draft.ledger.nextSeq, log: { rejections: [] } };
    return guarded(() => {
      const ms = draft.liveMatch!;
      const stop = runPlayerMatch(ports, draft, ms, content, canPause, true, options.watched?.logHash);
      if (stop) return stopped(draft, ms, stop, run.log);
      draft.liveMatch = null;
      const result = finishMatch(ports, draft, ms, content);
      return { state: draft, report: finishWeek(ports, run, result, content), pause: null, watch: null, log: run.log };
    });
  }
  const cal = state.calendar;
  if (cal.phase === 'season-end') return err(engineError('phase.season-end', 'The season is over: run the season-end step'));
  if (state.playerClubId !== null) {
    const blockers = getBlockers(ports, state, content);
    if (blockers.length > 0) return err(engineError('advance.blocked', `Decide first: ${blockers.map((b) => b.code).join(', ')}`, { blockers }));
  }
  const draft = beginTransition(state);
  const run: WeekRun = { draft, newsFrom: draft.ids.news, ledgerFrom: draft.ledger.nextSeq, log: { rejections: [] } };
  return guarded(() => {
    // Season 1 has no preceding season end. World creation already ran the AI season-start
    // setup for every club except trials signings (D-P); AI clubs sign their trials rookie here,
    // before the first processing (P1) releases unsigned ones to the pool.
    if (cal.season === 1 && cal.weekIndex === 1) {
      runAiPhase(ports, draft, content, (s, c) => ports.ai.planSeasonEnd(s, c, content).filter((cmd) => cmd.type === 'trials.sign'), run.log);
    }
    // 1. Lock every playing club's squad, then play the player's match first, round by round.
    const fixtures = ports.league.fixturesForWeek(draft, cal.weekIndex, content).filter((f) => f.status === 'scheduled');
    if (fixtures.length > 0) lockSquads(ports, draft, fixtures, content);
    const player = draft.playerClubId;
    const mine = player === null ? undefined : fixtures.find((f) => f.homeClubId === player || f.awayClubId === player);
    let result: MatchResult | null = null;
    if (mine) {
      const ms = startMatch(ports, draft, mine, squadsOf(draft, mine, content), content);
      // M2: Watch is fixed with the lock; round 1 then waits for the viewer (runPlayerMatch stops before it).
      if (canPause && options.playerMatch === 'watch') ms.watch = { mode: 'watch', round: null, cursorTick: 0, calls: [] };
      else playRound(ports, draft, ms, content);
      const stop = runPlayerMatch(ports, draft, ms, content, canPause, false);
      if (stop) return stopped(draft, ms, stop, run.log);
      result = finishMatch(ports, draft, ms, content);
    }
    return { state: draft, report: finishWeek(ports, run, result, content), pause: null, watch: null, log: run.log };
  });
}

export function processWeek(ports: GamePorts, state: GameState, content: ContentDB): Result<WeekOutcome, EngineError> {
  const r = processWeekLive(ports, state, content, false);
  if (!r.ok) return r;
  return ok({ state: r.value.state, report: r.value.report!, log: r.value.log });
}
