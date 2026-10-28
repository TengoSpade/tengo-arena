import type { Seed } from '../rng';
import type { StartingRow, TacticsAssignment } from './club';
import type { FixtureStage } from './competition';
import type { AbilityId, ClassId, ClubId, CompetitionId, FighterId, FixtureId, PerkId, RaceId, StatId, TraitId, WeekId } from './ids';
import type { AbilityRanks } from './progression';

// ---- Sim inputs (core/game builds them; core/sim consumes them) ------------------------------

/** 03-combat sys-match inputs. Everything the sim needs; stored in MatchResult so a match can be re-simulated. */
export interface MatchInput {
  /** Match seed: deriveSeed(root, STREAM.match, season, fixtureId). */
  seed: Seed;
  /** 3, or 5 for finals. */
  bestOf: number;
  home: SideInput;
  away: SideInput;
}

export interface SideInput {
  clubId: ClubId;
  /** Exactly 5 fighters (O1), in slot order. */
  fighters: FightFighterInput[];
  /** Index into fighters of the lineup captain, and of the vice-captain if fielded. */
  captainIndex: number;
  viceCaptainIndex: number | null;
  /** Lineup chemistry (-5..5): from trait and captain lineup modifiers only in M1. Already folded into stats. */
  chemistry: number;
}

export interface FightFighterInput {
  fighterId: FighterId;
  classId: ClassId;
  raceId: RaceId;
  row: StartingRow;
  slot: number;
  /** Management-effective integer stats 1-20 (race, traits, statuses, chemistry, captain penalty applied; the sim must not re-apply them). */
  stats: Record<StatId, number>;
  /** Captaincy CQ 0-100 (lifecycle; −10 already applied for an acting captain). */
  captainQuality: number;
  /** Trait ids; the sim applies only combat-owned effects (traitEffectAdapter). */
  traitIds: TraitId[];
  tactics: TacticsAssignment;
  /** Rating 1-100 at kickoff (reports, MVP). */
  rating: number;
  /** Optional per-fighter hooks (combat.json combatModsDefaults). */
  combatMods?: { hpMult?: number; armorFlat?: number; wardFlat?: number; moveSpeedMult?: number; tenacityFlat?: number };
  // ---- M1.1 per-round fields (combat-skills.md sys-fight-freshness, sys-ability-ranks, sys-perks). Absent = the M1 default. ----
  /** Freshness 0-100 at the start of this round (default 100: no penalty). */
  freshness?: number;
  /** Ability ranks (default all 1). */
  abilityRanks?: AbilityRanks;
  /** Held perks, 0-4 (default none). */
  perkIds?: PerkId[];
  /** Entered from the reserves, or as an emergency entrant, for this round (default false). */
  enteredThisRound?: boolean;
}

/** M1.1: one round's sim input (simulateRound). Each side holds exactly the 5 active fighters, with the per-round fields set. */
export interface RoundInput {
  round: number;
  home: SideInput;
  away: SideInput;
  /**
   * M2 contract, RESERVED for the calls package (P-01; 05-technical-m2 §A6): how each side's calls are made this
   * round. Absent = no calls for either side, the M1/M1.1 behaviour (bit-identical). Until the calls package
   * lands the sim must refuse any plan other than absent or { none, none } (InvariantError; WP-M2A adds the check, today the field is ignored).
   */
  calls?: RoundCalls;
}

// ---- M2: calls (P-01), RESERVED until the owner answers Q17 and sys-calls is specified --------------

/**
 * One call (P-01, 03 §3.5 sys-calls): a committed input that takes effect at the START of `tick`, before that
 * tick's timers. A call made while the viewer is paused on frame tick f applies at f + 1, so every event up to
 * and including tick f is unchanged by it (the prefix property the viewer relies on, 05-technical-m2 §A2).
 */
export interface FightCall {
  /** The tick at whose start the call applies (1 ≤ tick < the time cap). */
  tick: number;
  /** sys-calls call kind id (content); no kind exists before the calls package. */
  kind: string;
  /** Unit index the call names (for example a focus target), when the kind takes one. */
  target?: number | null;
}

/**
 * How one side's calls are made in a round: none; by the AI call policy inside the sim (every AI club, and the
 * player's side when the player does not watch, open-020); or explicitly (the player, watching).
 */
export type SideCallPlan = { mode: 'none' } | { mode: 'policy' } | { mode: 'explicit'; calls: FightCall[] };

export interface RoundCalls {
  home: SideCallPlan;
  away: SideCallPlan;
}

/** M2: how the player's match is played, fixed at Play match with the squad lock (open-020, Q54 working assumption). */
export type MatchViewMode = 'watch' | 'simulate';

/**
 * M2: the player's match as watched (MatchState.watch). Absent = 'simulate' (the M1.1 flow). While a round is
 * being watched, GameState.liveMatch stays in phase 'round_pending' with `round` set.
 */
export interface LiveWatch {
  mode: MatchViewMode;
  /** The round waiting to be watched or being watched (rounds played + 1), or null between rounds. */
  round: number | null;
  /** The furthest tick the player has watched in that round (0 before kickoff); a reload resumes there, paused. Monotonic. */
  cursorTick: number;
  /** The player's calls in that round so far (RESERVED: always empty before the calls package). */
  calls: FightCall[];
}

/** M1.1: what one round did to a fighter who started it (sim RoundOutput.aftermath): input to drain, XP and immediate injuries. */
export interface RoundAftermath {
  fighterId: FighterId;
  side: 'home' | 'away';
  /** Damage taken this round (points) and max HP. */
  damageTaken: number;
  maxHp: number;
  downed: boolean;
  /** Largest single hit taken this round (points). */
  largestHit: number;
  /** The down, if downed. */
  downCause: DownRecord | null;
  /** Downs credited to him this round. */
  downsInflicted: number;
}

/** M1.1: a played round as the lifecycle hooks see it (core/game passes it to core/fighters). */
export interface RoundOutcome {
  /** The completed round (round number, winner, duration). */
  result: RoundResult;
  aftermath: RoundAftermath[];
}

// ---- Committed result ------------------------------------------------------------------------

/**
 * What happened in the arena for one fixture. Written once when the match is
 * played; never rerolled (P-05). Consequences (XP, injuries, gold) are
 * applied by their modules and reported through news and the ledger.
 */
export interface MatchResult {
  fixtureId: FixtureId;
  competitionId: CompetitionId;
  stage: FixtureStage;
  season: number;
  weekIndex: number;
  weekId: WeekId;
  homeClubId: ClubId;
  awayClubId: ClubId;
  engineVersion: number;
  contentHash: string;
  /** Full sim inputs (seed, bestOf, sides): enough to re-simulate the match for the report timeline or a replay. */
  input: MatchInput;
  rounds: RoundResult[];
  /** Rounds won. Rounds and matches are never drawn (03-combat sys-match). */
  score: { home: number; away: number };
  winnerClubId: ClubId;
  /** Keyed by fighter; every fighter who appeared. */
  fighterStats: Record<FighterId, FighterMatchStats>;
  mvpFighterId: FighterId | null;
  /** Hired blades used by either side (open-006). */
  hiredBladeIds: FighterId[];
  // ---- M1.1 round-by-round records (absent on results written before state v3: whole-match M1 sims) ----
  /** The squads fixed at the lineup lock. */
  squads?: { home: MatchSquad; away: MatchSquad };
  /** Lock-time fight inputs of reserves and emergency entrants (the round-1 five are in `input`). */
  reserveInputs?: { home: FightFighterInput[]; away: FightFighterInput[] };
  /** Who fought each round, with the per-round values: with `input` and `reserveInputs` it rebuilds every RoundInput exactly (replays never re-run decision policies). */
  roundLineups?: RoundLineups[];
  /** One record per between-round step that was played. */
  betweenRounds?: BetweenRoundRecord[];
  emergencyEntrants?: FighterId[];
  /**
   * Present on compacted results only (league compactHistory drops `fighterStats`, `reserveInputs`, `roundLineups`
   * and `betweenRounds`): what an old report still knows about every fighter who started a round, starters,
   * reserves and emergency entrants alike. See CompactFighterTotals.
   */
  fighterTotals?: Record<FighterId, CompactFighterTotals>;
  /**
   * Compacted results only: the round-1 five of each side as the sim input had it (slot order). Two readers need
   * it once the sim fighters are gone: the renewal ask (which of the club's matches this season a fighter
   * started) and the opponent's last fielded five on Home and Squad (D-R). `fieldedFive` (core/model) reads
   * either source.
   */
  fielded?: { home: CompactFielded[]; away: CompactFielded[] };
}

/**
 * One fighter of a side's round-1 five in a compacted result: [fighter id, row (0 front, 1 back),
 * rating at kickoff]. A tuple keeps a season of compacted results small (about 20 bytes a fighter).
 */
export type CompactFielded = readonly [fighterId: FighterId, row: 0 | 1, rating: number];

/**
 * One fighter's totals in a compacted result: [side (0 = home, 1 = away; the club is the fixture's
 * home or away club), rounds started, downs inflicted, downs suffered, damage dealt, healing done].
 * A tuple keeps a season of compacted results small (about 30 bytes a fighter).
 */
export type CompactFighterTotals = readonly [side: 0 | 1, roundsPlayed: number, downsInflicted: number, downsSuffered: number, damageDealt: number, healingDone: number];

// ---- M1.1 squads, swaps and the between-round step (combat-skills.md sys-match) ----------------

/** A club's match squad at the lock: 5 starters (slot order) and 0-2 reserves. */
export interface MatchSquad {
  starters: FighterId[];
  reserves: FighterId[];
  rows: Record<FighterId, StartingRow>;
  captainId: FighterId | null;
  viceCaptainId: FighterId | null;
}

/** One side's proposed swap at a between-round step (the entering fighter takes the outgoing fighter's slot; row defaults to his). */
export interface SwapDecision {
  out: FighterId;
  in: FighterId;
  row?: StartingRow;
}

export type SwapReason = 'player' | 'auto' | 'injury' | 'emergency';

export interface SwapRecord {
  out: FighterId;
  in: FighterId;
  row: StartingRow;
  reason: SwapReason;
  /** False only for emergency entrants. */
  costsSwap: boolean;
}

/** Why a proposed swap was refused (checked in this order; combat.json match.swaps). */
export type SwapRejection = 'match_decided' | 'no_swaps_left' | 'not_active' | 'not_a_reserve' | 'reserve_unfit' | 'duplicate';

export interface BetweenRoundRecord {
  afterRound: number;
  home: SwapRecord[];
  away: SwapRecord[];
  /** Injured in the round just played (they play no later round). */
  injured: FighterId[];
  /** Acting captain for the next round. */
  actingCaptain: { home: FighterId | null; away: FighterId | null };
  /** Freshness 0-100 of every squad member after the step. */
  freshness: Record<FighterId, number>;
}

/** One side of one round: the active five in slot order and the per-round values. */
export interface RoundSideLineup {
  fighterIds: FighterId[];
  rows: StartingRow[];
  captainIndex: number;
  viceCaptainIndex: number | null;
  /** CQ the acting captain fought with (interim penalty applied). */
  captainQuality: number;
  /** Freshness 0-100 at the round start, by slot. */
  freshness: number[];
  /**
   * M1.1 (additive, optional): Freshness 0-100 right after the round's drain (before the between-round recovery and
   * swaps), by slot. Written by the orchestrator once `freshnessAfterRound` ran; absent in older results.
   */
  freshnessAfter?: number[];
  /** Entered for this round, by slot. */
  entered: boolean[];
}

export interface RoundLineups {
  round: number;
  home: RoundSideLineup;
  away: RoundSideLineup;
  /**
   * M2 (additive, optional; RESERVED until the calls package): the call plans the round was played with, so a
   * replay re-simulates it exactly (roundInputOf copies it into RoundInput.calls). Absent = no calls.
   */
  calls?: RoundCalls;
}

export type MatchPhase = 'round_pending' | 'between_rounds' | 'done';

/** One side's state carried between rounds. */
export interface MatchSideState {
  clubId: ClubId;
  squad: MatchSquad;
  /** The active five for the next round, by slot, and their rows. */
  active: FighterId[];
  rows: StartingRow[];
  /** Swapped out: they can never return in this match (owner ruling). */
  withdrawn: FighterId[];
  unusedReserves: FighterId[];
  swapsUsed: number;
  injured: FighterId[];
  emergencyEntrants: FighterId[];
  actingCaptainId: FighterId | null;
  /** Fighters entering for the next round (enteredThisRound). */
  entering: FighterId[];
}

/**
 * A match in progress (persisted in GameState.liveMatch while the player's
 * match waits at a between-round step; P-05: every completed round and
 * decision is committed, a reload resumes on the same screen).
 */
export interface MatchState {
  fixtureId: FixtureId;
  /** Match seed: round seeds are deriveSeed(seed, 'round', n). */
  seed: Seed;
  bestOf: number;
  phase: MatchPhase;
  score: { home: number; away: number };
  /** Completed rounds. */
  rounds: RoundResult[];
  roundLineups: RoundLineups[];
  betweenRounds: BetweenRoundRecord[];
  home: MatchSideState;
  away: MatchSideState;
  /** Lock-time MatchInput (sides hold the round-1 five). */
  input: MatchInput;
  /** Lock-time fight input of every squad member and entrant, by fighter id. */
  inputsById: Record<FighterId, FightFighterInput>;
  /** Accumulated over the rounds played. */
  fighterStats: Record<FighterId, FighterMatchStats>;
  hiredBladeIds: FighterId[];
  /** The player's decisions for the pending between-round step (match.swap); null = accept the auto-swap suggestions. */
  playerDecisions: SwapDecision[] | null;
  /**
   * M2 (additive, optional; written from save schema v5 by WP-M2B): how the player watches this match and where.
   * Absent = 'simulate', the M1.1 flow.
   */
  watch?: LiveWatch;
}

export type RoundTiebreakStep = 'fighters_standing' | 'hp_fraction_sum' | 'damage_dealt' | 'first_down' | 'seeded_coin';

export interface RoundResult {
  /** 1-based. */
  round: number;
  /** deriveSeed(match seed, 'round', round). */
  seed: Seed;
  winner: 'home' | 'away';
  endReason: 'elimination' | 'time-limit';
  /** Which time-cap tie-break decided it, if any. */
  tiebreakStep: RoundTiebreakStep | null;
  durationTicks: number;
  survivors: { home: number; away: number };
  downs: { home: number; away: number };
  /** Final HP per unit index (0-4 home, 5-9 away). */
  finalHp: number[];
  /** Hash of the final fight state; identical at every RecordLevel. */
  checksum: string;
  /**
   * hashEventStream of the full log when recorded at 'full', else null. M2: a round the player watched is
   * committed at 'full' and keeps the hash of the log he saw (diagnostics and determinism tests; replays are
   * verified by `checksum`, because the hash also depends on FIGHT_LOG_FORMAT_VERSION).
   */
  eventHash: string | null;
}

/** 03-combat schema note 7. Summed over the match unless stated. */
export interface FighterMatchStats {
  clubId: ClubId;
  roundsPlayed: number;
  roundsSurvived: number;
  ticksOnArena: number;
  damageDealt: number;
  damageToShields: number;
  damageTaken: number;
  healingDone: number;
  /**
   * M1.1 (additive, optional): effective healing received (overheal excluded), the mirror of `healingDone`. Written
   * by the sim since the box-score round; absent in results played before it (the report re-derives it from the
   * re-simulated rounds when it can).
   */
  healingReceived?: number;
  shieldingDone: number;
  overheal: number;
  ccAppliedTicks: number;
  ccReceivedTicks: number;
  downsInflicted: number;
  downsSuffered: number;
  assists: number;
  focusSpent: number;
  casts: Record<AbilityId, number>;
  /** ruleFires[i] = fires of rule i; the last entry is the stance (P-22 recap). */
  ruleFires: number[];
  /** Ticks spent committed to each rule (same indexing as ruleFires). */
  ruleCommittedTicks: number[];
  /** Indexes of rules that never fired in the match. */
  rulesNeverFired: number[];
  /** Every down suffered (input to sys-injury and the death summary). */
  downs: DownRecord[];
  /** Opponents faced (M4 knowledge contact). */
  opponentIds: FighterId[];
  /**
   * Damage taken and max HP in each round played (index = round - 1; v2, for
   * per-round injury rolls). The sim always writes them; absent only in
   * hand-built fixtures and in results from v1 saves.
   */
  roundDamageTaken?: number[];
  roundMaxHp?: number[];
}

export interface DownRecord {
  round: number;
  tick: number;
  /** Credited fighter, if any. */
  byFighterId: FighterId | null;
  abilityId: AbilityId | null;
  /** Size of the downing hit, overkill, and damage taken that round (points). */
  hit: number;
  overkill: number;
  damageTakenRound: number;
  maxHp: number;
}
