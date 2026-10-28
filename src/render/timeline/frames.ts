/**
 * The frame table: every `frame` event of a log as per-unit typed arrays, for O(log n) position and HP lookups.
 * PURE. Frames are `[x cm, y cm, hp, stateBits]` (log format 1) or `[..., shield, focus]` (format 2); a missing
 * shield or focus is stored as NaN and reads back as null (never guessed).
 */
import type { FightEvent, FrameUnit, UnitSpawn } from '../../core/model';
import { InvariantError } from '../../core/util';
import { bisectRight } from './util';

export interface FrameTable {
  readonly count: number;
  readonly ticks: Float64Array;
  /** seq of each frame's event (-1 for the spawn frame prepended when a log's first frame is later than tick 0). */
  readonly seqs: Float64Array;
  readonly x: readonly Float64Array[];
  readonly y: readonly Float64Array[];
  readonly hp: readonly Float64Array[];
  readonly bits: readonly Float64Array[];
  readonly shield: readonly Float64Array[];
  readonly focus: readonly Float64Array[];
  /** Per unit and frame: the direction the unit last moved in (radians, 0 = east, +y = south); set by `computeHeadings`. */
  readonly heading: readonly Float64Array[];
}

export interface Pos {
  x: number;
  y: number;
}

/** Build the table from the `frame` events (ascending ticks) and the spawn data. A tick-0 frame from the spawn is prepended when the log's first frame is later. */
export function buildFrameTable(frameEvents: readonly FightEvent[], spawns: readonly UnitSpawn[], unitCount: number): FrameTable {
  type Row = { tick: number; seq: number; units: readonly (FrameUnit | undefined)[] };
  const rows: Row[] = [];
  for (const ev of frameEvents) {
    if (ev.type !== 'frame' || !ev.data) continue;
    const row: Row = { tick: ev.tick, seq: ev.seq, units: ev.data.u };
    const last = rows[rows.length - 1];
    if (last && last.tick === ev.tick) rows[rows.length - 1] = row;
    else rows.push(row);
  }
  const first = rows[0];
  if (!first) throw new InvariantError('buildFrameTable: no frames');
  if (first.tick > 0) {
    const units: FrameUnit[] = [];
    for (let u = 0; u < unitCount; u++) {
      const s = spawns.find((sp) => sp.unit === u);
      units.push(s ? [s.x, s.y, s.hp, 0] : [0, 0, 0, 0]);
    }
    rows.unshift({ tick: 0, seq: -1, units });
  }
  const count = rows.length;
  const make = (): Float64Array[] => Array.from({ length: unitCount }, () => new Float64Array(count));
  const x = make();
  const y = make();
  const hp = make();
  const bits = make();
  const shield = make();
  const focus = make();
  const heading = make();
  const ticks = new Float64Array(count);
  const seqs = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    const row = rows[k]!;
    ticks[k] = row.tick;
    seqs[k] = row.seq;
    for (let u = 0; u < unitCount; u++) {
      const f = row.units[u];
      if (f) {
        x[u]![k] = f[0];
        y[u]![k] = f[1];
        hp[u]![k] = f[2];
        bits[u]![k] = f[3];
        shield[u]![k] = f[4] ?? NaN;
        focus[u]![k] = f[5] ?? NaN;
      } else if (k > 0) {
        // A frame without this unit (not produced by the sim): hold the previous values.
        x[u]![k] = x[u]![k - 1]!;
        y[u]![k] = y[u]![k - 1]!;
        hp[u]![k] = hp[u]![k - 1]!;
        bits[u]![k] = bits[u]![k - 1]!;
        shield[u]![k] = shield[u]![k - 1]!;
        focus[u]![k] = focus[u]![k - 1]!;
      }
    }
  }
  return { count, ticks, seqs, x, y, hp, bits, shield, focus, heading };
}

/** Index of the last frame with tick ≤ `tick` (0 when the tick is before the first frame). */
export function frameAtOrBefore(ft: FrameTable, tick: number): number {
  return Math.max(0, bisectRight(ft.ticks, tick) - 1);
}

/** Position of a unit at a (fractional) tick: linear between the surrounding frames, held after the last. */
export function positionAt(ft: FrameTable, unit: number, tick: number, out: Pos): void {
  const xs = ft.x[unit]!;
  const ys = ft.y[unit]!;
  const k = frameAtOrBefore(ft, tick);
  const t0 = ft.ticks[k]!;
  if (k >= ft.count - 1 || tick <= t0) {
    out.x = xs[k]!;
    out.y = ys[k]!;
    return;
  }
  const a = (tick - t0) / (ft.ticks[k + 1]! - t0);
  out.x = xs[k]! + (xs[k + 1]! - xs[k]!) * a;
  out.y = ys[k]! + (ys[k + 1]! - ys[k]!) * a;
}

/** Minimum movement between two frames (cm squared) that counts as moving (and turns the heading). */
export const MOVE_MIN_CM2 = 4;
