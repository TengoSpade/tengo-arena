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
import type { ClubId, FighterId, Fixture, GameState, LineupEntry, MatchResult, WeekReport } from '../model';
import { cloneJson, engineError, err, ok, type EngineError, type Result } from '../util';
import { applyToDraft } from './commands';
import { addMatchNews, buildMatchInput, eligibleEntries, toResult } from './match';
import type { GamePorts } from './ports';
import { clubsInOrder, defaultTactics, newsSince, rosterOf, tidyAll } from './shared';
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
  for (const club of clubsInOrder(draft, content)) {
    if (club.id === draft.playerClubId) continue;
    for (const cmd of plan(draft, club.id)) {
      const r = applyToDraft(ports, draft, cmd, content);
      if (!r.ok) log.rejections.push({ clubId: club.id, type: cmd.type, code: r.error.code });
    }
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
  const draft = cloneJson(state);
  const newsFrom = draft.ids.news;
  const ledgerFrom = draft.ledger.nextSeq;
  const log: PhaseLog = { rejections: [] };
  const results: MatchResult[] = [];
  try {
    // Season 1 has no preceding season end: the AI's season-start phase (trials signings,
    // opening offers, captains) runs here, before the first processing (P1).
    if (cal.season === 1 && cal.weekIndex === 1) runAiPhase(ports, draft, content, (s, c) => ports.ai.planSeasonEnd(s, c, content), log);

    // 1. Simulate every fixture of the week (all fixtures are simulated here in M1).
    const fixtures = ports.league.fixturesForWeek(draft, cal.weekIndex, content).filter((f) => f.status === 'scheduled');
    if (fixtures.length > 0) {
      const { lineups, blades } = lockLineups(ports, draft, fixtures, content);
      for (const fx of fixtures) {
        const input = buildMatchInput(ports, draft, fx, { home: lineups.get(fx.homeClubId)!, away: lineups.get(fx.awayClubId)! }, content);
        const out = ports.sim.simulateMatch(input, content, { record: 'none' });
        const used = [...(blades.get(fx.homeClubId) ?? []), ...(blades.get(fx.awayClubId) ?? [])];
        const result = toResult(ports, fx, input, out, used, content);
        draft.results[fx.id] = result;
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
    // 11. The Reckoning is seeded after the last regular week, then the calendar moves on.
    if (cal.weekIndex === ports.league.lastRegularWeekIndex(content)) ports.league.seedReckonings(draft, content);
    draft.calendar = ports.league.nextCalendar(cal, content);
    tidyAll(ports, draft, content);
  } catch (e) {
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
