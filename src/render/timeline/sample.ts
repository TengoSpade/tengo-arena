/**
 * sampleAt: the arena at one (fractional) tick, a pure function of (log, tick, context, options). PURE.
 *
 * - Positions interpolate linearly between the surrounding frames: the only look past the sampled tick, at most one
 *   frame interval. `options.knownUntilTick` (a live round's head) forbids it: a frame later than that tick is never
 *   used and positions hold at the frame before it. HP, shield and focus step at the last frame at or before the tick;
 *   a down shows at its own tick.
 * - Everything else (actions, casts, statuses, rule badge, effects and their ages, captains, standing counts, the end)
 *   comes from intervals and events with tick ≤ the sampled tick, and nothing is ever shortened or lengthened by a later
 *   event. So a log truncated after tick H samples exactly as the full log does with `knownUntilTick: H`, for every
 *   tick up to H (tested on every fixture).
 * - Reduced motion (04 §9) sets pulses and animated ages to their end states: the rule badge pulse is 0, effects of
 *   the motion-only kinds (MOTION_ONLY_EFFECTS) are left out, and every other effect is at its end state (`age` 1)
 *   while it lasts, except a number, whose age keeps running because it fades in place (A9). Telegraph progress,
 *   projectiles and every marker stay: they are information.
 */
import type { Side } from '../../core/model';
import type {
  ArenaFrameState,
  ArenaRoundContext,
  CastRenderState,
  EffectRenderState,
  ProjectileRenderState,
  RuleBadgeState,
  StatusRenderState,
  TelegraphRenderState,
  UnitAction,
  UnitRenderState,
  ZoneRenderState,
} from '../types';
import type { CastRec, DecisionRec, StatusSeg, TimelineData } from './data';
import { MOTION_ONLY_EFFECTS } from './effects';
import { MOVE_MIN_CM2, frameAtOrBefore, positionAt, type Pos } from './frames';
import { bisectLeft, bisectRight, lastAtOrBefore } from './util';
import type { PlaybackIndex } from './model';

/** The rule badge pulses for 220 ms after a decision commits (04 §7). */
export const RULE_PULSE_MS = 220;

function dataOf(index: PlaybackIndex): TimelineData {
  return index.internal as TimelineData;
}

function activeCast(list: readonly CastRec[], tick: number): CastRec | null {
  const i = lastAtOrBefore(list, tick, (c) => c.start);
  if (i < 0) return null;
  const c = list[i]!;
  return tick < c.end ? c : null;
}

function ruleBadge(d: DecisionRec, ruleCount: number | undefined, tick: number, pulseTicks: number, reduced: boolean): RuleBadgeState {
  const rule = d.event.data?.rule ?? 0;
  const stance = ruleCount === undefined ? d.event.data?.action === 'stance' : rule >= ruleCount;
  const label = rule < 0 ? 'T' : stance ? 'S' : `R${rule + 1}`;
  const age = tick - d.tick;
  return { label, rule, sinceTick: d.tick, pulse: reduced ? 0 : Math.max(0, 1 - age / pulseTicks) };
}

interface MergedStatus {
  seg: StatusSeg;
  stacks: number;
  applied: number;
  ends: number;
}

/**
 * The arena at `tick` (fractional allowed; clamped to the round). `ArenaFrameState.endTick` is set only once the
 * tick has reached the end. `reducedMotion` sets pulses and animated ages to their end states (04 §9). `knownUntilTick`
 * is the tick the log is known up to (a live round's head): positions never use a frame after it. Pure.
 */
export function sampleAt(index: PlaybackIndex, tick: number, ctx: ArenaRoundContext, options?: { reducedMotion?: boolean; knownUntilTick?: number }): ArenaFrameState {
  const data = dataOf(index);
  const reduced = options?.reducedMotion === true;
  const known = options?.knownUntilTick ?? Infinity;
  const n = data.unitCount;
  const ft = data.frames;
  // Clamped to the round once its end is known (a replay, or a live log that has reached it); a live log with no end yet never clamps upward: the caller holds the head.
  const asked = Math.max(0, Number.isFinite(tick) ? tick : 0);
  const T = data.endTick === null ? asked : Math.min(data.endTick, asked);
  const k = frameAtOrBefore(ft, T);
  const t0 = ft.ticks[k]!;
  const alpha = k < ft.count - 1 && T > t0 && ft.ticks[k + 1]! <= known ? (T - t0) / (ft.ticks[k + 1]! - t0) : 0;
  const pulseTicks = RULE_PULSE_MS / data.header.tickMs;

  // Positions first: facing, telegraphs and zones read other units' positions.
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let u = 0; u < n; u++) {
    const ux = ft.x[u]!;
    const uy = ft.y[u]!;
    xs[u] = alpha > 0 ? ux[k]! + (ux[k + 1]! - ux[k]!) * alpha : ux[k]!;
    ys[u] = alpha > 0 ? uy[k]! + (uy[k + 1]! - uy[k]!) * alpha : uy[k]!;
  }
  const isDown = (u: number): boolean => {
    const d = data.downTick[u];
    return d !== null && d !== undefined && T >= d;
  };

  const units: UnitRenderState[] = [];
  const telegraphs: TelegraphRenderState[] = [];
  const captainNow: (number | null)[] = [0, 1].map((side) => {
    const list = data.captains[side as Side];
    return list[lastAtOrBefore(list, T, (c) => c.tick)]?.unit ?? null;
  });

  for (let u = 0; u < n; u++) {
    const down = isDown(u);
    const side = data.sides[u]!;
    const decision = (() => {
      const list = data.decisions[u]!;
      const i = lastAtOrBefore(list, T, (d) => d.tick);
      return i >= 0 ? list[i]! : null;
    })();
    const cast = activeCast(data.casts[u]!, T);

    // Statuses: merge the live versions of every instance of one status into one entry.
    const merged: MergedStatus[] = [];
    let incap: UnitAction | null = null;
    if (!down) {
      for (const s of data.statuses[u]!) {
        if (s.from > T) break;
        if (T >= s.to) continue;
        if (s.incapacitates) incap = incap === 'stunned' ? incap : s.incapacitates;
        const m = merged.find((e) => e.seg.status === s.status);
        if (m) {
          m.stacks = s.stacking === 'stacks' ? m.stacks + s.stacks : Math.max(m.stacks, s.stacks);
          m.applied = Math.min(m.applied, s.appliedTick);
          m.ends = Math.max(m.ends, s.endsTick);
        } else {
          merged.push({ seg: s, stacks: s.stacks, applied: s.appliedTick, ends: s.endsTick });
        }
      }
    }
    const statuses: StatusRenderState[] = merged.map((m) => ({ status: m.seg.status, category: m.seg.category, stacks: m.stacks, appliedTick: m.applied, endsTick: m.ends }));

    // Displacement.
    let dispKind: 'dash' | 'leap' | 'knockback' | 'pull' | null = null;
    for (const d of data.displaces[u]!) {
      if (d.start > T) break;
      if (T < d.end) dispKind = d.kind;
    }

    // Movement between the last two frames at or before the tick.
    let moving = false;
    if (k > 0) {
      const dx = ft.x[u]![k]! - ft.x[u]![k - 1]!;
      const dy = ft.y[u]![k]! - ft.y[u]![k - 1]!;
      moving = dx * dx + dy * dy >= MOVE_MIN_CM2;
    }

    let action: UnitAction;
    if (down) action = 'downed';
    else if (incap) action = incap;
    else if (dispKind === 'knockback' || dispKind === 'pull') action = 'displaced';
    else if (cast) action = cast.kind;
    else if (dispKind !== null || moving) action = 'move';
    else action = 'idle';

    // Facing: the cast target, else the committed target, else the way the unit last moved.
    const decisionTarget = decision?.event.data?.targetUnit ?? null;
    const committed = decisionTarget !== null && decisionTarget !== u && decisionTarget >= 0 && decisionTarget < n && !isDown(decisionTarget) ? decisionTarget : null;
    let facing = ft.heading[u]![k]!;
    if (!down) {
      const aim = cast && cast.target !== null && cast.target !== u && cast.target < n ? cast.target : committed;
      if (aim !== null) {
        const dx = xs[aim]! - xs[u]!;
        const dy = ys[aim]! - ys[u]!;
        if (dx !== 0 || dy !== 0) facing = Math.atan2(dy, dx);
      }
    }

    let castState: CastRenderState | null = null;
    if (cast && !down) {
      const span = Math.max(1, cast.planned - cast.start);
      castState = {
        ability: cast.ability,
        kind: cast.kind,
        startTick: cast.start,
        endTick: cast.planned,
        progress: Math.min(1, Math.max(0, (T - cast.start) / span)),
        target: cast.target,
      };
      // A telegraph for casts and channels that read as one (04 §7): an area, or a line to the target.
      if (cast.kind !== 'windup') {
        const tele = cast.cue?.telegraph ?? null;
        if (tele && cast.planned - cast.start >= tele.minTicks) {
          const tgt = cast.target !== null && cast.target < n ? cast.target : null;
          const aimsAtOther = tgt !== null && tgt !== u;
          const toward = aimsAtOther ? Math.atan2(ys[tgt]! - ys[u]!, xs[tgt]! - xs[u]!) : facing;
          let tx = xs[u]!;
          let ty = ys[u]!;
          let size = tele.sizeCm;
          let ok = true;
          if (tele.shape === 'single') {
            if (aimsAtOther) size = Math.hypot(xs[tgt]! - xs[u]!, ys[tgt]! - ys[u]!);
            else ok = false;
          } else if (tele.shape === 'circle' && cast.center === 'target' && tgt !== null) {
            tx = xs[tgt]!;
            ty = ys[tgt]!;
          }
          if (ok) {
            telegraphs.push({
              caster: u,
              ability: cast.ability,
              shape: tele.shape,
              x: tx,
              y: ty,
              size,
              spread: tele.spread,
              direction: toward,
              progress: castState.progress,
            });
          }
        }
      }
    }

    const hits = data.hitTicks[u]!;
    const hi = bisectRight(hits, T) - 1;
    const rule = decision && !down ? ruleBadge(decision, ctx.units[u]?.ruleCount, T, pulseTicks, reduced) : null;
    const shield = ft.shield[u]![k]!;
    const focus = ft.focus[u]![k]!;
    units.push({
      unit: u,
      side,
      x: xs[u]!,
      y: ys[u]!,
      facing,
      hp: down ? 0 : ft.hp[u]![k]!,
      maxHp: data.maxHp[u]!,
      shield: Number.isNaN(shield) ? null : down ? 0 : shield,
      focus: Number.isNaN(focus) ? null : focus,
      standing: !down,
      downedTick: down ? (data.downTick[u] ?? null) : null,
      action,
      cast: castState,
      statuses,
      rule,
      isCaptain: !down && captainNow[side] === u,
      targetUnit: down ? null : committed,
      lastHitTick: hi >= 0 ? hits[hi]! : null,
    });
  }

  // Projectiles in flight: homing from where the launcher stood toward the target's current position.
  const projectiles: ProjectileRenderState[] = [];
  const anchor: Pos = { x: 0, y: 0 };
  const pj = lastAtOrBefore(data.projectiles, T, (p) => p.launch);
  for (let i = pj; i >= 0; i--) {
    const p = data.projectiles[i]!;
    if (p.launch < T - data.maxFlight) break;
    if (T >= p.land) continue;
    const progress = Math.min(1, Math.max(0, (T - p.launch) / (p.land - p.launch)));
    positionAt(ft, p.source, p.launch, anchor, known);
    const tx = p.target !== null && p.target < n ? xs[p.target]! : anchor.x;
    const ty = p.target !== null && p.target < n ? ys[p.target]! : anchor.y;
    projectiles.push({ id: p.id, ability: p.ability, source: p.source, target: p.target, x: anchor.x + (tx - anchor.x) * progress, y: anchor.y + (ty - anchor.y) * progress, progress });
  }
  projectiles.reverse();

  const zones: ZoneRenderState[] = [];
  for (const z of data.zones) {
    if (z.spawn > T) break;
    if (T >= z.expire) continue;
    zones.push({
      id: z.id,
      ability: z.ability,
      owner: z.owner,
      side: z.side,
      x: z.follow ? xs[z.owner]! : z.x,
      y: z.follow ? ys[z.owner]! : z.y,
      radius: z.radius,
      spawnTick: z.spawn,
      endsTick: z.endsTick,
    });
  }

  const effects: EffectRenderState[] = [];
  const from = bisectLeft(data.effectTicks, T - data.maxEffectLife);
  const to = bisectRight(data.effectTicks, T);
  for (let i = from; i < to; i++) {
    const e = data.effects[i]!;
    if (T >= e.end) continue;
    if (reduced && MOTION_ONLY_EFFECTS.has(e.kind)) continue;
    if (e.needsStanding.some(isDown)) continue;
    let x = e.x;
    let y = e.y;
    if (e.anchor !== null) {
      positionAt(ft, e.anchor, e.tick, anchor, known);
      x = anchor.x;
      y = anchor.y;
    }
    // Reduced motion: effects sit at their end state; a number keeps its age (it fades in place, A9).
    const age = reduced && e.kind !== 'number' ? 1 : Math.min(1, Math.max(0, (T - e.tick) / (e.end - e.tick)));
    effects.push({ id: e.id, kind: e.kind, unit: e.unit, target: e.target, ability: e.ability, x, y, amount: e.amount, crit: e.crit, tone: e.tone, age });
  }

  let home = 0;
  let away = 0;
  for (let u = 0; u < n; u++) {
    if (!units[u]!.standing) continue;
    if (data.sides[u] === 0) home++;
    else away++;
  }
  const ended = data.endTick !== null && T >= data.endTick;
  return {
    tick: T,
    fightSeconds: T * data.tickSeconds,
    overtime: data.overtimeTick !== null && T >= data.overtimeTick,
    ended,
    endTick: ended ? data.endTick : null,
    units,
    projectiles,
    zones,
    telegraphs,
    effects,
    standing: { home, away },
    captains: { home: captainNow[0] ?? null, away: captainNow[1] ?? null },
  };
}
