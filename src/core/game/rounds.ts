/**
 * Round inputs from the lock-time fight inputs and a round's lineup (M1.1
 * record format, 05 M1.1 addendum §A2). Shared by the orchestrator (play) and
 * the replay (roundInputOf), so both build exactly the same RoundInput.
 */
import type { FightFighterInput, FighterId, MatchResult, MatchState, RoundCalls, RoundInput, RoundLineups, RoundSideLineup, SideCallPlan, SideInput } from '../model';
import type { ContentDB } from '../content';
import { InvariantError } from '../util';
import type { GamePorts } from './ports';

/** One side of a round's input: each active fighter's lock-time input with this round's slot, row, Freshness and entered flag; the acting captain's CQ. */
export function sideFrom(base: SideInput, pool: (id: FighterId) => FightFighterInput | undefined, lineup: RoundSideLineup, where: string): SideInput {
  const fighters = lineup.fighterIds.map((id, slot): FightFighterInput => {
    const lock = pool(id);
    if (!lock) throw new InvariantError(`${where}: no fight input for ${id}`);
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
  const pool = (side: 'home' | 'away') => {
    const m = new Map<FighterId, FightFighterInput>();
    for (const f of result.input[side].fighters) m.set(f.fighterId, f);
    for (const f of result.reserveInputs?.[side] ?? []) m.set(f.fighterId, f);
    return (id: FighterId) => m.get(id);
  };
  const where = `roundInputOf ${result.fixtureId}`;
  return withCalls({ round, home: sideFrom(result.input.home, pool('home'), lineups.home, where), away: sideFrom(result.input.away, pool('away'), lineups.away, where) }, lineups);
}

/**
 * The round's input with the call plans it was played with (M2, RESERVED for the calls package; 05-technical-m2 §A6):
 * `RoundLineups.calls` copied into `RoundInput.calls`, so a replay re-simulates exactly the calls the round had. Absent
 * plans stay absent (no calls: the M1.1 input, bit-identical).
 */
export function withCalls(input: RoundInput, lineups: RoundLineups): RoundInput {
  return lineups.calls ? { ...input, calls: copyCalls(lineups.calls) } : input;
}

/** A deep copy of call plans (a lineup record never shares objects with a sim input). */
export function copyCalls(calls: RoundCalls): RoundCalls {
  const side = (p: SideCallPlan): SideCallPlan => (p.mode === 'explicit' ? { mode: 'explicit', calls: p.calls.map((c) => ({ ...c })) } : { ...p });
  return { home: side(calls.home), away: side(calls.away) };
}

/**
 * A committed round of a match still in progress (GameState.liveMatch), rebuilt like roundInputOf from the match's own
 * record: its lineup and the lock-time inputs of everyone who can play (MatchState.inputsById).
 */
export function liveRoundInputOf(ms: MatchState, round: number): RoundInput {
  const lineups = ms.roundLineups.find((r) => r.round === round);
  if (!lineups) throw new InvariantError(`liveRoundInputOf ${ms.fixtureId}: no round ${round}`);
  const pool = (id: FighterId) => ms.inputsById[id];
  const where = `liveRoundInputOf ${ms.fixtureId}`;
  return withCalls({ round, home: sideFrom(ms.input.home, pool, lineups.home, where), away: sideFrom(ms.input.away, pool, lineups.away, where) }, lineups);
}

/**
 * Why a stored result cannot be re-simulated on this build, or null when it can (05-technical-m2 §A4; owner answer to
 * Q56). The one rule for replays and the report timeline (buildMatchReport):
 * - 'compacted': O24 dropped its fight inputs and round records;
 * - 'other-build': another sim played it: the engine version differs, or the sim content does: `MatchResult.simHash`
 *   against core/sim simContentHash (tech-026: a balance update ends replays, a renamed club does not), and for
 *   results without a simHash (written before save v5, or while this build's sim cannot name it) the career content
 *   hash, which covers the sim content too.
 */
export function replayBlocker(ports: GamePorts, result: MatchResult, content: ContentDB): 'compacted' | 'other-build' | null {
  if (ports.league.isCompactedResult(result)) return 'compacted';
  if (result.engineVersion !== ports.sim.engineVersion) return 'other-build';
  const simHash = result.simHash === undefined ? null : (ports.sim.simContentHash?.(content) ?? null);
  if (simHash !== null) return result.simHash === simHash ? null : 'other-build';
  return result.contentHash === content.ref.hash ? null : 'other-build';
}
