/**
 * createArenaViewer's setup and its undo path, with PixiJS's Application replaced by a fake (happy-dom has no WebGL):
 * a failed init keeps its friendly error even when PixiJS cannot destroy a half-built app, and a failure after init
 * (the skin's load, the cue table) leaves no canvas in the host, no live context and no skin behind.
 */
import type * as Pixi from 'pixi.js';
import type * as TextModule from './scene/text';
import { describe, expect, it, vi } from 'vitest';
import type { ContentDB } from '../../core/content';
import { defaultArenaPalette } from '../colors';
import type { ArenaSkin } from './index';
import { createArenaViewer } from './index';
import { createFakeTimeline, fakeContent, fakeContext, fakeCues, fakeLog, fakeViewTransform } from './testing/fake-timeline';

const fake = vi.hoisted(() => ({
  initError: null as Error | null,
  /** PixiJS dereferences an undefined renderer when a failed init is destroyed: model it. */
  destroyThrows: false,
  apps: [] as {
    destroy: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    loseContext: ReturnType<typeof vi.fn>;
    ticker: { add: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> };
    canvas: HTMLCanvasElement;
    /** How many children the stage still had when the app was destroyed (the scene must be detached first). */
    stageChildrenAtDestroy: number;
  }[],
}));

vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof Pixi>();
  class FakeApplication {
    canvas = document.createElement('canvas');
    stage = new actual.Container();
    loseContext = vi.fn();
    renderer = { resize: vi.fn(), resolution: 1, name: 'webgl', gl: { getExtension: () => ({ loseContext: this.loseContext }) } };
    ticker = { started: false, deltaMS: 16, add: vi.fn(), remove: vi.fn(), start: vi.fn(() => (this.ticker.started = true)), stop: vi.fn(() => (this.ticker.started = false)) };
    render = vi.fn();
    stageChildrenAtDestroy = -1;
    destroy = vi.fn(() => {
      this.stageChildrenAtDestroy = this.stage.children.length;
      if (fake.destroyThrows) throw new TypeError("Cannot read properties of undefined (reading 'destroy')");
      this.canvas.remove();
    });
    constructor() {
      fake.apps.push(this);
    }
    init(): Promise<void> {
      if (fake.initError) {
        delete (this as { renderer?: unknown }).renderer; // a failed init leaves no renderer
        return Promise.reject(fake.initError);
      }
      return Promise.resolve();
    }
  }
  return { ...actual, Application: FakeApplication };
});

vi.mock('./scene/text', async (importOriginal) => {
  const actual = await importOriginal<typeof TextModule>();
  return { ...actual, createPixiTextFactory: () => actual.createStubTextFactory() };
});

function options(host: HTMLElement, over: Partial<Parameters<typeof createArenaViewer>[0]> = {}): Parameters<typeof createArenaViewer>[0] {
  return { host, content: fakeContent(), palette: defaultArenaPalette('dark'), reducedMotion: false, timeline: createFakeTimeline(), cues: fakeCues(), viewTransform: fakeViewTransform, ...over };
}

function trackedSkin(over: Partial<ArenaSkin> = {}): ArenaSkin & { destroyed: number } {
  const skin = {
    id: 'tracked',
    destroyed: 0,
    load: () => Promise.resolve(),
    prepare: () => Promise.resolve(),
    createBody: () => {
      throw new Error('no bodies in this test');
    },
    createFloor: () => {
      throw new Error('no floor in this test');
    },
    setPalette: () => undefined,
    destroy() {
      skin.destroyed++;
    },
    ...over,
  };
  return skin as ArenaSkin & { destroyed: number };
}

function setup(): { host: HTMLDivElement } {
  fake.initError = null;
  fake.destroyThrows = false;
  fake.apps.length = 0;
  const host = document.createElement('div');
  document.body.appendChild(host);
  return { host };
}

describe('createArenaViewer setup and undo', () => {
  it('a failed init rejects with the friendly WebGL error even when PixiJS cannot destroy the half-built app', async () => {
    const { host } = setup();
    fake.initError = new Error('This browser does not support WebGL.');
    fake.destroyThrows = true;
    const error = await createArenaViewer(options(host)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).constructor).toBe(Error); // not the TypeError PixiJS throws from destroy
    expect((error as Error).message).toBe('The arena could not start a WebGL canvas: This browser does not support WebGL.');
    expect((error as Error).cause).toBe(fake.initError);
    expect(fake.apps[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('canvas')).toHaveLength(0);
  });

  it('a skin that fails to load after init leaves no canvas, no live context and no skin', async () => {
    const { host } = setup();
    const skin = trackedSkin({ load: () => Promise.reject(new Error('skin boom')) });
    await expect(createArenaViewer(options(host, { skin }))).rejects.toThrow('skin boom');
    const app = fake.apps[0]!;
    expect(host.querySelectorAll('canvas')).toHaveLength(0);
    expect(app.destroy).toHaveBeenCalledTimes(1);
    expect(app.destroy).toHaveBeenCalledWith({ removeView: true }, { children: true, texture: true, textureSource: true, context: true });
    expect(app.loseContext).toHaveBeenCalledTimes(1); // the GPU context is given back
  });

  it('a cue table that cannot be built releases the skin, the canvas and the context', async () => {
    const { host } = setup();
    const skin = trackedSkin();
    const { cues: _omit, ...rest } = options(host, { skin });
    void _omit;
    await expect(createArenaViewer({ ...rest, content: {} as ContentDB })).rejects.toThrow();
    const app = fake.apps[0]!;
    expect(skin.destroyed).toBe(1);
    expect(host.querySelectorAll('canvas')).toHaveLength(0);
    expect(app.destroy).toHaveBeenCalledTimes(1);
    expect(app.loseContext).toHaveBeenCalledTimes(1);
  });

  it('a failure while undoing does not stop the rest of the undo', async () => {
    const { host } = setup();
    const skin = trackedSkin({ load: () => Promise.reject(new Error('skin boom')), destroy: () => {
      throw new Error('destroy boom');
    } });
    await expect(createArenaViewer(options(host, { skin }))).rejects.toThrow('skin boom'); // the original error, not the undo's
    expect(fake.apps[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('canvas')).toHaveLength(0);
  });

  it('a viewer that was created releases everything once on destroy, however often it is called', async () => {
    const { host } = setup();
    const skin = trackedSkin();
    const viewer = await createArenaViewer(options(host, { skin }));
    const app = fake.apps[0]!;
    expect(host.querySelectorAll('canvas')).toHaveLength(1);
    expect(host.querySelector('canvas')!.getAttribute('role')).toBe('img');
    expect(host.querySelector('canvas')!.tabIndex).toBe(0);
    viewer.destroy();
    viewer.destroy();
    expect(app.destroy).toHaveBeenCalledTimes(1);
    expect(app.loseContext).toHaveBeenCalledTimes(1);
    expect(skin.destroyed).toBe(1);
    expect(host.querySelectorAll('canvas')).toHaveLength(0);
    await expect(viewer.snapshot()).rejects.toThrow('destroyed');
  });

  it('a viewer destroyed from inside its own tick (an onStop callback that leaves the arena) renders nothing more', async () => {
    const { host } = setup();
    const rendersAtStop: number[] = [];
    let viewer: Awaited<ReturnType<typeof createArenaViewer>> | null = null;
    viewer = await createArenaViewer(
      options(host, {
        onStop: () => {
          rendersAtStop.push(app.render.mock.calls.length);
          viewer!.destroy(); // the UI leaves the arena on a stop
        },
      }),
    );
    const app = fake.apps[0]!;
    await viewer.load(fakeLog(), fakeContext({ kind: 'replay' }));
    viewer.setSpeed(4);
    viewer.play();
    const tick = app.ticker.add.mock.calls[0]![0] as () => void;
    for (let i = 0; i < 4000 && rendersAtStop.length === 0; i++) tick();
    expect(rendersAtStop).toHaveLength(1); // a stop fired inside a tick
    expect(app.render.mock.calls.length).toBe(rendersAtStop[0]); // and that tick drew nothing after the destroy
    expect(app.destroy).toHaveBeenCalledTimes(1);
    expect(app.stageChildrenAtDestroy).toBe(0); // the scene was detached before the renderer went
    // a tick that was already queued does nothing either
    expect(() => tick()).not.toThrow();
    expect(app.render.mock.calls.length).toBe(rendersAtStop[0]);
  });

  it('destroys in a safe order: ticker off, scene detached and released, then the renderer', async () => {
    const { host } = setup();
    const order: string[] = [];
    const skin = trackedSkin({ destroy: () => order.push('skin') as unknown as void });
    const viewer = await createArenaViewer(options(host, { skin }));
    const app = fake.apps[0]!;
    app.ticker.stop.mockImplementation(() => order.push('ticker.stop'));
    app.destroy.mockImplementation(() => {
      order.push('app.destroy');
      app.canvas.remove();
    });
    viewer.destroy();
    expect(order.indexOf('ticker.stop')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('ticker.stop')).toBeLessThan(order.indexOf('skin'));
    expect(order.indexOf('skin')).toBeLessThan(order.indexOf('app.destroy'));
    expect(order.filter((o) => o === 'app.destroy')).toHaveLength(1);
  });

  it('a play followed by a skip and a destroy in the same task is silent (no warnings, no errors)', async () => {
    const { host } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const viewer = await createArenaViewer(options(host));
    const app = fake.apps[0]!;
    await viewer.load(fakeLog(), fakeContext({ kind: 'replay' }));
    viewer.setSpeed(4);
    viewer.play();
    const tick = app.ticker.add.mock.calls[0]![0] as () => void;
    for (let i = 0; i < 5; i++) tick();
    viewer.seek(1_000_000); // Simulate the rest: skip to the end
    viewer.destroy();
    expect(() => tick()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('tabStop: false leaves the canvas out of the tab order', async () => {
    const { host } = setup();
    const viewer = await createArenaViewer(options(host, { skin: trackedSkin(), tabStop: false }));
    expect(host.querySelector('canvas')!.getAttribute('tabindex')).toBeNull();
    viewer.destroy();
  });
});
