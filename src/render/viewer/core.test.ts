/**
 * Viewer logic on a fake timeline (05-technical-m2 §A11, "Viewer logic (happy-dom, WP-M2D)"): the playback clock, the
 * live head, bounded queries, auto-pause stops, log swaps, load awaiting the skin, frame feed throttling.
 * No GPU: a real ViewerCore and ArenaScene over the placeholder skin's scene-graph objects.
 */
import { describe, expect, it } from 'vitest';
import type { AutoPauseRules } from '../types';
import { assemble } from './testing/headless';
import { fakeContext, fakeLog } from './testing/fake-timeline';

const NO_PAUSE: AutoPauseRules = { ownDowned: false, enemyDowned: false, ownCaptainDown: false, overtime: false, ownHpBelowPct: null };

async function loaded(kind: 'live' | 'replay' = 'replay', extra: { startTick?: number; hudHz?: number; autoPause?: AutoPauseRules; playerSide?: 0 | 1 | null; spec?: Parameters<typeof fakeLog>[0] } = {}) {
  const h = assemble({ hudHz: extra.hudHz, autoPause: extra.autoPause });
  await h.core.load(fakeLog(extra.spec), fakeContext({ kind, startTick: extra.startTick, playerSide: extra.playerSide }));
  return h;
}

/** Play at `speed` until the core stops itself (or `maxFrames`). */
function playOut(h: Awaited<ReturnType<typeof loaded>>, maxFrames = 20_000): void {
  h.core.play();
  h.run(maxFrames);
}

describe('load', () => {
  it('awaits skin.prepare before the first frame and draws paused at ctx.startTick', async () => {
    const h = assemble();
    let release!: () => void;
    h.skin.gate = new Promise<void>((r) => (release = r));
    const pending = h.core.load(fakeLog(), fakeContext({ kind: 'replay', startTick: 120 }));
    await Promise.resolve();
    expect(h.skin.prepareCalls).toEqual([10]);
    expect(h.frames).toHaveLength(0); // nothing shown while the skin is still preparing
    expect(h.skin.bodiesCreated).toBe(0);
    expect(h.core.loaded).toBe(false);
    release();
    await pending;
    expect(h.core.loaded).toBe(true);
    expect(h.core.playing).toBe(false);
    expect(h.core.tick).toBe(120);
    expect(h.frames).toHaveLength(1); // the HUD gets the opening state once
    expect(h.frames[0]!.tick).toBe(120);
    expect(h.skin.bodiesCreated).toBe(10);
  });

  it('lets a newer load overtake an older one that is still preparing', async () => {
    const h = assemble();
    let release!: () => void;
    h.skin.gate = new Promise<void>((r) => (release = r));
    const first = h.core.load(fakeLog({ endTick: 500 }), fakeContext({ kind: 'replay' }));
    const second = h.core.load(fakeLog({ endTick: 900 }), fakeContext({ kind: 'replay' }));
    release();
    await Promise.all([first, second]);
    expect(h.core.endTick).toBe(900);
    expect(h.skin.liveBodies).toBe(10); // one round of bodies, not two
  });

  it('frees the previous round before showing the next', async () => {
    const h = await loaded('replay');
    expect(h.skin.liveBodies).toBe(10);
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    expect(h.skin.bodiesCreated).toBe(20);
    expect(h.skin.liveBodies).toBe(10);
  });

  it('a log the model refuses leaves the viewer unloaded and rejects', async () => {
    const h = assemble();
    h.timeline.indexFightLog = () => {
      throw new Error('not a full-level log');
    };
    await expect(h.core.load(fakeLog(), fakeContext())).rejects.toThrow('not a full-level log');
    expect(h.core.loaded).toBe(false);
  });
});

describe('the playback clock', () => {
  it('plays 1x, 2x and 4x: about 20, 40 and 80 ticks per wall second', async () => {
    for (const [speed, expected] of [[1, 20], [2, 40], [4, 80]] as const) {
      const h = await loaded('replay', { autoPause: NO_PAUSE });
      h.core.setSpeed(speed);
      h.core.play();
      h.run(60);
      expect(h.core.tick).toBeCloseTo(expected, 0);
    }
  });

  it('never advances more than 100 ms of fight per frame after a stall', async () => {
    const h = await loaded('replay', { autoPause: NO_PAUSE });
    h.core.play();
    h.run(1, 30_000);
    expect(h.core.tick).toBeLessThanOrEqual(2 + 1e-9);
  });

  it('pause stops the clock and feeds the HUD once; speed changes keep the tick', async () => {
    const h = await loaded('replay', { autoPause: NO_PAUSE });
    h.core.play();
    h.run(30);
    const before = h.frames.length;
    h.core.pause();
    expect(h.core.playing).toBe(false);
    expect(h.frames.length).toBe(before + 1);
    expect(h.frames.at(-1)!.tick).toBeCloseTo(h.core.tick, 9);
    const t = h.core.tick;
    h.core.setSpeed(4);
    expect(h.core.tick).toBe(t);
    expect(h.core.speed).toBe(4);
  });

  it('remembers the speed across loads', async () => {
    const h = await loaded('replay');
    h.core.setSpeed(2);
    await h.core.load(fakeLog(), fakeContext({ kind: 'replay' }));
    expect(h.core.speed).toBe(2);
  });

  it('feeds the HUD at most hudHz while playing, and at every pause, seek and stop', async () => {
    const h = await loaded('replay', { hudHz: 10, autoPause: NO_PAUSE });
    h.frames.length = 0;
    h.core.play();
    h.run(120); // 2 s of 60 fps frames
    expect(h.frames.length).toBeGreaterThanOrEqual(18);
    expect(h.frames.length).toBeLessThanOrEqual(22);
    const n = h.frames.length;
    h.core.seek(10);
    expect(h.frames.length).toBe(n + 1);
    h.core.pause();
    expect(h.frames.length).toBe(n + 2);
  });

  it('seeking leaves the play state unchanged and shows the sought tick', async () => {
    const h = await loaded('replay', { autoPause: NO_PAUSE });
    h.core.play();
    h.core.seek(400);
    expect(h.core.playing).toBe(true);
    expect(h.core.tick).toBe(400);
    expect(h.core.currentState!.tick).toBe(400);
    h.core.pause();
    h.core.seek(5000);
    expect(h.core.tick).toBe(1200);
  });

  it('shows the same state at a tick whether it was played to or sought to', async () => {
    const h = await loaded('replay', { autoPause: NO_PAUSE });
    h.core.setSpeed(4);
    h.core.play();
    h.run(200);
    const played = h.core.currentState!;
    const t = h.core.tick;
    h.core.pause();
    h.core.seek(0);
    h.core.seek(t);
    expect(JSON.stringify(h.core.currentState)).toBe(JSON.stringify(played));
  });
});

describe('stops', () => {
  it('stops exactly on an auto-pause tick, once, and resumes past it', async () => {
    const h = await loaded('replay', { playerSide: 0 });
    h.core.setSpeed(4);
    playOut(h);
    expect(h.stops).toHaveLength(1);
    const stop = h.stops[0]!;
    expect(stop.kind).toBe('auto');
    if (stop.kind !== 'auto') throw new Error();
    expect(stop.stop.tick).toBe(600); // our first down; the enemy down at 300 is off by default
    expect(stop.stop.reason).toBe('ownDowned');
    expect(h.core.tick).toBe(600);
    expect(h.core.playing).toBe(false);
    expect(h.frames.at(-1)!.tick).toBe(600); // the HUD sees the stop tick
    // Resume: the stop at the tick we are on does not fire again; the next one does.
    playOut(h);
    expect(h.stops).toHaveLength(2);
    expect(h.stops[1]).toMatchObject({ kind: 'auto', stop: { tick: 700 } });
    playOut(h);
    expect(h.stops[2]).toMatchObject({ kind: 'auto', stop: { tick: 900, reason: 'overtime' } });
    playOut(h);
    expect(h.stops[3]).toEqual({ kind: 'end', tick: 1200 });
    expect(h.core.endTick).toBe(1200);
  });

  it('honours setAutoPause (enemy downs on, ours off)', async () => {
    const h = await loaded('replay', { playerSide: 0 });
    h.core.setAutoPause({ ownDowned: false, enemyDowned: true, ownCaptainDown: false, overtime: false, ownHpBelowPct: null });
    h.core.setSpeed(4);
    playOut(h);
    expect(h.stops[0]).toMatchObject({ kind: 'auto', stop: { tick: 300, reason: 'enemyDowned' } });
    playOut(h);
    expect(h.stops[1]).toEqual({ kind: 'end', tick: 1200 }); // none of ours or overtime
  });

  it('playing at the end stops again at once', async () => {
    const h = await loaded('replay', { autoPause: NO_PAUSE });
    h.core.seek(1200);
    h.core.play();
    h.run(5);
    expect(h.stops).toEqual([{ kind: 'end', tick: 1200 }]);
    expect(h.core.tick).toBe(1200);
    expect(h.core.playing).toBe(false);
  });

  it('a stop never fires when seeking over it', async () => {
    const h = await loaded('replay', { playerSide: 0 });
    h.core.seek(650);
    expect(h.stops).toHaveLength(0);
  });

  it('a live round stops at the head after a rewind, then plays on past it', async () => {
    const h = await loaded('live', { startTick: 450, autoPause: NO_PAUSE });
    h.core.seek(300);
    expect(h.core.tick).toBe(300);
    h.core.setSpeed(4);
    playOut(h);
    expect(h.stops).toEqual([{ kind: 'head', tick: 450 }]);
    expect(h.core.tick).toBe(450);
    expect(h.core.headTick).toBe(450);
    playOut(h, 500);
    expect(h.core.tick).toBeGreaterThan(450);
    expect(h.stops).toHaveLength(1); // at the head, play simply continues
  });
});

describe('a live round (no future leaks, review B1)', () => {
  it('seeks at most to the head; the end is null until playback reaches it', async () => {
    const h = await loaded('live', { startTick: 100, autoPause: NO_PAUSE });
    expect(h.core.headTick).toBe(100);
    expect(h.core.endTick).toBeNull();
    h.core.seek(1000);
    expect(h.core.tick).toBe(100);
    h.core.setSpeed(4);
    h.core.play();
    h.run(300);
    expect(h.core.headTick).toBeGreaterThan(100);
    expect(h.core.endTick).toBeNull();
    h.core.seek(1100);
    expect(h.core.tick).toBe(h.core.headTick);
    for (const state of h.frames) {
      expect(state.endTick).toBeNull();
      expect(state.ended).toBe(false);
    }
  });

  it('learns the end only when it is reached, then reports it', async () => {
    const h = await loaded('live', { startTick: 0, autoPause: NO_PAUSE });
    h.core.setSpeed(4);
    playOut(h);
    expect(h.stops).toEqual([{ kind: 'end', tick: 1200 }]);
    expect(h.core.endTick).toBe(1200);
    expect(h.core.headTick).toBe(1200);
  });

  it('never asks the model for anything beyond what it is about to show', async () => {
    const h = await loaded('live', { startTick: 0, playerSide: 0 });
    h.core.setSpeed(4);
    h.core.play();
    h.run(200);
    h.core.keyMoments();
    h.core.decisionAt(1);
    const head = h.core.headTick;
    // One frame at 4x moves 1.33 ticks; stops are looked up to the end of the frame being drawn, no further.
    expect(h.timeline.maxTickAsked()).toBeLessThanOrEqual(head + 1.4);
  });

  it('bounds key moments and decisions by the head', async () => {
    const h = await loaded('live', { startTick: 650, autoPause: NO_PAUSE });
    const moments = h.core.keyMoments();
    expect(moments.map((m) => m.tick)).toEqual([300, 600]); // the down at 700, overtime at 900 and the end are not shown
    expect(moments.every((m) => m.tick <= h.core.headTick)).toBe(true);
    expect(h.timeline.calls.keyMoments.every((t) => t <= 650)).toBe(true);
    h.core.seek(100); // rewinding does not shrink what was already shown
    expect(h.core.keyMoments().map((m) => m.tick)).toEqual([300, 600]);
    h.core.decisionAt(3);
    expect(h.timeline.calls.decisionAt.at(-1)).toBe(100);
  });

  it('a replay shows every key moment up to the end', async () => {
    const h = await loaded('replay');
    expect(h.core.keyMoments().map((m) => m.kind)).toEqual(['down', 'down', 'down', 'overtime', 'end']);
  });

  it('caches key moments per head', async () => {
    const h = await loaded('replay');
    h.core.keyMoments();
    h.core.keyMoments();
    expect(h.timeline.calls.keyMoments).toHaveLength(1);
  });
});

describe('replaceLog (calls)', () => {
  it('swaps a log that extends the shown prefix, keeping the tick and refreshing queries', async () => {
    const h = await loaded('live', { startTick: 0, autoPause: NO_PAUSE });
    h.core.setSpeed(4);
    h.core.play();
    h.run(40);
    h.core.pause();
    const t = Math.floor(h.core.tick);
    const next = fakeLog({ endTick: 1000, divergeAfter: { tick: t, tag: 'call-1' } });
    const before = h.core.tick;
    expect(h.core.replaceLog(next, t)).toBe(true);
    expect(h.core.tick).toBe(before);
    expect(h.timeline.calls.indexFightLog).toBe(2);
  });

  it('refuses a log that breaks the prefix, and one for a tick beyond the head', async () => {
    const h = await loaded('live', { startTick: 400, autoPause: NO_PAUSE });
    const changedEarly = fakeLog({ endTick: 1200, downs: [{ tick: 100, unit: 3, by: 6 }] });
    expect(h.core.replaceLog(changedEarly, 400)).toBe(false);
    expect(h.core.replaceLog(fakeLog(), 401)).toBe(false); // ahead of the head
    // Still showing the original round.
    h.core.seek(0);
    h.core.play();
    expect(h.core.tick).toBe(0);
  });

  it('refuses when nothing is loaded', () => {
    const h = assemble();
    expect(h.core.replaceLog(fakeLog(), 0)).toBe(false);
  });
});

describe('selection and input', () => {
  it('select() is silent; a click and Tab report through onSelect', async () => {
    const h = await loaded('replay');
    h.core.select(3);
    expect(h.core.selection).toBe(3);
    expect(h.selections).toEqual([]);
    expect(h.core.cycleSelection(1)).toBe(true);
    expect(h.core.selection).toBe(4);
    expect(h.selections).toEqual([4]);
    const pos = h.scene.tokenPosition(6)!;
    h.core.pointerSelect(pos.x, pos.y);
    expect(h.core.selection).toBe(6);
    h.core.pointerSelect(2, 2); // empty floor
    expect(h.core.selection).toBeNull();
    expect(h.selections).toEqual([4, 6, null]);
  });

  it('Tab walks the tokens and lets focus leave at either end (no keyboard trap)', async () => {
    const h = await loaded('replay');
    expect(h.core.cycleSelection(1)).toBe(true); // none -> 0
    expect(h.core.selection).toBe(0);
    for (let i = 1; i < 10; i++) expect(h.core.cycleSelection(1)).toBe(true);
    expect(h.core.selection).toBe(9);
    expect(h.core.cycleSelection(1)).toBe(false); // past the last: cleared, the browser takes Tab
    expect(h.core.selection).toBeNull();
    expect(h.core.cycleSelection(-1)).toBe(true); // Shift+Tab from none -> last
    expect(h.core.selection).toBe(9);
    expect(h.core.clearSelectionFromKeyboard()).toBe(true);
    expect(h.core.clearSelectionFromKeyboard()).toBe(false);
  });

  it('describes the arena for the canvas label', async () => {
    const h = await loaded('replay', { playerSide: 0 });
    h.core.seek(650);
    expect(h.core.describe()).toBe('Arena, round 1, 32.5 seconds. HOM 4 standing, AWY 4 standing.');
  });
});

describe('destroy', () => {
  it('is idempotent and silences every callback', async () => {
    const h = await loaded('replay', { autoPause: NO_PAUSE });
    h.core.play();
    h.core.destroy();
    h.core.destroy();
    const frames = h.frames.length;
    expect(h.core.frame(16)).toBe(false);
    h.core.seek(10);
    h.core.pause();
    expect(h.frames.length).toBe(frames);
    expect(h.skin.liveBodies).toBe(0);
    await h.core.load(fakeLog(), fakeContext());
    expect(h.core.loaded).toBe(false);
  });

  it('a load in flight when destroyed shows nothing', async () => {
    const h = assemble();
    let release!: () => void;
    h.skin.gate = new Promise<void>((r) => (release = r));
    const pending = h.core.load(fakeLog(), fakeContext());
    h.core.destroy();
    release();
    await pending;
    expect(h.skin.bodiesCreated).toBe(0);
    expect(h.frames).toHaveLength(0);
  });
});
