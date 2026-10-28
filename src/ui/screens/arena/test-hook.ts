/**
 * The arena test hook (05-technical-m2 §A7, tech-027): `window.__arena.viewer`. Compiled into DEV and `smoke` builds
 * only: App imports this module behind `import.meta.env.DEV || import.meta.env.MODE === 'smoke'`, which a production
 * build folds to false, so the module is not in any production chunk (tests/build asserts it).
 *
 *   frame()            the HUD's latest ArenaFrameState (units, standing, effects) or null
 *   seek(t) play() pause() setSpeed(s)   drive the mounted viewer
 *   stats()            ViewerStats (fps, frame time, renderer, resolution)
 *   logHash()          hashEventStream of the loaded round, computed in the browser (the smoke compares it with Node's golden)
 *   loadFixtureRound() simulate a fixed round of the dev world at 'full' and open it on #/replay/__fixture__
 */
import { hashEventStream } from '../../../core/model';
import type { Speed } from '../../../render';
import type { AppStore } from '../../store';
import { buildFixtureRound, FIXTURE_ROUND_ID } from '../../debug/arena-fixture';
import { hookSlot } from './hook-registry';

export interface ArenaTestHook {
  frame(): ReturnType<NonNullable<typeof hookSlot.frame>> | null;
  seek(tick: number): void;
  play(): void;
  pause(): void;
  setSpeed(speed: Speed): void;
  stats(): ReturnType<NonNullable<typeof hookSlot.viewer>['stats']> | null;
  logHash(): string | null;
  loadFixtureRound(): Promise<string>;
  /** Whether a viewer is mounted. */
  ready(): boolean;
}

export function installArenaTestHook(store: AppStore): ArenaTestHook {
  const hook: ArenaTestHook = {
    frame: () => hookSlot.frame?.() ?? null,
    seek: (tick) => hookSlot.viewer?.seek(tick),
    play: () => hookSlot.viewer?.play(),
    pause: () => hookSlot.viewer?.pause(),
    setSpeed: (speed) => hookSlot.viewer?.setSpeed(speed),
    stats: () => hookSlot.viewer?.stats() ?? null,
    logHash: () => (hookSlot.log ? hashEventStream(hookSlot.log.header, hookSlot.log.events) : null),
    ready: () => hookSlot.viewer !== null,
    async loadFixtureRound() {
      hookSlot.fixture = { fixtureId: FIXTURE_ROUND_ID, playback: buildFixtureRound(store) };
      location.hash = `#/replay/${FIXTURE_ROUND_ID}`;
      return FIXTURE_ROUND_ID;
    },
  };
  const w = window as unknown as { __arena?: Record<string, unknown> };
  w.__arena = { ...(w.__arena ?? {}), viewer: hook };
  return hook;
}
