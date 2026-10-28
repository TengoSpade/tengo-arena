/**
 * Which moments of a fight to capture, in two kinds that never mix.
 *
 * The observer packet is a fixed schedule that does not depend on the downs: a frame at tick 10, then one every 30 ticks
 * (1.5 s of fight time, shorter than a callout's 2 s so every callout is on screen in at least one frame), then the last
 * tick. Its frame count follows the fight's length only and its files are numbered, so nothing in a packet says how many
 * downs there were or when.
 *
 * The evidence-only captures bracket every down (just before it, where its callout appears, and later in the callout's life)
 * and are private to the scorer: they record what the screen's text said at those ticks, with no screenshot and no file in
 * the packet. Pure.
 */
import type { FightKey } from './types';

/** Ticks between observer frames: 1.5 s of fight time, under the 2 s life of a down callout. */
export const PACKET_EVERY_TICKS = 30;

export interface PlannedCapture {
  tick: number;
  reason: 'spawn' | 'periodic' | 'end' | 'before-down' | 'down' | 'after-down';
  /** true: a numbered screenshot in the observer packet. false: the scorer's private evidence only (text, no picture). */
  packet: boolean;
}

/** The observer frames of a fight of `durationTicks`: depends on nothing but its length. */
export function planPacket(durationTicks: number, everyTicks = PACKET_EVERY_TICKS): PlannedCapture[] {
  const out: PlannedCapture[] = [{ tick: Math.min(10, durationTicks), reason: 'spawn', packet: true }];
  for (let t = 10 + everyTicks; t < durationTicks; t += everyTicks) out.push({ tick: t, reason: 'periodic', packet: true });
  if (durationTicks > 10) out.push({ tick: durationTicks, reason: 'end', packet: true });
  return out;
}

/** Private evidence moments around every down; the down that ends the fight is at the last tick, so its frames are clamped to it. */
export function planEvidence(key: FightKey): PlannedCapture[] {
  const end = key.durationTicks;
  const out: PlannedCapture[] = [];
  for (const d of key.downs) {
    out.push({ tick: Math.max(0, d.tick - 8), reason: 'before-down', packet: false });
    out.push({ tick: Math.min(d.tick + 2, end), reason: 'down', packet: false });
    out.push({ tick: Math.min(d.tick + 30, end), reason: 'after-down', packet: false });
  }
  return out;
}

/** Everything to capture while the fight plays, in tick order (packet frames before evidence at the same tick). */
export function planCaptures(key: FightKey, everyTicks = PACKET_EVERY_TICKS): PlannedCapture[] {
  return [...planPacket(key.durationTicks, everyTicks), ...planEvidence(key)].sort((a, b) => a.tick - b.tick || Number(b.packet) - Number(a.packet));
}
