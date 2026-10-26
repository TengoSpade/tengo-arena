/**
 * Round inputs from the lock-time fight inputs and a round's lineup (M1.1
 * record format, 05 M1.1 addendum §A2). Shared by the orchestrator (play) and
 * the replay (roundInputOf), so both build exactly the same RoundInput.
 */
import type { FightFighterInput, FighterId, MatchResult, RoundInput, RoundSideLineup, SideInput } from '../model';
import { InvariantError } from '../util';

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
  return { round, home: sideFrom(result.input.home, pool('home'), lineups.home, where), away: sideFrom(result.input.away, pool('away'), lineups.away, where) };
}
