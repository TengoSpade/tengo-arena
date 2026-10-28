/**
 * The viewer over WP-M2C's REAL model, cue table, camera and colours, on committed simulator rounds (src/render/
 * timeline/fixtures): nothing is faked but the GPU. Checks that the viewer and the model agree on the contract (A19):
 * live samples are bounded by the head, key moments and decisions never run past it, a replay plays to its end, stops
 * land on real events, and teardown holds with real data.
 */
import { describe, expect, it } from 'vitest';
import { viewTransform } from '../camera';
import { defaultArenaPalette } from '../colors';
import { indexFightLog, sampleAt, timeline } from '../timeline';
import type { AutoPauseRules } from '../types';
import { countDisplayObjects } from './scene/arena-scene';
import { assemble, type Headless } from './testing/headless';
import { defaultContent, defaultCues, loadFixture, makeCtx, truncateLog } from './testing/real-fixtures';

const NO_PAUSE: AutoPauseRules = { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null };

/** A headless viewer on the real model, cues, content, camera and palette. */
function onRealModel(autoPause?: AutoPauseRules): Headless {
  return assemble({ timeline, cues: defaultCues(), content: defaultContent(), viewTransform, palette: defaultArenaPalette('dark'), ...(autoPause ? { autoPause } : {}) });
}

describe('the viewer over the real model', () => {
  it('plays a real round to its end: ten tokens, stops on real events, the end stop, no error', async () => {
    const { log } = loadFixture('a');
    const h = onRealModel();
    await h.core.load(log, makeCtx(log, 0, 'replay'));
    expect(h.scene.tokenCount).toBe(10);
    h.core.setSpeed(4);
    h.core.play();
    for (let i = 0; i < 40_000 && h.stops.at(-1)?.kind !== 'end'; i++) {
      const before = h.stops.length;
      h.run(1);
      if (h.stops.length > before && h.stops.at(-1)!.kind !== 'end') h.core.play(); // resume after an auto-pause
    }
    const end = h.stops.at(-1)!;
    expect(end.kind).toBe('end');
    expect(h.core.endTick).toBe((end as { tick: number }).tick);
    expect(h.stops.filter((s) => s.kind === 'auto').length).toBeGreaterThan(0); // our downs, our captain, overtime
    const last = h.core.currentState!;
    expect(last.ended).toBe(true);
    expect(last.units.some((u) => !u.standing)).toBe(true);
  });

  it('a live round shows what the model gives for a log cut at the head, and nothing beyond it', async () => {
    const { log } = loadFixture('b');
    const content = defaultContent();
    const cues = defaultCues();
    const h = onRealModel(NO_PAUSE);
    const ctx = makeCtx(log, 0, 'live');
    await h.core.load(log, { ...ctx, startTick: 120 });
    h.core.setSpeed(4);
    h.core.play();
    h.run(60);
    h.core.pause();
    const head = h.core.headTick;
    const tick = h.core.tick;
    expect(head).toBeGreaterThan(130);
    expect(head - tick).toBeLessThanOrEqual(2 + 1e-6); // the drawn tick is at most one frame interval behind the head
    // The full log sampled at the drawn tick with the head as the bound equals a log that stops at the head...
    const full = indexFightLog(log, content, cues, 'live');
    const cut = indexFightLog(truncateLog(log, Math.floor(head)), content, cues, 'live');
    const a = sampleAt(full, tick, ctx, { knownUntilTick: head });
    const b = sampleAt(cut, tick, ctx, { knownUntilTick: head });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // ...and that is what the viewer itself shows.
    expect(JSON.stringify(h.core.currentState)).toBe(JSON.stringify(a));
    expect(h.core.endTick).toBeNull();
    for (const m of h.core.keyMoments()) expect(m.tick).toBeLessThanOrEqual(head);
  });

  it('live motion is as smooth as a replay: as many distinct positions over the same frames, and no sample uses a frame past the head', async () => {
    const { log } = loadFixture('a');
    const content = defaultContent();
    const cues = defaultCues();
    type Call = { tick: number; known: number | undefined; result: string };
    const calls: Call[] = [];
    const spy: typeof timeline = {
      ...timeline,
      sampleAt: (index, tick, c, o) => {
        const state = timeline.sampleAt(index, tick, c, o);
        calls.push({ tick, known: o?.knownUntilTick, result: JSON.stringify(state) });
        return state;
      },
    };
    const FRAMES = 12;
    const run = async (kind: 'live' | 'replay'): Promise<{ xs: number[][]; heads: number[]; h: Headless }> => {
      const h = assemble({ timeline: spy, cues, content, viewTransform, autoPause: NO_PAUSE });
      await h.core.load(log, { ...makeCtx(log, 0, kind), startTick: 200 });
      h.core.play();
      const xs: number[][] = [];
      const heads: number[] = [];
      for (let i = 0; i < FRAMES; i++) {
        h.run(1);
        xs.push(h.core.currentState!.units.map((u) => u.x));
        heads.push(h.core.headTick);
      }
      return { xs, heads, h };
    };
    const replay = await run('replay');
    calls.length = 0;
    const live = await run('live');
    const liveCalls = calls.slice();
    const distinct = (xs: number[][], unit: number): number => new Set(xs.map((row) => row[unit])).size;
    const best = [...Array(10).keys()].sort((p, q) => distinct(replay.xs, q) - distinct(replay.xs, p))[0]!;
    expect(distinct(replay.xs, best)).toBe(FRAMES); // a moving unit takes a new position every frame in a replay
    expect(distinct(live.xs, best)).toBe(distinct(replay.xs, best)); // and in a live round (it stepped every 2 ticks: 2 of 12)
    // The head runs ahead of the drawn tick by at most one frame interval, and never goes back.
    live.heads.forEach((head, i) => {
      if (i > 0) expect(head).toBeGreaterThanOrEqual(live.heads[i - 1]!);
    });
    expect(live.h.core.headTick - live.h.core.tick).toBeLessThanOrEqual(2 + 1e-6);
    // No sample used a frame past the head: each live sample passed its bound, and equals the sample of a log cut at it.
    const real = liveCalls.filter((c) => c.tick > 0); // (the kickoff sample at 0 only reads the first frame)
    expect(real.length).toBeGreaterThan(FRAMES);
    const ctx = makeCtx(log, 0, 'live');
    for (const c of real) {
      expect(c.known, 'a live sample without knownUntilTick').toBeDefined();
      expect(c.known!).toBeGreaterThanOrEqual(c.tick);
      expect(c.known! - c.tick).toBeLessThanOrEqual(2 + 1e-6);
      const cut = indexFightLog(truncateLog(log, Math.floor(c.known!)), content, cues, 'live');
      expect(JSON.stringify(sampleAt(cut, c.tick, ctx, { reducedMotion: false, knownUntilTick: c.known! }))).toBe(c.result);
    }
  });

  it('decisionsUpTo gives the real committed decisions: oldest first, one per change, none past the head', async () => {
    const { log } = loadFixture('a');
    const h = onRealModel(NO_PAUSE);
    await h.core.load(log, { ...makeCtx(log, 0, 'live'), startTick: 300 });
    for (const unit of [0, 3, 7]) {
      const list = h.core.decisionsUpTo(unit);
      expect(list.length).toBeGreaterThan(1);
      expect(list.every((d) => d.unit === unit && d.commitTick <= 300)).toBe(true);
      for (let i = 1; i < list.length; i++) expect(list[i]!.commitTick).toBeGreaterThan(list[i - 1]!.commitTick);
      expect(list.at(-1)!.commitTick).toBe(h.core.decisionAt(unit)!.commitTick); // the newest is what decisionAt says now
    }
    expect(h.core.decisionsUpTo(0, 99_999).every((d) => d.commitTick <= 300)).toBe(true);
  });

  it('holds its objects over repeated real rounds (teardown with real data)', async () => {
    const { log } = loadFixture('c');
    const h = onRealModel(NO_PAUSE);
    const ctx = makeCtx(log, 0, 'replay');
    let objects = 0;
    for (let round = 0; round < 6; round++) {
      await h.core.load(log, ctx);
      h.core.setSpeed(4);
      h.core.play();
      h.run(500);
      h.core.pause();
      if (round === 1) objects = countDisplayObjects(h.scene.root);
    }
    expect(h.skin.liveBodies).toBe(10);
    expect(countDisplayObjects(h.scene.root)).toBeLessThanOrEqual(objects * 1.15 + 8);
    h.core.destroy();
    h.scene.destroy();
    expect(h.skin.liveBodies).toBe(0);
  });
});
