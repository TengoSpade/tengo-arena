/**
 * Season-end step (03 sys-calendar; leagues.json calendar.seasonEndOrder;
 * 02 §3): one atomic block from phase 'season-end' to week 1 of the next
 * season, before the review screens:
 *   1 placings and titles (archive)      8 contract expiries
 *   2 prizes                             9 off-season injury recovery
 *   3 promotion and relegation          12 free-agent pool maintenance
 *   4 prestige                          13 next-season setup (tiers, wings, fixtures, rookies, finances)
 *   6 aging and development             14 AI phase (trials signings, cap relief, opening offers, captains)
 *   7 retirements                       15 autosave (UI store)
 * Steps 5, 10 and 11 are M4-M6. It is not a week: no wages, no debt week.
 * Step 13 follows core/league's documented order: setupSeason, the new
 * calendar, then compaction; rookies and the finance setup run on the new
 * season's calendar (core/economy reads the ending season as season - 1).
 */
import type { ContentDB } from '../content';
import type { ClubSeasonRow, FighterId, GameState, NewsItem, RetirementRecord, SeasonEndReport, SeasonRecord } from '../model';
import { NotImplementedError, cloneJson, engineError, err, ok, type EngineError, type Result } from '../util';
import type { GamePorts } from './ports';
import { clubsInOrder, newsSince, rosterOf, tidyAll } from './shared';
import { runAiPhase, type PhaseLog } from './week';

export interface SeasonEndOutcome {
  state: GameState;
  report: SeasonEndReport;
  log: PhaseLog;
}

/** News retention: the current and the previous season (05 §5). */
function pruneNews(draft: GameState): void {
  const keepFrom = draft.calendar.season - 1;
  draft.news = draft.news.filter((n: NewsItem) => n.at.season >= keepFrom);
}

/**
 * Club season rows: league columns from core/league (leagueSeasonColumns),
 * prestige after the update, money from the ending season's ledger
 * (core/economy rewrites income/costs/endBalance at setup from the same ledger).
 */
function writeClubRows(ports: GamePorts, draft: GameState, record: SeasonRecord, content: ContentDB): void {
  for (const club of clubsInOrder(draft, content)) {
    if (club.history.some((h) => h.season === record.season)) continue;
    const league = ports.league.leagueSeasonColumns(draft, record, club.id);
    if (!league) continue;
    let income = 0;
    let costs = 0;
    for (const e of draft.ledger.entries) {
      if (e.clubId !== club.id || e.season !== record.season) continue;
      if (e.amount > 0) income += e.amount;
      else costs -= e.amount;
    }
    const row: ClubSeasonRow = { ...league, income, costs, endBalance: club.finance.balance, prestigeEnd: club.prestige };
    club.history.push(row);
  }
}

export function processSeasonEnd(ports: GamePorts, state: GameState, content: ContentDB): Result<SeasonEndOutcome, EngineError> {
  if (state.calendar.phase !== 'season-end') {
    return err(engineError('phase.not-season-end', `The season-end step runs after the last week (now ${state.calendar.weekId ?? state.calendar.phase})`));
  }
  const draft = cloneJson(state);
  const season = draft.calendar.season;
  const newsFrom = draft.ids.news;
  const log: PhaseLog = { rejections: [] };
  const player = draft.playerClubId;
  let prizes = 0;
  let retiredIds: FighterId[] = [];
  let expiredIds: FighterId[] = [];
  let developedIds: FighterId[] = [];
  let record: SeasonRecord;
  try {
    // 1 + 3 (decided from the same final tables): placings, titles and movements; the archive goes to history.
    const moves = ports.league.promotionRelegation(draft, content);
    record = cloneJson(ports.league.archiveSeason(draft, moves, content));
    draft.history.push(record);
    // 2. Prizes.
    const seqBefore = draft.ledger.nextSeq;
    ports.economy.seasonPrizes(draft, record, content);
    if (player !== null) {
      for (const e of draft.ledger.entries) if (e.seq >= seqBefore && e.clubId === player) prizes += e.amount;
    }
    // 3. Promotion and relegation applied.
    ports.league.applyTierMoves(draft, moves);
    // 4. Prestige.
    ports.economy.updatePrestige(draft, record, content);
    writeClubRows(ports, draft, record, content);
    // 6. Aging and development.
    if (player !== null) developedIds = rosterOf(draft, player).map((f) => f.id);
    ports.fighters.seasonEndDevelopment(draft, content);
    // 7. Retirements (core/fighters appends them to the archived record).
    const retirements: RetirementRecord[] = draft.options.retirement ? ports.fighters.seasonEndRetirements(draft, content) : [];
    // 8. Contract expiries (remember the clubs first: expiry clears the contract).
    const holder = new Map(Object.values(draft.fighters).map((f) => [f.id, f.clubId] as const));
    const expired = ports.economy.contractExpiries(draft, content);
    if (player !== null) {
      retiredIds = retirements.filter((r) => r.lastClubId === player).map((r) => r.fighterId);
      expiredIds = expired.filter((id) => holder.get(id) === player);
    }
    tidyAll(ports, draft, content);
    // 9. Off-season recovery.
    ports.fighters.offseasonRecovery(draft, content);
    // 12. Pool maintenance: long-unsigned free agents leave the league (recorded as 'left-unsigned').
    const archived = draft.history[draft.history.length - 1]!;
    for (const r of retirements) if (!archived.retirements.some((x) => x.fighterId === r.fighterId)) archived.retirements.push(r);
    for (const id of ports.economy.poolMaintenance(draft, content)) {
      if (archived.retirements.some((r) => r.fighterId === id)) continue;
      const f = draft.fighters[id]!;
      archived.retirements.push({
        fighterId: id,
        age: f.age,
        lastClubId: f.freeAgency?.formerClubId ?? null,
        proSeasons: f.career.proSeasons,
        peakRating: f.career.peakRating,
        cause: 'left-unsigned',
      });
    }
    // 13. Next-season setup.
    ports.league.setupSeason(draft, season + 1, content);
    draft.calendar = ports.league.seasonStartCalendar(season + 1, content);
    ports.league.compactHistory(draft, content);
    const rookies = ports.fighters.generateRookies(draft, content);
    archived.rookieIds = [...rookies];
    ports.economy.nextSeasonFinanceSetup(draft, rookies, content);
    for (const memory of Object.values(draft.ai)) memory.voluntaryReleasesThisSeason = 0;
    pruneNews(draft);
    ports.fighters.announceFinalSeasons(draft, content);
    tidyAll(ports, draft, content);
    record = archived;
    // 14. AI phase for the new season.
    runAiPhase(ports, draft, content, (s, c) => ports.ai.planSeasonEnd(s, c, content), log);
    tidyAll(ports, draft, content);
  } catch (e) {
    if (e instanceof NotImplementedError) throw e; // a stubbed module: callers (UI dev fallback, soak) handle it
    return err(engineError('engine.failure', `Season end failed: ${e instanceof Error ? e.message : String(e)}`, { name: e instanceof Error ? e.name : 'unknown' }));
  }
  const report: SeasonEndReport = {
    record: cloneJson(record),
    playerClub:
      player === null
        ? null
        : {
            clubId: player,
            promoted: record.tiers.some((t) => t.promotedIds.includes(player)),
            relegated: record.tiers.some((t) => t.relegatedIds.includes(player)),
            prizes,
            retiredIds,
            expiredIds,
            developedIds,
          },
    newsIds: newsSince(draft, newsFrom),
  };
  return ok({ state: draft, report, log });
}
