/**
 * Test and dev harness: a real store (createGameStore) on a fake platform
 * (memory saves, manual clock, captured downloads), the fixture content and
 * the dev engine. Screen tests of WP6 and WP7 can use it:
 *
 *   const { store } = createTestStore({ world: 'dev', weekIndex: 11 });
 *   render(<TestApp store={store}><SquadScreen params={{}} /></TestApp>);
 *
 * Lives in src/ui/debug because it imports core/testkit (05 §3.1).
 */
import type { ComponentChildren } from 'preact';
import type { ContentDB } from '../../core/content';
import type { GameState } from '../../core/model';
import { FIXTURE_CONTENT_RAW, buildFixtureWorld, fixtureContent } from '../../core/testkit';
import type { Clock, FileIO } from '../../platform/save-store';
import { createMemorySaveStore, type MemorySaveStore } from '../../platform/save-store.memory';
import { StoreContext } from '../store/contract';
import { createGameStore, type AppStore } from '../store/create-store';
import { EngineContext, type GameEngine } from '../store/engine';
import { createDevEngine } from './dev-engine';
import { buildDevWorld } from './dev-world';

export interface TestClock extends Clock {
  advance(ms: number): void;
}

export function createTestClock(startMs = Date.UTC(2026, 9, 25, 12, 0, 0)): TestClock {
  let now = startMs;
  return {
    nowMs: () => now,
    nowIso: () => new Date(now).toISOString(),
    advance: (ms) => {
      now += ms;
    },
  };
}

export interface TestStoreOptions {
  /** 'dev' = buildDevWorld on the fixture content; 'fixture' = testkit buildFixtureWorld; 'none' = no career. */
  world?: 'dev' | 'fixture' | 'none';
  weekIndex?: number;
  /** Player club for the dev world (default: the first club). null = not chosen yet. */
  playerClubId?: string | null;
  engine?: GameEngine;
  dev?: boolean;
}

export interface TestStore {
  store: AppStore;
  saves: MemorySaveStore;
  clock: TestClock;
  downloads: { fileName: string; text: string }[];
  content: ContentDB;
  engine: GameEngine;
}

export function createTestStore(options: TestStoreOptions = {}): TestStore {
  const saves = createMemorySaveStore();
  const clock = createTestClock();
  const downloads: { fileName: string; text: string }[] = [];
  const files: FileIO = {
    download: (fileName, text) => downloads.push({ fileName, text }),
    readText: (file) => file.text(),
  };
  const engine = options.engine ?? createDevEngine();
  const store = createGameStore({
    saves,
    clock,
    files,
    entropy: () => [1, 2, 3, 4],
    loadTheme: () => FIXTURE_CONTENT_RAW,
    gameVersion: '0.0.0-test',
    dev: options.dev ?? true,
    engine,
  });
  const loaded = store.initContent('fixture');
  if (!loaded.ok) throw new Error('fixture content failed to load');
  const content = fixtureContent();
  const world = options.world ?? 'dev';
  if (world !== 'none') {
    const firstClub = content.clubs.list[0]!.id;
    const state: GameState =
      world === 'fixture'
        ? buildFixtureWorld()
        : buildDevWorld(content, { playerClubId: options.playerClubId === undefined ? firstClub : options.playerClubId, weekIndex: options.weekIndex ?? 11 });
    store.replaceWorld(state, content);
  }
  return { store, saves, clock, downloads, content, engine };
}

/** Providers a screen needs in a test: the store and its engine. */
export function TestProviders({ store, children }: { store: AppStore; children: ComponentChildren }) {
  return (
    <StoreContext.Provider value={store}>
      <EngineContext.Provider value={store.engine}>{children}</EngineContext.Provider>
    </StoreContext.Provider>
  );
}
