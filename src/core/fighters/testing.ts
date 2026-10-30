/**
 * Pure builders for lifecycle tests (no testkit import, so this file is
 * legal in core; it is not exported from index.ts).
 */
import type { ContentDB } from '../content';
import type { ClubId, Fighter, FighterId, FighterMatchStats, FixtureId, GameState, MatchResult, StatId, TacticsPresetId, WeekId } from '../model';
import { trainFromClocks } from './levels';
import { effectiveStatsOf, ratingOf } from './stats';
import { tables } from './tables';

/** A fighter whose effective stats equal `values` exactly (caps = values, full maturity, no wear, no traits). */
export function withStats(fighter: Fighter, content: ContentDB, values: Partial<Record<string, number>>, fallback = 10): Fighter {
  const cap100 = {} as Record<StatId, number>;
  const zero = {} as Record<StatId, number>;
  for (const id of tables(content).statIds) {
    cap100[id] = (values[id] ?? fallback) * 100;
    zero[id] = 0;
  }
  const out: Fighter = { ...fighter, cap100, bloom: { ...zero }, wear100: { ...zero }, dev100: { physical: 2800, mental: 4000 }, traits: [], statuses: [], injury: null };
  return { ...out, train100: trainFromClocks(out, content) };
}

export interface RoundSpec {
  /** Winner side of the round. */
  winner: 'home' | 'away';
}

export interface FighterRoundSpec {
  downed?: boolean;
  /** Damage taken that round, points. */
  damage?: number;
  maxHp?: number;
  byFighterId?: FighterId | null;
}

function emptyStats(clubId: ClubId): FighterMatchStats {
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
    downsSuffered: 0,
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

/**
 * A hand-made MatchResult: `home` / `away` fighter ids, the round winners, and
 * per fighter per round exposure (default: not downed, no damage).
 */
export function makeResult(
  state: GameState,
  content: ContentDB,
  params: {
    fixtureId?: string;
    stage?: MatchResult['stage'];
    homeClubId: ClubId;
    awayClubId: ClubId;
    home: FighterId[];
    away: FighterId[];
    rounds: RoundSpec[];
    perRound?: Record<string, FighterRoundSpec[]>;
  },
): MatchResult {
  const stats: Record<FighterId, FighterMatchStats> = {};
  const inputFor = (ids: FighterId[]) =>
    ids.map((fid, slot) => {
      const f = state.fighters[fid]!;
      return {
        fighterId: fid,
        classId: f.classId,
        raceId: f.raceId,
        row: 'front' as const,
        slot,
        stats: effectiveStatsOf(f, content),
        captainQuality: 50,
        traitIds: f.traits.map((t) => t.id),
        tactics: { kind: 'preset' as const, presetId: content.classes.require(f.classId).defaultPresetId as TacticsPresetId },
        rating: ratingOf(f, content),
      };
    });
  for (const [side, ids] of [['home', params.home], ['away', params.away]] as const) {
    for (const fid of ids) {
      const s = emptyStats(side === 'home' ? params.homeClubId : params.awayClubId);
      s.roundsPlayed = params.rounds.length;
      const spec = params.perRound?.[fid] ?? [];
      params.rounds.forEach((_r, i) => {
        const rs = spec[i] ?? {};
        s.damageTaken += rs.damage ?? 0;
        if (rs.downed) {
          s.downsSuffered += 1;
          s.downs.push({ round: i + 1, tick: 0, byFighterId: rs.byFighterId ?? null, abilityId: null, hit: 0, overkill: 0, damageTakenRound: rs.damage ?? 0, maxHp: rs.maxHp ?? 1000 });
        } else s.roundsSurvived += 1;
      });
      stats[fid] = s;
    }
  }
  for (const s of Object.values(stats)) for (const d of s.downs) if (d.byFighterId && stats[d.byFighterId]) stats[d.byFighterId]!.downsInflicted += 1;
  const homeWins = params.rounds.filter((r) => r.winner === 'home').length;
  const awayWins = params.rounds.length - homeWins;
  return {
    fixtureId: (params.fixtureId ?? `lg:${state.calendar.season}:t:${state.calendar.weekId ?? 'MW1'}:${params.homeClubId}:${params.awayClubId}`) as FixtureId,
    competitionId: `lg:${state.calendar.season}:t` as MatchResult['competitionId'],
    stage: params.stage ?? 'league',
    season: state.calendar.season,
    weekIndex: state.calendar.weekIndex,
    weekId: (state.calendar.weekId ?? 'MW1') as WeekId,
    homeClubId: params.homeClubId,
    awayClubId: params.awayClubId,
    engineVersion: 0,
    contentHash: 'test',
    input: {
      seed: 'test',
      bestOf: 3,
      home: { clubId: params.homeClubId, fighters: inputFor(params.home), captainIndex: 0, viceCaptainIndex: null, chemistry: 0 },
      away: { clubId: params.awayClubId, fighters: inputFor(params.away), captainIndex: 0, viceCaptainIndex: null, chemistry: 0 },
    },
    rounds: params.rounds.map((r, i) => ({
      round: i + 1,
      seed: 'test',
      winner: r.winner,
      endReason: 'elimination' as const,
      tiebreakStep: null,
      durationTicks: 600,
      survivors: { home: 0, away: 0 },
      downs: { home: 0, away: 0 },
      finalHp: [],
      checksum: '0',
      eventHash: null,
    })),
    score: { home: homeWins, away: awayWins },
    winnerClubId: homeWins > awayWins ? params.homeClubId : params.awayClubId,
    fighterStats: stats,
    mvpFighterId: null,
    hiredBladeIds: [],
  };
}
