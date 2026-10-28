/**
 * The arena scene (05-technical-m2 §A5, A18): floor (skin), row markers, zones, telegraphs, ground cues, bodies
 * with their tokens (depth-sorted by screen y), projectiles and high cues, the bars/pips/badges overlay, and the
 * overtime edge. It draws an `ArenaFrameState` and nothing else: no simulation, no randomness, no game state.
 * Visuals are reused by unit index and effect id; everything is released on `clearRound` and `destroy`.
 *
 * Layer order, bottom to top (the designer's order, arena-notes.md §1):
 *   floor · row markers · zones · telegraphs · low cues · bodies (ring, wedge, glyph plate) · projectiles ·
 *   high cues (impacts, numbers, callouts) · overlay (bars, pips, badges: never hidden by a body) · overtime edge
 *
 * Every colour, alpha, size and duration comes from the palette and `palette.metrics`. The scene works in CSS px;
 * the renderer's resolution does the rest.
 */
import { Container, Graphics } from 'pixi.js';
import type { ContentDB } from '../../../core/content';
import type { UnitIndex } from '../../../core/model';
import { TELEGRAPH_MIN_TICKS } from '../../cues';
import type { viewTransform as viewTransformFn } from '../../camera';
import type { ArenaFrameState, ArenaPalette, ArenaRoundContext, ArenaUnitInfo, CameraConfig, CueTable, StatusCue, UnitRenderState } from '../../types';
import { DESTROY_ALL } from '../destroy';
import { FlashLimiter } from '../flash-limiter';
import type { ArenaSkin, BodyFrame } from '../skin';
import { affineOf, blendAffine, pxPerMetreOf, screenAngle, sx, sy, toWorld, type AffineMap } from './affine';
import { Chip } from './chip';
import { EffectLayer, type FxEnv } from './effects';
import type { TextFactory } from './text';
import { Token, type TokenEnv, type TokenFrame } from './token';
import { ProjectileLayer, TelegraphLayer, ZoneLayer } from './world';

export interface SceneOptions {
  skin: ArenaSkin;
  content: ContentDB;
  cues: CueTable;
  palette: ArenaPalette;
  text: TextFactory;
  viewTransform: typeof viewTransformFn;
  camera: CameraConfig;
  reducedMotion: boolean;
  /** Flashes a second per fighter; null follows palette.metrics.flashLimitPerSecond. */
  flashLimitPerSecond: number | null;
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

/** The row labels show for 2 s from kickoff, then fade over 1 s (04 §4: labelled only at kickoff). */
const KICKOFF_TICKS = 40;
const KICKOFF_FADE_TICKS = 20;
/** The overtime edge fades in over this long (design review A18, decision 6); instant under reduced motion. */
const OVERTIME_FADE_MS = 360;
const BASE_PX_PER_METRE = 52;
const MAX_PIPS = 4;
const MAX_UNITS = 16;
/** A focus bar whose maximum the content does not give is read against this. */
const DEFAULT_FOCUS_MAX = 100;

export class ArenaScene {
  readonly root = new Container();
  private readonly floorLayer = new Container();
  private readonly markers = new Container();
  private readonly zones = new ZoneLayer();
  private readonly telegraphs: TelegraphLayer;
  private readonly fx = new EffectLayer();
  private readonly bodies = new Container();
  private readonly projectiles = new ProjectileLayer();
  private readonly overlays = new Container();
  private readonly overtimeEdge = new Graphics();
  private readonly markerG = new Graphics();
  private readonly markerChips: Chip[] = [];

  private palette: ArenaPalette;
  private camera: CameraConfig;
  private reducedMotion: boolean;
  private labels: 'off' | 'selected' | 'all' = 'off';
  private selected: UnitIndex | null = null;
  private ringRemap = false;
  /** Bumped whenever palette or layout changes, so cached chip drawings refresh. */
  private version = 0;

  private ctx: ArenaRoundContext | null = null;
  private arena = { width: 3200, height: 1800 };
  private readonly tokens: (Token | undefined)[] = new Array<Token | undefined>(MAX_UNITS).fill(undefined);
  private tokenList: Token[] = [];
  private floor: Container | null = null;
  private floorPpm = 0;
  private floorArena = '';
  private kickoff: KickoffInfo | null = null;
  private readonly markerXs: { x: number; side: 0 | 1; row: 'front' | 'back' }[] = [];
  private readonly dashXs: number[] = [];
  private dashY0 = Number.NaN;
  private dashY1 = Number.NaN;
  private dashColor = -1;

  private viewport = { width: 1280, height: 720 };
  private target: AffineMap = { ox: 0, oy: 0, ax: 1, ay: 0, bx: 0, by: 1 };
  private readonly current: AffineMap = { ox: 0, oy: 0, ax: 1, ay: 0, bx: 0, by: 1 };
  private from: AffineMap | null = null;
  private easeStart = 0;
  private easing = false;
  private mapDirty = true;
  private layoutPpm = 0;

  private readonly limiter: FlashLimiter;
  private readonly byUnit: (UnitRenderState | undefined)[] = new Array<UnitRenderState | undefined>(MAX_UNITS).fill(undefined);
  private readonly infoByUnit: (ArenaUnitInfo | undefined)[] = new Array<ArenaUnitInfo | undefined>(MAX_UNITS).fill(undefined);
  private readonly pipBuf: StatusCue[] = [];
  private lastState: ArenaFrameState | null = null;
  private readonly bodyFrame: BodyFrame = { tick: 0, dtMs: 0, speed: 1, reducedMotion: false, pxPerMetre: BASE_PX_PER_METRE };
  private destroyed = false;
  private overtimeAlpha = 0;
  private edgeDrawn = '';
  /** Reused per frame. */
  private readonly env: FxEnv;
  private readonly frameScratch: TokenFrame = {
    x: 0,
    y: 0,
    tick: 0,
    facing: 0,
    ring: 0,
    hardControl: false,
    flash: 0,
    selected: false,
    reducedMotion: false,
    labels: 'off',
    pips: this.pipBuf,
    pipCount: 0,
    pipMore: 0,
    cast: -1,
    castName: '',
    focusMax: DEFAULT_FOCUS_MAX,
    body: this.bodyFrame,
  };

  constructor(private readonly opts: SceneOptions) {
    this.palette = opts.palette;
    this.camera = opts.camera;
    this.reducedMotion = opts.reducedMotion;
    this.limiter = new FlashLimiter(opts.flashLimitPerSecond ?? opts.palette.metrics.flashLimitPerSecond);
    this.telegraphs = new TelegraphLayer(opts.text);
    opts.text.configure(opts.palette);
    this.root.eventMode = 'none';
    this.bodies.sortableChildren = true;
    for (const layer of [this.floorLayer, this.markers, this.zones.root, this.telegraphs.root, this.fx.low, this.bodies, this.projectiles.root, this.fx.high, this.overlays, this.overtimeEdge]) layer.eventMode = 'none';
    this.markers.addChild(this.markerG);
    this.root.addChild(this.floorLayer, this.markers, this.zones.root, this.telegraphs.root, this.fx.low, this.bodies, this.projectiles.root, this.fx.high, this.overlays, this.overtimeEdge);
    this.overtimeEdge.visible = false;
    this.env = {
      map: this.current,
      ppm: BASE_PX_PER_METRE,
      squash: 1,
      palette: this.palette,
      version: this.version,
      cues: opts.cues,
      content: opts.content,
      text: opts.text,
      byUnit: this.byUnit,
      infoOf: (unit) => this.infoByUnit[unit],
      zones: [],
      tick: 0,
      reducedMotion: this.reducedMotion,
      playing: false,
      nowMs: 0,
      sideColor: (side) => this.ringOf(side),
      ringStyle: (side) => this.ctx?.sides[side].colors.ringStyle ?? (side === 0 ? 'solid' : 'double'),
      limiter: this.limiter,
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
  }

  setCamera(camera: CameraConfig, nowMs: number): void {
    // A camera change eases from where the view is now (04 §4; none under reduced motion).
    this.from = { ...this.current };
    this.easeStart = nowMs;
    this.easing = !this.reducedMotion && camera.easeMs > 0;
    this.camera = camera;
    this.mapDirty = true;
  }

  /** The palette changed (theme, motion or interface scale: the host re-read the tokens). */
  setPalette(palette: ArenaPalette): void {
    const themeChanged = palette.theme !== this.palette.theme;
    this.palette = palette;
    this.env.palette = palette;
    this.version++;
    this.env.version = this.version;
    // The brass and steel side rings are theme tokens: after a theme switch they follow the palette (a match
    // between other clubs keeps the clubs' colours).
    if (themeChanged && this.ctx && this.ctx.playerSide !== null) this.ringRemap = true;
    this.opts.text.configure(palette);
    this.opts.skin.setPalette(palette);
    this.floorArena = '';
    this.edgeDrawn = '';
    this.limiter.setLimit(this.opts.flashLimitPerSecond ?? palette.metrics.flashLimitPerSecond);
    this.relayoutTokens();
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    this.env.reducedMotion = on;
    if (on) {
      this.easing = false;
      this.from = null;
    }
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
    this.infoByUnit.fill(undefined);
    for (const info of ctx.units) if (info.unit >= 0 && info.unit < MAX_UNITS) this.infoByUnit[info.unit] = info;
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
    this.computeMarkers();
    this.selected = null;
    this.lastState = null;
  }

  /** Free the round's visuals (tokens, bodies, pooled cues, the floor). Downed bodies go with the round (next kickoff). */
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
      this.floor.destroy(DESTROY_ALL);
      this.floor = null;
    }
    this.markerG.clear();
    this.dashXs.length = 0;
    for (const chip of this.markerChips) chip.view.visible = false;
    this.markerXs.length = 0;
    this.ctx = null;
    this.kickoff = null;
    this.lastState = null;
  }

  // ---- per frame -------------------------------------------------------------------------------------------------

  draw(state: ArenaFrameState, frame: FrameInfo): void {
    const ctx = this.ctx;
    if (this.destroyed || !ctx) return;
    this.lastState = state;
    const env = this.env;

    this.byUnit.fill(undefined);
    for (const u of state.units) if (u.unit >= 0 && u.unit < MAX_UNITS) this.byUnit[u.unit] = u;

    this.updateMap(frame.nowMs);
    const map = this.current;
    const ppm = pxPerMetreOf(map);
    env.ppm = ppm;
    env.squash = Math.abs(map.ax) > 1e-9 ? Math.abs(map.by / map.ax) : 1;
    env.zones = state.zones;
    env.tick = frame.tick;
    env.playing = frame.playing;
    env.nowMs = frame.nowMs;
    env.reducedMotion = this.reducedMotion;
    if (!this.easing && Math.abs(ppm - this.layoutPpm) > 0.01) this.relayoutTokens();

    this.ensureFloor(ppm);
    this.placeFloor();
    this.drawMarkers(map, frame.tick);

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
    const f = this.frameScratch;
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
      const casting = u.cast !== null && u.cast.endTick - u.cast.startTick >= TELEGRAPH_MIN_TICKS;
      f.cast = casting ? u.cast!.progress : -1;
      f.castName = casting ? (this.opts.content.abilities.get(u.cast!.ability)?.name ?? '') : '';
      token.update(u, f);
    }

    this.updateOvertimeEdge(state.overtime, frame.dtMs, map);
  }

  /** The up-to-four highest-priority status pips of a unit (hard control first), the overflow, and the ring grey. */
  private selectPips(u: UnitRenderState, f: TokenFrame): void {
    const buf = this.pipBuf;
    let n = 0;
    let total = 0;
    let grey = false;
    for (const s of u.statuses) {
      const cue = this.opts.cues.status(s.status);
      if (cue.ring === 'grey') grey = true;
      if (cue.pip === null) continue; // the shield category has no pip: its bar segment shows it
      total++;
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
    f.pipMore = Math.max(0, total - MAX_PIPS);
    f.hardControl = grey;
  }

  private focusMax(): number {
    const combat = (this.opts.content as { combat?: { focus?: { max?: number } } }).combat;
    return combat?.focus?.max ?? DEFAULT_FOCUS_MAX;
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

  // ---- floor, row markers, overtime edge -------------------------------------------------------------------------

  private ensureFloor(ppm: number): void {
    const arenaKey = `${this.arena.width}x${this.arena.height}`;
    const settled = !this.easing;
    const changed = this.floor === null || this.floorArena !== arenaKey || (settled && Math.abs(ppm - this.floorPpm) > 0.01);
    if (!changed) return;
    this.floor?.destroy(DESTROY_ALL);
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

  private computeMarkers(): void {
    this.markerXs.length = 0;
    const k = this.kickoff;
    if (!k) return;
    // The four row lines: through each side's front and back rows (mean x of that group at kickoff).
    const sums = new Map<string, { sum: number; n: number; side: 0 | 1; row: 'front' | 'back' }>();
    for (const u of k.units) {
      const key = `${u.side}|${u.row}`;
      const s = sums.get(key) ?? { sum: 0, n: 0, side: u.side, row: u.row };
      s.sum += u.x;
      s.n++;
      sums.set(key, s);
    }
    for (const s of sums.values()) this.markerXs.push({ x: s.sum / s.n, side: s.side, row: s.row });
  }

  /** Faint dashed row lines always; their labels only at kickoff (04 §4). */
  private drawMarkers(map: AffineMap, tick: number): void {
    const n = this.markerXs.length;
    this.markers.visible = n > 0;
    if (n === 0) return;
    const p = this.palette;
    const g = this.markerG;
    const y0 = sy(map, 0, 0);
    const y1 = sy(map, 0, this.arena.height);
    // The ~280 dash segments are rebuilt only when the lines moved (zoom, resize, a new round) or the colour changed.
    let moved = this.dashY0 !== y0 || this.dashY1 !== y1 || this.dashColor !== p.line || this.dashXs.length !== n;
    for (let i = 0; i < n && !moved; i++) if (this.dashXs[i] !== sx(map, this.markerXs[i]!.x, 0)) moved = true;
    if (moved) {
      this.dashY0 = y0;
      this.dashY1 = y1;
      this.dashColor = p.line;
      this.dashXs.length = 0;
      g.clear();
      const dash = 6;
      for (const m of this.markerXs) {
        const x = sx(map, m.x, 0);
        this.dashXs.push(x);
        for (let y = y0; y < y1; y += dash * 2) g.moveTo(x, y).lineTo(x, Math.min(y + dash, y1));
      }
      g.stroke({ width: 1, color: p.line });
    }
    const labelAlpha = tick <= KICKOFF_TICKS ? 1 : Math.max(0, 1 - (tick - KICKOFF_TICKS) / KICKOFF_FADE_TICKS);
    const rem = p.metrics.pipSizePx;
    while (this.markerChips.length < n) {
      const chip = new Chip(this.opts.text, 'label');
      this.markers.addChild(chip.view);
      this.markerChips.push(chip);
    }
    this.markerXs.forEach((m, i) => {
      const chip = this.markerChips[i]!;
      chip.view.visible = labelAlpha > 0;
      if (labelAlpha <= 0) return;
      const h = p.metrics.labelSizePx * 1.35;
      const w = chip.set(m.row === 'front' ? 'Front row' : 'Back row', this.env, 0, rem * 0.4, h);
      chip.view.position.set(sx(map, m.x, 0) - w / 2, y0 + rem * 0.4);
      chip.view.alpha = labelAlpha * 0.85;
    });
  }

  /** Overtime (04 §7, A18): a static thin amber line on the inner edge of the wall; fades in over 360 ms, never pulses. */
  private updateOvertimeEdge(overtime: boolean, dtMs: number, map: AffineMap): void {
    const want = overtime ? 1 : 0;
    // Linear over 360 ms; instant under reduced motion and while paused or seeking.
    const step = this.reducedMotion || dtMs <= 0 ? 1 : dtMs / OVERTIME_FADE_MS;
    this.overtimeAlpha = want > this.overtimeAlpha ? Math.min(want, this.overtimeAlpha + step) : Math.max(want, this.overtimeAlpha - step);
    this.overtimeEdge.visible = this.overtimeAlpha > 0.01;
    this.overtimeEdge.alpha = this.overtimeAlpha;
    if (!this.overtimeEdge.visible) return;
    const x0 = sx(map, 0, 0);
    const y0 = sy(map, 0, 0);
    const x1 = sx(map, this.arena.width, this.arena.height);
    const y1 = sy(map, this.arena.width, this.arena.height);
    const key = `${x0.toFixed(1)}|${y0.toFixed(1)}|${x1.toFixed(1)}|${y1.toFixed(1)}|${this.palette.warn}|${this.palette.metrics.ringLinePx}`;
    if (key === this.edgeDrawn) return;
    this.edgeDrawn = key;
    this.overtimeEdge.clear().rect(x0, y0, x1 - x0, y1 - y0).stroke({ width: this.palette.metrics.ringLinePx, color: this.palette.warn, alignment: 1 });
  }

  // ---- colours and layout ----------------------------------------------------------------------------------------

  /** The ring colour a side is drawn with now (after any theme remap). */
  ringColor(side: 0 | 1): number {
    return this.ringOf(side);
  }

  private ringOf(side: 0 | 1): number {
    const ctx = this.ctx;
    if (!ctx) return this.palette.ink;
    if (this.ringRemap && ctx.playerSide !== null) return side === ctx.playerSide ? this.palette.sideUs : this.palette.sideThem;
    return ctx.sides[side].colors.ring;
  }

  private tokenEnv(): TokenEnv {
    return { palette: this.palette, text: this.opts.text, pxPerMetre: pxPerMetreOf(this.current) || BASE_PX_PER_METRE, version: this.version };
  }

  /** Redraw static token geometry for the current palette and zoom. */
  relayoutTokens(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.version++;
    this.env.version = this.version;
    const env = this.tokenEnv();
    this.layoutPpm = env.pxPerMetre;
    for (const token of this.tokenList) token.layout(env, ctx.sides[token.info.side].colors);
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

  /** Release everything. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearRound();
    this.zones.destroy();
    this.telegraphs.destroy();
    this.projectiles.destroy();
    this.fx.destroy();
    for (const chip of this.markerChips) chip.dispose();
    this.markerChips.length = 0;
    this.root.destroy(DESTROY_ALL);
    this.opts.text.destroy();
  }
}

/** Count of display objects under `root`, itself included (leak checks). */
export function countDisplayObjects(root: Container): number {
  let n = 1;
  for (const child of root.children) n += child instanceof Container ? countDisplayObjects(child) : 1;
  return n;
}
