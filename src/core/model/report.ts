import type { SeasonPhase } from './calendar';
import type { FixtureStage } from './competition';
import type { AbilityId, ClubId, FighterId, FixtureId, NewsId, PerkId, WeekId } from './ids';
import type { FighterMatchStats, RoundTiebreakStep } from './match';
import type { Gold } from './ledger';
import type { SeasonRecord, WageRaise } from './history';

/**
 * Read-only views produced by core/game for the UI. They are derived, never
 * stored. Additive changes are allowed; renames need the architect.
 */

/** Match report (03-combat sys-match-report, P-22). Built by core/game buildMatchReport. */
export interface MatchReport {
  fixtureId: FixtureId;
  stage: FixtureStage;
  weekId: WeekId;
  season: number;
  home: ReportSide;
  away: ReportSide;
  score: { home: number; away: number };
  winnerClubId: ClubId;
  rounds: ReportRound[];
  fighters: FighterRecap[];
  mvpFighterId: FighterId | null;
  /** False when the timeline could not be rebuilt (engine or content changed since the match). */
  timelineAvailable: boolean;
  aftermath: MatchAftermath;
  /**
   * M1.1 (additive): the team totals of each side, always the sum of its fighters' lines in `fighters`
   * (the starters who left, the reserves who came on and the emergency entrants included). Absent on
   * reports built before this field.
   */
  totals?: { home: ReportTotals; away: ReportTotals };
  /**
   * M1.1 (additive): the bench XP (a third of a lineup slot) every fighter who started no round earned
   * in this match: unused squad reserves first, then the rest of the fit roster, home club then away club.
   * Absent when the match left no record of it (matches played before bench XP was stored, news older than two seasons).
   */
  bench?: BenchXpLine[];
  /** M1.1 (additive): the result was compacted (an older season's match between other clubs): `fighters[].stats` holds only the totals (see FighterRecap). */
  compacted?: boolean;
}

export interface ReportSide {
  clubId: ClubId;
  captainId: FighterId | null;
  chemistry: number;
  /** The five who start round 1, in slot order (unchanged). Use `appearedIds` for everyone who played. */
  fighterIds: FighterId[];
  /**
   * M1.1 (additive): every fighter who started at least one round, in the order they first took the field:
   * the round-1 five in slot order, then reserves and emergency entrants as they came on. Equals `fighterIds`
   * for whole-match (M1) results. Each id has a line in `MatchReport.fighters`.
   */
  appearedIds?: FighterId[];
  /** M1.1 (additive): squad reserves who never started a round (they earn bench XP: see `MatchReport.bench`). */
  unusedReserveIds?: FighterId[];
}

/** One side's totals: the sum over `ReportSide.appearedIds` of the lines in `MatchReport.fighters`, plus XP. */
export interface ReportTotals {
  downsInflicted: number;
  downsSuffered: number;
  damageDealt: number;
  healingDone: number;
  /** Absent on a compacted report (the counters are not kept). */
  damageTaken?: number;
  shieldingDone?: number;
  /** Round XP of the fighters who played (`aftermath.xp`). */
  xp: number;
  /** Bench XP of the side's non-starters (`bench`). */
  benchXp: number;
}

/** A non-starter's bench XP in one match. */
export interface BenchXpLine {
  fighterId: FighterId;
  clubId: ClubId;
  /** 'reserve': named in the match squad and never came on; 'bench': the rest of the fit roster. */
  role: 'reserve' | 'bench';
  xp: number;
}

export interface ReportRound {
  round: number;
  winner: 'home' | 'away';
  endReason: 'elimination' | 'time-limit';
  tiebreakStep: RoundTiebreakStep | null;
  durationTicks: number;
  /** Key-event timeline (summary-level events re-simulated from the stored seed and inputs). */
  keyEvents: ReportEvent[];
}

export interface ReportEvent {
  tick: number;
  kind: 'down' | 'interrupt' | 'deathward' | 'rally' | 'captain_down' | 'handover' | 'overtime' | 'perk_proc';
  actorId: FighterId | null;
  targetId: FighterId | null;
  abilityId: AbilityId | null;
  /** e.g. hit size for downs. */
  amount: number | null;
  /** perk_proc (M1.1): the perk whose trigger fired. */
  perkId?: PerkId;
}

export interface FighterRecap {
  fighterId: FighterId;
  clubId: ClubId;
  isCaptain: boolean;
  /** Compacted reports (`MatchReport.compacted`): only clubId, roundsPlayed, downsInflicted, downsSuffered, damageDealt and healingDone are kept; every other counter is 0 or empty. */
  stats: FighterMatchStats;
  /** Rule lines of the fighter's preset, with fire counts (the stance last). */
  rules: { index: number; isStance: boolean; fires: number; committedTicks: number; neverFired: boolean }[];
  /** Death summaries (who, which ability, last hits, active debuffs, late heal or shield). */
  downs: { round: number; tick: number; byFighterId: FighterId | null; abilityId: AbilityId | null; hit: number }[];
  /** M1.1: trigger fires per perk over the match (from the re-simulated round recaps); absent when the timeline is unavailable. */
  perkProcs?: Record<PerkId, number>;
  /** M1.1 (additive): how he came to play: a starter, a squad reserve who came on, an emergency entrant. */
  role?: 'starter' | 'reserve' | 'emergency';
  /** M1.1 (additive): the rounds he started (1-based). Absent for whole-match (M1) and compacted results. */
  roundsStarted?: number[];
}

export interface MatchAftermath {
  xp: Record<FighterId, number>;
  /** M1.1 (additive): bench XP of the fighters who started no round (squad reserves included), when the match recorded it. */
  benchXp?: Record<FighterId, number>;
  injuries: { fighterId: FighterId; severity: 'knock' | 'minor' | 'moderate' | 'serious'; weeksOut: number }[];
  gold: { clubId: ClubId; amount: Gold; reason: 'gate' | 'winBonus' }[];
}

/** Returned by advanceWeek: the digest of one processed week. */
export interface WeekReport {
  season: number;
  weekIndex: number;
  weekId: WeekId;
  /** Phase after processing (may have moved on, e.g. to 'season-end'). */
  phaseAfter: SeasonPhase;
  /** Fixtures played this week, in simulation order. */
  fixtureIds: FixtureId[];
  playerFixtureId: FixtureId | null;
  newsIds: NewsId[];
  /** Ledger entries written: seq in [ledgerSeqFrom, ledgerSeqTo). */
  ledgerSeqFrom: number;
  ledgerSeqTo: number;
  /** M1.1: player-club level-ups gained this week (fighter, level reached), for the pacing dialog and badges. Absent = none. */
  levelUps?: { fighterId: FighterId; level: number }[];
}

/** Returned by runSeasonEnd for the season review screens. */
export interface SeasonEndReport {
  record: SeasonRecord;
  playerClub: {
    clubId: ClubId;
    promoted: boolean;
    relegated: boolean;
    prizes: Gold;
    retiredIds: FighterId[];
    expiredIds: FighterId[];
    developedIds: FighterId[];
    /** Player contracts raised to the tier minimum at next-season setup (core always writes it). */
    wageRaises?: WageRaise[];
  } | null;
  newsIds: NewsId[];
}

/** Why the player cannot advance yet (getBlockers). `code` maps to UI text. */
export interface Blocker {
  code:
    | 'lineup.incomplete'
    | 'lineup.unavailable'
    | 'lineup.not-on-roster'
    | 'roster.over-cap'
    | 'club.not-chosen'
    | 'phase.season-end'
    | (string & {});
  fighterId?: FighterId;
  details?: Record<string, string | number>;
}
