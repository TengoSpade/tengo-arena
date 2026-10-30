/**
 * The viewer prefetch (A10: the first open within 500 ms): the lazy viewer entry and, through it, PixiJS's own lazy chunks
 * (browser environment, WebGL renderer) are asked for at idle whenever a Watch is plausible, once, and never into the
 * startup JS (tests/build/prefetch.test.ts checks the bundle). The viewer module is replaced by a stand-in: PixiJS never
 * loads into happy-dom here.
 */
import { cleanup, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureContent } from '../../../core/testkit';
import { liveWatchState, watchWorld } from '../../debug/arena-test-world';
import { DEFAULT_SETTINGS, updateSettings } from '../../store/settings';
import { prefetchViewer, prefetchViewerAfterLoad, resetViewerPrefetch, usePrefetchViewer } from './viewer-factory';

const entry = vi.hoisted(() => ({ prefetchViewerChunks: vi.fn(async () => undefined), createArenaViewer: vi.fn() }));
vi.mock('../../../render/viewer', () => entry);

const realIdle = window.requestIdleCallback;
const realCancel = window.cancelIdleCallback;
let idleQueue: (() => void)[] = [];

beforeEach(() => {
  entry.prefetchViewerChunks.mockClear();
  resetViewerPrefetch();
  updateSettings({ ...DEFAULT_SETTINGS });
  idleQueue = [];
  // Not under test: the hook skips MODE 'test' (PixiJS in happy-dom). The browser's idle callback is a queue we flush by hand.
  vi.stubEnv('MODE', 'development');
  window.requestIdleCallback = ((fn: () => void) => idleQueue.push(fn)) as unknown as typeof window.requestIdleCallback;
  window.cancelIdleCallback = (() => undefined) as typeof window.cancelIdleCallback;
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  window.requestIdleCallback = realIdle;
  window.cancelIdleCallback = realCancel;
});

const flushIdle = async () => {
  idleQueue.splice(0).forEach((fn) => fn());
  await new Promise((r) => setTimeout(r, 0));
};

function Probe({ plausible }: { plausible: boolean }) {
  usePrefetchViewer(plausible);
  return null;
}

describe('prefetchViewer', () => {
  it('loads the entry and warms its PixiJS chunks, once per page', async () => {
    const load = vi.fn(async () => entry);
    prefetchViewer(load);
    prefetchViewer(load);
    await new Promise((r) => setTimeout(r, 0));
    expect(load).toHaveBeenCalledTimes(1);
    expect(entry.prefetchViewerChunks).toHaveBeenCalledTimes(1);
  });

  it('a failed fetch is swallowed and may be tried again', async () => {
    prefetchViewer(() => Promise.reject(new Error('offline')));
    await new Promise((r) => setTimeout(r, 0));
    const load = vi.fn(async () => entry);
    prefetchViewer(load);
    await new Promise((r) => setTimeout(r, 0));
    expect(load).toHaveBeenCalledTimes(1);
    expect(entry.prefetchViewerChunks).toHaveBeenCalledTimes(1);
  });

  it('the default load is the viewer entry itself (a dynamic import)', async () => {
    prefetchViewer();
    await new Promise((r) => setTimeout(r, 0));
    expect(entry.prefetchViewerChunks).toHaveBeenCalledTimes(1);
  });
});

describe('when a Watch is plausible, at idle', () => {
  it('asks for the chunks only when the browser is idle, not at render', async () => {
    render(<Probe plausible />);
    expect(entry.prefetchViewerChunks).not.toHaveBeenCalled();
    expect(idleQueue).toHaveLength(1);
    await flushIdle();
    expect(entry.prefetchViewerChunks).toHaveBeenCalledTimes(1);
  });

  it('not when no match is next, and not when the player always simulates', async () => {
    render(<Probe plausible={false} />);
    expect(idleQueue).toHaveLength(0);
    cleanup();
    updateSettings({ ...DEFAULT_SETTINGS, arena: { ...DEFAULT_SETTINGS.arena, watchPreference: 'simulate' } });
    render(<Probe plausible />);
    expect(idleQueue).toHaveLength(0);
    await flushIdle();
    expect(entry.prefetchViewerChunks).not.toHaveBeenCalled();
  });

  it('never under test (PixiJS would load into happy-dom)', async () => {
    vi.stubEnv('MODE', 'test');
    render(<Probe plausible />);
    expect(idleQueue).toHaveLength(0);
  });

  it('Home, Squad and the between-round screen call it (the screens are the triggers)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    for (const file of ['home/index.tsx', 'squad/index.tsx', 'between-rounds/index.tsx']) {
      const src = readFileSync(join(process.cwd(), 'src/ui/screens', file), 'utf8');
      expect(src, file).toContain('usePrefetchViewer(');
    }
  });
});

describe('after a load', () => {
  const content = fixtureContent();
  it('a save with a round waiting asks for the chunks at once (the arena opens right away)', async () => {
    const w = watchWorld(content);
    prefetchViewerAfterLoad(liveWatchState(w));
    await new Promise((r) => setTimeout(r, 0));
    expect(entry.prefetchViewerChunks).toHaveBeenCalledTimes(1);
  });

  it('any other load leaves it to Home (idle), and nothing loads under test', async () => {
    const w = watchWorld(content);
    prefetchViewerAfterLoad(w.state);
    prefetchViewerAfterLoad(null);
    vi.stubEnv('MODE', 'test');
    prefetchViewerAfterLoad(liveWatchState(w));
    await new Promise((r) => setTimeout(r, 0));
    expect(entry.prefetchViewerChunks).not.toHaveBeenCalled();
  });
});
