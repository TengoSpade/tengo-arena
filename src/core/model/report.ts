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
  /** R2 box score (additive): effective healing received (overheal excluded); absent when a fighter's line cannot say (a result played before it was counted, no timeline to rebuild it from) and on a compacted report. */
  healingReceived?: number;
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
  /** R2 box score (additive): each side's totals for this round (the sum of its fighters' `FighterBox.rounds` lines); absent when the rounds could not be re-simulated (`timelineAvailable` false). */
  totals?: { home: BoxScoreLine; away: BoxScoreLine };
}

/**
 * R2 box score (additive): the counters of one fighter over a match or one round, all in points. Damage is HP
 * damage (shield absorption is not in it); healing is effective (overheal excluded); shielding is the shield
 * points granted. Self-heals (regeneration, leech) count as healing done and healing received.
 */
export interface BoxScoreLine {
  damageDone: number;
  damageReceived: number;
  healingDone: number;
  /** Absent when it cannot be known (see `ReportTotals.healingReceived`). */
  healingReceived?: number;
  shieldingDone: number;
  downsInflicted: number;
  downsSuffered: number;
}

/** One round of a fighter's box score: the counters of that round and his Freshness (0-100, whole points) around it. */
export interface FighterBoxRound extends BoxScoreLine {
  /** 1-based; one entry per round he started. */
  round: number;
  /** At the start of the round (what the sim fought with). */
  freshnessBefore: number | null;
  /** Right after the round's drain, before the between-round rest; null for results played before it was recorded. */
  freshnessAfter: number | null;
}

/**
 * R2 box score (additive): a fighter's whole match and, when the rounds could be re-simulated, each round he
 * started. `FighterRecap.stats` stays the raw counters; this is the table-ready view of them.
 */
export interface FighterBox extends BoxScoreLine {
  /** Rounds he started (`FighterRecap.roundsStarted.length`, or `stats.roundsPlayed`). */
  roundsStarted: number;
  /** Freshness at the start of his first round: what he took the field with (a reserve who came on: when he entered). Null when no lineup record exists (whole-match M1 results). */
  freshnessBefore: number | null;
  /** Freshness after his last round's drain: where the match left him. Null for results played before it was recorded. */
  freshnessAfter: number | null;
  /** One line per round he started, in order; empty when the rounds could not be re-simulated (`MatchReport.timelineAvailable` false) and for whole-match (M1) results. */
  rounds: FighterBoxRound[];
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
  /** R2 box score (additive): the match and per-round counters with Freshness before and after. Absent on a compacted report (`stats` keeps the few totals it has). */
  box?: FighterBox;
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
