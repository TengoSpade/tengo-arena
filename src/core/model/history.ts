import type { StandingRow } from './competition';
import type { ClubId, FighterId, TierId, WingId } from './ids';

/**
 * Archive of a finished season, written once by the season-end step
 * (core/league writes tables and movements; fighters adds retirements and
 * rookies). Older seasons' full MatchResults are compacted; these records stay.
 */
export interface SeasonRecord {
  season: number;
  tiers: TierSeasonRecord[];
  retirements: RetirementRecord[];
  rookieIds: FighterId[];
}

export interface TierSeasonRecord {
  tierId: TierId;
  wingTables: { wingId: WingId; rows: StandingRow[] }[];
  tierTable: StandingRow[];
  reckoningChampionId: ClubId | null;
  reckoningRunnerUpId: ClubId | null;
  /** Best regular-season record (tier-table #1). */
  shieldWinnerId: ClubId | null;
  promotedIds: ClubId[];
  relegatedIds: ClubId[];
  /** Furthest Reckoning stage of every qualifier (v2; core/league always writes it; absent in hand-built fixtures). */
  reckoningStages?: Partial<Record<ClubId, ReckoningStage>>;
}

export type ReckoningStage = 'quarterfinal' | 'semifinal' | 'final' | 'champion';

export interface RetirementRecord {
  fighterId: FighterId;
  age: number;
  lastClubId: ClubId | null;
  proSeasons: number;
  peakRating: number;
  cause: 'age' | 'career-ending-injury' | 'left-unsigned';
}

/** All-time records are DERIVED from history (core/league records view); none are stored. */
export interface LeagueRecordsView {
  mostReckoningTitles: { clubId: ClubId; titles: number }[];
  mostShields: { clubId: ClubId; shields: number }[];
  seasonsPlayed: number;
}
