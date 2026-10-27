/**
 * Season end (03-league-economy sys-league "Promotion and relegation",
 * sys-calendar season-end steps 1 and 3): tier moves between every adjacent
 * pair of tiers decided from the same season's final tables, the season
 * archive, result compaction and all-time records.
 */
import type { ContentDB } from '../content';
import {
  asId,
  compactFielded,
  fieldedFive,
  leagueCompetitionId,
  reckoningCompetitionId,
  type ClubId,
  type ClubSeasonRow,
  type CompactFighterTotals,
  type FighterId,
  type GameState,
  type LeagueRecordsView,
  type MatchResult,
  type MatchSquad,
  type SeasonRecord,
  type StandingRow,
  type TierId,
  type TierSeasonRecord,
} from '../model';
import { putResult, removeFixture, removeResult } from '../model';
import { compareStrings, invariant } from '../util';
import { tiersByLevel } from './common';
import { reckoningStageForSeason, reckoningStageIn, type ReckoningStage } from './reckoning';
import { standingsImpl } from './standings';

export interface TierMove {
  clubId: ClubId;
  from: TierId;
  to: TierId;
  reason: 'reckoning' | 'shield' | 'relegated';
}

/**
 * Promotions and relegations of the current season. For each adjacent pair:
 * the upper tier relegates the bottom relegatePerWing of each wing table; the
 * lower tier promotes one club per promotionRoutes entry in content order
 * (reckoning: its Reckoning champion; shield: its tier-table #1, or the
 * next-highest club not already promoted). Moves are listed per pair from the
 * top: promotions in route order, then relegations by upper tier-table rank.
 * Throws if a Reckoning is unfinished or the counts would change tier sizes.
 */
export function promotionRelegationImpl(state: GameState, content: ContentDB): TierMove[] {
  const season = state.calendar.season;
  const tiers = tiersByLevel(content);
  const rules = content.leagues.promotionRelegation;
  invariant(!rules.promotionPlayoff.enabled, 'promotion playoff is not implemented (FUTURE)');
  const moves: TierMove[] = [];
  for (let i = 0; i + 1 < tiers.length; i++) {
    const upper = asId<TierId>(tiers[i]!.id);
    const lower = asId<TierId>(tiers[i + 1]!.id);
    const upperLeague = state.competitions[leagueCompetitionId(season, upper)];
    const lowerLeague = state.competitions[leagueCompetitionId(season, lower)];
    invariant(upperLeague && lowerLeague, `promotionRelegation: season ${season} has no league for ${upper} or ${lower}`);

    const promoted: TierMove[] = [];
    const lowerTable = standingsImpl(state, lowerLeague.id, 'tier', content);
    const chosen = new Set<ClubId>();
    const nextBest = (): ClubId => {
      const row = lowerTable.find((r) => !chosen.has(r.clubId));
      invariant(row, `promotionRelegation: ${lower} has no club left to promote`);
      return row.clubId;
    };
    for (const route of rules.promotionRoutes) {
      let clubId: ClubId;
      if (route.id === 'reckoning') {
        const champion = state.competitions[reckoningCompetitionId(season, lower)]?.bracket?.championId ?? null;
        invariant(champion, `promotionRelegation: the ${lower} Reckoning has no champion yet`);
        clubId = chosen.has(champion) ? nextBest() : champion;
      } else {
        clubId = nextBest();
      }
      chosen.add(clubId);
      promoted.push({ clubId, from: lower, to: upper, reason: route.id });
    }

    const upperRank = new Map(standingsImpl(state, upperLeague.id, 'tier', content).map((r) => [r.clubId, r.position]));
    const relegated: TierMove[] = [];
    for (const wing of upperLeague.wings) {
      const rows = standingsImpl(state, upperLeague.id, wing.wingId, content);
      for (const row of rows.slice(rows.length - rules.relegatePerWing)) {
        relegated.push({ clubId: row.clubId, from: upper, to: lower, reason: 'relegated' });
      }
    }
    relegated.sort((a, b) => upperRank.get(a.clubId)! - upperRank.get(b.clubId)!);
    invariant(
      promoted.length === relegated.length,
      `promotionRelegation: ${promoted.length} promoted but ${relegated.length} relegated between ${upper} and ${lower}`,
    );
    moves.push(...promoted, ...relegated);
  }
  return moves;
}

/** Apply tier moves to clubs (each club at most once, from its current tier). */
export function applyTierMovesImpl(draft: GameState, moves: readonly TierMove[]): void {
  const seen = new Set<ClubId>();
  for (const move of moves) {
    invariant(!seen.has(move.clubId), `applyTierMoves: ${move.clubId} moves twice`);
    seen.add(move.clubId);
    const club = draft.clubs[move.clubId];
    invariant(club, `applyTierMoves: unknown club ${move.clubId}`);
    invariant(club.tierId === move.from, `applyTierMoves: ${move.clubId} is in ${club.tierId}, not ${move.from}`);
  }
  for (const move of moves) draft.clubs[move.clubId]!.tierId = move.to;
}

/**
 * Season archive (season-end step 1): per tier from the top, the final wing
 * and tier tables, the Reckoning champion and runner-up, the Shield winner
 * (tier-table #1) and the clubs that left the tier: promotedIds (moved up out
 * of this tier, in route order) and relegatedIds (moved down out of it).
 * Retirements and rookies are left empty for core/fighters.
 */
export function archiveSeasonImpl(state: GameState, moves: readonly TierMove[], content: ContentDB): SeasonRecord {
  const season = state.calendar.season;
  const tiers: TierSeasonRecord[] = [];
  for (const tier of tiersByLevel(content)) {
    const tierId = asId<TierId>(tier.id);
    const league = state.competitions[leagueCompetitionId(season, tierId)];
    if (!league) continue;
    const tierTable = standingsImpl(state, league.id, 'tier', content);
    const reckoning = state.competitions[reckoningCompetitionId(season, tierId)];
    const bracket = reckoning?.bracket ?? null;
    const out = moves.filter((m) => m.from === tierId);
    const reckoningStages: Partial<Record<ClubId, ReckoningStage>> = {};
    if (reckoning && bracket) {
      for (const clubId of bracket.seeds) {
        const stage = reckoningStageIn(reckoning, clubId);
        if (stage !== null) reckoningStages[clubId] = stage;
      }
    }
    tiers.push({
      tierId,
      wingTables: league.wings.map((w) => ({ wingId: w.wingId, rows: standingsImpl(state, league.id, w.wingId, content) })),
      tierTable,
      reckoningChampionId: bracket?.championId ?? null,
      reckoningRunnerUpId: bracket?.runnerUpId ?? null,
      shieldWinnerId: tierTable[0]?.clubId ?? null,
      promotedIds: out.filter((m) => m.reason !== 'relegated').map((m) => m.clubId),
      relegatedIds: out.filter((m) => m.reason === 'relegated').map((m) => m.clubId),
      reckoningStages,
    });
  }
  return { season, tiers, retirements: [], rookieIds: [] };
}

/** ClubSeasonRow columns owned by core/league; core/economy supplies income, costs, endBalance and prestigeEnd. */
export type LeagueSeasonColumns = Omit<ClubSeasonRow, 'income' | 'costs' | 'endBalance' | 'prestigeEnd'>;

/** A club's league columns for its season row, from the archived record (null if it played in no archived tier). */
export function leagueSeasonColumnsImpl(state: GameState, record: SeasonRecord, clubId: ClubId): LeagueSeasonColumns | null {
  for (const tier of record.tiers) {
    const row = tier.tierTable.find((r) => r.clubId === clubId);
    if (!row) continue;
    let wingId: LeagueSeasonColumns['wingId'] = null;
    let wingRow: StandingRow | undefined;
    for (const w of tier.wingTables) {
      wingRow = w.rows.find((r) => r.clubId === clubId);
      if (wingRow) {
        wingId = w.wingId;
        break;
      }
    }
    const reckoning: ReckoningStage | null = reckoningStageForSeason(state, record.season, clubId);
    return {
      season: record.season,
      tierId: tier.tierId,
      wingId,
      wingPosition: wingRow?.position ?? 0,
      tierPosition: row.position,
      points: row.points,
      matchWins: row.matchWins,
      matchLosses: row.matchLosses,
      reckoning,
      shield: tier.shieldWinnerId === clubId,
      promoted: tier.promotedIds.includes(clubId),
      relegated: tier.relegatedIds.includes(clubId),
    };
  }
  return null;
}

// ---- compaction ----------------------------------------------------------------------------------------------------

/**
 * Seasons whose fixtures, results and competitions are kept: the current and
 * the previous season (05 §5, TUNABLE (tech)). Matches between other clubs
 * are compacted twice over: in season, once they are
 * `leagues.json matchRecords.compactAiMatchesAfterWeeks` weeks old
 * (`compactAgedResultsImpl`), and at the season end for the season just
 * played (`compactHistoryImpl`: whatever the in-season rule had not reached
 * yet, the last few weeks). The player club's matches are never compacted
 * while they are in the window. A compacted result keeps scores, round
 * summaries, winner, MVP, hired blades, the squads, each fighter's totals and
 * the round-1 fives; sim fighters, per-round final HP, per-fighter stats and
 * the M1.1 per-round records go. Older seasons are dropped entirely: their
 * tables, titles and movements live in history (SeasonRecord).
 */
export const RESULT_RETENTION_SEASONS = 2;

/**
 * Weeks after which a match between other clubs is compacted when a content set does not say
 * (`leagues.json matchRecords.compactAiMatchesAfterWeeks` is optional in the schema because the frozen test fixture
 * predates it; content/default carries the value and is the one to tune).
 */
export const DEFAULT_COMPACT_AI_MATCHES_AFTER_WEEKS = 3;

/** True for a result stripped by compactHistory (its sim input has no fighters, so it cannot be re-simulated). */
export function isCompactedResult(result: MatchResult): boolean {
  return result.input.home.fighters.length === 0 && result.input.away.fighters.length === 0;
}

/**
 * A compacted copy (results are write-once and shared between states: never edit one in place).
 *
 * Kept: the score, winner, MVP and hired blades, the round summaries (without final HP), the sides' squads without
 * their row maps (a summary of who was named), the emergency entrants, `fighterTotals` (for every fighter who
 * started a round the side, rounds started, downs inflicted and suffered, damage dealt and healing done, so an old
 * report still attributes every fighter to his club, emergency entrants and swapped-in reserves included) and
 * `fielded` (each side's round-1 five with rows and kickoff ratings: what the renewal ask and the opponent's last
 * lineup read, so compacting never changes them).
 * Dropped: the sim fighters, per-fighter stats, `reserveInputs`, `roundLineups` and `betweenRounds` (about 13 of a
 * result's 16 KB; they only serve re-simulating and the round-by-round timeline, which a compacted result no
 * longer offers).
 */
export function compactedResult(result: MatchResult): MatchResult {
  const side = (s: MatchResult['input']['home']): MatchResult['input']['home'] => ({ ...s, fighters: [], captainIndex: 0, viceCaptainIndex: null });
  const squad = (q: MatchSquad): MatchSquad => ({ ...q, rows: {} });
  const fighterTotals: Record<FighterId, CompactFighterTotals> = {};
  for (const [id, st] of Object.entries(result.fighterStats)) {
    fighterTotals[id as FighterId] = [st.clubId === result.homeClubId ? 0 : 1, st.roundsPlayed, st.downsInflicted, st.downsSuffered, st.damageDealt, st.healingDone];
  }
  const out: MatchResult = {
    ...result,
    input: { ...result.input, home: side(result.input.home), away: side(result.input.away) },
    rounds: result.rounds.map((r) => ({ ...r, finalHp: [] })),
    fighterStats: {},
    fighterTotals: result.fighterTotals ?? fighterTotals,
    fielded: result.fielded ?? { home: compactFielded(fieldedFive(result, 'home')), away: compactFielded(fieldedFive(result, 'away')) },
  };
  delete out.reserveInputs;
  delete out.roundLineups;
  delete out.betweenRounds;
  if (result.squads) out.squads = { home: squad(result.squads.home), away: squad(result.squads.away) };
  return out;
}

/** True when the match involves the player's club (never compacted while it is in the retention window). */
function involves(result: MatchResult, clubId: ClubId | null): boolean {
  return clubId !== null && (result.homeClubId === clubId || result.awayClubId === clubId);
}

/**
 * Run at the end of every week processing (`processedWeek` = the week just processed, `season` its season): compact
 * the season's matches between other clubs that are at least `compactAiMatchesAfterWeeks` weeks older than that
 * week. A match played in week w is compacted by the processing of week w + N, so the last N weeks stay full (the
 * match report of a recent match still has its timeline). Deterministic, a pure function of the state: the player
 * club's matches are never touched, and with no player club (headless runs) every match is. The weeks it has
 * already passed are covered too, so a state saved by a build without this rule is caught up at its next week.
 */
export function compactAgedResultsImpl(draft: GameState, season: number, processedWeek: number, afterWeeks: number): void {
  const cutoff = processedWeek - afterWeeks;
  if (cutoff < 1) return;
  const player = draft.playerClubId;
  const aged: MatchResult[] = [];
  for (const result of Object.values(draft.results)) {
    if (result.season !== season || result.weekIndex > cutoff || isCompactedResult(result) || involves(result, player)) continue;
    aged.push(result);
  }
  for (const result of aged) putResult(draft, compactedResult(result));
}

/**
 * Run at the end of the season-end step (calendar on the new season N): drop
 * seasons before N - 1, compact season N - 1 except the player club's matches.
 */
export function compactHistoryImpl(draft: GameState): void {
  const season = draft.calendar.season;
  const keepFrom = season - RESULT_RETENTION_SEASONS + 1;
  for (const comp of Object.values(draft.competitions)) {
    if (comp.season >= keepFrom) continue;
    for (const id of comp.fixtureIds) {
      removeResult(draft, id);
      removeFixture(draft, id);
    }
    delete draft.competitions[comp.id];
  }
  const player = draft.playerClubId;
  for (const result of Object.values(draft.results)) {
    if (result.season >= season || isCompactedResult(result) || involves(result, player)) continue;
    putResult(draft, compactedResult(result));
  }
}

// ---- records ----------------------------------------------------------------------------------------------------------------

export function leagueRecordsImpl(state: GameState): LeagueRecordsView {
  const titles = new Map<ClubId, number>();
  const shields = new Map<ClubId, number>();
  for (const record of state.history) {
    for (const tier of record.tiers) {
      if (tier.reckoningChampionId) titles.set(tier.reckoningChampionId, (titles.get(tier.reckoningChampionId) ?? 0) + 1);
      if (tier.shieldWinnerId) shields.set(tier.shieldWinnerId, (shields.get(tier.shieldWinnerId) ?? 0) + 1);
    }
  }
  const sorted = (m: Map<ClubId, number>): [ClubId, number][] => [...m].sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]));
  return {
    mostReckoningTitles: sorted(titles).map(([clubId, n]) => ({ clubId, titles: n })),
    mostShields: sorted(shields).map(([clubId, n]) => ({ clubId, shields: n })),
    seasonsPlayed: state.history.length,
  };
}
