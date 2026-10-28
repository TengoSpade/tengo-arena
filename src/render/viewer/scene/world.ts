/**
 * The arena's world layers: zones, cast telegraphs and projectiles (04 §7, A5 "Ability cues"). Each is a pool of
 * visuals keyed by the state's own ids (zone id, caster unit, projectile id), reused across frames and released
 * when the key goes away. Static geometry is redrawn only when its inputs change; per frame only transforms,
 * scale (telegraph progress) and alpha move.
 *
 * Ground marks (zones, telegraphs, rings) are drawn in px around a screen anchor and squashed vertically by the
 * projection's squash (1 for top-down), so an oblique camera turns circles into ellipses without a code path.
 */
import { Container, Graphics } from 'pixi.js';
import type { AbilityCue, ArenaPalette, CueTable, ProjectileRenderState, TelegraphRenderState, UnitRenderState, ZoneRenderState } from '../../types';
import { KeyedPool } from '../pool';
import { mixColor, toneColor, type Chrome } from '../palette';
import { sx, sy, type AffineMap } from './affine';

/** What every world layer needs for a frame. Filled in by the scene; never allocated per frame. */
export interface WorldEnv {
  map: AffineMap;
  /** CSS px per metre along x. */
  ppm: number;
  /** Vertical squash of the ground plane (1 for top-down). */
  squash: number;
  palette: ArenaPalette;
  chrome: Chrome;
  cues: CueTable;
  units: readonly UnitRenderState[];
  tick: number;
  reducedMotion: boolean;
  playing: boolean;
  nowMs: number;
  /** Colour of a side's ring (the viewer-resolved side colour). */
  sideColor(side: 0 | 1): number;
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
    this.root.destroy({ children: true });
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
    this.pool.begin();
    for (const z of zones) {
      const m = this.pool.get(z.id);
      const r = cm(env, z.radius);
      const color = env.sideColor(z.side);
      const key = `${r.toFixed(1)}|${color}|${env.chrome.outline}`;
      if (m.drawn !== key) {
        m.drawn = key;
        // A floor disc in the owner's side colour at low alpha with a firm edge, so it never reads as a body.
        m.g.clear().circle(0, 0, r).fill({ color, alpha: 0.2 }).circle(0, 0, r).stroke({ width: 2, color, alpha: 0.85 });
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
    this.root.destroy({ children: true });
  }
}

// ---- telegraphs --------------------------------------------------------------------------------------------------

class TelegraphMark {
  readonly root = new Container();
  readonly outline = new Graphics();
  readonly inner = new Graphics();
  drawn = '';
  constructor() {
    this.root.eventMode = 'none';
    this.root.addChild(this.inner, this.outline);
    this.root.visible = false;
  }
  destroy(): void {
    this.root.destroy({ children: true });
  }
}

export class TelegraphLayer {
  readonly root = new Container();
  private readonly pool = new KeyedPool<TelegraphMark>(
    () => {
      const m = new TelegraphMark();
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

  update(list: readonly TelegraphRenderState[], env: WorldEnv): void {
    this.pool.begin();
    for (const t of list) {
      const m = this.pool.get(t.caster);
      const cue = env.cues.ability(t.ability);
      const color = toneColor(cue.tone, env.palette);
      const size = cm(env, t.size);
      const spread = t.shape === 'line' ? cm(env, t.spread) : t.spread;
      const key = `${t.shape}|${size.toFixed(1)}|${spread.toFixed(3)}|${color}`;
      if (m.drawn !== key) {
        m.drawn = key;
        drawTelegraph(m, t.shape, size, spread, color, env);
      }
      m.root.visible = true;
      m.root.position.set(sx(env.map, t.x, t.y), sy(env.map, t.x, t.y));
      m.root.scale.set(1, env.squash);
      const p = Math.max(0, Math.min(1, t.progress));
      // Progress is information, so it stays under reduced motion; only the direction is sampled.
      m.outline.rotation = t.direction;
      m.inner.rotation = t.direction;
      if (t.shape === 'line') m.inner.scale.set(p, 1);
      else if (t.shape === 'single') m.inner.scale.set(1);
      else m.inner.scale.set(p);
      if (t.shape === 'single') drawSingleProgress(m, size, p, color, env);
    }
    this.pool.end();
  }

  clear(): void {
    this.pool.releaseAll();
  }
  destroy(): void {
    this.pool.clear();
    this.root.destroy({ children: true });
  }
}

function drawTelegraph(m: TelegraphMark, shape: TelegraphRenderState['shape'], size: number, spread: number, color: number, env: WorldEnv): void {
  const edge = { width: 2, color, alpha: 0.9 } as const;
  const dark = { width: 4.5, color: env.chrome.outline, alpha: 0.5 } as const;
  m.outline.clear();
  m.inner.clear();
  switch (shape) {
    case 'circle':
      m.outline.circle(0, 0, size).fill({ color, alpha: 0.1 }).circle(0, 0, size).stroke(dark).circle(0, 0, size).stroke(edge);
      m.inner.circle(0, 0, size).fill({ color, alpha: 0.28 });
      break;
    case 'cone': {
      const a = spread / 2;
      m.outline.moveTo(0, 0).arc(0, 0, size, -a, a).closePath().fill({ color, alpha: 0.1 });
      m.outline.moveTo(0, 0).arc(0, 0, size, -a, a).closePath().stroke(dark);
      m.outline.moveTo(0, 0).arc(0, 0, size, -a, a).closePath().stroke(edge);
      m.inner.moveTo(0, 0).arc(0, 0, size, -a, a).closePath().fill({ color, alpha: 0.28 });
      break;
    }
    case 'line': {
      const half = Math.max(2, spread / 2);
      m.outline.rect(0, -half, size, half * 2).fill({ color, alpha: 0.1 }).rect(0, -half, size, half * 2).stroke(dark).rect(0, -half, size, half * 2).stroke(edge);
      m.inner.rect(0, -half, size, half * 2).fill({ color, alpha: 0.28 });
      break;
    }
    case 'single':
      // A target ring; the progress arc is drawn per frame (drawSingleProgress).
      m.outline.circle(0, 0, size).stroke(dark).circle(0, 0, size).stroke({ width: 1.5, color, alpha: 0.6 });
      break;
  }
}

function drawSingleProgress(m: TelegraphMark, radius: number, progress: number, color: number, env: WorldEnv): void {
  m.inner.clear();
  if (progress <= 0) return;
  const end = -Math.PI / 2 + Math.PI * 2 * progress;
  m.inner.arc(0, 0, radius, -Math.PI / 2, end).stroke({ width: 5, color: env.chrome.outline, alpha: 0.6 });
  m.inner.arc(0, 0, radius, -Math.PI / 2, end).stroke({ width: 3, color, alpha: 1 });
}

// ---- projectiles -------------------------------------------------------------------------------------------------

/** The smallest projectile glyph (research A4.2: no tiny projectiles). */
export const MIN_PROJECTILE_PX = 10;

class ProjectileMark {
  readonly root = new Container();
  readonly tail = new Graphics();
  readonly head = new Graphics();
  lastX = Number.NaN;
  lastY = Number.NaN;
  heading = 0;
  drawn = '';
  constructor() {
    this.root.eventMode = 'none';
    this.root.addChild(this.tail, this.head);
    this.root.visible = false;
  }
  destroy(): void {
    this.root.destroy({ children: true });
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
    this.pool.begin();
    for (const p of list) {
      const m = this.pool.get(p.id);
      const cue: AbilityCue = env.cues.ability(p.ability);
      const size = Math.max(MIN_PROJECTILE_PX, cue.projectile?.sizePx ?? MIN_PROJECTILE_PX);
      const color = toneColor(cue.tone, env.palette);
      const key = `${size}|${color}`;
      if (m.drawn !== key) {
        m.drawn = key;
        const r = size / 2;
        m.head.clear().circle(0, 0, r + 1.5).fill({ color: env.chrome.outline, alpha: 0.85 }).circle(0, 0, r).fill({ color });
        m.tail.clear().poly([0, -r * 0.7, -size * 2.4, 0, 0, r * 0.7]).fill({ color, alpha: 0.4 });
      }
      const x = sx(env.map, p.x, p.y);
      const y = sy(env.map, p.x, p.y);
      m.root.visible = true;
      m.root.position.set(x, y);
      if (!Number.isNaN(m.lastX) && (Math.abs(x - m.lastX) > 0.5 || Math.abs(y - m.lastY) > 0.5)) m.heading = Math.atan2(y - m.lastY, x - m.lastX);
      m.lastX = x;
      m.lastY = y;
      m.tail.rotation = m.heading;
      // No trail under reduced motion (04 §9).
      m.tail.visible = !env.reducedMotion && env.playing;
    }
    this.pool.end();
  }

  clear(): void {
    this.pool.releaseAll();
  }
  destroy(): void {
    this.pool.clear();
    this.root.destroy({ children: true });
  }
}

/** A faded version of a colour for outlines on both themes (shared by the cue drawers). */
export function dim(color: number, floor: number, t: number): number {
  return mixColor(color, floor, t);
}
