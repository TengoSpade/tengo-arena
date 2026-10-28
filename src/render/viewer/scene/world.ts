/**
 * The arena's world layers: zones, cast telegraphs and projectiles (04 §7, A5 "Ability cues"; components.css §25.4).
 * Each is a pool of visuals keyed by the state's own ids (zone id, caster unit, projectile id), reused across frames
 * and released when the key goes away. Static geometry is redrawn only when its inputs change; per frame only
 * transforms, scale (telegraph progress) and alpha move.
 *
 * Ground marks (zones, telegraphs) are drawn in px around a screen anchor and squashed vertically by the
 * projection's squash (1 for top-down), so an oblique camera turns circles into ellipses without a code path.
 * Every colour and alpha comes from the palette: zones and telegraphs take the owner's or caster's ring colour (and
 * the telegraph its ring style: ours solid, theirs double), progress takes `palette.telegraph`.
 */
import { Container, Graphics } from 'pixi.js';
import type { ContentDB } from '../../../core/content';
import type { ArenaPalette, ArenaUnitInfo, CueTable, ProjectileRenderState, TelegraphRenderState, UnitRenderState, ZoneRenderState } from '../../types';
import { DESTROY_ALL } from '../destroy';
import { KeyedPool } from '../pool';
import { toneColor } from '../palette';
import { sx, sy, type AffineMap } from './affine';
import { Chip } from './chip';
import type { TextFactory } from './text';

/** What every world layer needs for a frame. Filled in by the scene; never allocated per frame. */
export interface WorldEnv {
  map: AffineMap;
  /** CSS px per metre along x. */
  ppm: number;
  /** Vertical squash of the ground plane (1 for top-down). */
  squash: number;
  palette: ArenaPalette;
  /** Bumped whenever the palette or layout changes (cached chip drawings refresh). */
  version: number;
  cues: CueTable;
  content: ContentDB;
  text: TextFactory;
  /** The unit states by unit index (never by array position). */
  byUnit: readonly (UnitRenderState | undefined)[];
  /** Who a unit is (the round context), by unit index. */
  infoOf(unit: number): ArenaUnitInfo | undefined;
  /** The zones in play (a zone-trigger pulse reaches to its zone's edge). */
  zones: readonly ZoneRenderState[];
  tick: number;
  reducedMotion: boolean;
  playing: boolean;
  nowMs: number;
  /** Colour of a side's ring (the viewer-resolved side colour). */
  sideColor(side: 0 | 1): number;
  /** The ring style of a side: ours solid, theirs double (the colour-free cue). */
  ringStyle(side: 0 | 1): 'solid' | 'double';
}

const cm = (env: WorldEnv, value: number): number => (value / 100) * env.ppm;

/** A ground-plane mark: a container at a screen anchor with the projection's squash, holding one Graphics. */
class GroundMark {
  readonly root = new Container();
  readonly g = new Graphics();
  /** Free-form key of what the geometry was last drawn for. */
  drawn = '';
  constructor() {
    this.root.eventMode = 'none';
    this.g.eventMode = 'none';
    this.root.addChild(this.g);
    this.root.visible = false;
  }
  destroy(): void {
    this.root.destroy(DESTROY_ALL);
  }
}

// ---- zones -------------------------------------------------------------------------------------------------------

/** Ticks a zone fades in and out over (fade-out is the "fade on expiry" of 05 §A5; none under reduced motion). */
const ZONE_FADE_TICKS = 6;

export class ZoneLayer {
  readonly root = new Container();
  private readonly pool = new KeyedPool<GroundMark>(
    () => {
      const m = new GroundMark();
      this.root.addChild(m.root);
      return m;
    },
    (m) => {
      m.drawn = '';
    },
    (m) => {
      m.root.visible = false;
    },
    (m) => m.destroy(),
  );

  constructor() {
    this.root.eventMode = 'none';
  }

  get liveCount(): number {
    return this.pool.liveCount;
  }
  get created(): number {
    return this.pool.created;
  }

  update(zones: readonly ZoneRenderState[], env: WorldEnv): void {
    const p = env.palette;
    this.pool.begin();
    for (const z of zones) {
      const m = this.pool.get(z.id);
      const r = cm(env, z.radius);
      const color = env.sideColor(z.side);
      const key = `${r.toFixed(1)}|${color}|${p.metrics.zoneAlpha}`;
      if (m.drawn !== key) {
        m.drawn = key;
        // A floor disc in the owner's ring colour at the zone alpha with a thin inner edge, so it never reads as a body.
        m.g.clear().circle(0, 0, r).fill({ color, alpha: p.metrics.zoneAlpha }).circle(0, 0, r - 0.5).stroke({ width: 1, color, alpha: 0.55 });
      }
      m.root.visible = true;
      m.root.position.set(sx(env.map, z.x, z.y), sy(env.map, z.x, z.y));
      m.root.scale.set(1, env.squash);
      let alpha = 1;
      if (!env.reducedMotion) {
        alpha = Math.min(1, (env.tick - z.spawnTick + 1) / ZONE_FADE_TICKS);
        if (z.endsTick !== null) alpha = Math.min(alpha, Math.max(0, (z.endsTick - env.tick) / ZONE_FADE_TICKS));
      }
      m.root.alpha = Math.max(0, alpha);
    }
    this.pool.end();
  }

  clear(): void {
    this.pool.releaseAll();
  }
  destroy(): void {
    this.pool.clear();
    this.root.destroy(DESTROY_ALL);
  }
}

// ---- telegraphs --------------------------------------------------------------------------------------------------

class TelegraphMark {
  readonly root = new Container();
  readonly area = new Container();
  readonly outline = new Graphics();
  readonly inner = new Graphics();
  readonly name: Chip;
  drawn = '';
  constructor(text: TextFactory) {
    this.root.eventMode = 'none';
    this.area.eventMode = 'none';
    this.name = new Chip(text, 'label');
    this.area.addChild(this.inner, this.outline);
    this.root.addChild(this.area, this.name.view);
    this.root.visible = false;
  }
  destroy(): void {
    this.name.dispose();
    this.root.destroy(DESTROY_ALL);
  }
}

export class TelegraphLayer {
  readonly root = new Container();
  private pool: KeyedPool<TelegraphMark> | null = null;

  constructor(private readonly text: TextFactory) {
    this.root.eventMode = 'none';
  }

  private ensurePool(): KeyedPool<TelegraphMark> {
    if (!this.pool) {
      this.pool = new KeyedPool<TelegraphMark>(
        () => {
          const m = new TelegraphMark(this.text);
          this.root.addChild(m.root);
          return m;
        },
        (m) => {
          m.drawn = '';
        },
        (m) => {
          m.root.visible = false;
        },
        (m) => m.destroy(),
      );
    }
    return this.pool;
  }

  get liveCount(): number {
    return this.pool?.liveCount ?? 0;
  }

  update(list: readonly TelegraphRenderState[], env: WorldEnv): void {
    const pool = this.ensurePool();
    const p = env.palette;
    pool.begin();
    for (const t of list) {
      const m = pool.get(t.caster);
      const side = env.byUnit[t.caster]?.side ?? 0;
      const color = env.sideColor(side);
      const double = env.ringStyle(side) === 'double';
      const size = t.shape === 'single' ? Math.max(cm(env, t.size), env.ppm * 0.7) : cm(env, t.size);
      const spread = t.shape === 'line' ? cm(env, t.spread) : t.spread;
      const key = `${t.shape}|${size.toFixed(1)}|${spread.toFixed(3)}|${color}|${double}|${env.version}`;
      if (m.drawn !== key) {
        m.drawn = key;
        drawTelegraph(m, t.shape, size, spread, color, double, p);
      }
      m.root.visible = true;
      m.root.position.set(sx(env.map, t.x, t.y), sy(env.map, t.x, t.y));
      m.area.scale.set(1, env.squash);
      // Progress is information, so it stays under reduced motion; only the direction is sampled.
      const prog = Math.max(0, Math.min(1, t.progress));
      m.outline.rotation = t.direction;
      m.inner.rotation = t.direction;
      if (t.shape === 'line') m.inner.scale.set(prog, 1);
      else if (t.shape === 'single') m.inner.scale.set(1);
      else m.inner.scale.set(prog);
      if (t.shape === 'single') drawSingleProgress(m, size, prog, p);
      // The ability's name on a plate chip under the area.
      const rem = p.metrics.pipSizePx;
      const name = env.content.abilities.get(t.ability)?.name ?? '';
      m.name.view.visible = name !== '';
      if (name !== '') {
        const h = p.metrics.labelSizePx * 1.35;
        const w = m.name.set(name, env, 0, rem * 0.4, h);
        const below = t.shape === 'circle' ? size * env.squash : env.ppm * 0.7;
        m.name.view.position.set(-w / 2, below + rem * 0.5);
      }
    }
    pool.end();
  }

  clear(): void {
    this.pool?.releaseAll();
  }
  destroy(): void {
    this.pool?.clear();
    this.root.destroy(DESTROY_ALL);
  }
}

function drawTelegraph(m: TelegraphMark, shape: TelegraphRenderState['shape'], size: number, spread: number, color: number, double: boolean, p: ArenaPalette): void {
  m.outline.clear();
  m.inner.clear();
  const fill = { color, alpha: p.metrics.telegraphFillAlpha } as const;
  const progress = { color: p.telegraph, alpha: p.metrics.telegraphProgressAlpha } as const;
  const edge = (g: Graphics, trace: (g: Graphics) => void): void => {
    // Ours: a 2 px edge. Theirs: two 2 px lines with a 2 px gap (a 6 px band with the middle taken back to the floor).
    trace(g);
    g.stroke({ width: double ? 6 : 2, color, alpha: p.metrics.telegraphEdgeAlpha });
    if (double) {
      trace(g);
      g.stroke({ width: 2, color: p.floor });
    }
  };
  switch (shape) {
    case 'circle':
      m.outline.circle(0, 0, size).fill(fill);
      edge(m.outline, (g) => g.circle(0, 0, size));
      m.inner.circle(0, 0, size).fill(progress);
      break;
    case 'cone': {
      const a = spread / 2;
      const trace = (g: Graphics): Graphics => g.moveTo(0, 0).arc(0, 0, size, -a, a).closePath();
      trace(m.outline).fill(fill);
      edge(m.outline, trace);
      trace(m.inner).fill(progress);
      break;
    }
    case 'line': {
      const half = Math.max(2, spread / 2);
      m.outline.rect(0, -half, size, half * 2).fill(fill);
      edge(m.outline, (g) => g.rect(0, -half, size, half * 2));
      m.inner.rect(0, -half, size, half * 2).fill(progress);
      break;
    }
    case 'single':
      // A target ring in the same edge style, 2 px; the progress arc is drawn per frame.
      m.outline.circle(0, 0, size).stroke({ width: 2, color, alpha: p.metrics.telegraphEdgeAlpha });
      break;
  }
}

function drawSingleProgress(m: TelegraphMark, radius: number, progress: number, p: ArenaPalette): void {
  m.inner.clear();
  if (progress <= 0) return;
  const end = -Math.PI / 2 + Math.PI * 2 * progress;
  m.inner.arc(0, 0, radius, -Math.PI / 2, end).stroke({ width: 4, color: p.telegraph, alpha: Math.min(1, p.metrics.telegraphProgressAlpha * 2.5) });
}

// ---- projectiles -------------------------------------------------------------------------------------------------

class ProjectileMark {
  readonly root = new Container();
  readonly head = new Graphics();
  lastX = Number.NaN;
  lastY = Number.NaN;
  heading = 0;
  drawn = '';
  constructor() {
    this.root.eventMode = 'none';
    this.head.eventMode = 'none';
    this.root.addChild(this.head);
    this.root.visible = false;
  }
  destroy(): void {
    this.root.destroy(DESTROY_ALL);
  }
}

export class ProjectileLayer {
  readonly root = new Container();
  private readonly pool = new KeyedPool<ProjectileMark>(
    () => {
      const m = new ProjectileMark();
      this.root.addChild(m.root);
      return m;
    },
    (m) => {
      m.drawn = '';
      m.lastX = Number.NaN;
    },
    (m) => {
      m.root.visible = false;
    },
    (m) => m.destroy(),
  );

  constructor() {
    this.root.eventMode = 'none';
  }

  get liveCount(): number {
    return this.pool.liveCount;
  }

  update(list: readonly ProjectileRenderState[], env: WorldEnv): void {
    const p = env.palette;
    const rem = p.metrics.pipSizePx;
    this.pool.begin();
    for (const proj of list) {
      const m = this.pool.get(proj.id);
      const cue = env.cues.ability(proj.ability);
      // At least 0.9 rem across (research A4.2: no tiny projectiles), an arrow pointing along its path.
      const w = Math.max(0.9 * rem, 0.5 * env.ppm, cue.projectile?.sizePx ?? 0);
      const h = Math.max(0.5 * rem, 0.26 * env.ppm);
      const color = toneColor(cue.tone, p);
      const key = `${w.toFixed(1)}|${h.toFixed(1)}|${color}|${p.plate}`;
      if (m.drawn !== key) {
        m.drawn = key;
        const pts = [-w / 2, -0.3 * h, 0.12 * w, -0.3 * h, 0.12 * w, -0.5 * h, 0.5 * w, 0, 0.12 * w, 0.5 * h, 0.12 * w, 0.3 * h, -w / 2, 0.3 * h];
        m.head.clear().poly(pts).fill({ color }).stroke({ width: 2, color: p.plate, alignment: 0, join: 'round' });
      }
      const x = sx(env.map, proj.x, proj.y);
      const y = sy(env.map, proj.x, proj.y);
      m.root.visible = true;
      m.root.position.set(x, y);
      if (Number.isNaN(m.lastX)) {
        // Before it has moved: point from the launcher at the target.
        const from = env.byUnit[proj.source];
        const to = proj.target !== null ? env.byUnit[proj.target] : undefined;
        if (from && to) m.heading = Math.atan2(sy(env.map, to.x, to.y) - sy(env.map, from.x, from.y), sx(env.map, to.x, to.y) - sx(env.map, from.x, from.y));
      } else if (Math.abs(x - m.lastX) > 0.5 || Math.abs(y - m.lastY) > 0.5) {
        m.heading = Math.atan2(y - m.lastY, x - m.lastX);
      }
      m.lastX = x;
      m.lastY = y;
      m.head.rotation = m.heading;
    }
    this.pool.end();
  }

  clear(): void {
    this.pool.releaseAll();
  }
  destroy(): void {
    this.pool.clear();
    this.root.destroy(DESTROY_ALL);
  }
}
