import { Rng, STREAM, type Seed } from '../rng';
import { byNumber, byString, chain } from '../util';

/**
 * Headless balance harness: many seeded fights -> per-class win rates.
 *
 * PHASE A STUB. The report shape and CLI (`npm run balance`) are fixed;
 * the fights are placeholder coin flips until core/sim exists. The sim agent
 * replaces `playFight` with real simulateFight() calls on generated lineups
 * (mirror matches, random 5v5 drafts, 1v1 class matrix).
 */
export interface BalanceOptions {
  seed: Seed;
  fights: number;
  /** Class ids to evaluate (from content). */
  classIds: readonly string[];
}

export interface ClassBalanceRow {
  classId: string;
  appearances: number;
  wins: number;
  winRate: number;
}

export interface BalanceReport {
  kind: 'balance';
  stub: boolean;
  seed: Seed;
  fights: number;
  classes: ClassBalanceRow[];
  /** Classes outside the TUNABLE target band (docs/design 05 §10). */
  outliers: string[];
  targetBand: { min: number; max: number };
}

/** TUNABLE: acceptable per-class win-rate band for random drafts. */
export const BALANCE_TARGET_BAND = { min: 0.45, max: 0.55 } as const;

export function runBalance(options: BalanceOptions): BalanceReport {
  const { seed, fights, classIds } = options;
  if (!Number.isSafeInteger(fights) || fights < 0) throw new RangeError(`fights must be a non-negative integer, got ${fights}`);
  const ids = classIds.length >= 2 ? classIds : ['class-a', 'class-b'];
  const stats = new Map<string, { appearances: number; wins: number }>(ids.map((id) => [id, { appearances: 0, wins: 0 }]));

  for (let i = 0; i < fights; i++) {
    const rng = Rng.create(seed, STREAM.balance, i);
    const a = rng.pick(ids);
    const b = rng.pick(ids);
    const aWins = playFight(rng);
    const sa = stats.get(a)!;
    const sb = stats.get(b)!;
    sa.appearances++;
    sb.appearances++;
    if (aWins) sa.wins++;
    else sb.wins++;
  }

  const classes = [...stats.entries()]
    .map(([classId, s]) => ({ classId, appearances: s.appearances, wins: s.wins, winRate: s.appearances ? s.wins / s.appearances : 0 }))
    .sort(chain(byNumber((r: ClassBalanceRow) => r.winRate, true), byString((r: ClassBalanceRow) => r.classId)));
  const outliers = classes
    .filter((r) => r.appearances > 0 && (r.winRate < BALANCE_TARGET_BAND.min || r.winRate > BALANCE_TARGET_BAND.max))
    .map((r) => r.classId);

  return { kind: 'balance', stub: true, seed, fights, classes, outliers, targetBand: { ...BALANCE_TARGET_BAND } };
}

/** Placeholder fight: a fair coin. Replaced by core/sim in phase B. */
function playFight(rng: Rng): boolean {
  return rng.chance(0.5);
}
