/**
 * Integer money helpers (03 §1 rounding: each formula computes in integers
 * and rounds once at its end toward zero; wages and asks then floor to a
 * multiple of 5, signing costs, payouts and prizes to a multiple of 10).
 *
 * Every product here stays far below 2^47 for the value ranges of
 * economy.json (03-league-economy schema note 3), so a single Math.trunc of
 * an exact integer quotient is correctly rounded on every JS engine.
 */
import { InvariantError } from '../util';

/** a × b ÷ c, truncated toward zero once. */
export function mulDiv(a: number, b: number, c: number): number {
  const product = a * b;
  if (!Number.isSafeInteger(product) || !Number.isSafeInteger(c) || c === 0) {
    throw new InvariantError(`economy.mulDiv: unsafe operands ${a} × ${b} ÷ ${c}`);
  }
  const q = Math.trunc(product / c);
  return q === 0 ? 0 : q;
}

/** Integer quotient toward zero. */
export function divTrunc(a: number, b: number): number {
  const q = Math.trunc(a / b);
  return q === 0 ? 0 : q;
}

/** Round toward zero to a multiple (floor5 / floor10 for non-negative money). */
export function floorTo(value: number, multiple: number): number {
  const r = Math.trunc(value / multiple) * multiple;
  return r === 0 ? 0 : r;
}

/** economy.json step table: the entry with the largest key <= lookup (tables are ascending). */
export function stepLookup(table: readonly (readonly [number, number])[], key: number): number {
  let value = table[0]?.[1] ?? 0;
  for (const [k, v] of table) {
    if (k <= key) value = v;
    else break;
  }
  return value;
}

/** Integer linear interpolation over ascending [x, y] anchors, toward zero, flat outside the range. */
export function interpolate(anchors: readonly (readonly [number, number])[], x: number): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!first || !last) return 0;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const hi = anchors[i]!;
    const lo = anchors[i - 1]!;
    if (x <= hi[0]) return lo[1] + divTrunc((hi[1] - lo[1]) * (x - lo[0]), hi[0] - lo[0]);
  }
  return last[1];
}
