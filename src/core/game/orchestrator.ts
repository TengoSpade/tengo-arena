/**
 * M1.1 round-by-round match orchestrator (WP-C; docs/design/05 M1.1
 * addendum §WP-C). Spec: combat-skills.md sys-match and "Operation
 * contract: round-by-round matches"; progression.md hooks.
 *
 *   startMatch -> playRound -> [betweenRounds -> applyBetweenRound -> playRound]* -> finishMatch
 *
 * Pure over a draft: playRound calls the sim (ports.sim.simulateRound) and
 * the lifecycle hooks (ports.fighters.freshnessAfterRound, xpAfterRound,
 * injuriesAfterRound), applyBetweenRound runs legality, forced replacements,
 * emergency entrants, captain reassignment and freshnessBetweenRounds. AI
 * clubs and unpaused player matches take autoSwapDecisions; the player's
 * match pauses in GameState.liveMatch (P-05: everything committed per round).
 *
 * Implemented in the contracts phase (the record format depends on them):
 * checkSwaps (legality, combat.json match.swaps order) and roundInputOf
 * (replay). Everything else is a typed stub.
 */
import type { ContentDB } from '../content';
import type {
  ClubId,
  FightFighterInput,
  FighterId,
  Fixture,
  GameState,
  MatchResult,
  MatchSquad,
  MatchState,
  RoundInput,
  RoundOutcome,
  RoundSideLineup,
  SideInput,
  StartingRow,
  SwapDecision,
  SwapRejection,
} from '../model';
import { InvariantError, notImplemented } from '../util';
import type { GamePorts } from './ports';

export type MatchSide = 'home' | 'away';

/** Squads at the lineup lock (from Club.lineup: starters, reserves). */
export interface LockedSquads {
  home: MatchSquad;
  away: MatchSquad;
}

/** Validate the squads and build the MatchState (fight inputs of all squad members at the lock; match seed as today). */
export function startMatch(ports: GamePorts, draft: GameState, fixture: Fixture, squads: LockedSquads, content: ContentDB): MatchState {
  return notImplemented('game.startMatch (M1.1 WP-C)', ports, draft, fixture, squads, content);
}

/** Play the next round: build its RoundInput, simulateRound(deriveSeed(seed, 'round', n)), the lifecycle hooks, the score; phase moves on. */
export function playRound(ports: GamePorts, draft: GameState, ms: MatchState, content: ContentDB): RoundOutcome {
  return notImplemented('game.playRound (M1.1 WP-C)', ports, draft, ms, content);
}

/** One side of the between-round screen (combat-skills.md "Decision point"). */
export interface BetweenRoundSideView {
  clubId: ClubId;
  active: {
    fighterId: FighterId;
    slot: number;
    row: StartingRow;
    /** Freshness 0-100 now, and at the start of the round just played. */
    freshness: number;
    freshnessBefore: number;
    damageTaken: number;
    downed: boolean;
    injured: boolean;
  }[];
  reserves: { fighterId: FighterId; freshness: number; rating: number; fit: boolean }[];
  withdrawn: FighterId[];
  swapsLeft: number;
  /** Injured active fighters who must be replaced (forced). */
  forced: FighterId[];
  /** Auto-swap suggestions (pre-filled on the player's screen). */
  suggestions: SwapDecision[];
}

export interface BetweenRoundView {
  fixtureId: Fixture['id'];
  afterRound: number;
  nextRound: number;
  score: { home: number; away: number };
  home: BetweenRoundSideView;
  away: BetweenRoundSideView;
  /** The player's side, or null for an AI-vs-AI match. */
  playerSide: MatchSide | null;
  /** when_urgent pacing: a forced choice between two reserves, an active fighter below the auto threshold, or the captain out. */
  urgent: boolean;
}

/** Screen data and auto-swap suggestions for both sides after a non-deciding round. */
export function betweenRounds(ports: GamePorts, state: GameState, ms: MatchState, content: ContentDB): BetweenRoundView {
  return notImplemented('game.betweenRounds (M1.1 WP-C)', ports, state, ms, content);
}

/**
 * The auto-swap procedure for one side (combat-skills.md sys-match "Auto-swap"),
 * with the club's AutoSwapRules: forced injury replacements, then the
 * threshold step (freshnessBelow + lostRoundBonus if the side lost the round
 * just played), keepOneForInjury. Deterministic; never reads the other side's
 * pending decision (blind).
 */
export function autoSwapDecisions(ports: GamePorts, state: GameState, ms: MatchState, side: MatchSide, content: ContentDB): SwapDecision[] {
  return notImplemented('game.autoSwapDecisions (M1.1 WP-C)', ports, state, ms, side, content);
}

export interface SwapCheck {
  accepted: SwapDecision[];
  rejected: { decision: SwapDecision; reason: SwapRejection }[];
}

/**
 * Swap legality for one side's decisions at the pending step, each checked in
 * order (first failure wins): match_decided, no_swaps_left (counting the
 * swaps accepted before it), not_active, not_a_reserve (withdrawn fighters are
 * never reserves), reserve_unfit (injured this match or `isUnfit`), duplicate
 * (a fighter twice in this step's decisions).
 */
export function checkSwaps(ms: MatchState, side: MatchSide, decisions: readonly SwapDecision[], maxSwaps: number, isUnfit: (id: FighterId) => boolean = () => false): SwapCheck {
  const s = ms[side];
  const out: SwapCheck = { accepted: [], rejected: [] };
  const decided = ms.phase === 'done' || ms.score.home * 2 > ms.bestOf || ms.score.away * 2 > ms.bestOf;
  const seen = new Set<FighterId>();
  let used = s.swapsUsed;
  for (const d of decisions) {
    const reject = (reason: SwapRejection): void => {
      out.rejected.push({ decision: d, reason });
    };
    if (decided) reject('match_decided');
    else if (used >= maxSwaps) reject('no_swaps_left');
    else if (!s.active.includes(d.out)) reject('not_active');
    else if (!s.unusedReserves.includes(d.in) || s.withdrawn.includes(d.in)) reject('not_a_reserve');
    else if (s.injured.includes(d.in) || isUnfit(d.in)) reject('reserve_unfit');
    else if (seen.has(d.out) || seen.has(d.in)) reject('duplicate');
    else {
      out.accepted.push(d);
      used++;
    }
    seen.add(d.out);
    seen.add(d.in);
  }
  return out;
}

/** Apply both sides' decisions (home then away; they never interact) plus forced replacements; the MatchState moves to round_pending. */
export function applyBetweenRound(
  ports: GamePorts,
  draft: GameState,
  ms: MatchState,
  decisions: { home: SwapDecision[]; away: SwapDecision[] },
  content: ContentDB,
): MatchState {
  return notImplemented('game.applyBetweenRound (M1.1 WP-C)', ports, draft, ms, decisions, content);
}

/** The committed MatchResult (squads, reserveInputs, roundLineups, betweenRounds, emergencyEntrants, merged fighterStats, MVP). */
export function finishMatch(ports: GamePorts, draft: GameState, ms: MatchState, content: ContentDB): MatchResult {
  return notImplemented('game.finishMatch (M1.1 WP-C)', ports, draft, ms, content);
}

/** A whole match with auto decisions on both sides (AI-vs-AI, unpaused player matches, the soak). */
export function playMatchAuto(ports: GamePorts, draft: GameState, fixture: Fixture, squads: LockedSquads, content: ContentDB): MatchResult {
  return notImplemented('game.playMatchAuto (M1.1 WP-C)', ports, draft, fixture, squads, content);
}

// ---- replay (implemented: it fixes the record format) ------------------------------------------------------

function sideOf(result: MatchResult, side: MatchSide, lineup: RoundSideLineup): SideInput {
  const base = result.input[side];
  const pool = new Map<FighterId, FightFighterInput>();
  for (const f of base.fighters) pool.set(f.fighterId, f);
  for (const f of result.reserveInputs?.[side] ?? []) pool.set(f.fighterId, f);
  const fighters = lineup.fighterIds.map((id, slot): FightFighterInput => {
    const lock = pool.get(id);
    if (!lock) throw new InvariantError(`roundInputOf: no fight input for ${id} (${result.fixtureId})`);
    const f: FightFighterInput = { ...lock, row: lineup.rows[slot]!, slot, freshness: lineup.freshness[slot]!, enteredThisRound: lineup.entered[slot]! };
    if (slot === lineup.captainIndex) f.captainQuality = lineup.captainQuality;
    return f;
  });
  return { clubId: base.clubId, fighters, captainIndex: lineup.captainIndex, viceCaptainIndex: lineup.viceCaptainIndex, chemistry: base.chemistry };
}

/**
 * The exact RoundInput of a played round, rebuilt from the record (sw-008:
 * re-simulating it gives the same checksum and event hash; no policy runs).
 * M1 results (no roundLineups) replay every round from `input` unchanged.
 */
export function roundInputOf(result: MatchResult, round: number): RoundInput {
  const lineups = result.roundLineups?.find((r) => r.round === round);
  if (!lineups) return { round, home: result.input.home, away: result.input.away };
  return { round, home: sideOf(result, 'home', lineups.home), away: sideOf(result, 'away', lineups.away) };
}
