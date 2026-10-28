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
 * Decisions taken here (05 M1.1 addendum; reported to the architect):
 * - The hooks see the MatchState with the round just played appended
 *   (rounds, roundLineups with the round-start Freshness, score, merged
 *   fighterStats); `entering` is already cleared.
 * - Auto-swap compares Freshness in whole points (freshnessOf), as the UI and
 *   the sim see it; the threshold step goes lowest first (sw-007, §A4).
 * - Acting captain at each step: the club captain if active; else the acting
 *   captain if still active and either he is the vice or the vice is not
 *   active; else the vice if active; else the highest lock-time CQ among the
 *   active five (ties: lower slot). Everyone but the club captain leads at
 *   CQ − actingCaptainCqPenalty (the lock lead keeps his lock value).
 * - A swap reason is 'injury' when the outgoing fighter is injured, else
 *   'player' for the player's side when GameState.liveMatch carried his
 *   match.swap decisions, else 'auto'. Emergency entrants: 'emergency',
 *   costsSwap false; with no fit fighter outside the squad a hired blade of
 *   the injured fighter's class is engaged (open-006, one week).
 * - MatchResult.reserveInputs holds the reserves who entered and the
 *   emergency entrants (what roundInputOf needs), not unused reserves.
 */
import type { ContentDB } from '../content';
import { roleFamilies } from '../ai';
import {
  setMembership,
  type BetweenRoundRecord,
  type ClubId,
  type FightFighterInput,
  type Fighter,
  type FighterId,
  type FighterMatchStats,
  type Fixture,
  type GameState,
  type MatchResult,
  type MatchSideState,
  type MatchSquad,
  type MatchState,
  type RoundCalls,
  type RoundInput,
  type RoundLineups,
  type RoundOutcome,
  type RoundResult,
  type RoundSideLineup,
  type StartingRow,
  type SwapDecision,
  type SwapReason,
  type SwapRecord,
  type SwapRejection,
} from '../model';
import { deriveSeed, type Seed } from '../rng';
import { mergeStats, mvpScore } from '../sim';
import { InvariantError } from '../util';
import { buildMatchInput, fightInputOf, matchTypeOf } from './match';
import { copyCalls, sideFrom } from './rounds';
import type { GamePorts } from './ports';
import { compareIds, onRoster } from './shared';

export type MatchSide = 'home' | 'away';
const SIDES: readonly MatchSide[] = ['home', 'away'];

/** Squads at the lineup lock (from Club.lineup: starters, reserves). */
export interface LockedSquads {
  home: MatchSquad;
  away: MatchSquad;
}

// ---- small reads ------------------------------------------------------------------------------------------------

function decided(ms: Pick<MatchState, 'score' | 'bestOf'>): boolean {
  return ms.score.home * 2 > ms.bestOf || ms.score.away * 2 > ms.bestOf;
}

function freshness(ports: GamePorts, state: GameState, id: FighterId): number {
  const f = state.fighters[id];
  return f ? ports.fighters.freshnessOf(f) : 100;
}

function familiesOf(state: GameState, id: FighterId, content: ContentDB): readonly string[] {
  const f = state.fighters[id];
  const k = f ? content.classes.get(f.classId) : undefined;
  return k ? roleFamilies(k) : [];
}

function sameFamily(state: GameState, a: FighterId, b: FighterId, content: ContentDB): boolean {
  const fb = familiesOf(state, b, content);
  return familiesOf(state, a, content).some((x) => fb.includes(x));
}

function swapsLeft(ms: MatchState, side: MatchSide, content: ContentDB): number {
  const s = ms[side];
  return Math.max(0, Math.min(content.combat.match.swaps.maxPerMatch - s.swapsUsed, s.unusedReserves.length));
}

function reserveUsable(ports: GamePorts, state: GameState, s: MatchSideState, id: FighterId): boolean {
  const f = state.fighters[id];
  return !!f && !s.injured.includes(id) && !s.withdrawn.includes(id) && ports.fighters.isFit(f);
}

/**
 * Best-fit unused reserve for `outId` (combat sys-match): same role family
 * first (when `familyFirst`), then rating, then Freshness, then lower squad
 * index. `ok` filters (threshold margins); `taken` are reserves already used
 * in this step.
 */
function bestReserve(
  ports: GamePorts,
  state: GameState,
  ms: MatchState,
  side: MatchSide,
  outId: FighterId,
  taken: ReadonlySet<FighterId>,
  familyFirst: boolean,
  ok: (id: FighterId) => boolean,
  content: ContentDB,
): FighterId | null {
  const s = ms[side];
  const cands = s.unusedReserves.filter((id) => !taken.has(id) && reserveUsable(ports, state, s, id) && ok(id));
  if (cands.length === 0) return null;
  const key = (id: FighterId) => ({
    fam: familyFirst && sameFamily(state, outId, id, content) ? 1 : 0,
    rating: ms.inputsById[id]?.rating ?? 0,
    fresh: freshness(ports, state, id),
    index: s.squad.reserves.indexOf(id),
  });
  return cands
    .map((id) => ({ id, k: key(id) }))
    .sort((a, b) => b.k.fam - a.k.fam || b.k.rating - a.k.rating || b.k.fresh - a.k.fresh || a.k.index - b.k.index)[0]!.id;
}

// ---- start ------------------------------------------------------------------------------------------------------

function checkSquad(squad: MatchSquad, clubId: ClubId, content: ContentDB): void {
  const ids = [...squad.starters, ...squad.reserves];
  if (squad.starters.length !== content.combat.match.squad.starters) throw new InvariantError(`startMatch: ${clubId} has ${squad.starters.length} starters`);
  if (squad.reserves.length > content.combat.match.squad.reservesMax) throw new InvariantError(`startMatch: ${clubId} has ${squad.reserves.length} reserves`);
  if (new Set(ids).size !== ids.length) throw new InvariantError(`startMatch: ${clubId} names a fighter twice`);
}

function rowOf(state: GameState, squad: MatchSquad, id: FighterId, content: ContentDB): StartingRow {
  const row = squad.rows[id];
  if (row) return row;
  const f = state.fighters[id];
  return (f ? content.classes.get(f.classId)?.startingRow : undefined) ?? 'front';
}

/** Validate the squads and build the MatchState (fight inputs of all squad members at the lock; match seed as today). */
export function startMatch(ports: GamePorts, draft: GameState, fixture: Fixture, squads: LockedSquads, content: ContentDB): MatchState {
  for (const side of SIDES) checkSquad(squads[side], side === 'home' ? fixture.homeClubId : fixture.awayClubId, content);
  const entries = (sq: MatchSquad) => sq.starters.map((fighterId) => ({ fighterId, row: rowOf(draft, sq, fighterId, content) }));
  const input = buildMatchInput(ports, draft, fixture, { home: entries(squads.home), away: entries(squads.away) }, content);
  const inputsById = {} as Record<FighterId, FightFighterInput>;
  const matchType = matchTypeOf(fixture);
  const hiredBladeIds: FighterId[] = [];
  const sideState = (side: MatchSide): MatchSideState => {
    const squad = squads[side];
    const lock = input[side];
    const club = draft.clubs[lock.clubId]!;
    for (const f of lock.fighters) inputsById[f.fighterId] = f;
    squad.reserves.forEach((id, i) => {
      inputsById[id] = fightInputOf(ports, draft, club, id, rowOf(draft, squad, id, content), 5 + i, { matchType, chemistry: lock.chemistry, acting: false, cq: null }, content);
    });
    for (const id of [...squad.starters, ...squad.reserves]) if (draft.fighters[id]?.status === 'hired-blade') hiredBladeIds.push(id);
    return {
      clubId: lock.clubId,
      squad: { starters: [...squad.starters], reserves: [...squad.reserves], rows: { ...squad.rows }, captainId: squad.captainId, viceCaptainId: squad.viceCaptainId },
      active: lock.fighters.map((f) => f.fighterId),
      rows: lock.fighters.map((f) => f.row),
      withdrawn: [],
      unusedReserves: [...squad.reserves],
      swapsUsed: 0,
      injured: [],
      emergencyEntrants: [],
      actingCaptainId: lock.fighters[lock.captainIndex]?.fighterId ?? null,
      entering: [],
    };
  };
  const home = sideState('home');
  const away = sideState('away');
  return {
    fixtureId: fixture.id,
    seed: input.seed,
    bestOf: input.bestOf,
    phase: 'round_pending',
    score: { home: 0, away: 0 },
    rounds: [],
    roundLineups: [],
    betweenRounds: [],
    home,
    away,
    input,
    inputsById,
    fighterStats: {},
    hiredBladeIds,
    playerDecisions: null,
  };
}

// ---- rounds -----------------------------------------------------------------------------------------------------

/** CQ the acting captain fights with: the lock lead keeps his lock value; others lead at their lock CQ minus the interim penalty unless club captain. */
function actingCq(ms: MatchState, side: MatchSide, content: ContentDB): number {
  const s = ms[side];
  const id = s.actingCaptainId;
  if (id === null) return 0;
  const lock = ms.input[side];
  const lead = lock.fighters[lock.captainIndex];
  if (lead && lead.fighterId === id) return lead.captainQuality;
  const raw = ms.inputsById[id]?.captainQuality ?? 0;
  if (s.squad.captainId === id) return raw;
  return Math.max(0, raw - content.development.captaincy.actingCaptainCqPenalty);
}

function lineupOf(ports: GamePorts, state: GameState, ms: MatchState, side: MatchSide, content: ContentDB): RoundSideLineup {
  const s = ms[side];
  const freshnessNow = s.active.map((id) => freshness(ports, state, id));
  const entered = s.active.map((id) => s.entering.includes(id));
  if (ms.rounds.length === 0) {
    const lock = ms.input[side];
    return {
      fighterIds: [...s.active],
      rows: [...s.rows],
      captainIndex: lock.captainIndex,
      viceCaptainIndex: lock.viceCaptainIndex,
      captainQuality: lock.fighters[lock.captainIndex]?.captainQuality ?? 0,
      freshness: freshnessNow,
      entered,
    };
  }
  const captainIndex = s.actingCaptainId === null ? 0 : Math.max(0, s.active.indexOf(s.actingCaptainId));
  const vi = s.squad.viceCaptainId === null ? -1 : s.active.indexOf(s.squad.viceCaptainId);
  return {
    fighterIds: [...s.active],
    rows: [...s.rows],
    captainIndex,
    viceCaptainIndex: vi >= 0 && vi !== captainIndex ? vi : null,
    captainQuality: actingCq(ms, side, content),
    freshness: freshnessNow,
    entered,
  };
}

/** The next round of a match as the sim will play it: its number, exact RoundInput, lineup record and round seed. */
export interface PreparedRound {
  round: number;
  input: RoundInput;
  lineups: RoundLineups;
  seed: Seed;
}

/**
 * The call plans of the pending round (RESERVED for the calls package, P-01; 05-technical-m2 §A6): the player's calls
 * made so far in his live round (`liveMatch.watch.calls`), none for the other side. Undefined (no calls: the M1.1
 * input, bit-identical) while there are none, which is always the case before the calls package ('match.call' is
 * refused). The calls package also gives AI sides and a simulating player the call policy here.
 */
function pendingCalls(state: GameState, ms: MatchState): RoundCalls | undefined {
  const calls = ms.watch?.calls ?? [];
  const side = playerSideOf(state, ms);
  if (calls.length === 0 || side === null) return undefined;
  const plans: RoundCalls = { home: { mode: 'none' }, away: { mode: 'none' } };
  plans[side] = { mode: 'explicit', calls: calls.map((c) => ({ ...c })) };
  return plans;
}

/**
 * The next round's input, lineup record and seed, read-only (state and match are not touched). The ONE builder
 * of a round's input: playRound plays exactly this, and the M2 watch path (05-technical-m2 §A3, liveRoundPlayback)
 * shows exactly this, so the round the player watches cannot differ from the round that is committed. The round's
 * call plans (RESERVED; none before the calls package) are part of the input and of the lineup record, so a replay
 * (roundInputOf) re-simulates them.
 */
export function prepareRound(ports: GamePorts, state: GameState, ms: MatchState, content: ContentDB): PreparedRound {
  if (ms.phase !== 'round_pending') throw new InvariantError(`prepareRound: ${ms.fixtureId} is ${ms.phase}`);
  const n = ms.rounds.length + 1;
  const lineups: RoundLineups = { round: n, home: lineupOf(ports, state, ms, 'home', content), away: lineupOf(ports, state, ms, 'away', content) };
  const pool = (id: FighterId) => ms.inputsById[id];
  const input: RoundInput = {
    round: n,
    home: sideFrom(ms.input.home, pool, lineups.home, `playRound ${ms.fixtureId}`),
    away: sideFrom(ms.input.away, pool, lineups.away, `playRound ${ms.fixtureId}`),
  };
  const calls = pendingCalls(state, ms);
  if (calls) {
    input.calls = calls;
    lineups.calls = copyCalls(calls);
  }
  return { round: n, input, lineups, seed: deriveSeed(ms.seed, 'round', n) };
}

/**
 * A watched round's commit was refused: the log the viewer showed is not the log of the round that would be committed
 * (05-technical-m2 §A3, review B2). Week processing turns it into 'watch.mismatch' and returns no state.
 */
export class WatchMismatchError extends Error {
  constructor(
    readonly fixtureId: Fixture['id'],
    readonly round: number,
    readonly expected: string,
    readonly shown: string,
  ) {
    super(`The log shown for round ${round} of ${fixtureId} is not that round's log (shown ${shown}, round ${expected})`);
  }
}

/** playRound options (M2). */
export interface PlayRoundOptions {
  /**
   * Commit of a watched round: the hash of the log the viewer showed (RoundPlayback.log.hash). The round is then
   * simulated at 'full' from prepareRound's input (the call liveRoundPlayback makes) and its log hash is compared before
   * anything is written; a difference throws WatchMismatchError. In every build. The committed RoundResult keeps
   * `eventHash` null like every committed round, so a watched round and a simulated round commit identical results.
   */
  shownLogHash?: string;
}

/** Play the next round: prepareRound, simulateRound(deriveSeed(seed, 'round', n)), the lifecycle hooks, the score; phase moves on. */
export function playRound(ports: GamePorts, draft: GameState, ms: MatchState, content: ContentDB, options: PlayRoundOptions = {}): RoundOutcome {
  if (ms.phase !== 'round_pending') throw new InvariantError(`playRound: ${ms.fixtureId} is ${ms.phase}`);
  const { round: n, input, lineups, seed } = prepareRound(ports, draft, ms, content);
  const shown = options.shownLogHash;
  const out = ports.sim.simulateRound(input, seed, content, { record: shown === undefined ? 'none' : 'full' });
  if (shown !== undefined) {
    const hash = out.log?.hash ?? '';
    if (hash !== shown) throw new WatchMismatchError(ms.fixtureId, n, hash, shown);
  }
  // The outcome is identical at every record level (T4); only the 'full' level's own field differs, and committed rounds never store it.
  const result: RoundResult = { round: n, seed, ...out.result, eventHash: null };
  ms.rounds.push(result);
  ms.roundLineups.push(lineups);
  ms.score[result.winner]++;
  for (const id of [...ms.home.active, ...ms.away.active]) {
    const add = out.fighterStats[id];
    if (!add) continue;
    const prev = ms.fighterStats[id];
    ms.fighterStats[id] = prev ? mergeStats(prev, add) : add;
  }
  ms.home.entering = [];
  ms.away.entering = [];
  const outcome: RoundOutcome = { result, aftermath: out.aftermath };
  ports.fighters.freshnessAfterRound(draft, ms, outcome, content);
  // Box score: the Freshness each of the ten finished the round on (the drain is in; the between-round rest is not).
  for (const side of SIDES) lineups[side].freshnessAfter = lineups[side].fighterIds.map((id) => freshness(ports, draft, id));
  ports.fighters.xpAfterRound(draft, ms, outcome, content);
  const hurt = ports.fighters.injuriesAfterRound(draft, ms, outcome, content);
  for (const id of hurt) {
    for (const side of SIDES) {
      const s = ms[side];
      if (s.active.includes(id) && !s.injured.includes(id)) s.injured.push(id);
    }
  }
  ms.phase = decided(ms) ? 'done' : 'between_rounds';
  ms.playerDecisions = null;
  return outcome;
}

// ---- the between-round step -------------------------------------------------------------------------------------

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
  /**
   * Auto-swap suggestions (pre-filled on the player's screen). Blind: only the player's own side carries them; the
   * other side's pending decision is never computed for the player's view, so it is `[]` there (combat sys-match
   * "Simultaneous and blind"). With no player club (a spectated or headless match) both sides carry them.
   */
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

export function playerSideOf(state: GameState, ms: MatchState): MatchSide | null {
  if (state.playerClubId === null) return null;
  return ms.home.clubId === state.playerClubId ? 'home' : ms.away.clubId === state.playerClubId ? 'away' : null;
}

/** The auto-swap threshold for a side at the pending step: freshnessBelow, + lostRoundBonus if it lost the round just played. */
function thresholdFor(state: GameState, ms: MatchState, side: MatchSide, content: ContentDB): number {
  const rules = state.clubs[ms[side].clubId]?.autoSwap;
  const below = rules?.freshnessBelow ?? content.combat.match.autoSwapDefaults.freshnessBelow;
  const last = ms.rounds[ms.rounds.length - 1];
  return below + (last && last.winner !== side ? (rules?.lostRoundBonus ?? 0) : 0);
}

function sideView(ports: GamePorts, state: GameState, ms: MatchState, side: MatchSide, content: ContentDB, withSuggestions: boolean): BetweenRoundSideView {
  const s = ms[side];
  const n = ms.rounds.length;
  const last = ms.roundLineups[ms.roundLineups.length - 1]?.[side];
  return {
    clubId: s.clubId,
    active: s.active.map((id, slot) => {
      const st = ms.fighterStats[id];
      const at = last ? last.fighterIds.indexOf(id) : -1;
      return {
        fighterId: id,
        slot,
        row: s.rows[slot]!,
        freshness: freshness(ports, state, id),
        freshnessBefore: at >= 0 ? last!.freshness[at]! : freshness(ports, state, id),
        damageTaken: st?.roundDamageTaken?.[st.roundDamageTaken.length - 1] ?? 0,
        downed: st?.downs.some((d) => d.round === n) ?? false,
        injured: s.injured.includes(id),
      };
    }),
    reserves: s.unusedReserves.map((id) => ({ fighterId: id, freshness: freshness(ports, state, id), rating: ms.inputsById[id]?.rating ?? 0, fit: reserveUsable(ports, state, s, id) })),
    withdrawn: [...s.withdrawn],
    swapsLeft: swapsLeft(ms, side, content),
    forced: s.active.filter((id) => s.injured.includes(id)),
    suggestions: withSuggestions ? autoSwapDecisions(ports, state, ms, side, content) : [],
  };
}

/**
 * Screen data and auto-swap suggestions after a non-deciding round, as the player sees it. Decisions are blind:
 * the opponent's pending auto-swap decisions are not part of this view (its `suggestions` is `[]`; they are not
 * even computed here), so nothing the UI receives, stores or logs from this call reveals what the AI side will do.
 */
export function betweenRounds(ports: GamePorts, state: GameState, ms: MatchState, content: ContentDB): BetweenRoundView {
  if (ms.phase !== 'between_rounds') throw new InvariantError(`betweenRounds: ${ms.fixtureId} is ${ms.phase}`);
  const playerSide = playerSideOf(state, ms);
  const home = sideView(ports, state, ms, 'home', content, playerSide !== 'away');
  const away = sideView(ports, state, ms, 'away', content, playerSide !== 'home');
  let urgent = false;
  if (playerSide !== null) {
    const v = playerSide === 'home' ? home : away;
    const s = ms[playerSide];
    const fitReserves = v.reserves.filter((r) => r.fit).length;
    const below = thresholdFor(state, ms, playerSide, content);
    const captainOut = s.actingCaptainId !== null && (s.injured.includes(s.actingCaptainId) || !s.active.includes(s.actingCaptainId));
    urgent = (v.forced.length > 0 && fitReserves >= 2 && v.swapsLeft > 0) || v.active.some((a) => !a.injured && a.freshness < below) || captainOut;
  }
  return { fixtureId: ms.fixtureId, afterRound: ms.rounds.length, nextRound: ms.rounds.length + 1, score: { ...ms.score }, home, away, playerSide, urgent };
}

/**
 * The auto-swap procedure for one side (combat-skills.md sys-match "Auto-swap"),
 * with the club's AutoSwapRules: forced injury replacements, then the
 * threshold step (freshnessBelow + lostRoundBonus if the side lost the round
 * just played), keepOneForInjury. Deterministic; never reads the other side's
 * pending decision (blind).
 */
export function autoSwapDecisions(ports: GamePorts, state: GameState, ms: MatchState, side: MatchSide, content: ContentDB): SwapDecision[] {
  if (ms.phase !== 'between_rounds' || decided(ms)) return [];
  const s = ms[side];
  const rules = state.clubs[s.clubId]?.autoSwap ?? { ...content.combat.match.autoSwapDefaults, lostRoundBonus: 0 };
  let left = swapsLeft(ms, side, content);
  const taken = new Set<FighterId>();
  const out: SwapDecision[] = [];
  // 1. Forced: injured active fighters (slot order), the best-fit reserve, same role family first.
  for (const id of s.active) {
    if (left <= 0) break;
    if (!s.injured.includes(id)) continue;
    const r = bestReserve(ports, state, ms, side, id, taken, true, () => true, content);
    if (r === null) continue;
    out.push({ out: id, in: r });
    taken.add(r);
    left--;
  }
  if (rules.mode !== 'threshold') return out;
  // 2. Threshold: lowest Freshness first (ties: lower slot); 3. keepOneForInjury before the last possible step.
  const below = thresholdFor(state, ms, side, content);
  const lastStep = ms.rounds.length >= ms.bestOf - 1;
  const cands = s.active
    .map((id, slot) => ({ id, slot, f: freshness(ports, state, id) }))
    .filter((c) => !s.injured.includes(c.id) && c.f < below)
    .sort((a, b) => a.f - b.f || a.slot - b.slot);
  for (const c of cands) {
    if (left <= 0) break;
    if (rules.keepOneForInjury && left === 1 && !lastStep) break;
    const rating = ms.inputsById[c.id]?.rating ?? 0;
    const r = bestReserve(
      ports,
      state,
      ms,
      side,
      c.id,
      taken,
      rules.sameRoleFamilyFirst,
      (rid) => freshness(ports, state, rid) >= c.f + rules.reserveMargin && (ms.inputsById[rid]?.rating ?? 0) >= rating - rules.maxRatingGap,
      content,
    );
    if (r === null) continue;
    out.push({ out: c.id, in: r });
    taken.add(r);
    left--;
  }
  return out;
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
  const isDecided = ms.phase === 'done' || decided(ms);
  const seen = new Set<FighterId>();
  let used = s.swapsUsed;
  for (const d of decisions) {
    const reject = (reason: SwapRejection): void => {
      out.rejected.push({ decision: d, reason });
    };
    if (isDecided) reject('match_decided');
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

function enter(s: MatchSideState, d: SwapDecision, reason: SwapReason, costsSwap: boolean, records: SwapRecord[]): void {
  const slot = s.active.indexOf(d.out);
  if (slot < 0) throw new InvariantError(`swap: ${d.out} is not active`);
  const row = d.row ?? s.rows[slot]!;
  s.active[slot] = d.in;
  s.rows[slot] = row;
  if (!s.withdrawn.includes(d.out)) s.withdrawn.push(d.out);
  const r = s.unusedReserves.indexOf(d.in);
  if (r >= 0) s.unusedReserves.splice(r, 1);
  if (costsSwap) s.swapsUsed++;
  s.entering.push(d.in);
  records.push({ out: d.out, in: d.in, row, reason, costsSwap });
}

/** A one-week hired blade of the injured fighter's class when no fit fighter is left outside the squad (open-006). */
function engageBlade(ports: GamePorts, draft: GameState, clubId: ClubId, like: Fighter, content: ContentDB): FighterId {
  const club = draft.clubs[clubId]!;
  const tier = content.tiers.require(club.tierId);
  const gen = content.development.generation.hiredBlade;
  const id = ports.fighters.createFighter(
    draft,
    {
      kind: 'hired-blade',
      potentialShift: content.leagues.generationShifts.generatedFreeAgent,
      regionId: club.regionId,
      classId: like.classId,
      humanAge: { min: gen.humanAgeMin, max: gen.humanAgeMax },
      ratingTarget: tier.ratingBand.min,
    },
    content,
  );
  ports.economy.rollContractProfile(draft, id, content);
  const blade = draft.fighters[id]!;
  setMembership(draft, blade, clubId, 'hired-blade');
  blade.freeAgency = null;
  const now = { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex };
  blade.contract = {
    clubId,
    wagePerWeek: content.tierProfile(tier.level).tierMinWage,
    startSeason: now.season,
    endSeason: now.season,
    signedAt: now,
    dropClauseApplied: false,
    next: null,
  };
  return id;
}

/**
 * Emergency entrant for an injured fighter (no swap left): the best-fit fit
 * roster fighter outside the match squad (same role family as the injured
 * fighter, then rating, then Freshness, then lower fighter id; withdrawn
 * fighters never), else a hired blade. His fight input is built now, with the
 * side's lock chemistry.
 */
function emergencyEntrant(ports: GamePorts, draft: GameState, ms: MatchState, side: MatchSide, injuredId: FighterId, content: ContentDB): FighterId {
  const s = ms[side];
  const squad = new Set<FighterId>([...s.squad.starters, ...s.squad.reserves, ...s.withdrawn, ...s.active, ...s.emergencyEntrants, ...s.injured]);
  const cands: { f: Fighter; fam: number; rating: number; fresh: number }[] = [];
  for (const f of Object.values(draft.fighters)) {
    if (f.clubId !== s.clubId || squad.has(f.id) || onRoster(draft, s.clubId, f.id) === null || !ports.fighters.isFit(f)) continue;
    cands.push({ f, fam: sameFamily(draft, injuredId, f.id, content) ? 1 : 0, rating: ports.fighters.rating(f, content), fresh: ports.fighters.freshnessOf(f) });
  }
  cands.sort((a, b) => b.fam - a.fam || b.rating - a.rating || b.fresh - a.fresh || compareIds(a.f.id, b.f.id));
  const club = draft.clubs[s.clubId]!;
  let id = cands[0]?.f.id ?? null;
  if (id === null) {
    id = engageBlade(ports, draft, s.clubId, draft.fighters[injuredId]!, content);
    ms.hiredBladeIds.push(id);
  }
  const fixture = draft.fixtures[ms.fixtureId];
  const lock = ms.input[side];
  ms.inputsById[id] = fightInputOf(
    ports,
    draft,
    club,
    id,
    s.rows[s.active.indexOf(injuredId)]!,
    5 + s.squad.reserves.length + s.emergencyEntrants.length,
    { matchType: fixture ? matchTypeOf(fixture) : 'league', chemistry: lock.chemistry, acting: false, cq: null },
    content,
  );
  s.emergencyEntrants.push(id);
  return id;
}

/** Acting captain for the next round (see the module note). */
function reassignCaptain(ms: MatchState, side: MatchSide): void {
  const s = ms[side];
  const active = (id: FighterId | null): id is FighterId => id !== null && s.active.includes(id);
  const { captainId, viceCaptainId } = s.squad;
  if (active(captainId)) s.actingCaptainId = captainId;
  else if (active(s.actingCaptainId) && (s.actingCaptainId === viceCaptainId || !active(viceCaptainId))) return;
  else if (active(viceCaptainId)) s.actingCaptainId = viceCaptainId;
  else {
    let best = -1;
    let pick: FighterId | null = null;
    for (const id of s.active) {
      const cq = ms.inputsById[id]?.captainQuality ?? 0;
      if (cq > best) [best, pick] = [cq, id];
    }
    s.actingCaptainId = pick;
  }
}

/** Fighters injured in the round just played (not yet listed by an earlier step). */
function newlyInjured(ms: MatchState): FighterId[] {
  const earlier = new Set(ms.betweenRounds.flatMap((b) => b.injured));
  return [...ms.home.injured, ...ms.away.injured].filter((id) => !earlier.has(id));
}

/** Apply both sides' decisions (home then away; they never interact) plus forced replacements; the MatchState moves to round_pending. */
export function applyBetweenRound(
  ports: GamePorts,
  draft: GameState,
  ms: MatchState,
  decisions: { home: SwapDecision[]; away: SwapDecision[] },
  content: ContentDB,
): MatchState {
  if (ms.phase !== 'between_rounds') throw new InvariantError(`applyBetweenRound: ${ms.fixtureId} is ${ms.phase}`);
  const max = content.combat.match.swaps.maxPerMatch;
  const playerSide = playerSideOf(draft, ms);
  const record: BetweenRoundRecord = {
    afterRound: ms.rounds.length,
    home: [],
    away: [],
    injured: newlyInjured(ms),
    actingCaptain: { home: null, away: null },
    freshness: {},
  };
  for (const side of SIDES) {
    const s = ms[side];
    const source: SwapReason = side === playerSide && ms.playerDecisions !== null ? 'player' : 'auto';
    const check = checkSwaps(ms, side, decisions[side], max, (id) => {
      const f = draft.fighters[id];
      return !f || !ports.fighters.isFit(f);
    });
    const records = record[side];
    for (const d of check.accepted) enter(s, d, s.injured.includes(d.out) ? 'injury' : source, true, records);
    // Forced: every injured fighter still active is replaced (a reserve if a swap is left, else an emergency entrant).
    for (const id of [...s.active]) {
      if (!s.injured.includes(id)) continue;
      const r = s.swapsUsed < max ? bestReserve(ports, draft, ms, side, id, new Set(), true, () => true, content) : null;
      if (r !== null) enter(s, { out: id, in: r }, 'injury', true, records);
      else enter(s, { out: id, in: emergencyEntrant(ports, draft, ms, side, id, content) }, 'emergency', false, records);
    }
    reassignCaptain(ms, side);
    if (new Set(s.active).size !== 5 || s.active.length !== 5) throw new InvariantError(`applyBetweenRound: ${s.clubId} does not field 5`);
  }
  ports.fighters.freshnessBetweenRounds(draft, ms, content);
  for (const side of SIDES) {
    const s = ms[side];
    record.actingCaptain[side] = s.actingCaptainId;
    for (const id of [...s.squad.starters, ...s.squad.reserves, ...s.emergencyEntrants]) record.freshness[id] = freshness(ports, draft, id);
  }
  ms.betweenRounds.push(record);
  ms.phase = 'round_pending';
  ms.playerDecisions = null;
  return ms;
}

// ---- finish -----------------------------------------------------------------------------------------------------

/** The committed MatchResult (squads, reserveInputs, roundLineups, betweenRounds, emergencyEntrants, merged fighterStats, MVP). */
export function finishMatch(ports: GamePorts, draft: GameState, ms: MatchState, content: ContentDB): MatchResult {
  if (ms.phase !== 'done') throw new InvariantError(`finishMatch: ${ms.fixtureId} is ${ms.phase}`);
  const fixture = draft.fixtures[ms.fixtureId];
  if (!fixture) throw new InvariantError(`finishMatch: unknown fixture ${ms.fixtureId}`);
  const winner: MatchSide = ms.score.home > ms.score.away ? 'home' : 'away';
  const played = (side: MatchSide): FighterId[] => {
    const s = ms[side];
    return [...s.squad.starters, ...s.squad.reserves, ...s.emergencyEntrants].filter((id) => ms.fighterStats[id] !== undefined);
  };
  const fighterStats = {} as Record<FighterId, FighterMatchStats>;
  for (const side of SIDES) for (const id of played(side)) fighterStats[id] = ms.fighterStats[id]!;
  let mvp: FighterId | null = null;
  let best = -1;
  for (const id of played(winner)) {
    const sc = mvpScore(fighterStats[id]!);
    if (sc > best) [best, mvp] = [sc, id];
  }
  const entered = (side: MatchSide): FightFighterInput[] => {
    const lockIds = new Set(ms.input[side].fighters.map((f) => f.fighterId));
    return played(side)
      .filter((id) => !lockIds.has(id))
      .map((id) => ms.inputsById[id]!);
  };
  return {
    fixtureId: fixture.id,
    competitionId: fixture.competitionId,
    stage: fixture.stage,
    season: fixture.season,
    weekIndex: fixture.weekIndex,
    weekId: fixture.weekId,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    engineVersion: ports.sim.engineVersion,
    contentHash: content.ref.hash,
    ...simHashOf(ports, content),
    input: ms.input,
    rounds: ms.rounds,
    score: { ...ms.score },
    winnerClubId: winner === 'home' ? fixture.homeClubId : fixture.awayClubId,
    fighterStats,
    mvpFighterId: mvp,
    hiredBladeIds: [...ms.hiredBladeIds],
    squads: { home: ms.home.squad, away: ms.away.squad },
    reserveInputs: { home: entered('home'), away: entered('away') },
    roundLineups: ms.roundLineups,
    betweenRounds: ms.betweenRounds,
    emergencyEntrants: [...ms.home.emergencyEntrants, ...ms.away.emergencyEntrants],
  };
}

/** `MatchResult.simHash` (M2, save v5) when this sim can name it; absent otherwise (replays then fall back to the content hash). */
function simHashOf(ports: GamePorts, content: ContentDB): { simHash?: string } {
  const h = ports.sim.simContentHash?.(content) ?? null;
  return h === null ? {} : { simHash: h };
}

/** Both sides' auto decisions for the pending step, computed from the same state before either is applied (blind). */
export function autoDecisions(ports: GamePorts, state: GameState, ms: MatchState, content: ContentDB): { home: SwapDecision[]; away: SwapDecision[] } {
  return { home: autoSwapDecisions(ports, state, ms, 'home', content), away: autoSwapDecisions(ports, state, ms, 'away', content) };
}

/** Play an started match on to its end with auto decisions on both sides. */
export function playOutAuto(ports: GamePorts, draft: GameState, ms: MatchState, content: ContentDB): void {
  while (ms.phase !== 'done') {
    if (ms.phase === 'between_rounds') applyBetweenRound(ports, draft, ms, autoDecisions(ports, draft, ms, content), content);
    playRound(ports, draft, ms, content);
  }
}

/** A whole match with auto decisions on both sides (AI-vs-AI, unpaused player matches, the soak). */
export function playMatchAuto(ports: GamePorts, draft: GameState, fixture: Fixture, squads: LockedSquads, content: ContentDB): MatchResult {
  const ms = startMatch(ports, draft, fixture, squads, content);
  playOutAuto(ports, draft, ms, content);
  return finishMatch(ports, draft, ms, content);
}

// ---- replay ------------------------------------------------------------------------------------------------

export { roundInputOf } from './rounds';
