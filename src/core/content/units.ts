/**
 * Authoring units -> engine units (03 §1, 03-combat schema note 2).
 *
 * Content is authored in readable units with key suffixes; the engine works
 * in integers. Every conversion must be exact (the validator rejects values
 * that are not), so these helpers round only to remove floating-point noise.
 *
 * | Key suffix          | Authoring unit | Engine unit                         |
 * | ------------------- | -------------- | ----------------------------------- |
 * | `...S`              | seconds        | ticks (× ticksPerSecond, 20)         |
 * | `per...S`           | s per point    | milliseconds per point (× 1000)      |
 * | `...M`              | metres         | centimetres (× 100); sim uses mm (× 1000) |
 * | `...Mps`            | metres/second  | mm per tick (× 1000 / ticksPerSecond) |
 * | `...Deg`            | degrees        | cone table key (cos from combat.json) |
 * | `...Bp`             | basis points   | as is (integer)                      |
 * | unsuffixed fraction | 0..n           | basis points (× 10,000)              |
 */

export const TICKS_PER_SECOND = 20;
export const BP = 10_000;

const EPS = 1e-6;

function exact(value: number, factor: number, what: string): number {
  const scaled = value * factor;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > EPS) throw new RangeError(`${value} does not convert exactly to ${what}`);
  return rounded === 0 ? 0 : rounded;
}

export function isExact(value: number, factor: number): boolean {
  const scaled = value * factor;
  return Math.abs(scaled - Math.round(scaled)) <= EPS;
}

/** Seconds -> ticks. */
export function secondsToTicks(seconds: number, ticksPerSecond = TICKS_PER_SECOND): number {
  return exact(seconds, ticksPerSecond, 'ticks');
}

/** Seconds -> milliseconds (for per-point coefficients). */
export function secondsToMs(seconds: number): number {
  return exact(seconds, 1000, 'milliseconds');
}

/** Metres -> centimetres (content, events, UI). */
export function metresToCm(metres: number): number {
  return exact(metres, 100, 'centimetres');
}

/** Metres -> millimetres (sim-internal positions; orchestrator decision 2026-10-25). */
export function metresToMm(metres: number): number {
  return exact(metres, 1000, 'millimetres');
}

/** Metres per second -> millimetres per tick. */
export function mpsToMmPerTick(mps: number, ticksPerSecond = TICKS_PER_SECOND): number {
  return exact(mps, 1000 / ticksPerSecond, 'mm per tick');
}

/** Unsuffixed fraction (e.g. 0.04) -> basis points (400). */
export function fractionToBp(fraction: number): number {
  return exact(fraction, BP, 'basis points');
}

/** Basis-point multiply with one truncation toward zero at the end (03 §1 rounding). */
export function mulBp(value: number, bp: number): number {
  return Math.trunc((value * bp) / BP);
}

/**
 * Unit rule for a key, used by the validator: which factor a numeric value
 * under this key must convert exactly with. Returns null for keys without a
 * unit constraint (integers and identifiers).
 */
export function unitRuleForKey(key: string): { factor: number; unit: string } | null {
  if (/^per[A-Z].*[a-z]S$/.test(key)) return { factor: 1000, unit: 'milliseconds' };
  if (/[a-z]Mps$/.test(key)) return { factor: 1000 / TICKS_PER_SECOND, unit: 'mm per tick' };
  if (/[a-z]S$/.test(key)) return { factor: TICKS_PER_SECOND, unit: 'ticks' };
  if (/[a-z]M$/.test(key)) return { factor: 100, unit: 'centimetres' };
  if (/[a-z]Deg$/.test(key)) return { factor: 1, unit: 'whole degrees' };
  if (/Bp$/.test(key)) return { factor: 1, unit: 'whole basis points' };
  return { factor: BP, unit: 'basis points' };
}
