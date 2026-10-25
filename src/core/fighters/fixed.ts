/**
 * Fixed-point helpers for lifecycle formulas (03 §1 "Precision / rounding").
 *
 * Lifecycle formulas multiply integers (centipoints, hundredths of a year)
 * by chains of basis-point factors. Intermediate products use IEEE doubles,
 * whose + - * / are bit-identical in every JS engine; each formula then
 * rounds ONCE at its end. The 1e-7 nudge only absorbs representation noise
 * (e.g. 114.99999999999999 for an exact 115); a true result is never that
 * close to an integer because every factor has at most four decimals.
 */
import { fractionToBp } from '../content';

export const BP = 10_000;
const NOISE = 1e-7;

/** Truncate toward zero once at the end of a formula. */
export function truncN(x: number): number {
  return x >= 0 ? Math.floor(x + NOISE) : -Math.floor(-x + NOISE);
}

/** Round half away from zero once at the end of a formula. */
export function roundN(x: number): number {
  return x >= 0 ? Math.floor(x + 0.5 + NOISE) : -Math.floor(-x + 0.5 + NOISE);
}

/** Content fraction or multiplier -> integer basis points (exact; content is validated). */
export function bp(fraction: number): number {
  return fractionToBp(fraction);
}

/** Product of basis-point factors as a plain multiplier (float). */
export function multOf(factorsBp: readonly number[]): number {
  let m = 1;
  for (const f of factorsBp) m = (m * f) / BP;
  return m;
}

/** Step table lookup: value of the entry with the largest key <= x (0 below the first key). */
export function stepLookup(table: readonly (readonly [number, number])[], x: number): number {
  let value = 0;
  for (const [key, v] of table) {
    if (key <= x) value = v;
    else break;
  }
  return value;
}

// ---- deterministic ln / exp (no Math.log / Math.exp / Math.pow in core) ------------------------

const LN2 = 0.6931471805599453;

/** Natural log for x > 0 from basic IEEE operations only (atanh series after range reduction). */
export function lnDet(x: number): number {
  if (!(x > 0)) throw new RangeError(`lnDet: x must be > 0, got ${x}`);
  let m = x;
  let e = 0;
  while (m < 0.5) {
    m *= 2;
    e -= 1;
  }
  while (m > 1) {
    m /= 2;
    e += 1;
  }
  const z = (m - 1) / (m + 1);
  const z2 = z * z;
  let term = z;
  let sum = 0;
  for (let n = 1; n < 80; n += 2) {
    sum += term / n;
    term *= z2;
  }
  return 2 * sum + e * LN2;
}

/** e^y from basic IEEE operations only (Taylor series with halving / squaring). */
export function expDet(y: number): number {
  let k = 0;
  let r = y;
  while (r > 0.125 || r < -0.125) {
    r /= 2;
    k += 1;
  }
  let term = 1;
  let sum = 1;
  for (let n = 1; n < 30; n++) {
    term = (term * r) / n;
    sum += term;
  }
  for (let i = 0; i < k; i++) sum *= sum;
  return sum;
}

/** base^exponent for base > 0 and a real exponent (deterministic). */
export function powDet(base: number, exponent: number): number {
  if (base === 1 || exponent === 0) return 1;
  return expDet(exponent * lnDet(base));
}
