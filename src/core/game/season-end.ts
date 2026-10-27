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
import {
  alumnusOf,
  beginTransition,
  removeFighter,
  type ClubSeasonRow,
  type FighterDevelopment,
  type FighterId,
  type GameState,
  type NewsItem,
  type RetirementRecord,
  type SeasonEndReport,
  type SeasonRecord,
  type ResolvedLevelUp,
  type StatId,
} from '../model';
import { RESULT_RETENTION_SEASONS } from '../league';
import { NotImplementedError, cloneJson, engineError, err, ok, type EngineError, type Result } from '../util';
import type { GamePorts } from './ports';
import { clubsInOrder, compareIds, newsSince, rosterOf, tidyAll } from './shared';
import { runAiPhase, type PhaseLog } from './week';

export interface SeasonEndOutcome {
  state: GameState;
  report: SeasonEndReport;
  log: PhaseLog;
}

/**
 * Move fighters who left for good (status retired: retirements, career-ending
 * injuries, left unsigned) and this season's hired blades into alumni, and
 * drop references the UI keeps to them (shortlists, negotiations). Hired-blade
 * alumni are dropped once no retained result names them (RESULT_RETENTION_SEASONS).
 */
function compactDeparted(draft: GameState, season: number, record: SeasonRecord): void {
  const retirements = new Map(record.retirements.map((r) => [r.fighterId, r] as const));
  const gone = new Set<string>();
  for (const f of Object.values(draft.fighters)) {
    if (f.status === 'retired') {
      const r = retirements.get(f.id);
      draft.alumni[f.id] = alumnusOf(f, season, r?.cause ?? 'age', r?.lastClubId ?? f.freeAgency?.formerClubId ?? null);
    } else if (f.status === 'hired-blade' && f.clubId === null) {
      draft.alumni[f.id] = alumnusOf(f, season, 'hired-blade', null);
    } else continue;
    gone.add(f.id);
    removeFighter(draft, f.id);
  }
  if (gone.size > 0) {
    for (const club of Object.values(draft.clubs)) {
      if (club.shortlist.some((id) => gone.has(id))) club.shortlist = club.shortlist.filter((id) => !gone.has(id));
      const lineup = club.lineup;
      if (lineup.fighters.some((e) => gone.has(e.fighterId))) lineup.fighters = lineup.fighters.filter((e) => !gone.has(e.fighterId));
      if (lineup.matchCaptainId !== null && gone.has(lineup.matchCaptainId)) lineup.matchCaptainId = null;
      for (const id of Object.keys(lineup.tactics)) if (gone.has(id)) delete lineup.tactics[id as FighterId];
    }
    draft.market.negotiations = draft.market.negotiations.filter((n) => !gone.has(n.fighterId));
  }
  // Alumni nobody looks up once their results and news are gone: past hired blades and
  // leavers who never played a match (05 §5 retention; records and history keep the rest).
  const keepFrom = draft.calendar.season - RESULT_RETENTION_SEASONS + 1;
  for (const a of Object.values(draft.alumni)) {
    if (a.leftSeason >= keepFrom) continue;
    if (a.cause === 'hired-blade' || (a.cause === 'left-unsigned' && a.career.matches === 0)) delete draft.alumni[a.id];
  }
}

interface Snapshot {
  age: number;
  rating: number;
  potential: number;
  stats: Record<StatId, number>;
  picks: ResolvedLevelUp[];
}

/**
 * Season-end step 6.1 ahead of the aging step: every pending level-up is resolved by the fighter's policy
 * (manual reads as auto), oldest first, with the same choice core/fighters' Aging would make
 * (autoPickChoice with offerContextOf, how 'season_end'), so the season's picks are still in the level log
 * when the development rows are taken (developmentSummary picks). Anything refused stays for the aging step.
 */
function resolvePendingLevelUps(ports: GamePorts, draft: GameState, content: ContentDB): void {
  for (const f of Object.values(draft.fighters).sort((a, b) => compareIds(a.id, b.id))) {
    if (f.status === 'retired' || f.pendingLevelUps.length === 0) continue;
    const mode = ports.fighters.effectiveLevelUpMode(draft, f);
    const policy = mode === 'manual' ? 'auto' : mode;
    for (const offer of [...f.pendingLevelUps]) {
      const choice = ports.fighters.autoPickChoice(f, offer, policy, content, ports.fighters.offerContextOf(draft, f, content));
      if (!ports.fighters.resolveLevelUp(draft, f.id, offer.level, choice, 'season_end', content).ok) break;
    }
  }
}

function snapshotRostered(ports: GamePorts, draft: GameState, content: ContentDB): Map<FighterId, Snapshot> {
  const out = new Map<FighterId, Snapshot>();
  for (const club of clubsInOrder(draft, content)) {
    for (const f of rosterOf(draft, club.id)) {
      out.set(f.id, {
        age: f.age,
        rating: ports.fighters.rating(f, content),
        potential: ports.fighters.potential(f, content),
        stats: ports.fighters.effectiveStats(f, content),
        picks: f.season.levelLog.filter((l) => l.season === draft.calendar.season).map((l) => ({ ...l })),
      });
    }
  }
  return out;
}

/**
 * The ending season's development rows on its record (developmentSummary); older records drop theirs,
 * so only the latest season's stays in the save (05 §5 size).
 */
function recordDevelopment(
  ports: GamePorts,
  draft: GameState,
  record: SeasonRecord,
  before: Map<FighterId, Snapshot>,
  retirements: readonly RetirementRecord[],
  content: ContentDB,
): void {
  const retired = new Set<string>(retirements.map((r) => r.fighterId));
  const rows: FighterDevelopment[] = [];
  for (const [id, b] of before) {
    const f = draft.fighters[id];
    if (!f) continue;
    const stats = ports.fighters.effectiveStats(f, content);
    const attributeDeltas = {} as Record<StatId, number>;
    for (const s of Object.keys(b.stats) as StatId[]) attributeDeltas[s] = (stats[s] ?? 0) - (b.stats[s] ?? 0);
    const row: FighterDevelopment = { fighterId: id, ageBefore: b.age, ageAfter: f.age, ratingBefore: b.rating, ratingAfter: ports.fighters.rating(f, content), attributeDeltas };
    const potential = ports.fighters.potential(f, content) - b.potential;
    if (potential !== 0) row.potentialChange = potential;
    if (retired.has(id)) row.retired = true;
    if (b.picks.length > 0) row.picks = b.picks;
    rows.push(row);
  }
  record.development = rows;
  draft.history.forEach((h, i) => {
    if (h === record || h.development === undefined) return;
    const { development: _dropped, ...rest } = h;
    draft.history[i] = rest;
  });
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
  const draft = beginTransition(state);
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
    // 6. Aging and development (every rostered fighter's before/after goes on the record: developmentSummary).
    if (player !== null) developedIds = rosterOf(draft, player).map((f) => f.id);
    resolvePendingLevelUps(ports, draft, content);
    const before = snapshotRostered(ports, draft, content);
    ports.fighters.seasonEndDevelopment(draft, content);
    // 7. Retirements (core/fighters appends them to the archived record).
    const retirements: RetirementRecord[] = draft.options.retirement ? ports.fighters.seasonEndRetirements(draft, content) : [];
    recordDevelopment(ports, draft, record, before, retirements, content);
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
    // Retention (05 §5 size): older seasons dropped, last season compacted (after every
    // season-end step has read it), then fighters who left become slim alumni records.
    ports.league.compactHistory(draft, content);
    compactDeparted(draft, season, archived);
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
            wageRaises: (record.wageRaises ?? []).filter((r) => r.clubId === player),
          },
    newsIds: newsSince(draft, newsFrom),
  };
  return ok({ state: draft, report, log });
}
