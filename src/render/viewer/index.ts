/**
 * src/render/viewer — the PixiJS half of the arena viewer (05-technical-m2 §A5; WP-M2D).
 *
 * The only place besides src/render/skins that imports pixi.js at run time. src/ui loads this entry with a
 * dynamic import() only (rule ui-render-viewer-static), so PixiJS stays in a lazy chunk outside the startup
 * budget (tests/build/bundle.test.ts).
 *
 * The viewer plays one round's full-level log against a playback clock: it never simulates, never draws
 * randomness and never writes game state (T4, tech-009). Each frame it samples the render-state model
 * (src/render/timeline sampleAt) at the clock's tick and draws: floor (skin), zones, telegraphs, bodies
 * (skin), token overlays (viewer), projectiles, cues. The HUD (score, clock, fighter strip, controls,
 * inspector, feed) is DOM in src/ui, fed by onFrame at hudHz (tech-018).
 *
 * Layout of this folder: `core.ts` (clock, stops, bounded queries: no PixiJS, tested with a fake timeline),
 * `scene/` (the PixiJS scene), `input.ts`, `host.ts`, and this file, which wires them to a PixiJS Application.
 */
import { Application } from 'pixi.js';
import type { ContentDB } from '../../core/content';
import type { FightLog, UnitIndex } from '../../core/model';
import { DEFAULT_AUTO_PAUSE } from '../index';
import { DEFAULT_CAMERA, viewTransform as realViewTransform } from '../camera';
import { buildCueTable } from '../cues';
import { placeholderSkin } from '../skins/placeholder';
import { timeline as realTimeline, type Timeline } from '../timeline';
import type { ArenaFrameState, ArenaPalette, ArenaRoundContext, ArenaViewerDecisionHistory, ArenaViewerOptionExtras, AutoPauseRules, CameraConfig, DecisionSnapshot, KeyMoment, PlaybackStop, Speed, ViewerStats } from '../types';
import { MAX_DT_MS } from './clock';
import { ViewerCore } from './core';
import { canvasResolution, watchDevicePixelRatio } from './host';
import { attachInput } from './input';
import { ArenaScene } from './scene/arena-scene';
import { createPixiTextFactory } from './scene/text';
import type { ArenaSkin } from './skin';
import { RingStats } from './stats';

export type { ArenaSkin, BodyFrame, BodyVisual, SkinContext } from './skin';

export interface ArenaViewerOptions extends ArenaViewerOptionExtras {
  /** The element the canvas is created in; the viewer follows its size (ResizeObserver) and the device pixel ratio. */
  host: HTMLElement;
  content: ContentDB;
  palette: ArenaPalette;
  /** Default: the placeholder skin (src/render/skins/placeholder). */
  skin?: ArenaSkin;
  camera?: Partial<CameraConfig>;
  reducedMotion: boolean;
  /** Per-fighter flash limit (04 §9: no flashing above 3 per second). Default: palette.metrics.flashLimitPerSecond. */
  flashLimitPerSecond?: number;
  /** Cap on the canvas resolution (default 2): resolution = min(devicePixelRatio, maxResolution). */
  maxResolution?: number;
  /** The HUD's view of the arena, throttled to hudHz (default 10), and once on every pause, seek and stop. */
  onFrame?: (state: ArenaFrameState) => void;
  hudHz?: number;
  /** Playback stopped by itself: an auto-pause, the round's end, or (live) the live head. */
  onStop?: (stop: PlaybackStop) => void;
  /** A token was clicked or keyboard-selected (inspector). */
  onSelect?: (unit: UnitIndex | null) => void;
  /** The render-state model (default: the real src/render timeline); tests inject a fake (review B8). */
  timeline?: Timeline;
  // cues, viewTransform and tabStop come from ArenaViewerOptionExtras (src/render/types.ts, §A19).
}

/**
 * For a live round the viewer is the UI's ONLY source of round data (review B1): onFrame samples, keyMoments() and
 * decisionAt(), all bounded by headTick, and endTick stays null until the end is reached. The UI never indexes a
 * live log itself; the fake-viewer leak test (05-technical-m2 §A11) holds it to that.
 */
export interface ArenaViewer extends ArenaViewerDecisionHistory {
  /** Load a round (paused at ctx.startTick) after the skin has prepared its units. Replaces any previous round; frees its visuals. */
  load(log: FightLog, ctx: ArenaRoundContext): Promise<void>;
  /**
   * Calls package: swap in the round re-simulated with a new call, at the current tick. Refused (returns false)
   * unless every event up to `atTick` is identical (render/timeline samePrefix).
   */
  replaceLog(log: FightLog, atTick: number): boolean;
  play(): void;
  pause(): void;
  readonly playing: boolean;
  setSpeed(speed: Speed): void;
  readonly speed: Speed;
  /** Replay: any tick. Live: at most headTick (no peeking ahead). Leaves the play state unchanged. */
  seek(tick: number): void;
  /** The current (fractional) tick. */
  readonly tick: number;
  /** Live: the furthest tick shown so far. Replay: the round's last tick. */
  readonly headTick: number;
  /** Replay: the round's last tick. Live: null until playback has reached the end (no scrubber may announce it). */
  readonly endTick: number | null;
  /** Key moments up to headTick (the feed, scrubber marks). */
  keyMoments(): readonly KeyMoment[];
  /** The selected or given unit's committed decision at the current tick (inspector "why this"). */
  decisionAt(unit: UnitIndex): DecisionSnapshot | null;
  setAutoPause(rules: AutoPauseRules): void;
  setCamera(camera: Partial<CameraConfig>): void;
  setPalette(palette: ArenaPalette): void;
  setReducedMotion(on: boolean): void;
  select(unit: UnitIndex | null): void;
  /** Name labels over tokens: none, the selected unit, or all (stacked above the HP bar, 04 §4). */
  setLabels(mode: 'off' | 'selected' | 'all'): void;
  /** The canvas as a PNG (F8 tickets, the visual smoke). */
  snapshot(): Promise<Blob>;
  stats(): ViewerStats;
  /** Stop the ticker, release textures and the WebGL context, remove the canvas. Idempotent. */
  destroy(): void;
}

/**
 * Create a viewer in `options.host` (async: PixiJS Application.init). PixiJS v8 settings (tech-024):
 * preference 'webgl', antialias, autoDensity, resolution min(devicePixelRatio, maxResolution),
 * preserveDrawingBuffer (screenshots), backgroundAlpha 0, a ticker capped at the display refresh with
 * dt clamped to 100 ms (no jump after a hidden tab).
 */
export async function createArenaViewer(options: ArenaViewerOptions): Promise<ArenaViewer> {
  const { host, content } = options;
  const maxResolution = options.maxResolution ?? 2;
  let resolution = canvasResolution(window.devicePixelRatio, maxResolution);
  const size = (): { width: number; height: number } => ({ width: Math.max(1, Math.round(host.clientWidth)), height: Math.max(1, Math.round(host.clientHeight)) });
  const first = size();

  const app = new Application();
  /** Release the app, its canvas and its GPU context. Safe on a half-built app: a failed init leaves no renderer. */
  const releaseApp = (): void => {
    const gl = (app as unknown as { renderer?: { gl?: WebGLRenderingContext | WebGL2RenderingContext } }).renderer?.gl;
    try {
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true });
    } catch {
      // init never finished: there is nothing PixiJS can tear down
    }
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  };
  try {
    await app.init({
      preference: 'webgl',
      antialias: true,
      autoDensity: true,
      resolution,
      preserveDrawingBuffer: true,
      backgroundAlpha: 0,
      width: first.width,
      height: first.height,
      // Our own loop: one callback per display frame that stops while paused (no autostart, no shared ticker).
      autoStart: false,
      sharedTicker: false,
      // The viewer does its own hit-testing: the PixiJS event system stays idle.
      eventFeatures: { move: false, globalMove: false, click: false, wheel: false },
    });
  } catch (error) {
    releaseApp();
    throw new Error(`The arena could not start a WebGL canvas: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  // Whatever a later step creates is released again, in reverse, if a step after init throws (skin.load, cue table...).
  const undo: (() => void)[] = [releaseApp];
  try {
    const canvas = app.canvas;
    if (options.tabStop ?? true) canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Arena');
    canvas.style.display = 'block';
    host.appendChild(canvas);
    app.stage.eventMode = 'none';

    const skin = options.skin ?? placeholderSkin();
    let palette = options.palette;
    await skin.load({ renderer: app.renderer, content, palette });
    undo.push(() => skin.destroy());

    const cues = options.cues ?? buildCueTable(content);
    const textFactory = createPixiTextFactory(resolution, palette);
    undo.push(() => textFactory.destroy());
    const camera: CameraConfig = { ...DEFAULT_CAMERA, ...options.camera };
    let cameraConfig = camera;
    const scene = new ArenaScene({
      skin,
      content,
      cues,
      palette,
      text: textFactory,
      viewTransform: options.viewTransform ?? realViewTransform,
      camera: cameraConfig,
      reducedMotion: options.reducedMotion,
      flashLimitPerSecond: options.flashLimitPerSecond ?? null,
    });
    undo.push(() => scene.destroy());
    app.stage.addChild(scene.root);
    scene.setViewport(first.width, first.height);

    const intervals = new RingStats();
    const cpu = new RingStats();
    let lastTickAt = 0;
    let destroyed = false;

    const wake = (): void => {
      if (!destroyed && !app.ticker.started) app.ticker.start();
    };

    const core = new ViewerCore({
      content,
      cues,
      timeline: options.timeline ?? realTimeline,
      scene,
      prepare: (units) => skin.prepare(units),
      now: () => performance.now(),
      wake,
      reducedMotion: options.reducedMotion,
      autoPause: DEFAULT_AUTO_PAUSE,
      onFrame: (state) => {
        // The label is rewritten when paused (each pause, seek and stop), never at the HUD rate while playing (A9).
        if (!core.playing) canvas.setAttribute('aria-label', core.describe());
        options.onFrame?.(state);
      },
      hudHz: options.hudHz ?? 10,
      onStop: options.onStop,
      onSelect: options.onSelect,
    });

    /** One display frame: our work (clock, sample, scene), then the render. The ticker stops once nothing moves. */
    const onTick = (): void => {
      const t0 = performance.now();
      const dt = Math.min(app.ticker.deltaMS, MAX_DT_MS);
      if (lastTickAt > 0 && t0 - lastTickAt < 250) intervals.push(t0 - lastTickAt);
      lastTickAt = t0;
      const keepRunning = core.frame(dt);
      // A stop callback can destroy the viewer (leaving the arena): nothing renders, and the ticker is not touched again.
      if (destroyed) return;
      cpu.push(performance.now() - t0);
      app.render();
      if (!keepRunning && !scene.animating) {
        app.ticker.stop();
        lastTickAt = 0;
      }
    };
    app.ticker.add(onTick);
    undo.push(() => {
      app.ticker.remove(onTick);
      app.ticker.stop();
      core.destroy();
    });

    const applySize = (): void => {
      if (destroyed) return;
      const { width, height } = size();
      app.renderer.resize(width, height, resolution);
      scene.setViewport(width, height);
      // renderer.resize cleared the canvas: redraw and render now, or it stays blank until the next frame.
      core.refresh();
      app.render();
    };
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => applySize()) : null;
    resizeObserver?.observe(host);
    undo.push(() => resizeObserver?.disconnect());
    const stopDprWatch = watchDevicePixelRatio((dpr) => {
      const next = canvasResolution(dpr, maxResolution);
      if (next === resolution) return;
      resolution = next;
      applySize();
    });
    undo.push(stopDprWatch);
    const detachInput = attachInput({ canvas, core });
    undo.push(detachInput);

    const toBlob = (c: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));

    const viewer: ArenaViewer = {
      load: (log, ctx) => core.load(log, ctx),
      replaceLog: (log, atTick) => core.replaceLog(log, atTick),
      play: () => core.play(),
      pause: () => core.pause(),
      get playing() {
        return core.playing;
      },
      setSpeed: (speed) => core.setSpeed(speed),
      get speed() {
        return core.speed;
      },
      seek: (tick) => core.seek(tick),
      get tick() {
        return core.tick;
      },
      get headTick() {
        return core.headTick;
      },
      get endTick() {
        return core.endTick;
      },
      keyMoments: () => core.keyMoments(),
      decisionAt: (unit) => core.decisionAt(unit),
    decisionsUpTo: (unit, tick) => core.decisionsUpTo(unit, tick),
      setAutoPause: (rules) => core.setAutoPause(rules),
      setCamera(patch) {
        cameraConfig = { ...cameraConfig, ...patch };
        scene.setCamera(cameraConfig, performance.now());
        core.invalidate();
      },
      setPalette(next) {
        palette = next;
        scene.setPalette(next);
        core.invalidate();
      },
      setReducedMotion: (on) => core.setReducedMotion(on),
      select: (unit) => core.select(unit),
      setLabels: (mode) => core.setLabels(mode),
      async snapshot() {
        if (destroyed) throw new Error('The arena viewer was destroyed.');
        // Render now, in this task: the canvas holds this frame (preserveDrawingBuffer) and toBlob reads it.
        app.render();
        const direct = await toBlob(canvas);
        if (direct && direct.size > 0) return direct;
        // Fallback (some drivers): PixiJS extract into a 2D canvas.
        const extracted = app.renderer.extract.canvas({ target: app.stage, resolution }) as HTMLCanvasElement;
        const blob = await toBlob(extracted);
        if (!blob || blob.size === 0) throw new Error('The arena canvas could not be captured.');
        return blob;
      },
      stats(): ViewerStats {
        const running = app.ticker.started && lastTickAt > 0;
        const interval = intervals.mean(30);
        return {
          fps: running && interval > 0 ? 1000 / interval : 0,
          frameMsP50: cpu.percentile(0.5),
          frameMsP95: cpu.percentile(0.95),
          drawCalls: null,
          renderer: app.renderer.name === 'webgl' || app.renderer.name === 'webgpu' ? app.renderer.name : 'canvas',
          resolution: app.renderer.resolution,
        };
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        stopDprWatch();
        resizeObserver?.disconnect();
        detachInput();
        // Nothing renders from here on: the ticker is off and a tick in progress (destroy from an onStop callback) ends
        // without drawing. Then the stage lets go of the scene, so no frame can draw what is about to be destroyed, and
        // the scene's textures (fonts) go before the renderer that drew them.
        app.ticker.remove(onTick);
        app.ticker.stop();
        core.destroy();
        app.stage.removeChild(scene.root);
        scene.destroy();
        skin.destroy();
        // Gives the GPU context back now too (browsers cap live contexts).
        releaseApp();
      },
    };
    return viewer;
  } catch (error) {
    for (const f of undo.reverse()) {
      try {
        f();
      } catch {
        // keep releasing the rest
      }
    }
    throw error;
  }
}

/**
 * Warm the pieces of PixiJS that `createArenaViewer` would otherwise fetch one request after another at the first open:
 * the browser environment and the WebGL renderer are lazy chunks of PixiJS itself (Application.init imports them), so
 * loading this entry does not bring them. src/ui calls it at idle (right after the entry's own import) whenever a Watch is
 * plausible, so the first open is a warm open. Fetches and parses only: no canvas, no GPU context, no state. The WebGL
 * renderer is named through the `pixi-webgl-renderer` alias (vite.config.ts): the same module PixiJS imports, hence the same chunk.
 */
export async function prefetchViewerChunks(): Promise<void> {
  await Promise.all([import('pixi.js/browser'), import('pixi-webgl-renderer')]);
}
