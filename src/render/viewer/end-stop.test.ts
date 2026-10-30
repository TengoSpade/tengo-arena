/**
 * One input per round boundary (A7, ux-001): when the deciding down auto-pauses at the same tick as the round's end, the
 * end stop subsumes it. The player gets one stop there (the end), not an auto-pause followed by an end that needs another
 * Play press. On the real model, replayed and live, over the committed rounds that end on a down.
 */
import { describe, expect, it } from 'vitest';
import { viewTransform } from '../camera';
import { defaultArenaPalette } from '../colors';
import { indexFightLog, timeline } from '../timeline';
import type { AutoPauseRules, PlaybackStop } from '../types';
import { assemble, type Headless } from './testing/headless';
import { defaultContent, defaultCues, loadFixture, makeCtx, type FixtureName } from './testing/real-fixtures';
import type { FightLog } from '../../core/model';

const FIXTURES: FixtureName[] = ['long', 'a', 'b', 'c', 'd', 'e', 'f'];
/** Every auto-pause rule on, so a down of either side stops the round. */
const ALL_STOPS: AutoPauseRules = { ownDowned: true, enemyDowned: true, ownCaptainDown: true, overtime: true, ownHpBelowPct: null };

function onRealModel(): Headless {
  return assemble({ timeline, cues: defaultCues(), content: defaultContent(), viewTransform, palette: defaultArenaPalette('dark'), autoPause: ALL_STOPS });
}

/** The round's end tick and whether a down lands on it. */
function endOf(log: FightLog): { end: number; downOnEnd: boolean } {
  const end = log.events.find((e) => e.type === 'fight.end')!.tick;
  return { end, downOnEnd: log.events.some((e) => e.type === 'unit.down' && e.tick === end) };
}

/** Play at 4x, pressing Play at every stop, until the end stop. Returns every stop in order. */
function playThrough(h: Headless): PlaybackStop[] {
  h.core.setSpeed(4);
  h.core.play();
  for (let i = 0; i < 60_000 && h.stops.at(-1)?.kind !== 'end'; i++) {
    const before = h.stops.length;
    h.run(1);
    if (h.stops.length > before && h.stops.at(-1)!.kind !== 'end') h.core.play(); // a Play press after a pause
  }
  return h.stops;
}

describe('a down that ends the round', () => {
  for (const kind of ['replay', 'live'] as const) {
    it(`is one stop, the end, on a ${kind} round (no auto-pause at the same tick)`, async () => {
      let qualifying = 0;
      for (const name of FIXTURES) {
        const { log } = loadFixture(name);
        const { end, downOnEnd } = endOf(log);
        if (!downOnEnd) continue;
        qualifying++;
        const ctx = makeCtx(log, 0, kind);
        // The auto-pause rules do put a stop on the end tick (this is what used to cost a second press).
        expect(timeline.autoPauseStops(indexFightLog(log, defaultContent(), defaultCues(), kind), ALL_STOPS, ctx, end).some((s) => s.tick === end), `${name}: a stop sits on the end tick`).toBe(true);
        const h = onRealModel();
        await h.core.load(log, ctx);
        const stops = playThrough(h);
        const last = stops.at(-1)!;
        expect(last, name).toEqual({ kind: 'end', tick: end });
        expect(h.core.playing, name).toBe(false);
        expect(h.core.endTick, name).toBe(end);
        // Exactly one stop on the end tick, and it is the end.
        const onEnd = stops.filter((s) => (s.kind === 'auto' ? s.stop.tick : s.tick) === end);
        expect(onEnd, `${name}: stops on the end tick`).toEqual([{ kind: 'end', tick: end }]);
        // Every stop before it is an auto-pause on an earlier tick: the end needs no press beyond the one that reaches it.
        for (const s of stops.slice(0, -1)) expect(s.kind === 'auto' && s.stop.tick < end, `${name}: ${JSON.stringify(s)}`).toBe(true);
        h.scene.destroy();
      }
      expect(qualifying).toBeGreaterThan(0);
    }, 120_000);
  }

  it('still stops at a down that is not the end, and at the end when no down lands on it', async () => {
    const { log } = loadFixture('long');
    const { end } = endOf(log);
    const h = onRealModel();
    await h.core.load(log, makeCtx(log, 0, 'replay'));
    const stops = playThrough(h);
    expect(stops.filter((s) => s.kind === 'auto').length).toBeGreaterThan(2); // the downs and the overtime
    expect(stops.at(-1)).toEqual({ kind: 'end', tick: end });
  }, 60_000);
});
