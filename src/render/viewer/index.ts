/**
 * src/render/viewer — the PixiJS half of the arena viewer (05-technical-m2 §A5; WP-M2D implements).
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
 * CONTRACT: signatures fixed (architect); stubs throw NotImplementedError until WP-M2D lands.
 */
import type { ContentDB } from '../../core/content';
import type { FightLog, UnitIndex } from '../../core/model';
import { notImplemented } from '../../core/util';
import type { Timeline } from '../timeline';
import type { ArenaFrameState, ArenaPalette, ArenaRoundContext, AutoPauseRules, CameraConfig, DecisionSnapshot, KeyMoment, PlaybackStop, Speed, ViewerStats } from '../types';
import type { ArenaSkin } from './skin';

export type { ArenaSkin, BodyFrame, BodyVisual, SkinContext } from './skin';

export interface ArenaViewerOptions {
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
}

/**
 * For a live round the viewer is the UI's ONLY source of round data (review B1): onFrame samples, keyMoments() and
 * decisionAt(), all bounded by headTick, and endTick stays null until the end is reached. The UI never indexes a
 * live log itself; the fake-viewer leak test (05-technical-m2 §A11) holds it to that.
 */
export interface ArenaViewer {
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
export function createArenaViewer(options: ArenaViewerOptions): Promise<ArenaViewer> {
  return notImplemented('render.createArenaViewer', options);
}
