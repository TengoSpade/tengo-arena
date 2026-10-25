import type { ContentDB } from '../content';
import { Rng, STREAM, type Seed } from '../rng';
import { byNumber, byString, chain } from '../util';

/**
 * Headless balance harness: many seeded fights -> per-class win rates (V1,
 * vis-002). Owner: WP1. CONTRACT: options and report shape fixed (additive
 * changes allowed).
 *
 * STUB until core/sim lands: fights are placeholder coin flips. WP1 replaces
 * `playFight` with simulateMatch on generated lineups for each mode.
 */
export type BalanceMode =
  /** Random 5v5 drafts from all classes; win rate per class appearance. */
  | 'random-draft'
  /** Each class's default preset against the same class (sanity: ~50%). */
  | 'mirror'
  /** vis-002: tailored presets versus default presets at equal rating. */
  | 'preset-vs-default';

export interface BalanceOptions {
  seed: Seed;
  fights: number;
  content: ContentDB;
  mode?: BalanceMode;
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
  mode: BalanceMode;
  seed: Seed;
  fights: number;
  contentHash: string;
  classes: ClassBalanceRow[];
  /** Classes outside the target band (docs/design 05 §10). */
  outliers: string[];
  targetBand: { min: number; max: number };
}

/** TUNABLE (tech): M1 first-pass band; M7 target 45-55%. */
export const BALANCE_TARGET_BAND = { min: 0.4, max: 0.6 } as const;

export function runBalance(options: BalanceOptions): BalanceReport {
  const { seed, fights, content } = options;
  const mode = options.mode ?? 'random-draft';
  if (!Number.isSafeInteger(fights) || fights < 0) throw new RangeError(`fights must be a non-negative integer, got ${fights}`);
  const ids = content.classes.list.map((k) => k.id);
  const stats = new Map<string, { appearances: number; wins: number }>(ids.map((id) => [id, { appearances: 0, wins: 0 }]));

  for (let i = 0; i < fights; i++) {
    const rng = Rng.create(seed, STREAM.balance, mode, i);
    const a = rng.pick(ids);
    const b = mode === 'mirror' ? a : rng.pick(ids);
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

  return {
    kind: 'balance',
    stub: true,
    mode,
    seed,
    fights,
    contentHash: content.ref.hash,
    classes,
    outliers,
    targetBand: { ...BALANCE_TARGET_BAND },
  };
}

/** Placeholder fight: a fair coin. Replaced by core/sim. */
function playFight(rng: Rng): boolean {
  return rng.chance(0.5);
}
