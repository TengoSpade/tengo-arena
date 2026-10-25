/**
 * Season end (03-league-economy sys-league "Promotion and relegation",
 * sys-calendar season-end steps 1 and 3): tier moves between every adjacent
 * pair of tiers decided from the same season's final tables, the season
 * archive, result compaction and all-time records.
 */
import type { ContentDB } from '../content';
import {
  asId,
  leagueCompetitionId,
  reckoningCompetitionId,
  type ClubId,
  type ClubSeasonRow,
  type GameState,
  type LeagueRecordsView,
  type MatchResult,
  type SeasonRecord,
  type StandingRow,
  type TierId,
  type TierSeasonRecord,
} from '../model';
import { compareStrings, invariant } from '../util';
import { tiersByLevel } from './common';
import { reckoningStageForSeason, type ReckoningStage } from './reckoning';
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
    const bracket = state.competitions[reckoningCompetitionId(season, tierId)]?.bracket ?? null;
    const out = moves.filter((m) => m.from === tierId);
    tiers.push({
      tierId,
      wingTables: league.wings.map((w) => ({ wingId: w.wingId, rows: standingsImpl(state, league.id, w.wingId, content) })),
      tierTable,
      reckoningChampionId: bracket?.championId ?? null,
      reckoningRunnerUpId: bracket?.runnerUpId ?? null,
      shieldWinnerId: tierTable[0]?.clubId ?? null,
      promotedIds: out.filter((m) => m.reason !== 'relegated').map((m) => m.clubId),
      relegatedIds: out.filter((m) => m.reason === 'relegated').map((m) => m.clubId),
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
 * Seasons whose full MatchResults are kept: the current and the previous
 * season (05 §5, TUNABLE (tech)). Older results keep their scores, round
 * summaries, winner, MVP and hired blades; sim inputs (fighters), per-round
 * final HP and per-fighter stats are dropped.
 */
export const RESULT_RETENTION_SEASONS = 2;

/** True for a result stripped by compactHistory (its sim input has no fighters, so it cannot be re-simulated). */
export function isCompactedResult(result: MatchResult): boolean {
  return result.input.home.fighters.length === 0 && result.input.away.fighters.length === 0;
}

export function compactHistoryImpl(draft: GameState): void {
  const keepFrom = draft.calendar.season - RESULT_RETENTION_SEASONS + 1;
  for (const result of Object.values(draft.results)) {
    if (result.season >= keepFrom || isCompactedResult(result)) continue;
    for (const side of [result.input.home, result.input.away]) {
      side.fighters = [];
      side.captainIndex = 0;
      side.viceCaptainIndex = null;
    }
    for (const round of result.rounds) round.finalHp = [];
    result.fighterStats = {};
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
