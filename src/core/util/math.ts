/**
 * Deterministic math helpers for the core.
 *
 * Rule (enforced by tests/architecture): core code may use + - * / %,
 * Math.sqrt / abs / min / max / floor / ceil / round / trunc / sign / imul /
 * fround / clz32, but NOT transcendental functions (Math.sin, cos, tan, atan2,
 * exp, log, pow, hypot, cbrt, ...) or the ** operator. Their results are
 * implementation-defined and may differ between JS engines, which would break
 * replays across the browser, Node tests and a desktop shell. If a system
 * needs one, add a deterministic implementation here with tests.
 */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Inverse of lerp: where `value` lies between a and b (0..1 when inside). */
export function invLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

export function sq(x: number): number {
  return x * x;
}

/** x raised to a non-negative integer power by repeated multiplication. */
export function powi(x: number, n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`powi: exponent must be a non-negative integer, got ${n}`);
  let result = 1;
  let base = x;
  let e = n;
  while (e > 0) {
    if (e & 1) result *= base;
    base *= base;
    e >>>= 1;
  }
  return result;
}

/** Squared distance between two points (avoid sqrt when only comparing). */
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Euclidean distance. Math.sqrt is correctly rounded by IEEE 754, so it is deterministic. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/**
 * Round half away from zero to an integer. Use for money and other integer
 * quantities so that -2.5 -> -3 and 2.5 -> 3 (Math.round would give -2).
 */
export function roundHalfAway(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
