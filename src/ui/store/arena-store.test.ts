/**
 * The store's side of the watch flow (05-technical-m2 §A3, §A11 test-first item 2): the viewer opens only after the
 * lock's auto-round write has succeeded; a failed write undoes the lock in memory and shows nothing; the cursor is one
 * command plus the round autosave; the commit carries the shown log's hash; a commit with no shown log is refused
 * quietly (the UI routes it to the arena).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../../core/model';
import { fixtureContent } from '../../core/testkit';
import { resetToasts } from '../components';
import { createTestStore } from '../debug/test-store';
import { createScriptedCore, liveWatchState, watchWorld } from '../debug/arena-test-world';
import { arenaFacade, MATCH_WATCHING, SAVE_ROUND_FAILED, savedWatch, watchKey, WATCH_NOT_SHOWN } from './arena';
import { DEFAULT_SETTINGS, updateSettings } from './settings';

const content = fixtureContent();
beforeEach(() => {
  resetToasts();
  updateSettings({ ...DEFAULT_SETTINGS });
});

function setup() {
  const w = watchWorld(content);
  const core = createScriptedCore(w);
  const t = createTestStore({ world: 'none', engine: core.engine });
  t.store.replaceWorld(w.state, content);
  return { w, core, ...t };
}

/** Hold or fail the writes of one slot. */
function gateSlot(saves: ReturnType<typeof createTestStore>['saves'], slot: string, mode: 'fail' | 'hold') {
  const write = saves.write.bind(saves);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let armed = true;
  saves.write = async (slotId: string, ...rest: [string, never]) => {
    if (slotId === slot && armed) {
      if (mode === 'fail') throw new Error('disk full');
      await gate;
    }
    return write(slotId, ...rest);
  };
  return { release, disarm: () => (armed = false) };
}

describe('Play match (Watch): the lock is saved before anything opens (test-first item 2)', () => {
  it('returns match.watching only after the auto-round write succeeded, with the locked round in the save', async () => {
    const { store, saves, core } = setup();
    const res = await store.advance({ playerMatch: 'watch' });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error.code).toBe(MATCH_WATCHING);
    expect(core.advances[0]!.options).toEqual({ playerMatch: 'watch' });
    // The write is done by the time the caller learns the viewer may open.
    const meta = (await saves.list()).find((m) => m.slotId === 'auto-round');
    expect(meta).toBeTruthy();
    expect(JSON.parse((await saves.read('auto-round'))!).state.liveMatch.watch).toEqual({ mode: 'watch', round: 1, cursorTick: 0, calls: [] });
    expect(store.game.value!.liveMatch!.watch!.round).toBe(1);
    // The gate the arena opens on: set only once the write has succeeded.
    expect(savedWatch.value).toBe(watchKey({ fixtureId: store.game.value!.liveMatch!.fixtureId, round: 1 }));
  });

  it('an interrupted write (never completes) keeps the viewer closed: advance does not resolve', async () => {
    const { store, saves } = setup();
    const gate = gateSlot(saves, 'auto-round', 'hold');
    let settled = false;
    const p = store.advance({ playerMatch: 'watch' }).then((r) => {
      settled = true;
      return r;
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(settled).toBe(false);
    expect(store.busy.value).toBe(true);
    // The lock is in memory, but its round is not saved: the arena's gate is still shut.
    expect(store.game.value!.liveMatch?.watch?.round).toBe(1);
    expect(savedWatch.value).toBeNull();
    gate.release();
    const res = await p;
    expect(!res.ok && res.error.code).toBe(MATCH_WATCHING);
  });

  it('a failed write opens nothing, undoes the lock in memory, and Play match from the last good save locks the same round', async () => {
    const { store, saves, core, w } = setup();
    // A good save exists (the player's last save before Play match).
    expect((await store.save('manual-1')).ok).toBe(true);
    const gate = gateSlot(saves, 'auto-round', 'fail');
    const res = await store.advance({ playerMatch: 'watch' });
    expect(!res.ok && res.error.code).toBe(SAVE_ROUND_FAILED);
    // Quiet: the callers say it once, in their own place (a toast with Retry, the between-round error, the round card).
    expect(store.lastError.value).toBeNull();
    expect(savedWatch.value).toBeNull();
    // No round shown or pending: the world in memory is the one the last good save holds.
    expect(store.game.value!.liveMatch).toBeNull();
    expect((await saves.list()).some((m) => m.slotId === 'auto-round')).toBe(false);
    // The player quits and reloads: the last good save has no live match and no round shown.
    const lockedFirst = core.engine.advance!(w.state, content, { playerMatch: 'watch' });
    expect(lockedFirst.ok).toBe(true);
    expect((await store.load('manual-1')).ok).toBe(true);
    expect(store.game.value!.liveMatch).toBeNull();
    // Play match from it (the storage works again) locks the same lineup and plays the same round.
    gate.disarm();
    const again = await store.advance({ playerMatch: 'watch' });
    expect(!again.ok && again.error.code).toBe(MATCH_WATCHING);
    const first = lockedFirst.ok ? lockedFirst.value.state.liveMatch : null;
    expect(store.game.value!.liveMatch).toEqual(first);
  });

  it('is not an error to show when a commit has no shown log: watch.not-shown comes back quietly and changes nothing', async () => {
    const w = watchWorld(content);
    const core = createScriptedCore(w);
    const t = createTestStore({ world: 'none', engine: core.engine });
    t.store.replaceWorld(liveWatchState(w), content);
    const before = t.store.game.value;
    const res = await t.store.advance();
    expect(!res.ok && res.error.code).toBe(WATCH_NOT_SHOWN);
    expect(t.store.lastError.value).toBeNull(); // routed to #/arena, not toasted
    expect(t.store.game.value).toBe(before);
  });
});

describe('the facade writes', () => {
  function facadeSetup() {
    const w = watchWorld(content);
    const core = createScriptedCore(w);
    const t = createTestStore({ world: 'none', engine: core.engine });
    t.store.replaceWorld(liveWatchState(w), content);
    return { w, core, ...t, arena: arenaFacade(t.store, core.engine, () => t.store.content.value) };
  }

  it('saveCursor is match.watch plus the round autosave, and the cursor only moves forward', async () => {
    const { arena, store, saves, core } = facadeSetup();
    const r = await arena.saveCursor(store.game.value!, 137.2);
    expect(r.ok).toBe(true);
    // An integer reveal frontier at or beyond what was shown.
    expect(core.watchCommands).toEqual([{ tick: 138, mode: undefined }]);
    expect(store.game.value!.liveMatch!.watch!.cursorTick).toBe(138);
    expect(JSON.parse((await saves.read('auto-round'))!).state.liveMatch.watch.cursorTick).toBe(138);
    expect(store.dirty.value).toBe(false);
  });

  it('refuses a cursor save when no round is being watched', async () => {
    const { arena, store } = facadeSetup();
    const none = { ...store.game.value!, liveMatch: null } as GameState;
    const r = await arena.saveCursor(none, 10);
    expect(!r.ok && r.error.code).toBe('match.not-watching');
  });

  it('finishRound hands over exactly the hash the viewer showed; a wrong one is refused as a defect', async () => {
    const { arena, store, core } = facadeSetup();
    const good = core.hashOf(store.game.value!, 1);
    const bad = await arena.finishRound({ round: 1, logHash: 'not-the-shown-log' });
    expect(!bad.ok && bad.error.code).toBe('watch.mismatch');
    expect(store.game.value!.liveMatch!.rounds).toHaveLength(0);
    const res = await arena.finishRound({ round: 1, logHash: good });
    // The club pauses between rounds ('always'): the round is committed and the match waits.
    expect(!res.ok && res.error.code).toBe('match.paused');
    expect(core.advances.at(-1)!.options).toEqual({ watched: { round: 1, logHash: good } });
    expect(store.game.value!.liveMatch!.rounds).toHaveLength(1);
  });

  it('simulateRest switches the mode first, then plays on without a hash', async () => {
    const { arena, store, core } = facadeSetup();
    const res = await arena.simulateRest(store.game.value!, 90);
    expect(core.watchCommands).toEqual([{ tick: 90, mode: 'simulate' }]);
    expect(res.ok).toBe(true);
    expect(core.advances.at(-1)!.options).toBeUndefined();
  });

  it('simulateRest between rounds names the next round (rounds played + 1), as core asks', async () => {
    const { w, core, store, arena } = (() => {
      const w2 = watchWorld(content);
      const core2 = createScriptedCore(w2);
      const t = createTestStore({ world: 'none', engine: core2.engine });
      const st = liveWatchState(w2, { round: 2 });
      st.liveMatch!.phase = 'between_rounds';
      st.liveMatch!.watch = { mode: 'watch', round: null, cursorTick: 0, calls: [] };
      t.store.replaceWorld(st, content);
      return { w: w2, core: core2, store: t.store, arena: arenaFacade(t.store, core2.engine, () => t.store.content.value) };
    })();
    const seen: unknown[] = [];
    const apply = core.engine.applyCommand;
    core.engine.applyCommand = ((state, command, c) => (seen.push(command), apply(state, command, c))) as typeof apply;
    void w;
    // A cursor is refused between rounds; a mode switch names round 2 (one round was played).
    expect((await arena.saveCursor(store.game.value!, 50)).ok).toBe(false);
    await arena.simulateRest(store.game.value!, 0);
    expect(seen.find((c) => (c as { type: string }).type === 'match.watch')).toMatchObject({ type: 'match.watch', round: 2, mode: 'simulate' });
  });

  it("a mismatch with reason 'round' (already committed) is passed on quietly: no toast, never a defect", async () => {
    const { store, core } = facadeSetup();
    core.failNext = { code: 'watch.mismatch', message: 'already committed', details: { reason: 'round' } };
    const res = await store.advance({ watched: { round: 1, logHash: 'x' } });
    expect(!res.ok && res.error.code).toBe('watch.mismatch');
    expect(store.lastError.value).toBeNull();
    core.failNext = { code: 'watch.mismatch', message: 'different log', details: { reason: 'hash' } };
    await store.advance({ watched: { round: 1, logHash: 'x' } });
    expect(store.lastError.value?.code).toBe('watch.mismatch');
  });
});
