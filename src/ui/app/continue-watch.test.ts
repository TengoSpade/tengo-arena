import { describe, expect, it } from 'vitest';
import type { GameState } from '../../core/model';
import { fixtureContent } from '../../core/testkit';
import { createDevEngine } from '../debug/dev-engine';
import { liveWatchState, watchWorld } from '../debug/arena-test-world';
import { DEFAULT_SETTINGS, pacingStops } from '../store/settings';
import { continueModel, playModeFor, type ContinueInput } from './continue';

const content = fixtureContent();
const engine = createDevEngine();
const w = watchWorld(content);

function input(state: GameState, over: Partial<ContinueInput> = {}): ContinueInput {
  return { state, content, engine, blockers: [], routeId: 'squad', busy: false, stops: pacingStops(DEFAULT_SETTINGS), ...over };
}

describe('Play match: Watch or Simulate (open-020, owner answer to Q54)', () => {
  it('offers both with Watch primary by default; Streamlined simulates by default', () => {
    expect(playModeFor('balanced', 'ask')).toEqual({ mode: 'watch', offer: true });
    expect(playModeFor('thorough', 'ask')).toEqual({ mode: 'watch', offer: true });
    expect(playModeFor('streamlined', 'ask')).toEqual({ mode: 'simulate', offer: true });
  });

  it('an explicit preference decides without an offer, also under Streamlined', () => {
    expect(playModeFor('balanced', 'simulate')).toEqual({ mode: 'simulate', offer: false });
    expect(playModeFor('streamlined', 'watch')).toEqual({ mode: 'watch', offer: false });
  });

  it('Continue carries the mode and says what Play match will do', () => {
    const watch = continueModel(input(w.state, { play: { mode: 'watch', offer: true } }));
    expect(watch.main).toBe('Play match');
    expect(watch.sub).toContain('Watch');
    expect(watch.action).toEqual({ kind: 'advance', playsMatch: true, mode: 'watch', offer: true });
    const sim = continueModel(input(w.state, { play: { mode: 'simulate', offer: false } }));
    expect(sim.sub).toContain('Simulate');
    expect(sim.action).toEqual({ kind: 'advance', playsMatch: true, mode: 'simulate', offer: false });
  });
});

describe('a round waits in the arena', () => {
  const waiting = liveWatchState(w);

  it('Continue from another screen reads Resume watching and navigates to the arena instead of advancing', () => {
    const m = continueModel(input(waiting, { routeId: 'home' }));
    expect(m.main).toBe('Resume watching');
    expect(m.sub).toBe('Round 1 waits for you');
    expect(m.action).toEqual({ kind: 'navigate', to: '#/arena' });
  });

  it('in the arena the top-bar Continue does nothing: Space belongs to the viewer', () => {
    const m = continueModel(input(waiting, { routeId: 'arena' }));
    expect(m.action).toEqual({ kind: 'none' });
    expect(m.main).toBe('Watching');
  });

  it('between rounds of a watched match it still goes back to the between-round screen', () => {
    const st = liveWatchState(w, { round: 2 });
    st.liveMatch!.phase = 'between_rounds';
    st.liveMatch!.watch = { mode: 'watch', round: null, cursorTick: 0, calls: [] };
    expect(continueModel(input(st, { routeId: 'home' })).action).toEqual({ kind: 'navigate', to: '#/between-rounds' });
  });

  it('a simulated match (watch mode switched off) never reads Resume watching', () => {
    const st = liveWatchState(w, { round: 2 });
    st.liveMatch!.watch = { mode: 'simulate', round: null, cursorTick: 0, calls: [] };
    expect(continueModel(input(st, { routeId: 'home' })).main).not.toBe('Resume watching');
  });

  it('after a replay Continue goes back to the hub like after a report', () => {
    expect(continueModel(input(w.state, { routeId: 'replay' })).action).toEqual({ kind: 'navigate', to: '#/home' });
  });
});
