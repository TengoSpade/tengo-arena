/**
 * Phases 2 and 3: decisions with reaction delay (03 sys-tactics "Commit with
 * reaction delay", P-06) and action execution beneath the rules (sys-fight-ai
 * timing rules: basic windups, casts, channels, releases).
 */
import { decideTactics, evaluateTactics, type Decision, type TraceEntry } from '../tactics';
import type { Fight } from './fight';
import { canEvaluate, has, isImmobile, nearestEnemyInRange, retreatGap, sameDecision } from './resolve';
import { ACT_CAST, ACT_CHANNEL, ACT_NONE, ACT_WINDUP, type Unit } from './state';
import { BP, SC_ANCHORED, SC_ROOT, SC_SILENCE, SC_SLEEP, SC_STUN, SC_TAUNT } from './tables';
import { SimView } from './view';

const views = new WeakMap<Fight, SimView>();

function viewOf(f: Fight): SimView {
  let v = views.get(f);
  if (!v) {
    v = new SimView(f);
    views.set(f, v);
  }
  return v;
}

/** Start-of-tick snapshot of who targets whom (decisions read it, never live commits). */
export function snapshotTargets(f: Fight): void {
  let changed = f.tick === 0;
  for (const u of f.units) {
    const d = u.committed;
    let target = -1;
    let aim = -1;
    if (u.standing && d && d.target !== null && f.units[d.target]!.standing) {
      target = d.target;
      if (f.units[target]!.side !== u.side) aim = target;
    }
    if (u.standing && aim < 0 && u.subTarget >= 0 && f.units[u.subTarget]!.standing && f.units[u.subTarget]!.side !== u.side) aim = u.subTarget;
    f.snapTarget[u.index] = target;
    if (f.snapAim[u.index] !== aim) {
      f.snapAim[u.index] = aim;
      changed = true;
    }
  }
  if (!changed) return;
  for (let i = 0; i < 10; i++) {
    const list = f.targeters[i]!;
    if (list.length > 0) list.length = 0;
  }
  for (let i = 0; i < 10; i++) {
    const aim = f.snapAim[i]!;
    if (aim >= 0) f.targeters[aim]!.push(i);
  }
  for (const u of f.units) if (u.targetedMods) u.modsDirty = true;
}

export function decisions(f: Fight): void {
  snapshotTargets(f);
  const view = viewOf(f);
  view.sync();
  const t = f.tick;
  for (const idx of f.order) {
    const u = f.units[idx]!;
    if (!u.standing) continue;
    const p = u.pending;
    if (p && t >= p.commitAt) {
      const tgt = p.decision.target;
      if (tgt !== null && !f.units[tgt]!.standing) {
        u.pending = null;
        u.nextEval = t;
      } else {
        commitDecision(f, u, p.decision, p.trace, t - p.createdAt, p.causes);
      }
    }
    if (u.forced || !canEvaluate(u) || t < u.nextEval) continue;
    u.nextEval = t + f.tb.timing.decisionInterval;
    // Fast path: the decision alone; the traced evaluation only when something changes.
    const quick = decideTactics(u.tactics, view, idx);
    if (quick.target === null) continue;
    if (u.committed && sameDecision(quick, u.committed)) {
      u.pending = null;
      // Two rules with the same action and target are one decision: switch attribution without delay.
      if (quick.rule !== u.committed.rule) commitDecision(f, u, quick, evaluateTactics(u.tactics, view, idx).trace, 0, []);
      continue;
    }
    if (u.pending && sameDecision(quick, u.pending.decision) && quick.rule === u.pending.decision.rule) continue;
    const ev = evaluateTactics(u.tactics, view, idx);
    const d = ev.decision;
    if (u.pending) {
      // A later different result replaces the pending one without restarting the timer.
      u.pending.decision = d;
      u.pending.trace = ev.trace;
      continue;
    }
    let commitAt: number;
    let causes: string[];
    if (u.firstDecision) {
      u.firstDecision = false;
      commitAt = t + u.stagger;
      causes = ['opening'];
    } else {
      const r = f.reactionTicks(u);
      const jitter = u.rngReact.int(0, f.tb.derived.jitterMax);
      commitAt = t + r.ticks + jitter;
      causes = r.pressure ? ['pressure'] : [];
    }
    u.pending = { decision: d, trace: ev.trace, createdAt: t, commitAt, causes };
    if (commitAt <= t) commitDecision(f, u, d, ev.trace, 0, causes);
  }
}

export function commitDecision(f: Fight, u: Unit, d: Decision, trace: TraceEntry[], reactTicks: number, causes: string[]): void {
  const t = f.tick;
  const prev = u.committed;
  if (prev && prev.rule >= 0 && prev.rule < u.ruleCount && prev.rule !== d.rule && isMovementAction(prev.action)) {
    startRuleCooldown(f, u, prev.rule);
  }
  u.committed = d;
  u.committedTrace = trace;
  u.pending = null;
  u.subTarget = -1;
  if (d.rule >= 0) u.tally.ruleFires[d.rule]!++;
  else u.tally.forcedCommits++;
  for (const e of trace) {
    if (e.skip === null) continue;
    const m = u.tally.ruleSkips[e.rule];
    if (m) m.set(e.skip, (m.get(e.skip) ?? 0) + 1);
  }
  if (f.rec && f.rec.full) {
    f.rec.emit('unit.decide', t, u.index, d.target ?? undefined, {
      rule: d.rule,
      action: d.action === 'ability' ? `ability:${d.slot}` : d.action,
      targetUnit: d.target,
      reactTicks,
      reactCauses: causes,
      commitTick: t,
      trace,
    });
  }
}

function isMovementAction(a: Decision['action']): boolean {
  return a === 'kite' || a === 'hold' || a === 'protect' || a === 'regroup';
}

function startRuleCooldown(f: Fight, u: Unit, rule: number): void {
  const internal = u.tactics.internal as { rules: { cooldownTicks: number }[] };
  const cd = internal.rules[rule]?.cooldownTicks ?? 0;
  if (cd > 0) u.ruleCdEnd[rule] = f.tick + cd;
}

/** A forced decision (taunt) commits at once. */
export function forceDecision(f: Fight, u: Unit, taunter: number): void {
  u.forced = true;
  commitDecision(f, u, { rule: -1, action: 'attack', slot: null, target: taunter, band: null }, [], 0, ['taunted']);
}

// ---- Phase 3: actions ------------------------------------------------------------------------------

export function actions(f: Fight): void {
  for (const idx of f.order) {
    const u = f.units[idx]!;
    if (!u.standing || u.disp) continue;
    if (has(u, SC_STUN) || has(u, SC_SLEEP)) continue;
    switch (u.act) {
      case ACT_WINDUP:
        if (--u.actLeft <= 0) releaseBasic(f, u);
        continue;
      case ACT_CAST:
        if (--u.actLeft <= 0) releaseAbility(f, u);
        continue;
      case ACT_CHANNEL:
        channelTick(f, u);
        continue;
      default:
        tryStart(f, u);
    }
  }
}

function windupTicks(f: Fight, u: Unit): number {
  const frac = u.cls.basic.ranged ? f.tb.timing.windupRangedBp : f.tb.timing.windupMeleeBp;
  const w = Math.trunc((u.intervalTicks * frac * (BP + u.mods[25]!)) / (f.attackSpeedBp(u) * BP));
  return Math.max(1, w);
}

function swingReady(u: Unit): boolean {
  return u.swingAcc >= u.swingThreshold;
}

function startWindup(f: Fight, u: Unit, target: number): void {
  u.swingAcc -= u.swingThreshold;
  u.act = ACT_WINDUP;
  u.actLeft = windupTicks(f, u);
  u.actTarget = target;
  u.actAbility = u.cls.basic;
  u.actStart = f.tick;
  if (f.rec && f.rec.full) f.rec.emit('attack.start', f.tick, u.index, target, { windupTicks: u.actLeft });
}

/** Try a basic attack on `target` if it is in range and the swing is ready. */
function swingAt(f: Fight, u: Unit, target: number): void {
  if (target < 0 || !swingReady(u)) return;
  const tg = f.units[target]!;
  if (!tg.standing || tg.side === u.side) return;
  if (f.gap(u.index, target) <= u.basicRangeMm) startWindup(f, u, target);
}

export function abilityUsable(_f: Fight, u: Unit, slot: 'a1' | 'a2'): boolean {
  const ab = slot === 'a1' ? u.cls.a1 : u.cls.a2;
  if ((slot === 'a1' ? u.cdA1 : u.cdA2) > 0) return false;
  if (u.focus < ab.focusMilli) return false;
  if (has(u, SC_SILENCE) || has(u, SC_TAUNT)) return false;
  if (ab.movesCaster && (has(u, SC_ROOT) || has(u, SC_ANCHORED))) return false;
  return true;
}

/**
 * The decision the fighter acts on this tick. While the committed decision is
 * spent or invalid (its ability just released or cannot be used, or its
 * target is down) and the next decision waits out the reaction delay, the
 * fighter follows its stance toward the stance target instead of standing
 * still (orchestrator decision 2026-10-25, research C2.1: idle <= 5%).
 */
export function effectiveDecision(f: Fight, u: Unit): Decision | null {
  const d = u.committed;
  if (!d) return null;
  let valid = d.target !== null && f.units[d.target]!.standing;
  if (valid && d.action === 'ability' && !abilityUsable(f, u, d.slot!)) valid = false;
  if (valid || u.forced) return d;
  const target = stanceTargetOf(f, u);
  if (target < 0) return null;
  u.fallback.rule = u.ruleCount;
  u.fallback.target = target;
  return u.fallback;
}

/** Nearest standing enemy; the current aim is kept within the stickiness gap tolerance; ties to the lower slot. */
function stanceTargetOf(f: Fight, u: Unit): number {
  let best = -1;
  let bestGap = Number.MAX_SAFE_INTEGER;
  for (const e of f.units) {
    if (!e.standing || e.side === u.side) continue;
    const g = f.gap(u.index, e.index);
    if (g < bestGap) {
      best = e.index;
      bestGap = g;
    }
  }
  const aim = f.snapAim[u.index]!;
  if (aim >= 0 && aim !== best && f.units[aim]!.standing && f.gap(u.index, aim) - bestGap <= f.tb.movement.stickGapMm) return aim;
  return best;
}

function tryStart(f: Fight, u: Unit): void {
  const c = u.committed;
  if (c && c.target !== null && !f.units[c.target]!.standing) u.nextEval = Math.min(u.nextEval, f.tick + 1);
  const d = effectiveDecision(f, u);
  if (!d || d.target === null) return;
  const tgt = f.units[d.target]!;
  if (!tgt.standing) return;
  const gap = f.gap(u.index, d.target);
  switch (d.action) {
    case 'attack':
      swingAt(f, u, d.target);
      return;
    case 'stance': {
      const stance = u.tactics.stance;
      if (stance === 'cautious' && gap < retreatGap(f, u, null) && !u.retreatBlocked && !isImmobile(u)) return;
      swingAt(f, u, d.target);
      return;
    }
    case 'kite': {
      const band = d.band ? f.tb.bands[d.band] : 0;
      if (gap <= band && !u.retreatBlocked && !isImmobile(u)) return;
      swingAt(f, u, d.target);
      return;
    }
    case 'hold':
      holdSwing(f, u, d.target);
      return;
    case 'protect': {
      if (!u.inPosition) return;
      const attacker = u.protectAttacker;
      if (attacker >= 0 && f.gap(u.index, attacker) <= u.basicRangeMm) swingAt(f, u, attacker);
      else holdSwing(f, u, -1);
      return;
    }
    case 'regroup':
      if (gap <= f.tb.movement.regroupGapMm) holdSwing(f, u, -1);
      return;
    case 'ability': {
      const slot = d.slot!;
      if (!abilityUsable(f, u, slot)) return;
      const ab = slot === 'a1' ? u.cls.a1 : u.cls.a2;
      if (ab.target !== 'self' && d.target !== u.index && gap > ab.rangeMm) return;
      u.act = ACT_CAST;
      u.actLeft = ab.castTicks;
      u.actAbility = ab;
      u.actTarget = d.target;
      u.actStart = f.tick;
      if (f.rec && f.rec.full) f.rec.emit('cast.start', f.tick, u.index, d.target, { ability: ab.id, castTicks: ab.castTicks });
      if (ab.castTicks === 0) releaseAbility(f, u);
      return;
    }
  }
}

/** hold: the selected enemy if in range, else the nearest enemy in range. */
function holdSwing(f: Fight, u: Unit, preferred: number): void {
  const target =
    preferred >= 0 && f.units[preferred]!.side !== u.side && f.gap(u.index, preferred) <= u.basicRangeMm
      ? preferred
      : nearestEnemyInRange(f, u, u.basicRangeMm);
  if (target >= 0) {
    u.subTarget = target;
    swingAt(f, u, target);
  }
}

function releaseBasic(f: Fight, u: Unit): void {
  const target = u.actTarget;
  u.act = ACT_NONE;
  const tg = f.units[target]!;
  if (!tg.standing || f.gap(u.index, target) > u.basicRangeMm + f.tb.timing.leewayMm) {
    u.swingAcc = Math.min(u.swingThreshold, u.swingAcc + u.swingThreshold);
    if (f.rec && f.rec.full) f.rec.emit('attack.cancel', f.tick, u.index, target, { reason: tg.standing ? 'out_of_range' : 'target_down' });
    return;
  }
  const ab = u.cls.basic;
  const rel = f.newRelease(u.index, ab, { isBasic: true });
  u.tally.casts.set(ab.id, (u.tally.casts.get(ab.id) ?? 0) + 1);
  if (f.rec && f.rec.full) f.rec.emit('cast.release', f.tick, u.index, target, { ability: ab.id, focusSpent: 0, cooldownTicks: 0 });
  ruleReleased(f, u);
  deliver(f, u, ab, rel, target);
}

function ruleReleased(f: Fight, u: Unit): void {
  const d = u.committed;
  if (d && d.rule >= 0 && d.rule < u.ruleCount && !isMovementAction(d.action)) startRuleCooldown(f, u, d.rule);
}

function releaseAbility(f: Fight, u: Unit): void {
  const ab = u.actAbility!;
  const target = u.actTarget;
  u.act = ACT_NONE;
  const tg = f.units[target]!;
  const selfCast = ab.target === 'self' || target === u.index;
  if (!tg.standing || (!selfCast && f.gap(u.index, target) > ab.rangeMm + f.tb.timing.leewayMm)) {
    if (f.rec) f.rec.emit('cast.interrupt', f.tick, u.index, target, { ability: ab.id, by: null, cause: tg.standing ? 'out_of_range' : 'target_down' });
    u.nextEval = Math.min(u.nextEval, f.tick + 1);
    return;
  }
  u.focus -= ab.focusMilli;
  if (ab.slot === 'a1') u.cdA1 = ab.cooldownTicks * BP;
  else if (ab.slot === 'a2') u.cdA2 = ab.cooldownTicks * BP;
  u.tally.focusSpent += Math.trunc(ab.focusMilli / 1000);
  u.tally.casts.set(ab.id, (u.tally.casts.get(ab.id) ?? 0) + 1);
  if (f.rec) f.rec.emit('cast.release', f.tick, u.index, target, { ability: ab.id, focusSpent: Math.trunc(ab.focusMilli / 1000), cooldownTicks: ab.cooldownTicks }, true);
  ruleReleased(f, u);
  u.nextEval = Math.min(u.nextEval, f.tick + 1);
  if (ab.channel) {
    u.act = ACT_CHANNEL;
    u.actTarget = target;
    u.actStart = f.tick;
    u.channelNext = f.tick + ab.channel.intervalTicks;
    u.channelEnd = f.tick + ab.channel.durationTicks;
    return;
  }
  deliver(f, u, ab, f.newRelease(u.index, ab), target);
}

function channelTick(f: Fight, u: Unit): void {
  const ab = u.actAbility!;
  const target = u.actTarget;
  const tg = f.units[target]!;
  const selfCast = ab.target === 'self' || target === u.index;
  if (!tg.standing || (!selfCast && f.gap(u.index, target) > ab.rangeMm + f.tb.timing.leewayMm)) {
    u.act = ACT_NONE;
    u.nextEval = Math.min(u.nextEval, f.tick + 1);
    return;
  }
  if (f.tick >= u.channelNext) {
    u.channelNext += ab.channel!.intervalTicks;
    f.schedule(f.tick, { kind: 'release', seq: f.nextSeq(), source: u.index, rel: f.newRelease(u.index, ab), ability: ab, target });
  }
  if (f.tick >= u.channelEnd) {
    u.act = ACT_NONE;
    u.nextEval = Math.min(u.nextEval, f.tick + 1);
  }
}

/** Delivery: instant effects this tick, a homing projectile, or a dash / leap with effects on arrival. */
function deliver(f: Fight, u: Unit, ab: Unit['cls']['basic'], rel: ReturnType<Fight['newRelease']>, target: number): void {
  const t = f.tick;
  switch (ab.delivery) {
    case 'instant':
      f.schedule(t, { kind: 'release', seq: f.nextSeq(), source: u.index, rel, ability: ab, target });
      return;
    case 'projectile': {
      const speed = Math.max(1, ab.deliverySpeedMm);
      const gap = f.gap(u.index, target);
      const land = t + Math.ceil(gap / speed);
      f.projectiles.push({ rel, ability: ab, target, land, seq: f.nextSeq() });
      if (f.rec && f.rec.full) f.rec.emit('projectile.launch', t, u.index, target, { ability: ab.id, landTick: land });
      return;
    }
    case 'dash':
    case 'leap': {
      const tg = f.units[target]!;
      const dx = tg.x - u.x;
      const dy = tg.y - u.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const reach = 2 * f.tb.arena.radiusMm + (ab.endBehind ? 200 : f.tb.movement.insetMm);
      let tx: number;
      let ty: number;
      if (d === 0) {
        tx = u.x;
        ty = u.y;
      } else if (ab.endBehind) {
        tx = tg.x + Math.trunc((dx * reach) / d);
        ty = tg.y + Math.trunc((dy * reach) / d);
      } else {
        tx = tg.x - Math.trunc((dx * reach) / d);
        ty = tg.y - Math.trunc((dy * reach) / d);
      }
      const a = f.tb.arena;
      tx = Math.min(a.widthMm - a.radiusMm, Math.max(a.radiusMm, tx));
      ty = Math.min(a.heightMm - a.radiusMm, Math.max(a.radiusMm, ty));
      const speed = ab.deliverySpeedMm > 0 ? ab.deliverySpeedMm : ab.delivery === 'dash' ? f.tb.movement.dashMm : f.tb.movement.leapMm;
      cancelMovementAction(u);
      u.disp = {
        kind: ab.delivery,
        tx,
        ty,
        speed,
        stopUnit: ab.endBehind ? -1 : target,
        stopGapMm: ab.endBehind ? -1 : f.tb.movement.insetMm,
        arrive: { rel, ability: ab, target },
        fromX: u.x,
        fromY: u.y,
        startedAt: t,
      };
      if (f.rec && f.rec.full) f.rec.emit('displace', t, u.index, target, { kind: ab.delivery, from: [Math.trunc(u.x / 10), Math.trunc(u.y / 10)], to: [Math.trunc(tx / 10), Math.trunc(ty / 10)], ticks: Math.ceil(d / speed) });
      return;
    }
  }
}

function cancelMovementAction(u: Unit): void {
  if (u.act === ACT_WINDUP) u.swingAcc = Math.min(u.swingThreshold, u.swingAcc + u.swingThreshold);
  u.act = ACT_NONE;
}
