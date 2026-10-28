/**
 * The arena scene (05-technical-m2 §A5): floor (skin), row markers (kickoff only), zones, telegraphs, ground
 * cues, bodies with their tokens (depth-sorted by screen y), projectiles and high cues, the bars/pips/badges
 * overlay, and the overtime vignette. It draws an `ArenaFrameState` and nothing else: no simulation, no
 * randomness, no game state. Visuals are reused by unit index and effect id; everything is released on
 * `clearRound` and `destroy`.
 *
 * Layer order, bottom to top:
 *   floor · row markers · zones · telegraphs · low cues · bodies (+ ring, wedge, glyph) · projectiles · high cues ·
 *   overlay (bars, pips, badges: never hidden by a body) · vignette
 *
 * The scene works in CSS px; the renderer's resolution does the rest.
 */
import { Container, Graphics } from 'pixi.js';
import type { ContentDB } from '../../../core/content';
import type { UnitIndex } from '../../../core/model';
import { TELEGRAPH_MIN_TICKS } from '../../cues';
import type { viewTransform as viewTransformFn } from '../../camera';
import type { ArenaFrameState, ArenaPalette, ArenaRoundContext, ArenaUnitInfo, CameraConfig, CueTable, StatusCue, TeamColors, UnitRenderState } from '../../types';
import { FlashLimiter } from '../flash-limiter';
import { chromeFor, type Chrome } from '../palette';
import type { ArenaSkin, BodyFrame } from '../skin';
import { affineOf, blendAffine, pxPerMetreOf, screenAngle, sx, sy, toWorld, type AffineMap } from './affine';
import { EffectLayer, type FxEnv } from './effects';
import type { TextFactory, TextLabel } from './text';
import { Token, type TokenEnv, type TokenFrame } from './token';
import { ProjectileLayer, TelegraphLayer, ZoneLayer, type WorldEnv } from './world';

export interface SceneOptions {
  skin: ArenaSkin;
  content: ContentDB;
  cues: CueTable;
  palette: ArenaPalette;
  text: TextFactory;
  viewTransform: typeof viewTransformFn;
  camera: CameraConfig;
  reducedMotion: boolean;
  flashLimitPerSecond: number;
  uiScale: number;
}

/** What one frame tells the scene. */
export interface FrameInfo {
  tick: number;
  /** Wall ms since the last frame; 0 while paused or after a seek. */
  dtMs: number;
  speed: 1 | 2 | 4;
  playing: boolean;
  /** Monotonic wall time, ms. */
  nowMs: number;
}

/** Where the units stand at kickoff and in which row, for the row markers. */
export interface KickoffInfo {
  /** One entry per unit: its side, row and x position (cm) at tick 0. */
  units: readonly { unit: UnitIndex; side: 0 | 1; row: 'front' | 'back'; x: number }[];
}

const KICKOFF_TICKS = 40;
const KICKOFF_FADE_TICKS = 20;
const BASE_PX_PER_METRE = 52;
const MAX_PIPS = 4;
const MAX_UNITS = 16;

export class ArenaScene {
  readonly root = new Container();
  private readonly floorLayer = new Container();
  private readonly markers = new Container();
  private readonly zones = new ZoneLayer();
  private readonly telegraphs = new TelegraphLayer();
  private readonly fx: EffectLayer;
  private readonly bodies = new Container();
  private readonly projectiles = new ProjectileLayer();
  private readonly overlays = new Container();
  private readonly vignette = new Graphics();
  private readonly markerG = new Graphics();
  private readonly markerLabels: TextLabel[] = [];

  private palette: ArenaPalette;
  private chrome: Chrome;
  private camera: CameraConfig;
  private reducedMotion: boolean;
  private uiScale: number;
  private labels: 'off' | 'selected' | 'all' = 'off';
  private selected: UnitIndex | null = null;
  private ringRemap = false;

  private ctx: ArenaRoundContext | null = null;
  private arena = { width: 3200, height: 1800 };
  private readonly tokens: (Token | undefined)[] = new Array<Token | undefined>(MAX_UNITS).fill(undefined);
  private tokenList: Token[] = [];
  private floor: Container | null = null;
  private floorPpm = 0;
  private floorArena = '';
  private kickoff: KickoffInfo | null = null;

  private viewport = { width: 1280, height: 720 };
  private target: AffineMap = { ox: 0, oy: 0, ax: 1, ay: 0, bx: 0, by: 1 };
  private readonly current: AffineMap = { ox: 0, oy: 0, ax: 1, ay: 0, bx: 0, by: 1 };
  private from: AffineMap | null = null;
  private easeStart = 0;
  private easing = false;
  private mapDirty = true;

  private readonly limiter: FlashLimiter;
  private readonly byUnit: (UnitRenderState | undefined)[] = new Array<UnitRenderState | undefined>(MAX_UNITS).fill(undefined);
  private readonly pipBuf: StatusCue[] = [];
  private lastState: ArenaFrameState | null = null;
  private readonly bodyFrame: BodyFrame = { tick: 0, dtMs: 0, speed: 1, reducedMotion: false, pxPerMetre: BASE_PX_PER_METRE };
  private destroyed = false;
  private overtimeAlpha = 0;
  /** Reused per frame. */
  private readonly worldEnv: WorldEnv & FxEnv;

  constructor(private readonly opts: SceneOptions) {
    this.palette = opts.palette;
    this.chrome = chromeFor(opts.palette);
    this.camera = opts.camera;
    this.reducedMotion = opts.reducedMotion;
    this.uiScale = opts.uiScale;
    this.limiter = new FlashLimiter(opts.flashLimitPerSecond);
    this.fx = new EffectLayer(opts.text);
    this.root.eventMode = 'none';
    this.bodies.sortableChildren = true;
    for (const layer of [this.floorLayer, this.markers, this.zones.root, this.telegraphs.root, this.fx.low, this.bodies, this.projectiles.root, this.fx.high, this.overlays, this.vignette]) layer.eventMode = 'none';
    this.markers.addChild(this.markerG);
    this.root.addChild(this.floorLayer, this.markers, this.zones.root, this.telegraphs.root, this.fx.low, this.bodies, this.projectiles.root, this.fx.high, this.overlays, this.vignette);
    this.worldEnv = {
      map: this.current,
      ppm: BASE_PX_PER_METRE,
      squash: 1,
      palette: this.palette,
      chrome: this.chrome,
      cues: opts.cues,
      units: [],
      tick: 0,
      reducedMotion: this.reducedMotion,
      playing: false,
      nowMs: 0,
      sideColor: (side) => this.ringOf(side),
      limiter: this.limiter,
      byUnit: this.byUnit,
      info: [],
      content: opts.content,
      text: opts.text,
      overlayScale: 1,
      viewport: this.viewport,
    };
  }

  // ---- configuration ---------------------------------------------------------------------------------------------

  setViewport(width: number, height: number): void {
    this.viewport.width = Math.max(1, width);
    this.viewport.height = Math.max(1, height);
    this.mapDirty = true;
    this.from = null;
    this.easing = false;
    this.drawVignette();
  }

  setCamera(camera: CameraConfig, nowMs: number): void {
    // A camera change eases from where the view is now (04 §4: 220 ms; none under reduced motion).
    this.from = { ...this.current };
    this.easeStart = nowMs;
    this.easing = !this.reducedMotion && camera.easeMs > 0;
    this.camera = camera;
    this.mapDirty = true;
  }

  setPalette(palette: ArenaPalette): void {
    const themeChanged = palette.theme !== this.palette.theme;
    this.palette = palette;
    this.chrome = chromeFor(palette);
    this.worldEnv.palette = palette;
    this.worldEnv.chrome = this.chrome;
    // The brass and steel side rings are theme tokens: after a theme switch they follow the palette (a match
    // between other clubs keeps the clubs' colours).
    if (themeChanged && this.ctx && this.ctx.playerSide !== null) this.ringRemap = true;
    this.opts.skin.setPalette(palette);
    this.floorArena = '';
    this.relayoutTokens();
    this.drawVignette();
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    this.worldEnv.reducedMotion = on;
    if (on) {
      this.easing = false;
      this.from = null;
    }
  }

  setUiScale(scale: number): void {
    const s = Math.max(0.5, Math.min(2, Number.isFinite(scale) ? scale : 1));
    if (s === this.uiScale) return;
    this.uiScale = s;
    this.relayoutTokens();
  }

  setLabels(mode: 'off' | 'selected' | 'all'): void {
    this.labels = mode;
  }

  select(unit: UnitIndex | null): void {
    this.selected = unit;
  }

  setFlashLimit(perSecond: number): void {
    this.limiter.setLimit(perSecond);
  }

  get animating(): boolean {
    return this.easing;
  }

  // ---- the round -------------------------------------------------------------------------------------------------

  /** Build the tokens of a round (bodies come from the skin, after `skin.prepare`). Replaces any previous round. */
  setRound(ctx: ArenaRoundContext, arena: { width: number; height: number }, kickoff: KickoffInfo | null): void {
    this.clearRound();
    this.ctx = ctx;
    this.arena = arena;
    this.kickoff = kickoff;
    this.ringRemap = false;
    this.worldEnv.info = ctx.units;
    for (const info of ctx.units) {
      if (info.unit < 0 || info.unit >= MAX_UNITS) continue;
      const colors = ctx.sides[info.side].colors;
      const body = this.opts.skin.createBody(info, colors);
      const token = new Token(info, body, colors, this.tokenEnv());
      this.tokens[info.unit] = token;
      this.tokenList.push(token);
      this.bodies.addChild(token.root);
      this.overlays.addChild(token.overlay);
    }
    this.floorArena = '';
    this.mapDirty = true;
    this.drawMarkers();
    this.selected = null;
    this.lastState = null;
  }

  /** Free the round's visuals (tokens, bodies, pooled cues, the floor). */
  clearRound(): void {
    for (const token of this.tokenList) token.destroy();
    this.tokenList = [];
    this.tokens.fill(undefined);
    this.byUnit.fill(undefined);
    this.zones.clear();
    this.telegraphs.clear();
    this.projectiles.clear();
    this.fx.clear();
    this.limiter.reset();
    if (this.floor) {
      this.floor.destroy({ children: true });
      this.floor = null;
    }
    this.markerG.clear();
    for (const l of this.markerLabels) l.view.visible = false;
    this.ctx = null;
    this.kickoff = null;
    this.lastState = null;
  }

  // ---- per frame -------------------------------------------------------------------------------------------------

  draw(state: ArenaFrameState, frame: FrameInfo): void {
    const ctx = this.ctx;
    if (this.destroyed || !ctx) return;
    this.lastState = state;
    const env = this.worldEnv;

    this.byUnit.fill(undefined);
    for (const u of state.units) if (u.unit >= 0 && u.unit < MAX_UNITS) this.byUnit[u.unit] = u;

    this.updateMap(frame.nowMs);
    this.syncLayout();
    const map = this.current;
    const ppm = pxPerMetreOf(map);
    const squash = Math.abs(map.ax) > 1e-9 ? Math.abs(map.by / map.ax) : 1;
    env.ppm = ppm;
    env.squash = squash;
    env.units = state.units;
    env.tick = frame.tick;
    env.playing = frame.playing;
    env.nowMs = frame.nowMs;
    env.reducedMotion = this.reducedMotion;
    env.overlayScale = Math.max(0.6, Math.min(1.8, ppm / BASE_PX_PER_METRE)) * this.uiScale;

    this.ensureFloor(ppm);
    this.placeFloor();
    this.drawKickoff(map, frame.tick);

    this.zones.update(state.zones, env);
    this.telegraphs.update(state.telegraphs, env);
    this.fx.update(state.effects, env);
    this.projectiles.update(state.projectiles, env);

    // Tokens.
    const body = this.bodyFrame;
    body.tick = frame.tick;
    body.dtMs = frame.playing ? frame.dtMs : 0;
    body.speed = frame.speed;
    body.reducedMotion = this.reducedMotion;
    body.pxPerMetre = ppm;
    const f = this.tokenFrameScratch;
    f.tick = frame.tick;
    f.labels = this.labels;
    f.reducedMotion = this.reducedMotion;
    f.body = body;
    f.focusMax = this.focusMax();
    for (const u of state.units) {
      const token = this.tokens[u.unit];
      if (!token) continue;
      f.x = sx(map, u.x, u.y);
      f.y = sy(map, u.x, u.y);
      f.facing = screenAngle(map, u.facing);
      f.ring = this.ringOf(u.side);
      f.selected = this.selected === u.unit;
      f.flash = token.flashLevel(u, frame.tick, frame.playing, this.reducedMotion, this.limiter, frame.nowMs);
      this.selectPips(u, f);
      f.hardControl = f.hardControl || u.action === 'stunned' || u.action === 'asleep';
      f.cast = u.cast !== null && u.cast.endTick - u.cast.startTick >= TELEGRAPH_MIN_TICKS ? u.cast.progress : -1;
      token.update(u, f);
    }

    // Overtime vignette: a steady thin edge (04 §7), never pulsing.
    const want = state.overtime ? 1 : 0;
    const k = this.reducedMotion || frame.dtMs <= 0 ? 1 : Math.min(1, frame.dtMs / 360);
    this.overtimeAlpha += (want - this.overtimeAlpha) * k;
    this.vignette.visible = this.overtimeAlpha > 0.01;
    this.vignette.alpha = this.overtimeAlpha;
  }

  private readonly tokenFrameScratch: TokenFrame = {
    x: 0,
    y: 0,
    tick: 0,
    facing: 0,
    ring: 0,
    hardControl: false,
    flash: 0,
    selected: false,
    labels: 'off',
    reducedMotion: false,
    pips: this.pipBuf,
    pipCount: 0,
    cast: -1,
    focusMax: 100,
    body: this.bodyFrame,
  };

  /** The up-to-four highest-priority status cues of a unit (hard control first), and whether any greys the ring. */
  private selectPips(u: UnitRenderState, f: TokenFrame): void {
    const buf = this.pipBuf;
    let n = 0;
    let grey = false;
    for (const s of u.statuses) {
      const cue = this.opts.cues.status(s.status);
      if (cue.ring === 'grey') grey = true;
      // Insert by priority, highest first, keeping at most MAX_PIPS.
      let i = Math.min(n, MAX_PIPS);
      while (i > 0 && buf[i - 1]!.priority < cue.priority) {
        if (i < MAX_PIPS) buf[i] = buf[i - 1]!;
        i--;
      }
      if (i < MAX_PIPS) {
        buf[i] = cue;
        if (n < MAX_PIPS) n++;
      }
    }
    f.pipCount = n;
    f.hardControl = grey;
  }

  private focusMax(): number {
    const combat = (this.opts.content as { combat?: { focus?: { max?: number } } }).combat;
    return combat?.focus?.max ?? 100;
  }

  // ---- camera ----------------------------------------------------------------------------------------------------

  private updateMap(nowMs: number): void {
    const cam = this.camera;
    const follow = cam.follow !== null && cam.zoom > 1 ? this.byUnit[cam.follow] : undefined;
    if (follow || this.mapDirty) {
      this.mapDirty = false;
      const tf = this.opts.viewTransform(cam, this.viewport, this.arena, follow ? { x: follow.x, y: follow.y } : null);
      this.target = affineOf(tf);
    }
    if (this.easing && this.from) {
      const dur = Math.max(1, cam.easeMs);
      const t = Math.min(1, Math.max(0, (nowMs - this.easeStart) / dur));
      const eased = t * t * (3 - 2 * t);
      blendAffine(this.from, this.target, eased, this.current);
      if (t >= 1) {
        this.easing = false;
        this.from = null;
      }
    } else {
      Object.assign(this.current, this.target);
    }
  }

  // ---- floor and markers -----------------------------------------------------------------------------------------

  private ensureFloor(ppm: number): void {
    const arenaKey = `${this.arena.width}x${this.arena.height}`;
    const settled = !this.easing;
    const changed = this.floor === null || this.floorArena !== arenaKey || (settled && Math.abs(ppm - this.floorPpm) > 0.01);
    if (!changed) return;
    this.floor?.destroy({ children: true });
    this.floor = this.opts.skin.createFloor(this.arena, ppm);
    this.floorPpm = ppm;
    this.floorArena = arenaKey;
    this.floorLayer.addChild(this.floor);
  }

  private placeFloor(): void {
    const floor = this.floor;
    if (!floor) return;
    const m = this.current;
    const unit = this.floorPpm / 100;
    floor.position.set(m.ox, m.oy);
    floor.scale.set(m.ax / unit, m.by / unit);
  }

  private drawMarkers(): void {
    this.markerG.clear();
    const k = this.kickoff;
    if (!k) return;
    // Faint row lines through each side's front and back rows, labelled only at kickoff (04 §4).
    const sums = new Map<string, { sum: number; n: number }>();
    for (const u of k.units) {
      const key = `${u.side}|${u.row}`;
      const s = sums.get(key) ?? { sum: 0, n: 0 };
      s.sum += u.x;
      s.n++;
      sums.set(key, s);
    }
    this.markerXs.length = 0;
    for (const [key, s] of sums) {
      const [side, row] = key.split('|');
      this.markerXs.push({ x: s.sum / s.n, side: Number(side) as 0 | 1, row: row as 'front' | 'back' });
    }
    this.markerLabelCount = this.markerXs.length;
  }
  private readonly markerXs: { x: number; side: 0 | 1; row: 'front' | 'back' }[] = [];
  private markerLabelCount = 0;

  private drawKickoff(map: AffineMap, tick: number): void {
    const visible = this.markerLabelCount > 0 && tick < KICKOFF_TICKS + KICKOFF_FADE_TICKS;
    this.markers.visible = visible;
    if (!visible) return;
    const alpha = tick <= KICKOFF_TICKS ? 1 : Math.max(0, 1 - (tick - KICKOFF_TICKS) / KICKOFF_FADE_TICKS);
    const g = this.markerG;
    g.clear();
    const y0 = sy(map, 0, 0);
    const y1 = sy(map, 0, this.arena.height);
    while (this.markerLabels.length < this.markerLabelCount) {
      const l = this.opts.text.create('small');
      l.setAnchor(0.5, 0);
      this.markers.addChild(l.view);
      this.markerLabels.push(l);
    }
    this.markerXs.forEach((m, i) => {
      const x = sx(map, m.x, 0);
      g.moveTo(x, y0).lineTo(x, y1).stroke({ width: 1.5, color: this.palette.text, alpha: 0.16 * alpha });
      const l = this.markerLabels[i]!;
      l.setText(m.row === 'front' ? 'Front row' : 'Back row');
      l.setTint(this.palette.textMuted);
      l.view.position.set(x, y0 + 6);
      l.view.alpha = alpha * 0.9;
      l.view.visible = true;
    });
  }

  private drawVignette(): void {
    const { width, height } = this.viewport;
    this.vignette.clear().rect(0, 0, width, height).stroke({ width: 8, color: this.palette.warn, alpha: 0.35, alignment: 1 });
  }

  // ---- colours and layout ----------------------------------------------------------------------------------------

  /** The ring colour a side is drawn with now (after any theme remap). */
  ringColor(side: 0 | 1): number {
    return this.ringOf(side);
  }

  private ringOf(side: 0 | 1): number {
    const ctx = this.ctx;
    if (!ctx) return this.palette.text;
    if (this.ringRemap && ctx.playerSide !== null) return side === ctx.playerSide ? this.palette.sideUs : this.palette.sideThem;
    return ctx.sides[side].colors.ring;
  }

  private tokenEnv(): TokenEnv {
    const ppm = pxPerMetreOf(this.current) || BASE_PX_PER_METRE;
    return {
      palette: this.palette,
      chrome: this.chrome,
      text: this.opts.text,
      pxPerMetre: ppm,
      uiScale: this.uiScale,
      overlayScale: Math.max(0.6, Math.min(1.8, ppm / BASE_PX_PER_METRE)) * this.uiScale,
    };
  }

  /** Redraw static token geometry for the current palette, zoom and interface scale. */
  relayoutTokens(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const env = this.tokenEnv();
    this.layoutPpm = env.pxPerMetre;
    for (const token of this.tokenList) token.layout(env, ctx.sides[token.info.side].colors);
  }
  private layoutPpm = 0;

  /** Called each frame by the viewer when the zoom changed enough to redraw token shapes. */
  syncLayout(): void {
    const ppm = pxPerMetreOf(this.current);
    if (this.ctx && !this.easing && Math.abs(ppm - this.layoutPpm) > 0.01) this.relayoutTokens();
  }

  // ---- queries ---------------------------------------------------------------------------------------------------

  /** The unit under a canvas point, or null. Standing units win over downed ones; the nearest wins. */
  hitTest(px: number, py: number): UnitIndex | null {
    if (!this.lastState) return null;
    const w = toWorld(this.current, px, py);
    if (!w) return null;
    const reach = 50 + 25;
    let best: UnitIndex | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const u of this.lastState.units) {
      const d = Math.hypot(u.x - w.x, u.y - w.y);
      if (d > reach) continue;
      const score = d + (u.standing ? 0 : 1000);
      if (score < bestScore) {
        bestScore = score;
        best = u.unit;
      }
    }
    return best;
  }

  /** The current screen position of a unit's token (tests, focus rings). */
  tokenPosition(unit: UnitIndex): { x: number; y: number } | null {
    const t = this.tokens[unit];
    return t ? { x: t.screenX, y: t.screenY } : null;
  }

  get tokenCount(): number {
    return this.tokenList.length;
  }

  /** Pool sizes (live, created) for the leak checks. */
  poolStats(): { zones: number; telegraphs: number; projectiles: number; effects: number; effectsCreated: number } {
    return { zones: this.zones.liveCount, telegraphs: this.telegraphs.liveCount, projectiles: this.projectiles.liveCount, effects: this.fx.liveCount, effectsCreated: this.fx.created };
  }

  /** The token of a unit (tests). */
  tokenOf(unit: UnitIndex): Token | undefined {
    return this.tokens[unit];
  }

  /** The unit info the scene was built for. */
  unitInfo(unit: UnitIndex): ArenaUnitInfo | undefined {
    return this.ctx?.units.find((u) => u.unit === unit);
  }

  sideColors(side: 0 | 1): TeamColors | null {
    return this.ctx ? this.ctx.sides[side].colors : null;
  }

  /** Release everything. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearRound();
    this.zones.destroy();
    this.telegraphs.destroy();
    this.projectiles.destroy();
    this.fx.destroy();
    for (const l of this.markerLabels) l.view.destroy();
    this.markerLabels.length = 0;
    this.root.destroy({ children: true });
    this.opts.text.destroy();
  }

}

/** Count of display objects under `root`, itself included (leak checks). */
export function countDisplayObjects(root: Container): number {
  let n = 1;
  for (const child of root.children) n += child instanceof Container ? countDisplayObjects(child) : 1;
  return n;
}
