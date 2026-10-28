/**
 * One-shot cues (05-technical-m2 §A5 "Ability cues"; components.css §25.4): everything `ArenaFrameState.effects`
 * carries, drawn from the state alone, so the same tick looks the same whether playback reached it by playing or by
 * seeking. Every colour and size comes from the palette.
 *
 * - One visual per effect, keyed by the effect's id (its event seq, plus the model's companion offset) and reused
 *   (KeyedPool); released when the effect is no longer active.
 * - `DRAWERS` and `LAYER_OF` are exhaustive Records over `EffectKind`: a new effect kind fails to compile until it
 *   has a drawing and a layer.
 * - Damage kinds differ by SHAPE as well as colour: physical = angular spark, arcane = round burst, true = diamond.
 *   Numbers always carry a sign and are drawn with a plate-coloured stroke (4.5:1 on any floor).
 * - Rate limits (04 §9): flash cues (impacts, pulses, glints) go through the FlashLimiter (at most
 *   `metrics.flashLimitPerSecond` a second per fighter; a refused one is drawn dimmed); at most one number per
 *   fighter per `metrics.numberMergeMs` of wall time is drawn (later ones merge into it); no full-screen flashes.
 * - Reduced motion: nothing travels, expands or rises; numbers appear and fade in place. (The model also drops the
 *   motion-only kinds from the sample; the drawers draw nothing for them either.)
 */
import { Container, Graphics } from 'pixi.js';
import type { EffectKind, EffectRenderState } from '../../types';
import { DESTROY_ALL } from '../destroy';
import type { FlashLimiter } from '../flash-limiter';
import { KeyedPool } from '../pool';
import { toneColor, type Tone } from '../palette';
import { sx, sy } from './affine';
import { Chip } from './chip';
import type { TextLabel } from './text';
import type { WorldEnv } from './world';

export interface FxEnv extends WorldEnv {
  limiter: FlashLimiter;
  viewport: { width: number; height: number };
  /** The callout queue sits at the top of the field (true) or at the bottom, whichever is clearer of bodies. */
  queueTop: boolean;
}

type Layer = 'low' | 'high' | 'top';

/**
 * Where an effect draws: ground marks under the bodies (low), cues over them (high), and the text-bearing ones (numbers,
 * words, callouts) on top of the overlays (top), so a neighbour's stack never hides a number.
 */
export const LAYER_OF: Record<EffectKind, Layer> = {
  swing: 'high',
  beam: 'high',
  impact: 'high',
  number: 'top',
  evade: 'top',
  'heal-pulse': 'low',
  'shield-gain': 'low',
  'shield-break': 'high',
  'status-apply': 'low',
  'status-resist': 'top',
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
  down: 'top',
  deathward: 'low',
  rally: 'low',
  'captain-down': 'top',
  call: 'low',
};

/** Cues that are brightness bursts: the ones the flash limiter governs. */
const FLASH_KINDS: ReadonlySet<EffectKind> = new Set<EffectKind>(['impact', 'heal-pulse', 'splash', 'zone-trigger', 'cooldown-reset', 'deathward', 'rally', 'shield-break']);
/** Pulses, glints and streaks the model drops under reduced motion (MOTION_ONLY_EFFECTS): never drawn then. */
const MOTION_ONLY: ReadonlySet<EffectKind> = new Set<EffectKind>(['dash-trail', 'displace', 'heal-pulse', 'cooldown-reset', 'focus-gain']);

class EffectView {
  readonly root = new Container();
  readonly g = new Graphics();
  private readonly numbers = new Map<string, TextLabel>();
  private chip: Chip | null = null;
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
  /** A down line: the fallen was the acting captain (folded in from the captain-down cue). A captain-down cue folded into a down line. */
  captain = false;
  folded = false;

  constructor(private readonly env: () => FxEnv) {
    this.root.eventMode = 'none';
    this.g.eventMode = 'none';
    this.root.addChild(this.g);
    this.root.visible = false;
  }

  /** The label for a number of this tone and size, created on first use. */
  number(tone: Tone, crit: boolean): TextLabel {
    const key = `${tone}|${crit}`;
    let l = this.numbers.get(key);
    if (!l) {
      l = this.env().text.number(tone, crit);
      l.setAnchor(0.5, 0.5);
      this.numbers.set(key, l);
      this.root.addChild(l.view);
    }
    for (const [k, other] of this.numbers) other.view.visible = k === key;
    if (this.chip) this.chip.view.visible = false;
    return l;
  }

  textChip(): Chip {
    if (!this.chip) {
      this.chip = new Chip(this.env().text, 'label');
      this.root.addChild(this.chip.view);
    }
    for (const other of this.numbers.values()) other.view.visible = false;
    this.chip.view.visible = true;
    return this.chip;
  }

  hideText(): void {
    for (const other of this.numbers.values()) other.view.visible = false;
    if (this.chip) this.chip.view.visible = false;
  }

  destroy(): void {
    for (const l of this.numbers.values()) l.dispose();
    this.numbers.clear();
    this.chip?.dispose();
    this.chip = null;
    this.root.destroy(DESTROY_ALL);
  }
}

type Drawer = (v: EffectView, e: EffectRenderState, env: FxEnv, alpha: number, slot: number) => void;

export class EffectLayer {
  readonly low = new Container();
  readonly high = new Container();
  readonly top = new Container();
  private readonly pools: Record<Layer, KeyedPool<EffectView>>;
  /** Units with a down cue, and with a captain-down cue, this frame. */
  private readonly downUnits: number[] = [];
  private readonly capUnits: number[] = [];
  private queueOpen = false;
  private queueTop = true;
  /** Per fighter: the number effect currently hosting merged hits. */
  private readonly hosts = new Map<number, EffectView>();
  private readonly views: EffectView[] = [];
  private current: FxEnv | null = null;

  constructor() {
    this.low.eventMode = 'none';
    this.high.eventMode = 'none';
    this.top.eventMode = 'none';
    const make = (parent: Container): KeyedPool<EffectView> =>
      new KeyedPool<EffectView>(
        () => {
          const v = new EffectView(() => this.current!);
          parent.addChild(v.root);
          return v;
        },
        (v, key) => {
          v.boundId = key;
          v.fresh = true;
          v.suppressed = false;
          v.total = 0;
          v.crit = false;
          v.captain = false;
          v.folded = false;
        },
        (v) => {
          v.boundId = -1;
          v.root.visible = false;
          v.g.clear();
          v.hideText();
        },
        (v) => v.destroy(),
      );
    this.pools = { low: make(this.low), high: make(this.high), top: make(this.top) };
  }

  get liveCount(): number {
    return this.pools.low.liveCount + this.pools.high.liveCount + this.pools.top.liveCount;
  }
  get created(): number {
    return this.pools.low.created + this.pools.high.created + this.pools.top.created;
  }

  update(effects: readonly EffectRenderState[], env: FxEnv): void {
    this.current = env;
    this.pools.low.begin();
    this.pools.high.begin();
    this.pools.top.begin();
    this.downUnits.length = 0;
    this.capUnits.length = 0;
    // Pass 1: a view per effect; the first frame an effect is seen decides its flash and merges its number.
    const views = this.views;
    views.length = effects.length;
    let drawn = 0;
    const kept: EffectRenderState[] = this.kept;
    kept.length = 0;
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i]!;
      if (env.reducedMotion && MOTION_ONLY.has(e.kind)) continue;
      const v = this.pools[LAYER_OF[e.kind]].get(e.id);
      views[drawn++] = v;
      kept.push(e);
      if (e.unit !== null) {
        if (e.kind === 'down') this.downUnits.push(e.unit);
        else if (e.kind === 'captain-down') this.capUnits.push(e.unit);
      }
      if (v.fresh) {
        v.fresh = false;
        v.bornMs = env.nowMs;
        // Flash cues are limited while playing; a paused or sought frame is static, so it is never refused.
        v.admitted = !FLASH_KINDS.has(e.kind) || !env.playing || env.reducedMotion || env.limiter.admit(e.target ?? e.unit ?? 1000, env.nowMs);
        if (e.kind === 'number') {
          // Merging is for continuous playback (wall time); a paused or sought frame shows every hit's own number.
          if (env.playing) this.mergeNumber(v, e, env);
          else {
            v.total = e.amount ?? 0;
            v.crit = e.crit;
            v.suppressed = false;
          }
        }
      }
    }
    // Pass 2: draw (numbers now hold their merged totals). Down and captain-down callouts share one queue; a
    // captain-down for a unit that also has a down cue is folded into that down line ("Captain ... downed by ...").
    let queued = 0;
    for (let i = 0; i < drawn; i++) {
      if (kept[i]!.kind === 'down' || (kept[i]!.kind === 'captain-down' && !this.foldsIntoDown(kept[i]!))) queued++;
    }
    if (queued > 0 && !this.queueOpen) this.queueTop = this.clearerAtTop(env);
    this.queueOpen = queued > 0;
    env.queueTop = this.queueTop;
    let slot = 0;
    for (let i = 0; i < drawn; i++) {
      const e = kept[i]!;
      const v = views[i]!;
      v.root.visible = true;
      let place = 0;
      if (e.kind === 'captain-down' && this.foldsIntoDown(e)) {
        v.folded = true;
        v.hideText();
        v.g.clear();
        continue;
      }
      if (e.kind === 'down') v.captain = v.captain || (e.unit !== null && this.capUnits.includes(e.unit));
      if (e.kind === 'down' || e.kind === 'captain-down') place = slot++;
      // A burst the limiter refused is a ghost of itself (the zone alpha), never dropped: the cue still reads.
      DRAWERS[e.kind](v, e, env, v.admitted ? 1 : env.palette.metrics.zoneAlpha, place);
    }
    this.pools.low.end();
    this.pools.high.end();
    this.pools.top.end();
    views.length = 0;
    kept.length = 0;
    // Hosts whose view went away no longer merge anything.
    for (const [unit, host] of this.hosts) if (host.boundId < 0) this.hosts.delete(unit);
  }
  private readonly kept: EffectRenderState[] = [];

  private foldsIntoDown(e: EffectRenderState): boolean {
    return e.unit !== null && this.downUnits.includes(e.unit);
  }

  /**
   * Which end of the field holds the callout queue: the one with fewer bodies near the centre line (the queue is a
   * column about 300 px wide and 4 lines deep). Chosen when the queue opens and kept while it is open (no jumping).
   */
  private clearerAtTop(env: FxEnv): boolean {
    const f = env.field;
    const cx = (f.x0 + f.x1) / 2;
    const band = env.palette.metrics.labelSizePx * 1.45 * 4 + 24;
    let top = 0;
    let bottom = 0;
    for (const u of env.byUnit) {
      if (!u) continue;
      const x = sx(env.map, u.x, u.y);
      const y = sy(env.map, u.x, u.y);
      if (Math.abs(x - cx) > 150) continue;
      if (y - f.y0 < band) top++;
      if (f.y1 - y < band) bottom++;
    }
    return top <= bottom;
  }

  /** At most one number per fighter per merge window of wall time: later ones fold into the first. */
  private mergeNumber(v: EffectView, e: EffectRenderState, env: FxEnv): void {
    const target = e.target ?? e.unit ?? -1;
    const amount = e.amount ?? 0;
    const host = this.hosts.get(target);
    if (host && host.boundId >= 0 && host !== v && env.nowMs - host.bornMs < env.palette.metrics.numberMergeMs) {
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
    this.pools.top.releaseAll();
    this.hosts.clear();
    this.queueOpen = false;
  }

  destroy(): void {
    this.pools.low.clear();
    this.pools.high.clear();
    this.pools.top.clear();
    this.hosts.clear();
    this.low.destroy(DESTROY_ALL);
    this.high.destroy(DESTROY_ALL);
    this.top.destroy(DESTROY_ALL);
  }
}

// ---- drawing helpers --------------------------------------------------------------------------------------------

const TAU = Math.PI * 2;

interface Pt {
  x: number;
  y: number;
}
/**
 * Points are written into a ring of scratch objects, so a frame's lookups allocate nothing. A point stays valid for the
 * next 7 lookups (a drawer holds at most three).
 */
const SCRATCH: Pt[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
let scratchAt = 0;
function take(x: number, y: number): Pt {
  const p = SCRATCH[scratchAt++ & 7]!;
  p.x = x;
  p.y = y;
  return p;
}

function unitXY(env: FxEnv, unit: number | null): Pt | null {
  if (unit === null) return null;
  const u = env.byUnit[unit];
  return u ? take(sx(env.map, u.x, u.y), sy(env.map, u.x, u.y)) : null;
}

/** The effect's own point, in screen px. */
const here = (env: FxEnv, e: EffectRenderState): Pt => take(sx(env.map, e.x, e.y), sy(env.map, e.x, e.y));

/** A ring with a plate halo (every mark keeps contrast on any floor). */
function ring(g: Graphics, x: number, y: number, r: number, color: number, alpha: number, width: number, env: FxEnv): void {
  g.circle(x, y, r).stroke({ width: width + 3, color: env.palette.plate, alpha: alpha * 0.55 });
  g.circle(x, y, r).stroke({ width, color, alpha });
}

function line(g: Graphics, x0: number, y0: number, x1: number, y1: number, color: number, alpha: number, width: number, env: FxEnv): void {
  g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: width + 3, color: env.palette.plate, alpha: alpha * 0.55 });
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

/**
 * The fade of an effect. Under reduced motion the model gives non-number effects age 1, meaning "drawn static at the
 * end state" (§A19), so they must not fade by 1 - age (they would vanish); numbers fade in place.
 */
function fadeOf(env: FxEnv, e: EffectRenderState, from = 0): number {
  return env.reducedMotion && e.kind !== 'number' ? 1 : fade(e.age, from);
}

/** The shape of a damage tone: spark (physical), round burst (arcane), diamond (true); others use the spark. */
function impactShape(g: Graphics, x: number, y: number, size: number, tone: Tone, color: number, alpha: number, env: FxEnv): void {
  const h = size / 2;
  const plate = env.palette.plate;
  if (tone === 'arcane') {
    // radial-gradient(circle, transparent 0 38%, tone 40% 62%, transparent 64%): a ring band.
    g.circle(x, y, h * 0.51).stroke({ width: h * 0.24 + 3, color: plate, alpha: alpha * 0.5 });
    g.circle(x, y, h * 0.51).stroke({ width: h * 0.24, color, alpha });
    return;
  }
  const pts =
    tone === 'true'
      ? [x, y - h, x + h, y, x, y + h, x - h, y]
      : [x, y - h, x + 0.2 * h, y - 0.24 * h, x + h, y, x + 0.2 * h, y + 0.24 * h, x, y + h, x - 0.2 * h, y + 0.24 * h, x - h, y, x - 0.2 * h, y - 0.24 * h];
  g.poly(pts).fill({ color, alpha }).stroke({ width: 1.5, color: plate, alpha: alpha * 0.9, alignment: 0, join: 'round' });
}

function floatingNumber(v: EffectView, e: EffectRenderState, env: FxEnv, alpha: number): void {
  v.g.clear();
  if (v.suppressed) {
    v.hideText();
    return;
  }
  const crit = v.crit || e.crit;
  const amount = Math.round(v.total || e.amount || 0);
  const gain = e.tone === 'heal' || e.tone === 'shield';
  // The sign is always shown (U+2212 for damage).
  const l = v.number(e.tone, crit);
  l.setText(`${gain ? '+' : '−'}${Math.abs(amount)}${crit ? '!' : ''}`);
  // Beside the disc (never over its stack, which sits above it, nor under a neighbour's: this is the top layer), on
  // the right unless that leaves the host; it rises from the disc's middle.
  const m = env.palette.metrics;
  const p = unitXY(env, e.target ?? e.unit) ?? here(env, e);
  const reach = env.ppm * 0.5 + m.ringGapPx * 2 + m.ringLinePx * 2 + 1 + 4;
  const w = l.width;
  let x = p.x + reach + w / 2;
  if (x + w / 2 > env.viewport.width - 2) x = p.x - reach - w / 2;
  const y = Math.max(m.labelSizePx, p.y - env.ppm * 0.1 - settle(env, m.numberRisePx * e.age, 0));
  l.view.position.set(x, y);
  l.view.alpha = alpha * fadeOf(env, e, 0.55);
}

/** A short word on a plate chip at a point (Evade, Resisted, Deathward, Rally, Call). */
function wordChip(v: EffectView, text: string, x: number, y: number, env: FxEnv, alpha: number, edge?: number): void {
  const rem = env.palette.metrics.pipSizePx;
  const chip = v.textChip();
  const h = env.palette.metrics.labelSizePx * 1.35;
  const w = chip.set(text, env, 0, rem * 0.4, h, -1, edge);
  chip.view.position.set(x - w / 2, y - h / 2);
  chip.view.alpha = alpha;
}

function callout(v: EffectView, e: EffectRenderState, env: FxEnv, alpha: number, slot: number): void {
  const downed = e.kind === 'captain-down';
  const victim = e.unit !== null ? env.infoOf(e.unit) : undefined;
  const killer = e.target !== null ? env.infoOf(e.target) : undefined;
  // The cause is always named: the ability's name, or its id when the content does not know it.
  const ability = e.ability !== null ? (env.content.abilities.get(e.ability)?.name ?? String(e.ability)) : null;
  const who = victim?.className ?? 'Fighter';
  // One line per fallen fighter: a captain's down line carries the captain, a captain-down alone says so.
  let text = downed ? `Captain down: ${who}` : `${v.captain ? 'Captain ' : ''}${who} downed`;
  if (killer) text += ` by ${killer.className}`;
  if (ability) text += ` · ${ability}`;
  const side = victim ? env.sideColor(victim.side) : env.palette.ink;
  const rem = env.palette.metrics.pipSizePx;
  const h = env.palette.metrics.labelSizePx * 1.45;
  const chip = v.textChip();
  // The diamond (the side colour) sits in the left padding of the chip.
  const w = chip.set(text, env, 0, rem * 0.75, h);
  // A queue at one end of the field, away from the bodies (never on the fallen fighter's token): the newest line last.
  const f = env.field;
  const x = Math.max(w / 2 + 4, Math.min(env.viewport.width - w / 2 - 4, (f.x0 + f.x1) / 2));
  const gap = 4;
  const y = env.queueTop ? f.y0 + gap * 2 + slot * (h + gap) : f.y1 - gap * 2 - h - slot * (h + gap);
  const a = alpha * fadeOf(env, e, 0.7);
  chip.view.position.set(x - w / 2, y);
  chip.view.alpha = a;
  const d = rem * 0.3;
  v.g.clear();
  const cx = x - w / 2 + rem * 0.4;
  const cy = y + h / 2;
  v.g.poly([cx, cy - d, cx + d, cy, cx, cy + d, cx - d, cy]).fill({ color: side, alpha: a });
  // A ring where he fell, to look at, since the line is away from him.
  const anchor = unitXY(env, e.unit) ?? here(env, e);
  if (!env.reducedMotion && e.age < 0.1) ring(v.g, anchor.x, anchor.y, env.ppm * (0.5 + 2 * e.age), side, alpha * (1 - e.age * 8), 3, env);
}

// ---- the drawers: one per EffectKind -----------------------------------------------------------------------------

const DRAWERS: Record<EffectKind, Drawer> = {
  swing(v, e, env, alpha) {
    v.hideText();
    // The event's x,y is where it lands (the target); the arc is drawn at the actor, toward it.
    const from = unitXY(env, e.unit) ?? here(env, e);
    const to = unitXY(env, e.target) ?? here(env, e);
    const aim = Math.atan2(to.y - from.y, to.x - from.x);
    const sweep = 2.1;
    const color = toneColor(e.tone, env.palette);
    const r = env.ppm * 0.95;
    const start = aim - sweep / 2 + settle(env, sweep * 0.5 * e.age, 0);
    v.g.clear();
    v.g.arc(from.x, from.y, r, start, start + sweep * 0.55).stroke({ width: 8, color: env.palette.plate, alpha: alpha * 0.45 * fadeOf(env, e) });
    v.g.arc(from.x, from.y, r, start, start + sweep * 0.55).stroke({ width: 4, color, alpha: alpha * 0.95 * fadeOf(env, e) });
  },
  beam(v, e, env, alpha) {
    v.hideText();
    const a = unitXY(env, e.unit);
    const b = unitXY(env, e.target);
    v.g.clear();
    if (a && b) line(v.g, a.x, a.y, b.x, b.y, toneColor(e.tone, env.palette), alpha * fadeOf(env, e), 3, env);
  },
  impact(v, e, env, alpha) {
    v.hideText();
    const p = here(env, e);
    const rem = env.palette.metrics.pipSizePx;
    const base = Math.max(1.1 * rem, 0.7 * env.ppm);
    const size = base * settle(env, 0.6 + 0.5 * e.age, 1) * (e.crit ? 1.3 : 1);
    v.g.clear();
    impactShape(v.g, p.x, p.y, size, e.tone, toneColor(e.tone, env.palette), alpha * fadeOf(env, e, 0.2), env);
  },
  number(v, e, env, alpha) {
    floatingNumber(v, e, env, alpha);
  },
  evade(v, e, env, alpha) {
    v.g.clear();
    const p = here(env, e);
    wordChip(v, 'Evade', p.x, p.y - env.ppm * 0.9 - settle(env, env.palette.metrics.numberRisePx * 0.5 * e.age, 0), env, alpha * fadeOf(env, e, 0.55));
  },
  'heal-pulse'(v, e, env, alpha) {
    v.hideText();
    const p = unitXY(env, e.target ?? e.unit) ?? here(env, e);
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * (0.5 + 0.6 * e.age), env.palette.fxHeal, alpha * fadeOf(env, e), 3, env);
  },
  'shield-gain'(v, e, env, alpha) {
    v.hideText();
    const p = unitXY(env, e.target ?? e.unit) ?? here(env, e);
    v.g.clear();
    const r = env.ppm * 0.78;
    v.g.arc(p.x, p.y, r, -Math.PI * 0.8, -Math.PI * 0.2).stroke({ width: 7, color: env.palette.plate, alpha: alpha * 0.5 * fadeOf(env, e, 0.4) });
    v.g.arc(p.x, p.y, r, -Math.PI * 0.8, -Math.PI * 0.2).stroke({ width: 3.5, color: env.palette.fxShield, alpha: alpha * fadeOf(env, e, 0.4) });
  },
  'shield-break'(v, e, env, alpha) {
    v.hideText();
    const p = unitXY(env, e.target ?? e.unit) ?? here(env, e);
    const r0 = env.ppm * settle(env, 0.75 + 0.5 * e.age, 1.0);
    v.g.clear();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + hash01(e.id) * 0.6;
      line(v.g, p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0, p.x + Math.cos(a) * (r0 + 7), p.y + Math.sin(a) * (r0 + 7), env.palette.fxShield, alpha * fadeOf(env, e), 2.5, env);
    }
  },
  'status-apply'(v, e, env, alpha) {
    v.hideText();
    const p = unitXY(env, e.target ?? e.unit) ?? here(env, e);
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * settle(env, 0.45 + 0.3 * e.age, 0.7), toneColor(e.tone, env.palette), alpha * fadeOf(env, e) * 0.9, 2, env);
  },
  'status-resist'(v, e, env, alpha) {
    v.g.clear();
    const p = here(env, e);
    wordChip(v, 'Resisted', p.x, p.y - env.ppm * 0.9 - settle(env, env.palette.metrics.numberRisePx * 0.5 * e.age, 0), env, alpha * fadeOf(env, e, 0.55));
  },
  interrupt(v, e, env, alpha) {
    v.hideText();
    const p = unitXY(env, e.target ?? e.unit);
    v.g.clear();
    if (!p) return;
    // An X over the interrupted fighter, where its cast bar is.
    const rem = env.palette.metrics.pipSizePx;
    const x = p.x;
    const y = p.y - env.ppm * 0.5 - rem * 3;
    const s = rem * 0.4 * settle(env, 1 + 0.6 * (1 - e.age), 1);
    const a = alpha * fadeOf(env, e, 0.3);
    line(v.g, x - s, y - s, x + s, y + s, env.palette.warn, a, 3, env);
    line(v.g, x - s, y + s, x + s, y - s, env.palette.warn, a, 3, env);
  },
  'dash-trail'(v, e, env, alpha) {
    v.hideText();
    // x,y is where it began; unit is the one that moves (draw to where it is now).
    const p = unitXY(env, e.unit);
    v.g.clear();
    if (!p || env.reducedMotion) return;
    const s = here(env, e);
    line(v.g, s.x, s.y, p.x, p.y, toneColor(e.tone, env.palette), alpha * 0.55 * fadeOf(env, e), 6, env);
  },
  displace(v, e, env, alpha) {
    v.hideText();
    const p = unitXY(env, e.unit ?? e.target);
    v.g.clear();
    if (!p || env.reducedMotion) return;
    const s = here(env, e);
    const color = toneColor(e.tone, env.palette);
    const a = alpha * 0.7 * fadeOf(env, e);
    line(v.g, s.x, s.y, p.x, p.y, color, a, 4, env);
    const ang = Math.atan2(p.y - s.y, p.x - s.x);
    const head = 8;
    v.g.poly([p.x + Math.cos(ang) * head, p.y + Math.sin(ang) * head, p.x + Math.cos(ang + 2.5) * head, p.y + Math.sin(ang + 2.5) * head, p.x + Math.cos(ang - 2.5) * head, p.y + Math.sin(ang - 2.5) * head]).fill({ color, alpha: a });
  },
  cleanse(v, e, env, alpha) {
    v.hideText();
    const p = unitXY(env, e.target ?? e.unit) ?? here(env, e);
    v.g.clear();
    ring(v.g, p.x, p.y - settle(env, 18 * e.age, 0), env.ppm * 0.65, env.palette.fxHeal, alpha * fadeOf(env, e), 2.5, env);
  },
  dispel(v, e, env, alpha) {
    v.hideText();
    const p = unitXY(env, e.target ?? e.unit) ?? here(env, e);
    v.g.clear();
    const r = env.ppm * settle(env, 0.6 + 0.4 * e.age, 0.8);
    // A broken ring: three arcs with gaps.
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * TAU + 0.2;
      v.g.arc(p.x, p.y, r, a0, a0 + TAU / 3 - 0.7).stroke({ width: 5.5, color: env.palette.plate, alpha: alpha * 0.5 * fadeOf(env, e) });
      v.g.arc(p.x, p.y, r, a0, a0 + TAU / 3 - 0.7).stroke({ width: 2.5, color: env.palette.ink, alpha: alpha * fadeOf(env, e) });
    }
  },
  'guard-link'(v, e, env, alpha) {
    v.hideText();
    const a = unitXY(env, e.unit);
    const b = unitXY(env, e.target);
    v.g.clear();
    if (!a || !b) return;
    // A dashed link from guard to ward while it lasts.
    const n = 8;
    for (let i = 0; i < n; i += 2) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      line(v.g, a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1, env.palette.ink, alpha * 0.8 * fadeOf(env, e, 0.85), 2, env);
    }
  },
  'chain-arc'(v, e, env, alpha) {
    v.hideText();
    // From the previous target (unit) to this one (target); the zigzag is fixed per effect.
    const a = unitXY(env, e.unit);
    const b = unitXY(env, e.target);
    v.g.clear();
    if (!a || !b) return;
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
      line(v.g, px, py, qx, qy, color, alpha * fadeOf(env, e), 2.5, env);
      px = qx;
      py = qy;
    }
  },
  splash(v, e, env, alpha) {
    v.hideText();
    const o = here(env, e);
    const color = toneColor(e.tone, env.palette);
    const a = alpha * fadeOf(env, e);
    // The area is the ability's own: its cue's telegraph (circle, cone or line); a plain 0.9 m burst when it has none.
    const tg = e.ability !== null ? env.cues.ability(e.ability).telegraph : null;
    v.g.clear();
    if (tg && (tg.shape === 'cone' || tg.shape === 'line')) {
      const to = unitXY(env, e.target);
      const aim = to && (Math.abs(to.x - o.x) > 1 || Math.abs(to.y - o.y) > 1) ? Math.atan2(to.y - o.y, to.x - o.x) : 0;
      const len = (tg.sizeCm / 100) * env.ppm;
      if (tg.shape === 'cone') {
        const half = tg.spread / 2;
        v.g.moveTo(o.x, o.y).arc(o.x, o.y, len, aim - half, aim + half).closePath().fill({ color, alpha: a * 0.25 });
        v.g.moveTo(o.x, o.y).arc(o.x, o.y, len, aim - half, aim + half).closePath().stroke({ width: 5, color: env.palette.plate, alpha: a * 0.45 });
        v.g.moveTo(o.x, o.y).arc(o.x, o.y, len, aim - half, aim + half).closePath().stroke({ width: 2, color, alpha: a * 0.9 });
      } else {
        const w = Math.max(4, ((tg.spread / 100) * env.ppm) / 2);
        const px = -Math.sin(aim) * w;
        const py = Math.cos(aim) * w;
        const ex = o.x + Math.cos(aim) * len;
        const ey = o.y + Math.sin(aim) * len;
        const quad = [o.x + px, o.y + py, ex + px, ey + py, ex - px, ey - py, o.x - px, o.y - py];
        v.g.poly(quad).fill({ color, alpha: a * 0.25 });
        v.g.poly(quad).stroke({ width: 2, color, alpha: a * 0.9 });
      }
      return;
    }
    const r = tg && tg.shape === 'circle' ? (tg.sizeCm / 100) * env.ppm : env.ppm * 0.9;
    v.g.circle(o.x, o.y, r).fill({ color, alpha: a * 0.25 });
    ring(v.g, o.x, o.y, r, color, a * 0.8, 2, env);
  },
  'cooldown-reset'(v, e, env, alpha) {
    v.hideText();
    v.g.clear();
    if (env.reducedMotion) return;
    const p = unitXY(env, e.unit) ?? here(env, e);
    const s = env.palette.metrics.pipSizePx * 0.6 * (1 - e.age * 0.5);
    const y = p.y - env.ppm * 0.9;
    const pts = [p.x, y - s, p.x + s * 0.28, y - s * 0.28, p.x + s, y, p.x + s * 0.28, y + s * 0.28, p.x, y + s, p.x - s * 0.28, y + s * 0.28, p.x - s, y, p.x - s * 0.28, y - s * 0.28];
    v.g.poly(pts).fill({ color: env.palette.ink, alpha: alpha * fadeOf(env, e) }).stroke({ width: 1.5, color: env.palette.plate, alpha: alpha * fadeOf(env, e), alignment: 0 });
  },
  'focus-gain'(v, e, env, alpha) {
    v.hideText();
    v.g.clear();
    if (env.reducedMotion) return;
    const p = unitXY(env, e.unit ?? e.target);
    if (!p) return;
    // A glint on the focus bar: an outline around it in the focus colour.
    const m = env.palette.metrics;
    const barW = Math.max(1.7 * env.ppm, 3 * m.pipSizePx);
    const r = env.ppm * 0.5;
    const y = p.y - r - m.ringGapPx - m.ringWidthPx - 4 - m.barHeightPx * 0.3;
    v.g.rect(p.x - barW / 2 - 2, y - 3, barW + 4, m.barHeightPx * 0.6 + 6).stroke({ width: 2, color: env.palette.focus, alpha: alpha * fadeOf(env, e, 0.2) });
  },
  'zone-trigger'(v, e, env, alpha) {
    v.hideText();
    const o = here(env, e);
    // A pulse out to the edge of the zone it fired in (x,y is the zone's centre).
    let radius = env.ppm * 0.8;
    let best = Number.POSITIVE_INFINITY;
    for (const z of env.zones) {
      const d = Math.hypot(z.x - e.x, z.y - e.y);
      if (d < best && d < 30) {
        best = d;
        radius = (z.radius / 100) * env.ppm;
      }
    }
    v.g.clear();
    ring(v.g, o.x, o.y, radius * settle(env, 0.5 + 0.5 * e.age, 1), toneColor(e.tone, env.palette), alpha * fadeOf(env, e), 2.5, env);
  },
  down(v, e, env, alpha, slot) {
    callout(v, e, env, alpha, slot);
  },
  deathward(v, e, env, alpha) {
    // unit is the fighter that was saved (target is the saver).
    const p = unitXY(env, e.unit ?? e.target) ?? here(env, e);
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * settle(env, 0.5 + 0.9 * e.age, 1), env.palette.warn, alpha * fadeOf(env, e), 3.5, env);
    wordChip(v, 'Deathward', p.x, p.y - env.ppm * 1.1, env, alpha * fadeOf(env, e, 0.5));
  },
  rally(v, e, env, alpha) {
    const p = unitXY(env, e.unit ?? e.target) ?? here(env, e);
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * settle(env, 0.5 + 1.3 * e.age, 1.4), env.palette.ink, alpha * fadeOf(env, e), 3, env);
    wordChip(v, 'Rally', p.x, p.y - env.ppm * 1.1, env, alpha * fadeOf(env, e, 0.5));
  },
  'captain-down'(v, e, env, alpha, slot) {
    callout(v, e, env, alpha, slot);
  },
  call(v, e, env, alpha) {
    const p = unitXY(env, e.unit) ?? here(env, e);
    v.g.clear();
    ring(v.g, p.x, p.y, env.ppm * 0.8, env.palette.ink, alpha * fadeOf(env, e), 2.5, env);
    wordChip(v, 'Call', p.x, p.y - env.ppm * 1.1, env, alpha * fadeOf(env, e, 0.5));
  },
};
