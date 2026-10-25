import type { Seed } from '../rng';
import type { StartingRow, TacticsAssignment } from './club';
import type { FightEndReason } from './events';
import type { ClubId, CompetitionId, FighterId, FixtureId } from './ids';

/**
 * What happened in the arena for one fixture. Written once by the season
 * engine when the match is played; never rerolled (reloading cannot change a
 * played result, P-05). Post-match consequences (XP, injuries, gold) are
 * applied by their owning modules and reported through news and the ledger,
 * not stored here.
 */
export interface MatchResult {
  fixtureId: FixtureId;
  competitionId: CompetitionId;
  season: number;
  week: number;
  homeClubId: ClubId;
  awayClubId: ClubId;
  /** Match seed: deriveSeed(root, STREAM.match, season, fixtureId), logged so the match can be replayed. */
  seed: Seed;
  engineVersion: number;
  contentHash: string;
  /** Lineups as locked at match start (open-010). */
  lineups: { home: LineupSnapshot; away: LineupSnapshot };
  rounds: RoundResult[];
  /** Rounds won (best-of-3, best-of-5 in finals: P-02). */
  score: { home: number; away: number };
  /** null only if the match format allows a drawn match. */
  winnerClubId: ClubId | null;
  /** Keyed by fighter; covers every fighter who appeared for either side. */
  fighterStats: Record<FighterId, FighterMatchStats>;
  mvpFighterId: FighterId | null;
}

export interface LineupSnapshot {
  clubId: ClubId;
  captainId: FighterId | null;
  fighters: LineupSnapshotEntry[];
}

export interface LineupSnapshotEntry {
  fighterId: FighterId;
  row: StartingRow;
  tactics: TacticsAssignment;
  /** Rating at kickoff (1-100). */
  rating: number;
}

export interface RoundResult {
  /** 1-based. */
  round: number;
  /** Round seed: deriveSeed(match.seed, 'round', round). */
  seed: Seed;
  winner: 'home' | 'away' | null;
  endReason: FightEndReason;
  durationTicks: number;
  survivors: { home: number; away: number };
  /** Hash of the final fight state; identical at every RecordLevel (cheap determinism check). */
  checksum: string;
  /** hashEventStream of the full log when recorded at level 'full', else null. */
  eventHash: string | null;
}

/** [phase B] final list from 03 §4 "fight results" (e.g. opponents faced, time on the arena, focus spent). */
export interface FighterMatchStats {
  clubId: ClubId;
  roundsPlayed: number;
  roundsSurvived: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  downsInflicted: number;
  downsSuffered: number;
  abilityUses: number;
  /** ruleFires[i] = times rule i of the fighter's rule list fired, summed over rounds (P-22 recap). */
  ruleFires: number[];
}
