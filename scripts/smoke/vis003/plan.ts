/**
 * Which moments of a fight to capture for the agent observer. The packet is a sequence of stills of a fight played at
 * 1x: the spawn, a frame every few seconds, and around each down the frame before the blow lands, the frame where the
 * callout names the cause, and one later in the callout's 2 s life. Pure.
 */
import type { FightKey } from './types';

export interface PlannedCapture {
  tick: number;
  reason: 'spawn' | 'periodic' | 'before-down' | 'down' | 'after-down' | 'end';
}

export interface PlanOptions {
  /** A periodic frame every n ticks (20 ticks = 1 s). Default 80 (4 s). */
  everyTicks?: number;
  /** Frames closer than this to one already planned are dropped. Default 6 ticks. */
  minGapTicks?: number;
}

const rank = (r: PlannedCapture['reason']): number => (r === 'down' ? 0 : r === 'before-down' || r === 'after-down' ? 1 : r === 'end' ? 2 : r === 'spawn' ? 3 : 4);

export function planCaptures(key: FightKey, opts: PlanOptions = {}): PlannedCapture[] {
  const every = Math.max(20, opts.everyTicks ?? 80);
  const gap = opts.minGapTicks ?? 6;
  const end = key.durationTicks;
  const wanted: PlannedCapture[] = [{ tick: 10, reason: 'spawn' }];
  for (let t = every; t < end; t += every) wanted.push({ tick: t, reason: 'periodic' });
  for (const d of key.downs) {
    wanted.push({ tick: Math.max(0, d.tick - 8), reason: 'before-down' });
    // The down that ends the fight is at the last tick: its frames are clamped to it.
    wanted.push({ tick: Math.min(d.tick + 2, end), reason: 'down' });
    wanted.push({ tick: Math.min(d.tick + 30, end), reason: 'after-down' });
  }
  wanted.push({ tick: end, reason: 'end' });
  // Down frames win over periodic ones when they collide.
  wanted.sort((a, b) => a.tick - b.tick || rank(a.reason) - rank(b.reason));
  const out: PlannedCapture[] = [];
  for (const w of wanted) {
    if (w.tick > end) continue;
    const last = out[out.length - 1];
    if (last && w.tick - last.tick < gap) {
      if (rank(w.reason) < rank(last.reason)) out[out.length - 1] = w;
      continue;
    }
    out.push(w);
  }
  return out;
}
