/**
 * Phase 4: movement (03 sys-movement, sys-fight-ai behaviours). Goals use
 * start-of-tick positions; all steps apply simultaneously; then
 * displacements, two separation passes and the wall clamp. Integer mm.
 */
import type { Fight } from './fight';
import { abilityUsable } from './act';
import { has, isImmobile, nearestEnemyInRange, retreatGap } from './resolve';
import { ACT_CAST, ACT_CHANNEL, ACT_WINDUP, type Unit } from './state';
import { BP, SC_ANCHORED, SC_ROOT, SC_SLEEP, SC_STUN } from './tables';

const stepX = new Int32Array(10);
const stepY = new Int32Array(10);

type Goal = { kind: 'none' } | { kind: 'to'; x: number; y: number; approachTarget: number } | { kind: 'away'; from: number };

const NONE: Goal = { kind: 'none' };

export function movement(f: Fight): void {
  const t = f.tick;
  for (let i = 0; i < 10; i++) {
    stepX[i] = 0;
    stepY[i] = 0;
  }
  for (const u of f.units) {
    u.retreatBlocked = false;
    if (!u.standing || u.disp || isImmobile(u)) continue;
    if (u.act === ACT_WINDUP || u.act === ACT_CAST) continue;
    let speed = f.speedMm(u);
    if (u.act === ACT_CHANNEL) {
      const ch = u.actAbility?.channel;
      if (!ch || !ch.mobile) continue;
      speed = Math.trunc((speed * ch.speedMultBp) / BP);
    }
    if (speed <= 0) continue;
    const goal = goalFor(f, u);
    if (goal.kind === 'to') stepTo(f, u, goal.x, goal.y, speed, goal.approachTarget);
    else if (goal.kind === 'away') stepAway(f, u, goal.from, speed);
  }
  for (const u of f.units) {
    if (stepX[u.index] === 0 && stepY[u.index] === 0) continue;
    u.x += stepX[u.index]!;
    u.y += stepY[u.index]!;
  }
  for (const u of f.units) if (u.standing && u.disp) advanceDisplacement(f, u);
  separate(f);
  const a = f.tb.arena;
  for (const u of f.units) {
    u.x = clampI(u.x, a.radiusMm, a.widthMm - a.radiusMm);
    u.y = clampI(u.y, a.radiusMm, a.heightMm - a.radiusMm);
  }
  void t;
}

function clampI(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function goalFor(f: Fight, u: Unit): Goal {
  const d = u.committed;
  if (!d || d.target === null) return NONE;
  const tgt = f.units[d.target]!;
  if (!tgt.standing) return NONE;
  const gap = f.gap(u.index, d.target);
  switch (d.action) {
    case 'attack':
      return approach(f, u, d.target, u.basicRangeMm, gap);
    case 'stance': {
      const stance = u.tactics.stance;
      if (stance === 'aggressive') return approach(f, u, d.target, u.basicRangeMm, gap);
      if (stance === 'cautious') {
        const minGap = retreatGap(f, u, null);
        if (gap < minGap) return { kind: 'away', from: d.target };
        return approach(f, u, d.target, Math.max(minGap + f.tb.movement.insetMm, u.basicRangeMm), gap);
      }
      // steady: never more than steadyLead past our frontmost ally unless an enemy is in range.
      if (nearestEnemyInRange(f, u, u.basicRangeMm) >= 0) return NONE;
      const g = approach(f, u, d.target, u.basicRangeMm, gap);
      if (g.kind !== 'to') return g;
      let front = u.side === 0 ? -1 : Number.MAX_SAFE_INTEGER;
      let any = false;
      for (const o of f.units) {
        if (o === u || !o.standing || o.side !== u.side) continue;
        any = true;
        if (u.side === 0 ? o.x > front : o.x < front) front = o.x;
      }
      if (!any) return g;
      const frontmost = u.side === 0 ? u.x >= front : u.x <= front;
      if (frontmost) return g;
      const limit = u.side === 0 ? front + f.tb.movement.steadyLeadMm : front - f.tb.movement.steadyLeadMm;
      const x = u.side === 0 ? Math.min(g.x, limit) : Math.max(g.x, limit);
      if (Math.abs(x - u.x) < 1 && Math.abs(g.y - u.y) < 1) return NONE;
      return { kind: 'to', x, y: g.y, approachTarget: d.target };
    }
    case 'kite': {
      const band = d.band ? f.tb.bands[d.band] : 0;
      if (gap <= band) return { kind: 'away', from: d.target };
      if (gap <= u.basicRangeMm) return NONE;
      return approach(f, u, d.target, Math.max(u.basicRangeMm, band + 2 * f.tb.movement.insetMm), gap);
    }
    case 'hold':
      return NONE;
    case 'protect': {
      const ally = tgt;
      let attacker = -1;
      let best = Number.MAX_SAFE_INTEGER;
      for (const e of f.targeters[ally.index]!) {
        const g = f.gap(ally.index, e);
        if (g < best || (g === best && e < attacker)) {
          best = g;
          attacker = e;
        }
      }
      if (attacker < 0) {
        for (const e of f.units) {
          if (!e.standing || e.side === u.side) continue;
          const g = f.gap(ally.index, e.index);
          if (g < best) {
            best = g;
            attacker = e.index;
          }
        }
      }
      u.protectAttacker = attacker;
      if (attacker < 0) {
        u.inPosition = true;
        return NONE;
      }
      const at = f.units[attacker]!;
      const dx = at.x - ally.x;
      const dy = at.y - ally.y;
      const dd = Math.sqrt(dx * dx + dy * dy);
      const off = 2 * f.tb.arena.radiusMm + f.tb.movement.protectOffsetMm;
      const px = dd === 0 ? ally.x : ally.x + Math.trunc((dx * off) / dd);
      const py = dd === 0 ? ally.y : ally.y + Math.trunc((dy * off) / dd);
      const mx = px - u.x;
      const my = py - u.y;
      u.inPosition = mx * mx + my * my <= 500 * 500;
      return u.inPosition ? NONE : { kind: 'to', x: px, y: py, approachTarget: -1 };
    }
    case 'regroup':
      return approach(f, u, d.target, f.tb.movement.regroupGapMm, gap);
    case 'ability': {
      if (!abilityUsable(f, u, d.slot!)) return NONE;
      const ab = d.slot === 'a1' ? u.cls.a1 : u.cls.a2;
      if (ab.target === 'self' || d.target === u.index || !ab.approach) return NONE;
      return approach(f, u, d.target, ab.rangeMm, gap);
    }
  }
}

/** Move until the gap equals range - approachInset (sys-fight-ai). */
function approach(f: Fight, u: Unit, target: number, rangeMm: number, gap: number): Goal {
  const want = Math.max(0, rangeMm - f.tb.movement.insetMm);
  if (gap <= want) return NONE;
  const tg = f.units[target]!;
  const dx = u.x - tg.x;
  const dy = u.y - tg.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const reach = 2 * f.tb.arena.radiusMm + want;
  if (d === 0) return NONE;
  return { kind: 'to', x: tg.x + Math.trunc((dx * reach) / d), y: tg.y + Math.trunc((dy * reach) / d), approachTarget: target };
}

function stepTo(f: Fight, u: Unit, gx: number, gy: number, speed: number, approachTarget: number): void {
  let dx = gx - u.x;
  let dy = gy - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return;
  if (d <= speed) {
    stepX[u.index] = dx;
    stepY[u.index] = dy;
    return;
  }
  let ux = dx / d;
  let uy = dy / d;
  // Sidestep around an ally ahead on the movement line.
  const mv = f.tb.movement;
  for (const o of f.units) {
    if (o === u || !o.standing || o.side !== u.side) continue;
    const ox = o.x - u.x;
    const oy = o.y - u.y;
    const ahead = ox * ux + oy * uy;
    if (ahead <= 0 || ahead > mv.lookAheadMm) continue;
    const lateral = Math.abs(ox * uy - oy * ux);
    if (lateral > mv.corridorMm) continue;
    let px = -uy;
    let py = ux;
    const a = freeSpace(f, u, px, py);
    const b = freeSpace(f, u, -px, -py);
    let pickA: boolean;
    if (a !== b) pickA = a > b;
    else {
      const towardCentre = (f.tb.arena.laneCenterMm - u.y) * py;
      pickA = towardCentre !== 0 ? towardCentre > 0 : py > 0;
    }
    if (f.tick < u.sidestepFlipUntil) pickA = !pickA;
    if (!pickA) {
      px = -px;
      py = -py;
    }
    const w = mv.sidestepBp / BP;
    ux += px * w;
    uy += py * w;
    const n = Math.sqrt(ux * ux + uy * uy);
    ux /= n;
    uy /= n;
    break;
  }
  dx = Math.trunc(ux * speed);
  dy = Math.trunc(uy * speed);
  stepX[u.index] = dx;
  stepY[u.index] = dy;
  // Anti-stuck: less than 0.2 m gained on the target over 1 s flips the sidestep side for 1 s.
  if (approachTarget >= 0) {
    const g = f.gap(u.index, approachTarget);
    if (u.stuckSampleGap < 0 || f.tick - u.stuckSampleTick >= f.tb.tps) {
      if (u.stuckSampleGap >= 0 && u.stuckSampleGap - g < 200) u.sidestepFlipUntil = f.tick + f.tb.tps;
      u.stuckSampleGap = g;
      u.stuckSampleTick = f.tick;
    }
  }
}

/** Distance from the unit to the arena boundary along a unit direction. */
function freeSpace(f: Fight, u: Unit, px: number, py: number): number {
  const a = f.tb.arena;
  let best = Number.MAX_SAFE_INTEGER;
  if (px > 0) best = Math.min(best, (a.widthMm - a.radiusMm - u.x) / px);
  else if (px < 0) best = Math.min(best, (u.x - a.radiusMm) / -px);
  if (py > 0) best = Math.min(best, (a.heightMm - a.radiusMm - u.y) / py);
  else if (py < 0) best = Math.min(best, (u.y - a.radiusMm) / -py);
  return Math.trunc(best);
}

/** Step directly away from `from`, sliding along a wall when blocked (kite, cautious). */
function stepAway(f: Fight, u: Unit, from: number, speed: number): void {
  const src = f.units[from]!;
  let dx = u.x - src.x;
  let dy = u.y - src.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  let ux: number;
  let uy: number;
  if (d === 0) {
    ux = u.side === 0 ? -1 : 1;
    uy = 0;
  } else {
    ux = dx / d;
    uy = dy / d;
  }
  dx = Math.trunc(ux * speed);
  dy = Math.trunc(uy * speed);
  const a = f.tb.arena;
  const lo = a.radiusMm;
  const hiX = a.widthMm - a.radiusMm;
  const hiY = a.heightMm - a.radiusMm;
  let nx = u.x + dx;
  let ny = u.y + dy;
  const lostX = nx < lo ? lo - nx : nx > hiX ? nx - hiX : 0;
  const lostY = ny < lo ? lo - ny : ny > hiY ? ny - hiY : 0;
  nx = clampI(nx, lo, hiX);
  ny = clampI(ny, lo, hiY);
  if (lostX > 0) {
    // Blocked in x: slide along the wall, away from the threat in y (tie: toward the centre line, then +y).
    const sy = src.y !== u.y ? (u.y > src.y ? 1 : -1) : u.y !== a.laneCenterMm ? (a.laneCenterMm > u.y ? 1 : -1) : 1;
    ny = clampI(ny + sy * lostX, lo, hiY);
  }
  if (lostY > 0) {
    const sx = src.x !== u.x ? (u.x > src.x ? 1 : -1) : u.side === 0 ? -1 : 1;
    nx = clampI(nx + sx * lostY, lo, hiX);
  }
  const mx = nx - u.x;
  const my = ny - u.y;
  stepX[u.index] = mx;
  stepY[u.index] = my;
  if ((mx * mx + my * my) * 10 < speed * speed) u.retreatBlocked = true;
}

function advanceDisplacement(f: Fight, u: Unit): void {
  const disp = u.disp!;
  const dx = disp.tx - u.x;
  const dy = disp.ty - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  let done = false;
  if (d <= disp.speed) {
    u.x = disp.tx;
    u.y = disp.ty;
    done = true;
  } else {
    u.x += Math.trunc((dx * disp.speed) / d);
    u.y += Math.trunc((dy * disp.speed) / d);
  }
  if (!done && disp.stopUnit >= 0) {
    const o = f.units[disp.stopUnit]!;
    const cx = o.x - u.x;
    const cy = o.y - u.y;
    const gap = Math.floor(Math.sqrt(cx * cx + cy * cy)) - 2 * f.tb.arena.radiusMm;
    if (gap <= disp.stopGapMm) done = true;
  }
  const a = f.tb.arena;
  if (u.x <= a.radiusMm || u.x >= a.widthMm - a.radiusMm || u.y <= a.radiusMm || u.y >= a.heightMm - a.radiusMm) done = true;
  if (!done) return;
  u.disp = null;
  u.nextEval = Math.min(u.nextEval, f.tick + 1);
  if (disp.arrive) {
    const tg = f.units[disp.arrive.target]!;
    if (tg.standing) {
      f.schedule(f.tick, { kind: 'release', seq: f.nextSeq(), source: u.index, rel: disp.arrive.rel, ability: disp.arrive.ability, target: disp.arrive.target });
    }
  }
}

function immovable(u: Unit): boolean {
  return (
    has(u, SC_ANCHORED) ||
    has(u, SC_ROOT) ||
    has(u, SC_STUN) ||
    has(u, SC_SLEEP) ||
    u.act === ACT_CAST ||
    (u.act === ACT_CHANNEL && !(u.actAbility?.channel?.mobile ?? false))
  );
}

/** Two passes over standing, non-displaced pairs closer than one body width (lower index first). */
function separate(f: Fight): void {
  const minD = 2 * f.tb.arena.radiusMm;
  const us = f.units;
  for (let pass = 0; pass < f.tb.movement.passes; pass++) {
    let pushed = false;
    for (let i = 0; i < 10; i++) {
      const a = us[i]!;
      if (!a.standing || a.disp) continue;
      for (let j = i + 1; j < 10; j++) {
        const b = us[j]!;
        if (!b.standing || b.disp) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        const fixA = immovable(a);
        const fixB = immovable(b);
        if (fixA && fixB) continue;
        pushed = true;
        const d = Math.sqrt(d2);
        const overlap = minD - d;
        let ux: number;
        let uy: number;
        if (d === 0) {
          ux = 0;
          uy = 1;
        } else {
          ux = dx / d;
          uy = dy / d;
        }
        if (fixA || fixB) {
          const push = Math.ceil(overlap) + 1;
          const px = roundAway(ux * push);
          const py = roundAway(uy * push);
          if (fixA) {
            b.x += px;
            b.y += py;
          } else {
            a.x -= px;
            a.y -= py;
          }
        } else {
          const push = Math.ceil(overlap / 2) + 1;
          const px = roundAway(ux * push);
          const py = roundAway(uy * push);
          a.x -= px;
          a.y -= py;
          b.x += px;
          b.y += py;
        }
      }
    }
    if (!pushed) break;
  }
}

function roundAway(v: number): number {
  return v < 0 ? -Math.ceil(-v) : Math.ceil(v);
}
