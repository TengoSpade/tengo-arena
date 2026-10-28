/**
 * One-shot cues (05-technical-m2 §A5 "Ability cues"): everything `ArenaFrameState.effects` carries, drawn from the
 * state alone, so the same tick looks the same whether playback reached it by playing or by seeking.
 *
 * - One visual per effect, keyed by the effect's id (its event seq) and reused (KeyedPool); released when the
 *   effect is no longer active.
 * - `DRAWERS` and `LAYER_OF` are exhaustive Records over `EffectKind`: a new effect kind fails to compile until it
 *   has a drawing and a layer.
 * - Rate limits (04 §9, A5 "Telegraphs and readability"): flash cues (impacts, pulses, glints) go through the
 *   FlashLimiter (at most 3 a second per fighter, a refused one is drawn dimmed); at most one number per fighter
 *   per 100 ms of wall time is drawn (later ones merge into it); no full-screen flashes exist at all.
 * - Reduced motion: nothing travels, expands or rises; numbers appear and fade in place.
 */
import { Container, Graphics } from 'pixi.js';
import type { ContentDB } from '../../../core/content';
import type { ArenaUnitInfo, EffectKind, EffectRenderState, UnitRenderState } from '../../types';
import type { FlashLimiter } from '../flash-limiter';
import { KeyedPool } from '../pool';
import { toneColor } from '../palette';
import { sx, sy } from './affine';
import type { TextLabel, TextFactory, TextSize } from './text';
import type { WorldEnv } from './world';

export interface FxEnv extends WorldEnv {
  limiter: FlashLimiter;
  /** Units by index (UnitRenderState.unit); undefined for an index the state lacks. */
  byUnit: readonly (UnitRenderState | undefined)[];
  info: readonly ArenaUnitInfo[];
  content: ContentDB;
  text: TextFactory;
  overlayScale: number;
  viewport: { width: number; height: number };
}

type Layer = 'low' | 'high';

/** Which side of the bodies an effect draws on: ground marks under them, everything else over them. */
export const LAYER_OF: Record<EffectKind, Layer> = {
  swing: 'high',
  beam: 'high',
  impact: 'high',
  number: 'high',
  evade: 'high',
  'heal-pulse': 'low',
  'shield-gain': 'low',
  'shield-break': 'high',
  'status-apply': 'low',
  'status-resist': 'high',
  interrupt: 'high',
  'dash-trail': 'low',
  displace: 'low',
  cleanse: 'low',
  dispel: 'low',
  'guard-link': 'low',
  'chain-arc': 'high',
  splash: 'low',
  'cooldown-reset': 'high',
  'focus-gain': 'high',
  'zone-trigger': 'low',
  down: 'high',
  deathward: 'low',
  rally: 'low',
  'captain-down': 'high',
  call: 'low',
};

/** Cues that are brightness bursts: the ones the flash limiter governs. */
const FLASH_KINDS: ReadonlySet<EffectKind> = new Set<EffectKind>(['impact', 'heal-pulse', 'splash', 'zone-trigger', 'cooldown-reset', 'deathward', 'rally', 'shield-break']);

/** How long (wall ms) hits on one fighter merge into one number. */
const NUMBER_MERGE_MS = 100;
const RISE_PX = 28;
const REFUSED_ALPHA = 0.3;

class EffectView {
  readonly root = new Container();
  readonly g = new Graphics();
  private readonly labels: Partial<Record<TextSize, TextLabel>> = {};
  /** The effect id this view serves (-1 when free). */
  boundId = -1;
  /** The flash decision, taken the first frame the effect is seen. */
  fresh = true;
  admitted = true;
  /** Wall time the effect was first seen (number merging). */
  bornMs = 0;
  /** Number effects: merged into an earlier one (hidden), or the host with its running total. */
  suppressed = false;
  total = 0;
  crit = false;

  constructor(private readonly text: TextFactory) {
    this.root.eventMode = 'none';
    this.g.eventMode = 'none';
    this.root.addChild(this.g);
    this.root.visible = false;
  }

  label(size: TextSize): TextLabel {
    let l = this.labels[size];
    if (!l) {
      l = this.text.create(size);
      l.setAnchor(0.5, 0.5);
      this.labels[size] = l;
      this.root.addChild(l.view);
    }
    for (const key of Object.keys(this.labels) as TextSize[]) this.labels[key]!.view.visible = key === size;
    return l;
  }

  hideLabels(): void {
    for (const key of Object.keys(this.labels) as TextSize[]) this.labels[key]!.view.visible = false;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

type Drawer = (v: EffectView, e: EffectRenderState, env: FxEnv, alpha: number, slot: number) => void;

export class EffectLayer {
  readonly low = new Container();
  readonly high = new Container();
  private readonly pools: Record<Layer, KeyedPool<EffectView>>;
  /** Per fighter: the number effect currently hosting merged hits. */
  private readonly hosts = new Map<number, EffectView>();
  private readonly pooled: EffectView[] = [];
  private readonly views: EffectView[] = [];

  constructor(private readonly text: TextFactory) {
    this.low.eventMode = 'none';
    this.high.eventMode = 'none';
    const make = (parent: Container): KeyedPool<EffectView> =>
      new KeyedPool<EffectView>(
        () => {
          const v = new EffectView(this.text);
          parent.addChild(v.root);
          this.pooled.push(v);
          return v;
        },
        (v, key) => {
          v.boundId = key;
          v.fresh = true;
          v.suppressed = false;
          v.total = 0;
          v.crit = false;
        },
        (v) => {
          v.boundId = -1;
          v.root.visible = false;
          v.g.clear();
          v.hideLabels();
        },
        (v) => v.destroy(),
      );
    this.pools = { low: make(this.low), high: make(this.high) };
  }

  get liveCount(): number {
    return this.pools.low.liveCount + this.pools.high.liveCount;
  }
  get created(): number {
    return this.pools.low.created + this.pools.high.created;
  }

  update(effects: readonly EffectRenderState[], env: FxEnv): void {
    this.pools.low.begin();
    this.pools.high.begin();
    // Pass 1: a view per effect; the first frame an effect is seen decides its flash and merges its number.
    const views = this.views;
    views.length = effects.length;
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i]!;
      const v = this.pools[LAYER_OF[e.kind]].get(e.id);
      views[i] = v;
      if (v.fresh) {
        v.fresh = false;
        v.bornMs = env.nowMs;
        // Flash cues are limited while playing; a paused or sought frame is static, so it is never refused.
        v.admitted = !FLASH_KINDS.has(e.kind) || !env.playing || env.reducedMotion || env.limiter.admit(e.target ?? e.unit ?? 1000, env.nowMs);
        if (e.kind === 'number') this.mergeNumber(v, e, env);
      }
    }
    // Pass 2: draw (numbers now hold their merged totals).
    let slot = 0;
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i]!;
      const v = views[i]!;
      v.root.visible = true;
      if (e.kind === 'down' || e.kind === 'captain-down') slot++;
      DRAWERS[e.kind](v, e, env, v.admitted ? 1 : REFUSED_ALPHA, slot - 1);
    }
    this.pools.low.end();
    this.pools.high.end();
    views.length = 0;
    // Hosts whose view went away no longer merge anything.
    for (const [unit, host] of this.hosts) if (host.boundId < 0) this.hosts.delete(unit);
  }

  /** At most one number per fighter per 100 ms of wall time: later ones fold into the first. */
  private mergeNumber(v: EffectView, e: EffectRenderState, env: FxEnv): void {
    const target = e.target ?? e.unit ?? -1;
    const amount = e.amount ?? 0;
    const host = this.hosts.get(target);
    if (host && host.boundId >= 0 && host !== v && env.nowMs - host.bornMs < NUMBER_MERGE_MS) {
      host.total += amount;
      host.crit = host.crit || e.crit;
      v.suppressed = true;
      return;
    }
    v.total = amount;
    v.crit = e.crit;
    v.suppressed = false;
    this.hosts.set(target, v);
  }

  clear(): void {
    this.pools.low.releaseAll();
    this.pools.high.releaseAll();
    this.hosts.clear();
  }

  destroy(): void {
    this.pools.low.clear();
    this.pools.high.clear();
    this.hosts.clear();
    this.low.destroy({ children: true });
    this.high.destroy({ children: true });
  }
}

// ---- drawing helpers --------------------------------------------------------------------------------------------

const TAU = Math.PI * 2;

function unitXY(env: FxEnv, unit: number | null): { x: number; y: number } | null {
  if (unit === null) return null;
  const u = env.byUnit[unit];
  return u ? { x: sx(env.map, u.x, u.y), y: sy(env.map, u.x, u.y) } : null;
}

function ring(g: Graphics, x: number, y: number, r: number, color: number, alpha: number, width: number, env: FxEnv): void {
  g.circle(x, y, r).stroke({ width: width + 3, color: env.chrome.outline, alpha: alpha * 0.45 });
  g.circle(x, y, r).stroke({ width, color, alpha });
}

function line(g: Graphics, x0: number, y0: number, x1: number, y1: number, color: number, alpha: number, width: number, env: FxEnv): void {
  g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: width + 3, color: env.chrome.outline, alpha: alpha * 0.45 });
  g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width, color, alpha });
}

/** Reduced motion pins animated values to their settled look (no travel, no growth). */
const settle = (env: FxEnv, animated: number, settled: number): number => (env.reducedMotion ? settled : animated);

function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function fade(age: number, from = 0): number {
  return age <= from ? 1 : Math.max(0, 1 - (age - from) / (1 - from));
}

function floating(v: EffectView, e: EffectRenderState, env: FxEnv, text: string, size: TextSize, color: number, alpha: number, rise: number): void {
  v.g.clear();
  const l = v.label(size);
  l.setText(text);
  l.setTint(color);
  const x = sx(env.map, e.x, e.y);
  const y = sy(env.map, e.x, e.y) - env.ppm * 0.9 - settle(env, rise * e.age, 0);
  l.view.position.set(x, y);
  l.view.alpha = alpha * fade(e.age, 0.55);
}

function callout(v: EffectView, e: EffectRenderState, env: FxEnv, alpha: number, slot: number): void {
  const downed = e.kind === 'captain-down';
  const victim = e.unit !== null ? env.info[e.unit] : undefined;
  const killer = e.target !== null ? env.info[e.target] : undefined;
  const ability = e.ability !== null ? (env.content.abilities.get(e.ability)?.name ?? null) : null;
  const who = victim?.className ?? 'Fighter';
  let text = downed ? `Captain down: ${who}` : `${who} downed`;
  if (killer) text += ` by ${killer.className}`;
  if (ability) text += ` · ${ability}`;
  const side = victim ? env.sideColor(victim.side) : env.palette.text;
  const l = v.label('normal');
  l.setText(text);
  l.setTint(env.palette.text);
  const w = l.width + 16;
  const h = 20;
  const anchor = unitXY(env, e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
  const above = (26 + 70) * env.overlayScale;
  // Keep the callout inside the canvas, and stack simultaneous ones.
  const x = Math.max(w / 2 + 4, Math.min(env.viewport.width - w / 2 - 4, anchor.x));
  const y = Math.max(h / 2 + 4, anchor.y - above) + slot * (h + 4);
  const a = alpha * fade(e.age, 0.7);
  v.g.clear();
  v.g.roundRect(x - w / 2, y - h / 2, w, h, 5).fill({ color: env.chrome.plate, alpha: 0.9 * a });
  v.g.roundRect(x - w / 2, y - h / 2, w, h, 5).stroke({ width: 2, color: side, alpha: a });
  l.view.position.set(x, y);
  l.view.alpha = a;
  if (!env.reducedMotion && e.age < 0.1) ring(v.g, anchor.x, anchor.y, env.ppm * (0.5 + 2 * e.age), side, alpha * (1 - e.age * 8), 3, env);
}

// ---- the drawers: one per EffectKind -----------------------------------------------------------------------------

const DRAWERS: Record<EffectKind, Drawer> = {
  swing(v, e, env, alpha) {
    v.hideLabels();
    const x = sx(env.map, e.x, e.y);
    const y = sy(env.map, e.x, e.y);
    const to = unitXY(env, e.target);
    const aim = to ? Math.atan2(to.y - y, to.x - x) : 0;
    const sweep = 2.1;
    const color = toneColor(e.tone, env.palette);
    const r = env.ppm * 0.95;
    const start = aim - sweep / 2 + settle(env, sweep * 0.5 * e.age, 0);
    v.g.clear();
    v.g.arc(x, y, r, start, start + sweep * 0.55).stroke({ width: 8, color: env.chrome.outline, alpha: alpha * 0.4 * fade(e.age) });
    v.g.arc(x, y, r, start, start + sweep * 0.55).stroke({ width: 4, color, alpha: alpha * 0.95 * fade(e.age) });
  },
  beam(v, e, env, alpha) {
    v.hideLabels();
    const a = unitXY(env, e.unit);
    const b = unitXY(env, e.target);
    v.g.clear();
    if (a && b) line(v.g, a.x, a.y, b.x, b.y, toneColor(e.tone, env.palette), alpha * fade(e.age), 3, env);
  },
  impact(v, e, env, alpha) {
    v.hideLabels();
    const x = sx(env.map, e.x, e.y);
    const y = sy(env.map, e.x, e.y);
    const r = env.ppm * settle(env, 0.2 + 0.4 * e.age, 0.5);
    const color = toneColor(e.tone, env.palette);
    v.g.clear();
    ring(v.g, x, y, r, color, alpha * fade(e.age), e.crit ? 4 : 2.5, env);
    v.g.circle(x, y, Math.max(2, r * 0.3)).fill({ color, alpha: alpha * 0.8 * fade(e.age, 0.3) });
  },
  number(v, e, env, alpha) {
    v.g.clear();
    if (v.suppressed) {
      v.hideLabels();
      return;
    }
    const heal = e.tone === 'heal';
    const crit = v.crit || e.crit;
    const amount = Math.round(v.total || e.amount || 0);
    floating(v, e, env, `${heal ? '+' : ''}${amount}${crit ? '!' : ''}`, crit ? 'large' : 'normal', toneColor(e.tone, env.palette), alpha, RISE_PX);
  },
  evade(v, e, env, alpha) {
    floating(v, e, env, 'Evade', 'small', env.palette.text, alpha, RISE_PX * 0.5);
  },
  'heal-pulse'(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.target ?? e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * settle(env, 0.5 + 0.6 * e.age, 0.9), env.palette.good, alpha * fade(e.age), 3, env);
  },
  'shield-gain'(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.target ?? e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    v.g.clear();
    const r = env.ppm * 0.78;
    v.g.arc(p.x, p.y, r, -Math.PI * 0.8, -Math.PI * 0.2).stroke({ width: 7, color: env.chrome.outline, alpha: alpha * 0.4 * fade(e.age, 0.4) });
    v.g.arc(p.x, p.y, r, -Math.PI * 0.8, -Math.PI * 0.2).stroke({ width: 3.5, color: toneColor('shield', env.palette), alpha: alpha * fade(e.age, 0.4) });
  },
  'shield-break'(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.target ?? e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    const r0 = env.ppm * settle(env, 0.75 + 0.5 * e.age, 1.0);
    v.g.clear();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + hash01(e.id) * 0.6;
      line(v.g, p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0, p.x + Math.cos(a) * (r0 + 7), p.y + Math.sin(a) * (r0 + 7), toneColor('shield', env.palette), alpha * fade(e.age), 2.5, env);
    }
  },
  'status-apply'(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.target ?? e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * settle(env, 0.45 + 0.3 * e.age, 0.7), toneColor(e.tone, env.palette), alpha * fade(e.age) * 0.9, 2, env);
  },
  'status-resist'(v, e, env, alpha) {
    floating(v, e, env, 'Resisted', 'small', env.palette.textMuted, alpha, RISE_PX * 0.5);
  },
  interrupt(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.target ?? e.unit);
    v.g.clear();
    if (!p) return;
    // An X on the target's cast bar.
    const x = p.x;
    const y = p.y - (26 + 21) * env.overlayScale;
    const s = 6 * env.overlayScale * settle(env, 1 + 0.6 * (1 - e.age), 1);
    const a = alpha * fade(e.age, 0.3);
    line(v.g, x - s, y - s, x + s, y + s, env.palette.warn, a, 3, env);
    line(v.g, x - s, y + s, x + s, y - s, env.palette.warn, a, 3, env);
  },
  'dash-trail'(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.unit);
    v.g.clear();
    if (!p || env.reducedMotion) return;
    const x = sx(env.map, e.x, e.y);
    const y = sy(env.map, e.x, e.y);
    line(v.g, x, y, p.x, p.y, toneColor(e.tone, env.palette), alpha * 0.55 * fade(e.age), 6, env);
  },
  displace(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.target ?? e.unit);
    v.g.clear();
    if (!p) return;
    const x = sx(env.map, e.x, e.y);
    const y = sy(env.map, e.x, e.y);
    const a = alpha * 0.7 * fade(e.age);
    line(v.g, x, y, p.x, p.y, toneColor(e.tone, env.palette), a, 4, env);
    const ang = Math.atan2(p.y - y, p.x - x);
    const head = 8;
    v.g.poly([p.x + Math.cos(ang) * head, p.y + Math.sin(ang) * head, p.x + Math.cos(ang + 2.5) * head, p.y + Math.sin(ang + 2.5) * head, p.x + Math.cos(ang - 2.5) * head, p.y + Math.sin(ang - 2.5) * head]).fill({ color: toneColor(e.tone, env.palette), alpha: a });
  },
  cleanse(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.target ?? e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    v.g.clear();
    ring(v.g, p.x, p.y - settle(env, 18 * e.age, 0), env.ppm * 0.65, env.palette.good, alpha * fade(e.age), 2.5, env);
  },
  dispel(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.target ?? e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    v.g.clear();
    const r = env.ppm * settle(env, 0.6 + 0.4 * e.age, 0.8);
    // A broken ring: three arcs with gaps.
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * TAU + 0.2;
      v.g.arc(p.x, p.y, r, a0, a0 + TAU / 3 - 0.7).stroke({ width: 5.5, color: env.chrome.outline, alpha: alpha * 0.4 * fade(e.age) });
      v.g.arc(p.x, p.y, r, a0, a0 + TAU / 3 - 0.7).stroke({ width: 2.5, color: env.palette.text, alpha: alpha * fade(e.age) });
    }
  },
  'guard-link'(v, e, env, alpha) {
    v.hideLabels();
    const a = unitXY(env, e.unit);
    const b = unitXY(env, e.target);
    v.g.clear();
    if (!a || !b) return;
    // A dashed link from guard to ward while it lasts.
    const n = 8;
    for (let i = 0; i < n; i += 2) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      line(v.g, a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1, env.palette.text, alpha * 0.8 * fade(e.age, 0.85), 2, env);
    }
  },
  'chain-arc'(v, e, env, alpha) {
    v.hideLabels();
    const a = unitXY(env, e.unit);
    const b = unitXY(env, e.target);
    v.g.clear();
    if (!a || !b) return;
    // A jagged arc between the hops; the zigzag is fixed per effect.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const color = toneColor(e.tone, env.palette);
    let px = a.x;
    let py = a.y;
    for (let i = 1; i <= 4; i++) {
      const t = i / 4;
      const off = i === 4 ? 0 : (hash01(e.id * 7 + i) - 0.5) * 16;
      const qx = a.x + dx * t + nx * off;
      const qy = a.y + dy * t + ny * off;
      line(v.g, px, py, qx, qy, color, alpha * fade(e.age), 2.5, env);
      px = qx;
      py = qy;
    }
  },
  splash(v, e, env, alpha) {
    v.hideLabels();
    const x = sx(env.map, e.x, e.y);
    const y = sy(env.map, e.x, e.y);
    const color = toneColor(e.tone, env.palette);
    v.g.clear();
    v.g.circle(x, y, env.ppm * 0.9).fill({ color, alpha: alpha * 0.25 * fade(e.age) });
    ring(v.g, x, y, env.ppm * 0.9, color, alpha * 0.8 * fade(e.age), 2, env);
  },
  'cooldown-reset'(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    const s = 9 * settle(env, 1 - e.age * 0.5, 1);
    const y = p.y - env.ppm * 0.9;
    v.g.clear();
    v.g.poly([p.x, y - s, p.x + s * 0.28, y - s * 0.28, p.x + s, y, p.x + s * 0.28, y + s * 0.28, p.x, y + s, p.x - s * 0.28, y + s * 0.28, p.x - s, y, p.x - s * 0.28, y - s * 0.28]).fill({ color: env.palette.text, alpha: alpha * fade(e.age) }).stroke({ width: 1.5, color: env.chrome.outline, alpha: alpha * fade(e.age) });
  },
  'focus-gain'(v, e, env, alpha) {
    v.hideLabels();
    const p = unitXY(env, e.unit ?? e.target);
    v.g.clear();
    if (!p) return;
    const w = 46 * env.overlayScale;
    const y = p.y - (26 + 7.5) * env.overlayScale;
    v.g.rect(p.x - w / 2 - 2, y - 3, w + 4, 8).stroke({ width: 2, color: env.palette.text, alpha: alpha * fade(e.age, 0.2) });
  },
  'zone-trigger'(v, e, env, alpha) {
    v.hideLabels();
    const x = sx(env.map, e.x, e.y);
    const y = sy(env.map, e.x, e.y);
    v.g.clear();
    ring(v.g, x, y, env.ppm * settle(env, 0.4 + 0.7 * e.age, 0.8), toneColor(e.tone, env.palette), alpha * fade(e.age), 2.5, env);
  },
  down(v, e, env, alpha, slot) {
    callout(v, e, env, alpha, slot);
  },
  deathward(v, e, env, alpha) {
    const p = unitXY(env, e.target ?? e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * settle(env, 0.5 + 0.9 * e.age, 1), env.palette.warn, alpha * fade(e.age), 3.5, env);
    const l = v.label('small');
    l.setText('Deathward');
    l.setTint(env.palette.warn);
    l.view.position.set(p.x, p.y - env.ppm * 1.1);
    l.view.alpha = alpha * fade(e.age, 0.5);
  },
  rally(v, e, env, alpha) {
    const p = unitXY(env, e.unit ?? e.target) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * settle(env, 0.5 + 1.3 * e.age, 1.4), env.palette.text, alpha * fade(e.age), 3, env);
    const l = v.label('small');
    l.setText('Rally');
    l.setTint(env.palette.text);
    l.view.position.set(p.x, p.y - env.ppm * 1.1);
    l.view.alpha = alpha * fade(e.age, 0.5);
  },
  'captain-down'(v, e, env, alpha, slot) {
    callout(v, e, env, alpha, slot);
  },
  call(v, e, env, alpha) {
    const p = unitXY(env, e.unit) ?? { x: sx(env.map, e.x, e.y), y: sy(env.map, e.x, e.y) };
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * 0.8, env.palette.text, alpha * fade(e.age), 2.5, env);
    const l = v.label('small');
    l.setText('Call');
    l.setTint(env.palette.text);
    l.view.position.set(p.x, p.y - env.ppm * 1.1);
    l.view.alpha = alpha * fade(e.age, 0.5);
  },
};
