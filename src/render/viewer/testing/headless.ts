/**
 * Test support: the viewer's logic assembled without a GPU. A real `ViewerCore` and a real `ArenaScene` over the
 * placeholder skin (PixiJS scene-graph objects only; no renderer, no canvas), the fake timeline, a stub text factory
 * and a manual clock, so tests step frames by hand. Nothing in the viewer imports this file.
 */
import type { ContentDB } from '../../../core/content';
import type { UnitIndex } from '../../../core/model';
import { DEFAULT_AUTO_PAUSE } from '../../index';
import { DEFAULT_CAMERA } from '../../camera';
import { placeholderSkin } from '../../skins/placeholder';
import type { ArenaFrameState, ArenaPalette, AutoPauseRules, CameraConfig, PlaybackStop } from '../../types';
import { ViewerCore } from '../core';
import { defaultArenaPalette } from '../palette';
import { ArenaScene } from '../scene/arena-scene';
import { createStubTextFactory } from '../scene/text';
import type { ArenaSkin, BodyVisual, SkinContext } from '../skin';
import { createFakeTimeline, fakeContent, fakeCues, fakeViewTransform, type FakeTimeline } from './fake-timeline';

/** A skin that wraps another and counts what the viewer asks of it; `prepare` can be held open. */
export class TrackingSkin implements ArenaSkin {
  readonly id = 'tracking';
  bodiesCreated = 0;
  bodiesDestroyed = 0;
  prepareCalls: number[] = [];
  floorsCreated = 0;
  loaded = false;
  paletteCalls = 0;
  /** When set, `prepare` waits for it. */
  gate: Promise<void> | null = null;
  readonly bodies: BodyVisual[] = [];

  constructor(private readonly inner: ArenaSkin = placeholderSkin()) {}

  async load(ctx: SkinContext): Promise<void> {
    this.loaded = true;
    await this.inner.load(ctx);
  }
  async prepare(units: Parameters<ArenaSkin['prepare']>[0]): Promise<void> {
    this.prepareCalls.push(units.length);
    if (this.gate) await this.gate;
    await this.inner.prepare(units);
  }
  createBody(info: Parameters<ArenaSkin['createBody']>[0], colors: Parameters<ArenaSkin['createBody']>[1]): BodyVisual {
    this.bodiesCreated++;
    const body = this.inner.createBody(info, colors);
    const destroy = body.destroy.bind(body);
    body.destroy = () => {
      this.bodiesDestroyed++;
      destroy();
    };
    this.bodies.push(body);
    return body;
  }
  createFloor(arenaCm: { width: number; height: number }, pxPerMetre: number): ReturnType<ArenaSkin['createFloor']> {
    this.floorsCreated++;
    return this.inner.createFloor(arenaCm, pxPerMetre);
  }
  setPalette(palette: ArenaPalette): void {
    this.paletteCalls++;
    this.inner.setPalette(palette);
  }
  destroy(): void {
    this.inner.destroy();
  }
  get liveBodies(): number {
    return this.bodiesCreated - this.bodiesDestroyed;
  }
}

export interface Headless {
  core: ViewerCore;
  scene: ArenaScene;
  timeline: FakeTimeline;
  skin: TrackingSkin;
  text: ReturnType<typeof createStubTextFactory>;
  frames: ArenaFrameState[];
  stops: PlaybackStop[];
  selections: (UnitIndex | null)[];
  /** The manual wall clock, ms. */
  readonly now: number;
  /** Run `n` frames of `stepMs` each (default 16.67 ms): the ticker, by hand. Stops early when the core stops. */
  run(n: number, stepMs?: number): number;
  /** Advance wall time without a frame. */
  skipTime(ms: number): void;
  wakes: number;
}

export interface HeadlessOptions {
  hudHz?: number;
  reducedMotion?: boolean;
  autoPause?: AutoPauseRules;
  palette?: ArenaPalette;
  camera?: Partial<CameraConfig>;
  content?: ContentDB;
}

export function assemble(options: HeadlessOptions = {}): Headless {
  const timeline = createFakeTimeline();
  const skin = new TrackingSkin();
  const palette = options.palette ?? defaultArenaPalette('dark');
  const content = options.content ?? fakeContent();
  const cues = fakeCues();
  const text = createStubTextFactory();
  skin.setPalette(palette); // the real viewer loads the skin with the palette before the first round
  const scene = new ArenaScene({
    skin,
    content,
    cues,
    palette,
    text,
    viewTransform: fakeViewTransform,
    camera: { ...DEFAULT_CAMERA, ...options.camera },
    reducedMotion: options.reducedMotion ?? false,
    flashLimitPerSecond: null,
  });
  scene.setViewport(1280, 720);
  let now = 1000;
  const h: Headless = {
    core: undefined as never,
    scene,
    timeline,
    skin,
    text,
    frames: [],
    stops: [],
    selections: [],
    wakes: 0,
    get now() {
      return now;
    },
    run(n, stepMs = 1000 / 60) {
      let done = 0;
      for (let i = 0; i < n; i++) {
        now += stepMs;
        done++;
        if (!h.core.frame(stepMs)) break;
      }
      return done;
    },
    skipTime(ms) {
      now += ms;
    },
  };
  h.core = new ViewerCore({
    content,
    cues,
    timeline,
    scene,
    prepare: (units) => skin.prepare(units),
    now: () => now,
    wake: () => {
      h.wakes++;
    },
    reducedMotion: options.reducedMotion ?? false,
    autoPause: options.autoPause ?? DEFAULT_AUTO_PAUSE,
    onFrame: (s) => h.frames.push(s),
    hudHz: options.hudHz ?? 10,
    onStop: (s) => h.stops.push(s),
    onSelect: (u) => h.selections.push(u),
  });
  return h;
}
