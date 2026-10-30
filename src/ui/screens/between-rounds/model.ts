/**
 * Between-round screen logic (pure): the player's swap plan, keyboard cycling, the XP estimate and the
 * reserves' role coverage. combat-skills.md sys-match "Decision point"; progression.md XP rules.
 */
import type { ContentDB } from '../../../core/content';
import type { BetweenRoundSideView } from '../../../core/game';
import type { FighterId, GameState, MatchState, StartingRow, SwapDecision } from '../../../core/model';

export function sameDecisions(a: readonly SwapDecision[], b: readonly SwapDecision[]): boolean {
  if (a.length !== b.length) return false;
  const key = (d: SwapDecision) => `${d.out}>${d.in}>${d.row ?? ''}`;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((x, i) => x === sb[i]);
}

/** Reserves that can enter: unused, fit, not already used by another swap in the plan. */
export function freeReserves(side: BetweenRoundSideView, plan: readonly SwapDecision[], except?: FighterId): FighterId[] {
  const used = new Set(plan.filter((d) => d.out !== except).map((d) => d.in));
  return side.reserves.filter((r) => r.fit && !used.has(r.fighterId)).map((r) => r.fighterId);
}

/** Set (or clear with null) the reserve replacing `out`; keeps the plan within the swaps left. */
export function setSwap(side: BetweenRoundSideView, plan: readonly SwapDecision[], out: FighterId, incoming: FighterId | null, row?: StartingRow): SwapDecision[] {
  const rest = plan.filter((d) => d.out !== out && d.in !== incoming);
  if (incoming === null) return rest;
  if (rest.length >= side.swapsLeft) return [...plan];
  const slotRow = side.active.find((a) => a.fighterId === out)?.row;
  const d: SwapDecision = { out, in: incoming };
  if (row && row !== slotRow) d.row = row;
  return [...rest, d];
}

/** Keys 1–5: none → each free reserve in turn → none. */
export function cycleSwap(side: BetweenRoundSideView, plan: readonly SwapDecision[], out: FighterId): SwapDecision[] {
  const current = plan.find((d) => d.out === out)?.in ?? null;
  const options = freeReserves(side, plan, out);
  const order: (FighterId | null)[] = [null, ...options];
  const at = order.indexOf(current);
  const nextIn = order[(at + 1) % order.length] ?? null;
  if (nextIn !== null && current === null && plan.length >= side.swapsLeft) return [...plan];
  return setSwap(side, plan, out, nextIn);
}

/** XP so far in this match by fighter (≈: round XP rules without trait multipliers), development.json xp. */
export function matchXpSoFar(content: ContentDB, ms: MatchState, side: 'home' | 'away', tournament: boolean): Record<string, number> {
  const xp = content.development.xp;
  const out: Record<string, number> = {};
  ms.roundLineups.forEach((rl, i) => {
    const lineup = rl[side];
    const won = ms.rounds[i]?.winner === side;
    for (const id of lineup.fighterIds) {
      const st = ms.fighterStats[id];
      const rounds = Math.max(1, st?.roundsPlayed ?? 1);
      const downsPerRound = Math.min(xp.downCreditMax, Math.floor((st?.downsInflicted ?? 0) / rounds));
      const downed = (st?.downsSuffered ?? 0) >= rounds ? 1 : 0;
      const raw = xp.perRoundStarted + (won ? xp.winBonus : 0) + downsPerRound * xp.downCreditEach + (downed ? 0 : xp.surviveBonus);
      out[id] = (out[id] ?? 0) + raw * (tournament ? xp.tournamentMult : 1);
    }
  });
  for (const k of Object.keys(out)) out[k] = Math.floor(out[k]!);
  return out;
}

/** Roles the unused reserves cover (a hybrid counts for both), and the roles of the five without cover. */
export function reserveCoverage(state: GameState, content: ContentDB, side: BetweenRoundSideView): { covered: string[]; uncovered: string[] } {
  const roles = (id: FighterId) => [...(content.classes.get(state.fighters[id]?.classId ?? '')?.archetypes ?? [])] as string[];
  const covered = new Set<string>();
  for (const r of side.reserves) if (r.fit) for (const role of roles(r.fighterId)) covered.add(role);
  const needed = new Set<string>();
  for (const a of side.active) for (const role of roles(a.fighterId)) needed.add(role);
  return { covered: [...covered], uncovered: [...needed].filter((r) => !covered.has(r)) };
}

/** What a fighter has done so far in this match (the live counters), for the between-round table. */
export interface MatchLine {
  rounds: number;
  damageDone: number;
  damageReceived: number;
  healingDone: number;
  /** Null when core does not count it for this match (older records). */
  healingReceived: number | null;
  shieldingDone: number;
  /** Downs he inflicted / times he was downed. */
  downs: number;
  downed: number;
}

export function matchLineSoFar(ms: MatchState, id: FighterId): MatchLine {
  const s = ms.fighterStats[id];
  return {
    rounds: s?.roundsPlayed ?? 0,
    damageDone: s?.damageDealt ?? 0,
    damageReceived: s?.damageTaken ?? 0,
    healingDone: s?.healingDone ?? 0,
    healingReceived: s?.healingReceived ?? null,
    shieldingDone: s?.shieldingDone ?? 0,
    downs: s?.downsInflicted ?? 0,
    downed: s?.downsSuffered ?? 0,
  };
}
