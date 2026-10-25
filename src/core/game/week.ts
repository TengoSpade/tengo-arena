/**
 * Week processing (03 sys-calendar; leagues.json calendar.weekProcessingOrder;
 * 05 §3.3): one atomic commit for every club, in this order:
 *  1 simulate remaining fixtures (lineup lock, hired blades)
 *  2 record results and standings        7 P1 only: unsigned trials rookies to the pool
 *  3 lifecycle weekly                    8 free-agent decisions
 *  4 income                              9 AI action phase (tier, then club id order)
 *  5 costs                              10 pool floor top-up
 *  6 financial status                   11 advance the calendar (+ seed the Reckoning), digest
 * The UI store autosaves after success. The input state is never mutated.
 */
import type { ContentDB } from '../content';
import { beginTransition, putResult, type Club, type ClubId, type Fighter, type FighterId, type Fixture, type GameState, type LineupEntry, type MatchResult, type WeekReport } from '../model';
import { NotImplementedError, engineError, err, ok, type EngineError, type Result } from '../util';
import { applyToDraft } from './commands';
import { addMatchNews, buildMatchInput, eligibleEntries, toResult } from './match';
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

/** Lock the lineups of the clubs playing this week; hired blades fill short-handed sides (open-006). */
function lockLineups(
  ports: GamePorts,
  draft: GameState,
  fixtures: readonly Fixture[],
  content: ContentDB,
): { lineups: Map<ClubId, LineupEntry[]>; blades: Map<ClubId, FighterId[]> } {
  const playing: ClubId[] = [];
  for (const fx of fixtures) for (const c of [fx.homeClubId, fx.awayClubId]) if (!playing.includes(c)) playing.push(c);
  const ordered = clubsInOrder(draft, content).filter((c) => playing.includes(c.id));
  for (const club of ordered) autoCaptain(ports, draft, club, content);
  for (const club of ordered) ports.fighters.lineupLock(draft, club.id, content);
  const assigned = ports.economy.assignHiredBlades(draft, content);

  const lineups = new Map<ClubId, LineupEntry[]>();
  const blades = new Map<ClubId, FighterId[]>();
  for (const club of ordered) {
    const entries = eligibleEntries(ports, draft, club).filter((e) => draft.fighters[e.fighterId]?.status !== 'hired-blade');
    const used: FighterId[] = [];
    for (const id of assigned[club.id] ?? []) {
      if (entries.length >= 5) break;
      const f = draft.fighters[id];
      if (!f || entries.some((e) => e.fighterId === id)) continue;
      entries.push({ fighterId: id, row: content.classes.require(f.classId).startingRow });
      used.push(id);
    }
    if (entries.length < 5) {
      // Safety net: fit roster fighters left out of an AI lineup (the player is held by getBlockers).
      for (const f of rosterOf(draft, club.id).sort((a, b) => ports.fighters.rating(b, content) - ports.fighters.rating(a, content))) {
        if (entries.length >= 5) break;
        if (!ports.fighters.isFit(f) || entries.some((e) => e.fighterId === f.id)) continue;
        entries.push({ fighterId: f.id, row: content.classes.require(f.classId).startingRow });
      }
    }
    if (entries.length < 5) throw new LineupError(club.id, entries.length);
    lineups.set(club.id, entries);
    blades.set(club.id, used);
    // The locked lineup (hired blades labelled in it) is what the club fields; blades leave after the match.
    club.lineup.fighters = entries.map((e) => ({ fighterId: e.fighterId, row: e.row }));
    for (const e of entries) if (!club.lineup.tactics[e.fighterId]) club.lineup.tactics[e.fighterId] = defaultTactics(content, draft.fighters[e.fighterId]!);
  }
  return { lineups, blades };
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

export function processWeek(ports: GamePorts, state: GameState, content: ContentDB): Result<WeekOutcome, EngineError> {
  const cal = state.calendar;
  if (cal.phase === 'season-end') return err(engineError('phase.season-end', 'The season is over: run the season-end step'));
  if (state.playerClubId !== null) {
    const blockers = getBlockers(ports, state, content);
    if (blockers.length > 0) return err(engineError('advance.blocked', `Decide first: ${blockers.map((b) => b.code).join(', ')}`, { blockers }));
  }
  const draft = beginTransition(state);
  const newsFrom = draft.ids.news;
  const ledgerFrom = draft.ledger.nextSeq;
  const log: PhaseLog = { rejections: [] };
  const results: MatchResult[] = [];
  try {
    // Season 1 has no preceding season end. World creation already ran the AI season-start
    // setup for every club except trials signings (D-P); AI clubs sign their trials rookie here,
    // before the first processing (P1) releases unsigned ones to the pool.
    if (cal.season === 1 && cal.weekIndex === 1) {
      runAiPhase(ports, draft, content, (s, c) => ports.ai.planSeasonEnd(s, c, content).filter((cmd) => cmd.type === 'trials.sign'), log);
    }

    // 1. Simulate every fixture of the week (all fixtures are simulated here in M1).
    const fixtures = ports.league.fixturesForWeek(draft, cal.weekIndex, content).filter((f) => f.status === 'scheduled');
    if (fixtures.length > 0) {
      const { lineups, blades } = lockLineups(ports, draft, fixtures, content);
      for (const fx of fixtures) {
        const input = buildMatchInput(ports, draft, fx, { home: lineups.get(fx.homeClubId)!, away: lineups.get(fx.awayClubId)! }, content);
        const out = ports.sim.simulateMatch(input, content, { record: 'none' });
        const used = [...(blades.get(fx.homeClubId) ?? []), ...(blades.get(fx.awayClubId) ?? [])];
        const result = toResult(ports, fx, input, out, used, content);
        putResult(draft, result);
        results.push(result);
      }
    }
    // 2. Results, standings and brackets.
    for (const r of results) ports.league.recordResult(draft, r, content);
    // 3. Lifecycle: per match (XP, injuries), then the weekly step.
    for (const r of results) addMatchNews(draft, r, ports.fighters.applyMatchLifecycle(draft, r, content));
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
  } catch (e) {
    if (e instanceof NotImplementedError) throw e; // a stubbed module: callers (UI dev fallback, soak) handle it
    if (e instanceof LineupError) return err(engineError('lineup.unfillable', e.message, { clubId: e.clubId, have: e.have }));
    return err(engineError('engine.failure', `Week processing failed: ${e instanceof Error ? e.message : String(e)}`, { name: e instanceof Error ? e.name : 'unknown' }));
  }
  const playerClubId = state.playerClubId;
  const playerFixture = playerClubId === null ? undefined : results.find((r) => r.homeClubId === playerClubId || r.awayClubId === playerClubId);
  const report: WeekReport = {
    season: cal.season,
    weekIndex: cal.weekIndex,
    weekId: content.weekByIndex(cal.weekIndex).id as WeekReport['weekId'],
    phaseAfter: draft.calendar.phase,
    fixtureIds: results.map((r) => r.fixtureId),
    playerFixtureId: playerFixture?.fixtureId ?? null,
    newsIds: newsSince(draft, newsFrom),
    ledgerSeqFrom: ledgerFrom,
    ledgerSeqTo: draft.ledger.nextSeq,
  };
  return ok({ state: draft, report, log });
}
