/**
 * Phase 5 (resolution) and the commit-time queues (03 sys-fight-sim steps
 * 5-6, sys-abilities pipelines, statuses, DR, triggers).
 *
 * Damage and healing are computed in centipoints with start-of-tick
 * modifiers and shields, truncated toward zero at every step, and summed per
 * target until the commit. Statuses, shields, cleanses, displacements and
 * cooldown changes are queued and applied at the commit.
 */
import type { Decision } from '../tactics';
import { forceDecision } from './act';
import type { Fight } from './fight';
import { cm } from './record';
import { ACT_CHANNEL, ACT_NONE, ACT_WINDUP, type Job, type QueuedStatus, type Release, type StatusInst, type Unit, type Zone } from './state';
import { BP, DT_ARCANE, DT_PHYSICAL, SC_ANCHORED, SC_ROOT, SC_SLEEP, SC_STUN, ST, STATUS_CODE, type CAbility, type CAmount, type CEffect, type CStatus } from './tables';

// ---- Small queries ----------------------------------------------------------------------------

/** Status test by code (SC_* constants). */
export function has(u: Unit, code: number): boolean {
  return u.statusCount[code]! > 0;
}

/** Status test by id (content-driven ids). */
export function hasStatus(u: Unit, id: string): boolean {
  const c = STATUS_CODE.get(id);
  return c !== undefined && u.statusCount[c]! > 0;
}

export function statusInst(u: Unit, id: string): StatusInst | null {
  for (const s of u.statuses) if (s.st.id === id) return s;
  return null;
}

export function statusStacks(u: Unit, id: string): number {
  let n = 0;
  for (const s of u.statuses) if (s.st.id === id) n += s.stacks;
  return n;
}

export function canEvaluate(u: Unit): boolean {
  return u.standing && u.disp === null && u.act === ACT_NONE && !has(u, SC_STUN) && !has(u, SC_SLEEP);
}

export function isImmobile(u: Unit): boolean {
  return has(u, SC_STUN) || has(u, SC_SLEEP) || has(u, SC_ROOT) || has(u, SC_ANCHORED);
}

export function sameDecision(a: Decision, b: Decision): boolean {
  return a.action === b.action && a.slot === b.slot && a.target === b.target && a.band === b.band;
}

export function nearestEnemyInRange(f: Fight, u: Unit, rangeMm: number): number {
  let best = -1;
  let bestGap = Number.MAX_SAFE_INTEGER;
  for (const e of f.units) {
    if (!e.standing || e.side === u.side) continue;
    const g = f.gap(u.index, e.index);
    if (g <= rangeMm && g < bestGap) {
      best = e.index;
      bestGap = g;
    }
  }
  return best;
}

/** Cautious stance: keep a gap of at least cautiousMinGapFraction x attack range, min cautiousMinGapFloorM. */
export function retreatGap(f: Fight, u: Unit, _band: null): number {
  return Math.max(Math.trunc((u.basicRangeMm * f.tb.movement.cautiousFracBp) / BP), f.tb.movement.cautiousFloorMm);
}

function displaceImmune(u: Unit): boolean {
  return has(u, SC_ANCHORED) || u.mods[ST.displaceImmune]! > 0;
}

// ---- Status bookkeeping ------------------------------------------------------------------------

export function removeStatusInst(f: Fight, u: Unit, inst: StatusInst, _reason: string): void {
  const i = u.statuses.indexOf(inst);
  if (i < 0) return;
  u.statuses.splice(i, 1);
  u.statusCount[inst.st.code]!--;
  u.modsDirty = true;
  const id = inst.st.id;
  if (id === 'taunt') {
    u.forced = false;
    u.nextEval = Math.min(u.nextEval, f.tick);
  } else if (inst.st.hardCc) {
    u.nextEval = Math.min(u.nextEval, f.tick);
  }
  if (f.rec && f.rec.full) f.rec.emit('status.expire', f.tick, u.index, undefined, { status: id });
}

/** Cancel a windup, cast or channel. Nothing is spent: focus and cooldowns are charged at release. */
export function cancelAction(f: Fight, u: Unit, cause: string | null, by: number | null = null, castsOnly = false): void {
  if (u.act === ACT_NONE) return;
  if (u.act === ACT_WINDUP) {
    if (castsOnly) return;
    u.swingAcc = Math.min(u.swingThreshold, u.swingAcc + u.swingThreshold);
    if (f.rec && f.rec.full && cause) f.rec.emit('attack.cancel', f.tick, u.index, undefined, { reason: cause });
  } else if (cause && f.rec && u.actAbility) {
    f.rec.emit('cast.interrupt', f.tick, u.index, by ?? undefined, { ability: u.actAbility.id, by, cause });
  }
  u.act = ACT_NONE;
  u.nextEval = Math.min(u.nextEval, f.tick + 1);
}

// ---- Dynamic multipliers -------------------------------------------------------------------------

function hitSum(f: Fight, holder: Unit, other: Unit, stat: number): number {
  let v = 0;
  let trait = 0;
  for (const m of holder.hitDealtMods) {
    if (m.stat !== stat || !m.pred || !f.predVs(m.pred, holder, other)) continue;
    if (m.trait) trait += m.value;
    else v += m.value;
  }
  if (trait !== 0) {
    const cap = f.tb.derived.traitCapBp;
    v += Math.min(cap, Math.max(-cap, trait));
  }
  return v;
}

export function dealtMultBp(f: Fight, src: Unit, tgt: Unit): number {
  const [lo, hi] = f.tb.derived.dealtClamp;
  const v = BP + src.mods[ST.damageDealt]! + hitSum(f, src, tgt, ST.damageDealt);
  return Math.min(hi, Math.max(lo, v));
}

export function takenMultBp(f: Fight, recv: Unit, src: Unit): number {
  const [lo, hi] = f.tb.derived.takenClamp;
  let v = BP + recv.mods[ST.damageTaken]!;
  for (const m of recv.hitTakenMods) if (m.stat === ST.damageTaken && m.pred && f.predVs(m.pred, recv, src)) v += m.value;
  for (const m of recv.auraHitTaken) if (m.stat === ST.damageTaken && m.pred && f.predVs(m.pred, recv, src)) v += m.value;
  return Math.min(hi, Math.max(lo, v));
}

export function critBp(f: Fight, src: Unit, tgt: Unit): number {
  const v = src.crit0 + src.mods[ST.crit]! + hitSum(f, src, tgt, ST.crit);
  return Math.min(f.tb.derived.critMaxBp, Math.max(0, v));
}

function healDealtBp(f: Fight, src: Unit, tgt: Unit): number {
  return src.mods[ST.healingDealt]! + hitSum(f, src, tgt, ST.healingDealt);
}

export function evalAmount(a: CAmount, rel: Release, tgt: Unit): number {
  let sum = 0;
  const s = rel.snap;
  for (const p of a.scale) {
    let v = 0;
    switch (p.stat) {
      case 'power':
        v = s.power;
        break;
      case 'support':
        v = s.support;
        break;
      case 'maxHp':
        v = s.maxHp;
        break;
      case 'missingHp':
        v = s.maxHp - s.hp;
        break;
      case 'armor':
        v = Math.max(0, s.armor);
        break;
      case 'ward':
        v = Math.max(0, s.ward);
        break;
      case 'targetMaxHp':
        v = tgt.maxHp;
        break;
      case 'targetMissingHp':
        v = tgt.maxHp - tgt.hp;
        break;
      case 'triggerAmount':
        v = rel.triggerAmount;
        break;
      case 'lastDamage':
        v = rel.lastDamage?.get(tgt.index) ?? 0;
        break;
    }
    sum += p.coefBp * v;
  }
  return a.baseCenti + Math.trunc(sum / 100);
}

// ---- Resolution phase ------------------------------------------------------------------------------

export function resolution(f: Fight): void {
  const t = f.tick;
  const jobs: Job[] = f.jobsAt.get(t) ?? [];
  f.jobsAt.delete(t);
  if (f.projectiles.length > 0) {
    const keep = [];
    for (const p of f.projectiles) {
      if (p.land > t) {
        keep.push(p);
        continue;
      }
      if (f.units[p.target]!.standing) jobs.push({ kind: 'release', seq: p.seq, source: p.rel.source, rel: p.rel, ability: p.ability, target: p.target });
    }
    f.projectiles = keep;
  }
  for (const z of f.zones) {
    if (z.dead || !z.trap || t < z.trap.armAt) continue;
    const owner = f.units[z.owner]!;
    for (const idx of f.order) {
      const e = f.units[idx]!;
      if (!e.standing || e.side === owner.side || e.disp?.kind === 'leap') continue;
      if (!insideCircle(f, z.x, z.y, z.radiusMm, e)) continue;
      jobs.push({ kind: 'effects', seq: f.nextSeq(), source: z.owner, rel: z.rel, effects: z.enemies, target: e.index, cx: z.x, cy: z.y });
      if (f.rec && f.rec.full) f.rec.emit('zone.trigger', t, z.owner, e.index, {});
      if (z.trap.consume) z.dead = true;
      break;
    }
  }
  if (jobs.length === 0) return;
  const rank = f.rank;
  jobs.sort((a, b) => rank[a.source]! - rank[b.source]! || a.seq - b.seq);
  for (const job of jobs) runJob(f, job);
}

function insideCircle(f: Fight, cx: number, cy: number, radiusMm: number, u: Unit): boolean {
  const dx = u.x - cx;
  const dy = u.y - cy;
  const r = radiusMm + f.tb.arena.radiusMm;
  return dx * dx + dy * dy <= r * r;
}

function runJob(f: Fight, job: Job): void {
  switch (job.kind) {
    case 'release':
      applyAbility(f, job.rel, job.ability, job.target);
      return;
    case 'effects': {
      const tgt = f.units[job.target]!;
      if (!tgt.standing) return;
      for (const e of job.effects) applyEffect(f, job.rel, e, tgt, job.target, job.cx, job.cy, BP);
      return;
    }
    case 'dot': {
      const holder = f.units[job.holder]!;
      const inst = job.inst;
      if (!holder.standing || !inst.tick || !holder.statuses.includes(inst)) return;
      const centi = inst.tick.centi * inst.stacks;
      const src = inst.source >= 0 ? inst.source : holder.index;
      const rel = f.newRelease(src, null, { fromTrigger: false });
      if (inst.tick.heal) healPipeline(f, rel, f.units[src]!, holder, centi, inst.ability, true);
      else damageInstance(f, rel, holder, centi, inst.tick.dtype, false, false, 0, inst.ability, true);
      return;
    }
    case 'regen': {
      const u = f.units[job.source]!;
      if (!u.standing) return;
      const centi = Math.trunc((u.maxHp * u.mods[ST.hpRegenPct]!) / 100) + u.mods[ST.hpRegenFlat]!;
      if (centi <= 0) return;
      const rel = f.newRelease(u.index, null, { fromTrigger: true });
      healPipeline(f, rel, u, u, centi, null, false);
      return;
    }
    case 'zone':
      runZoneTick(f, job.zone);
      return;
    case 'reflect': {
      const tgt = f.units[job.target]!;
      if (!tgt.standing) return;
      applyHit(f, job.rel, tgt, job.centi, DT_PHYSICAL, false, false, false, 0, null, 0);
      return;
    }
    case 'fixedHeal': {
      const tgt = f.units[job.target]!;
      if (!tgt.standing) return;
      healPipeline(f, job.rel, f.units[job.rel.source]!, tgt, job.centi, job.ability, false);
      return;
    }
    case 'riposte': {
      const tgt = f.units[job.target]!;
      if (!tgt.standing) return;
      damageInstance(f, job.rel, tgt, job.centi, DT_PHYSICAL, true, false, 0, 'riposte', false);
      return;
    }
  }
}

function runZoneTick(f: Fight, z: Zone): void {
  if (z.dead) return;
  const owner = f.units[z.owner]!;
  for (const u of f.units) {
    if (!u.standing || !insideCircle(f, z.x, z.y, z.radiusMm, u)) continue;
    const list = u.side === owner.side ? z.allies : z.enemies;
    for (const e of list) applyEffect(f, z.rel, e, u, u.index, z.x, z.y, BP);
  }
}

/** Area membership: the unit's centre within the shape expanded by its radius (cones via the cosine table). */
function inArea(f: Fight, ab: CAbility, src: Unit, primary: Unit, cx: number, cy: number, u: Unit): boolean {
  const area = ab.area!;
  const r = f.tb.arena.radiusMm;
  if (area.shape === 'circle') return insideCircle(f, cx, cy, area.radiusMm, u);
  if (u === src) return false;
  const ax = primary.x - src.x;
  const ay = primary.y - src.y;
  const al = Math.sqrt(ax * ax + ay * ay);
  const vx = u.x - src.x;
  const vy = u.y - src.y;
  const vl = Math.sqrt(vx * vx + vy * vy);
  if (area.shape === 'cone') {
    if (vl > area.radiusMm + r) return false;
    if (vl <= r || al === 0 || u === primary) return true;
    return (ax * vx + ay * vy) * BP >= area.cosBp * al * vl;
  }
  // line
  if (al === 0) return false;
  const proj = (vx * ax + vy * ay) / al;
  const lateral = Math.abs(vx * ay - vy * ax) / al;
  return proj >= -r && proj <= area.lengthMm + r && lateral <= area.halfWidthMm + r;
}

export function applyAbility(f: Fight, rel: Release, ab: CAbility, target: number): void {
  const src = f.units[rel.source]!;
  const primary = f.units[target]!;
  if (ab.target !== 'self' && !primary.standing) return;
  const selfList = ab.selfEffects;
  if (ab.selfFirst && selfList.length > 0 && src.standing) applyList(f, rel, selfList, src, target, primary.x, primary.y);
  if (ab.area) {
    const cx = ab.area.centerSelf ? src.x : primary.x;
    const cy = ab.area.centerSelf ? src.y : primary.y;
    const affects = ab.area.affects;
    for (const u of f.units) {
      if (!u.standing) continue;
      const ally = u.side === src.side;
      if (affects === 'enemies' && ally) continue;
      if ((affects === 'allies' || affects === 'allies_incl_self') && !ally) continue;
      if (affects === 'allies' && u === src) continue;
      if (!inArea(f, ab, src, primary, cx, cy, u)) continue;
      const list = affects === 'both' && ally ? ab.allyEffects : ab.effects;
      for (const e of list) applyEffect(f, rel, e, u, target, cx, cy, BP);
    }
  } else if (primary.standing) {
    for (const e of ab.effects) applyEffect(f, rel, e, primary, target, primary.x, primary.y, BP);
  }
  if (!ab.selfFirst && selfList.length > 0 && src.standing) applyList(f, rel, selfList, src, target, primary.x, primary.y);
}

function applyList(f: Fight, rel: Release, list: CEffect[], tgt: Unit, primary: number, cx: number, cy: number): void {
  for (const e of list) applyEffect(f, rel, e, tgt, primary, cx, cy, BP);
}

function lowestAllyWithin(f: Fight, of: Unit, withinMm: number, includeSelf: boolean): number {
  let best = -1;
  let bestHp = 0;
  let bestGap = 0;
  for (const a of f.units) {
    if (!a.standing || a.side !== of.side || (a === of && !includeSelf)) continue;
    const g = f.gap(of.index, a.index);
    if (a !== of && g > withinMm) continue;
    const hp = f.hpBp(a);
    if (best < 0 || hp < bestHp || (hp === bestHp && (g < bestGap || (g === bestGap && a.index < best)))) {
      best = a.index;
      bestHp = hp;
      bestGap = g;
    }
  }
  return best;
}

export function applyEffect(f: Fight, rel: Release, e: CEffect, tgt: Unit, primary: number, cx: number, cy: number, falloffBp: number): void {
  if (!tgt.standing) return;
  const src = f.units[rel.source]!;
  switch (e.type) {
    case 'damage': {
      let a = evalAmount(e.amount, rel, tgt);
      if (falloffBp !== BP) a = Math.trunc((a * falloffBp) / BP);
      for (const b of e.bonus) if (f.predVs(b.pred, src, tgt)) a = Math.trunc((a * b.multBp) / BP);
      if (e.perTargetStack) {
        const stacks = statusStacks(tgt, e.perTargetStack.status);
        a = Math.trunc((a * (BP + e.perTargetStack.multBp * stacks)) / BP);
        if (e.perTargetStack.consume && stacks > 0) f.qConsume.push({ target: tgt.index, status: e.perTargetStack.status });
      }
      const abilityId = rel.ability?.id ?? null;
      const dealt = damageInstance(f, rel, tgt, a, e.dtype, e.canCrit, e.evadable, e.lifestealBp, abilityId, false);
      if (!rel.lastDamage) rel.lastDamage = new Map();
      rel.lastDamage.set(tgt.index, dealt < 0 ? 0 : dealt);
      if (dealt >= 0 && rel.isBasic && tgt.index === primary && !rel.fromTrigger) basicHitTriggers(f, src, tgt);
      if (e.onKill.length > 0 && dealt > 0) f.onKill.push({ src: src.index, target: tgt.index, rel, effects: e.onKill });
      return;
    }
    case 'heal': {
      let a = evalAmount(e.amount, rel, tgt);
      if (falloffBp !== BP) a = Math.trunc((a * falloffBp) / BP);
      const recvIdx = e.to ? lowestAllyWithin(f, src, e.to.withinMm, e.to.includeSelf) : tgt.index;
      if (recvIdx < 0) return;
      const recv = f.units[recvIdx]!;
      for (const b of e.bonus) if (f.predVs(b.pred, src, recv)) a = Math.trunc((a * b.multBp) / BP);
      healPipeline(f, rel, src, recv, a, rel.ability?.id ?? null, true);
      if (!rel.fromTrigger && rel.ability && rel.ability.slot !== 'passive') {
        src.healsCast++;
        src.triggers.forEach((tr, k) => {
          if (tr.on === 'every_n_heals' && src.healsCast % tr.n === 0) fireTrigger(f, src, k, recv.index, src.index, 0);
        });
      }
      return;
    }
    case 'shield': {
      let a = evalAmount(e.amount, rel, tgt);
      a = Math.trunc((a * (BP + healDealtBp(f, src, tgt))) / BP);
      a = Math.trunc((a * f.healRecvBp(tgt)) / BP);
      a = Math.trunc((a * f.overtimeHealBp()) / BP);
      const pts = Math.trunc(a / 100);
      if (pts > 0) f.qShield.push({ rel, target: tgt.index, amount: pts, duration: e.durationTicks });
      return;
    }
    case 'status':
      f.qStatus.push({ rel, target: tgt.index, eff: e, guardian: -1, guardPct: 0, guardRadiusMm: 0 });
      return;
    case 'guard': {
      const st = f.tb.statuses.get('guarded')!;
      f.qStatus.push({
        rel,
        target: tgt.index,
        eff: { type: 'status', status: st, durationTicks: e.durationTicks, magnitude: e.pctBp, maxStacks: 1, tick: null, resetOnTargetChange: false, wardHeal: null },
        guardian: src.index,
        guardPct: e.pctBp,
        guardRadiusMm: e.radiusMm,
      });
      return;
    }
    case 'knockback': {
      const sx = e.fromCaster ? src.x : cx;
      const sy = e.fromCaster ? src.y : cy;
      f.qDisplace.push({ rel, target: tgt.index, kind: 'knockback', mode: null, d: { kind: 'knockback', tx: sx, ty: sy, speed: e.distanceMm, stopUnit: -1, stopGapMm: 0, arrive: null, fromX: sx, fromY: sy, startedAt: f.tick } });
      return;
    }
    case 'pull': {
      const px = e.towardCaster ? src.x : cx;
      const py = e.towardCaster ? src.y : cy;
      f.qDisplace.push({
        rel,
        target: tgt.index,
        kind: 'pull',
        mode: null,
        d: { kind: 'pull', tx: px, ty: py, speed: e.distanceMm, stopUnit: e.towardCaster ? src.index : -1, stopGapMm: e.stopGapMm, arrive: null, fromX: px, fromY: py, startedAt: f.tick },
      });
      return;
    }
    case 'dash': {
      const p = f.units[primary]!;
      f.qDisplace.push({
        rel,
        target: tgt.index,
        kind: 'dash',
        mode: e.mode === 'away_from_target' ? 'away' : e.mode === 'toward_target' ? 'toward' : 'behind',
        d: { kind: 'dash', tx: p.x, ty: p.y, speed: e.distanceMm, stopUnit: primary, stopGapMm: 0, arrive: null, fromX: p.x, fromY: p.y, startedAt: f.tick },
      });
      return;
    }
    case 'cleanse':
      f.qCleanse.push({ rel, target: tgt.index, eff: e });
      return;
    case 'dispel':
      f.qDispel.push({ rel, target: tgt.index, eff: e });
      return;
    case 'interrupt':
      f.qInterrupt.push({ rel, target: tgt.index });
      return;
    case 'zone': {
      const zx = e.centerSelf ? src.x : tgt.x;
      const zy = e.centerSelf ? src.y : tgt.y;
      f.qZone.push({
        owner: src.index,
        ability: rel.ability?.id ?? null,
        rel,
        x: zx,
        y: zy,
        radiusMm: e.radiusMm,
        follow: e.follow,
        end: f.tick + e.durationTicks,
        interval: e.intervalTicks,
        next: f.tick + e.intervalTicks,
        trap: e.trap ? { armAt: f.tick + e.trap.armTicks, consume: e.trap.consume } : null,
        allies: e.allies,
        enemies: e.enemies,
        createdAt: f.tick,
        seq: f.nextSeq(),
        dead: false,
        maxActive: e.maxActive,
      });
      return;
    }
    case 'chain': {
      const hit = new Set<number>();
      let last = tgt;
      let fall = falloffBp;
      if (e.includeInitial) {
        for (const x of e.effects) applyEffect(f, rel, x, tgt, primary, cx, cy, fall);
        hit.add(tgt.index);
      }
      hit.add(tgt.index);
      for (let b = 0; b < e.bounces; b++) {
        let best = -1;
        let bestGap = 0;
        let bestHp = 0;
        for (const o of f.units) {
          if (!o.standing || o.side === src.side || hit.has(o.index)) continue;
          const g = f.gap(last.index, o.index);
          if (g > e.radiusMm) continue;
          const hp = f.hpBp(o);
          if (best < 0 || g < bestGap || (g === bestGap && (hp < bestHp || (hp === bestHp && o.index < best)))) {
            best = o.index;
            bestGap = g;
            bestHp = hp;
          }
        }
        if (best < 0) break;
        if (e.includeInitial || b > 0) fall = Math.trunc((fall * e.falloffBp) / BP);
        const next = f.units[best]!;
        for (const x of e.effects) applyEffect(f, rel, x, next, primary, cx, cy, fall);
        hit.add(best);
        last = next;
      }
      return;
    }
    case 'splash': {
      for (const o of f.units) {
        if (!o.standing) continue;
        if (e.excludePrimary && o === tgt) continue;
        const ally = o.side === src.side;
        if (e.affects === 'enemies' && ally) continue;
        if ((e.affects === 'allies' || e.affects === 'allies_incl_self') && !ally) continue;
        if (e.affects === 'allies' && o === src) continue;
        if (o !== tgt && f.gap(tgt.index, o.index) > e.radiusMm) continue;
        for (const x of e.effects) applyEffect(f, rel, x, o, primary, cx, cy, falloffBp);
      }
      return;
    }
    case 'cooldown':
      f.qCooldown.push({ rel, target: tgt.index, eff: e });
      return;
    case 'focus':
      f.qFocus.push({ target: tgt.index, milli: e.milli });
      return;
    case 'heal_recent_damage': {
      const span = Math.min(e.windowTicks, f.tb.damage.recentMaxTicks);
      let recent = 0;
      for (let i = 0; i < tgt.dmgRing.length; i++) {
        const tk = tgt.dmgRingTick[i]!;
        if (tk >= 0 && tk > f.tick - span - 1 && tk < f.tick) recent += tgt.dmgRing[i]!;
      }
      const fromRecent = Math.trunc((recent * 100 * e.pctBp) / BP);
      const min = evalAmount(e.min, rel, tgt);
      healPipeline(f, rel, src, tgt, Math.max(fromRecent, min), rel.ability?.id ?? null, true);
      return;
    }
  }
}

function basicHitTriggers(f: Fight, src: Unit, tgt: Unit): void {
  if (src.lastBasicTarget !== tgt.index) {
    if (src.lastBasicTarget >= 0) src.momentumReset = true;
    src.lastBasicTarget = tgt.index;
  }
  src.basicHits++;
  for (let k = 0; k < src.triggers.length; k++) {
    const tr = src.triggers[k]!;
    if (tr.on === 'basic_hit' || (tr.on === 'every_n_basic' && src.basicHits % tr.n === 0)) fireTrigger(f, src, k, tgt.index, src.index, 0);
  }
}

/**
 * One damage instance, pipeline steps 3-13 (amount and bonuses already applied).
 * Returns post-mitigation damage (HP + shields) dealt to `tgt`, or -1 when evaded.
 */
export function damageInstance(
  f: Fight,
  rel: Release,
  tgt: Unit,
  amountCenti: number,
  dtype: number,
  canCrit: boolean,
  evadable: boolean,
  lifestealBp: number,
  ability: string | null,
  overTime: boolean,
): number {
  const src = f.units[rel.source]!;
  let a = amountCenti;
  if (evadable && !has(tgt, SC_STUN) && !has(tgt, SC_SLEEP)) {
    tgt.evadeAcc += f.evadeBp(tgt);
    if (tgt.evadeAcc >= BP) {
      tgt.evadeAcc -= BP;
      if (f.rec && f.rec.full) f.rec.emit('evade', f.tick, tgt.index, src.index, { ability });
      const rip = statusInst(tgt, 'riposte');
      if (rip && f.gap(tgt.index, src.index) <= f.tb.damage.riposteGapMm && !rel.fromTrigger) {
        const rr = f.newRelease(tgt.index, null, { fromTrigger: true });
        const centi = Math.trunc((f.power(tgt) * rip.magnitude) / 100);
        f.schedule(f.tick + f.tb.timing.triggerDelay, { kind: 'riposte', seq: f.nextSeq(), source: tgt.index, rel: rr, target: src.index, centi });
      }
      tgt.triggers.forEach((tr, k) => {
        if (tr.on === 'evade') fireTrigger(f, tgt, k, src.index, src.index, 0);
      });
      return -1;
    }
  }
  let crit = false;
  if (canCrit) {
    src.critAcc += critBp(f, src, tgt);
    if (src.critAcc >= BP) {
      src.critAcc -= BP;
      crit = true;
      a = Math.trunc((a * f.tb.derived.critMultBp) / BP);
    }
  }
  if (!overTime) {
    const vb = f.overrides.varianceFactorBp;
    let factor: number;
    if (vb !== undefined) factor = vb;
    else {
      const r = src.rngVariance.int(0, BP - 1);
      const v = f.tb.damage.varianceBp;
      factor = BP - v + Math.trunc(((2 * v + 1) * r) / BP);
    }
    a = Math.trunc((a * factor) / BP);
  }
  const step6 = Math.trunc((a * dealtMultBp(f, src, tgt)) / BP);
  const guard = rel.reflect ? null : statusInst(tgt, 'guarded');
  const weaponBlow = evadable && !overTime;
  if (guard && guard.source >= 0 && guard.source !== tgt.index) {
    const g = f.units[guard.source]!;
    if (g.standing && f.gap(tgt.index, g.index) <= guard.guardRadiusMm) {
      const red = Math.trunc((step6 * guard.magnitude) / BP);
      applyHit(f, rel, g, red, dtype, crit, true, false, lifestealBp, ability, 0);
      return applyHit(f, rel, tgt, step6 - red, dtype, crit, false, weaponBlow, lifestealBp, ability, step6);
    }
  }
  return applyHit(f, rel, tgt, step6, dtype, crit, false, weaponBlow, lifestealBp, ability, step6);
}

/** Pipeline steps 8-13 against one recipient. Returns post-mitigation points (HP + shields). */
function applyHit(
  f: Fight,
  rel: Release,
  recv: Unit,
  centi: number,
  dtype: number,
  crit: boolean,
  redirected: boolean,
  weaponBlow: boolean,
  lifestealBp: number,
  ability: string | null,
  step6: number,
): number {
  const src = f.units[rel.source]!;
  const t = f.tick;
  let a = Math.trunc((centi * takenMultBp(f, recv, src)) / BP);
  a = Math.trunc((a * f.overtimeDmgBp()) / BP);
  const pre = Math.trunc(a / 100);
  const k = f.tb.damage.mitigation;
  if (dtype === DT_PHYSICAL) a = Math.trunc((a * k) / (k + Math.max(0, f.armor(recv))));
  else if (dtype === DT_ARCANE) a = Math.trunc((a * k) / (k + Math.max(0, f.ward(recv))));
  let pts = Math.trunc(a / 100);
  if (pts === 0 && a > 0) pts = f.tb.damage.minDamage;
  if (pts <= 0) return 0;
  // Shields that existed at the start of the tick absorb first, soonest-expiring first.
  let rem = pts;
  let toShield = 0;
  if (recv.shields.length > 0) {
    if (recv.shields.length > 1) recv.shields.sort((x, y) => x.end - y.end || x.seq - y.seq);
    for (const s of recv.shields) {
      if (rem === 0) break;
      if (s.amount <= 0 || s.createdAt >= t) continue;
      const take = Math.min(s.amount, rem);
      s.amount -= take;
      rem -= take;
      toShield += take;
      if (s.amount === 0) {
        if (f.rec && f.rec.full) f.rec.emit('shield.break', t, recv.index, src.index, {});
        if (s.source >= 0) {
          const owner = f.units[s.source]!;
          owner.triggers.forEach((tr, kk) => {
            if (tr.on === 'shield_broken') fireTrigger(f, owner, kk, recv.index, src.index, 0);
          });
        }
      }
    }
  }
  const hpDmg = rem;
  if (pts > recv.largestHit) recv.largestHit = pts;
  f.touchedDamage = true;
  f.pendDmg[recv.index]! += hpDmg;
  f.dmgTotal[recv.index]! += pts;
  if (hpDmg > f.maxHit[recv.index]!) {
    f.maxHit[recv.index] = hpDmg;
    f.maxHitSrc[recv.index] = src.index;
    f.maxHitAbility[recv.index] = ability;
  }
  if (src.side !== recv.side) recv.lastHitBy[src.index] = t;
  src.tally.damageDealt += hpDmg;
  src.tally.damageToShields += toShield;
  recv.tally.damageTaken += hpDmg;
  recv.roundDamageTaken += pts;
  const ri = t % recv.dmgRing.length;
  if (recv.dmgRingTick[ri] !== t) {
    recv.dmgRingTick[ri] = t;
    recv.dmgRing[ri] = 0;
  }
  recv.dmgRing[ri]! += pts;
  if (f.rec && f.rec.full) {
    f.rec.emit('hit', t, src.index, recv.index, {
      ability,
      amount: hpDmg,
      toShield,
      overkill: 0,
      damageType: dtype === DT_PHYSICAL ? 'physical' : dtype === DT_ARCANE ? 'arcane' : 'true',
      crit,
      guardRedirect: redirected,
      preMitigation: pre,
    });
  }
  if (rel.reflect) return pts;
  // Step 13, after the tick: lifesteal, Illuminated, thorns (queued for t + 1).
  const delay = f.tb.timing.triggerDelay;
  if (!rel.fromTrigger) {
    const ls = src.mods[ST.lifesteal]! + lifestealBp;
    if (ls > 0) {
      f.schedule(t + delay, { kind: 'fixedHeal', seq: f.nextSeq(), source: src.index, rel: f.newRelease(src.index, null, { fromTrigger: true }), target: src.index, centi: Math.trunc((pts * 100 * ls) / BP), ability: null });
    }
  }
  if (src.side !== recv.side) {
    const ill = strongest(recv, 'illuminated');
    if (ill > 0) {
      f.schedule(t + delay, { kind: 'fixedHeal', seq: f.nextSeq(), source: src.index, rel: f.newRelease(src.index, null, { fromTrigger: true }), target: src.index, centi: Math.trunc((pts * 100 * ill) / BP), ability: null });
    }
    if (weaponBlow && !redirected && !rel.fromTrigger) {
      const thorns = recv.mods[ST.thorns]!;
      if (thorns > 0 && f.gap(src.index, recv.index) <= f.tb.damage.thornsGapMm) {
        const rr = f.newRelease(recv.index, null, { reflect: true, fromTrigger: true });
        f.schedule(t + delay, { kind: 'reflect', seq: f.nextSeq(), source: recv.index, rel: rr, target: src.index, centi: Math.trunc((step6 * thorns) / BP) });
      }
    }
  }
  if (!rel.fromTrigger && src.standing) {
    src.triggers.forEach((tr, kk) => {
      if (tr.on === 'hit') fireTrigger(f, src, kk, recv.index, src.index, pts);
    });
  }
  if (recv.standing) {
    recv.triggers.forEach((tr, kk) => {
      if (tr.on === 'damage_taken') fireTrigger(f, recv, kk, src.index, src.index, pts);
    });
  }
  return pts;
}

function strongest(u: Unit, id: string): number {
  let best = 0;
  for (const s of u.statuses) if (s.st.id === id && s.magnitude * s.stacks > best) best = s.magnitude * s.stacks;
  return best;
}

/** Healing pipeline (bonuses applied by the caller); queues the heal for the commit. Returns points. */
function healPipeline(f: Fight, rel: Release, src: Unit, recv: Unit, centi: number, ability: string | null, useDealt: boolean): number {
  if (!recv.standing) return 0;
  let a = centi;
  if (useDealt) a = Math.trunc((a * (BP + healDealtBp(f, src, recv))) / BP);
  a = Math.trunc((a * f.healRecvBp(recv)) / BP);
  a = Math.trunc((a * f.overtimeHealBp()) / BP);
  const pts = Math.trunc(a / 100);
  if (pts <= 0) return 0;
  f.touchedHeals = true;
  f.heals[recv.index]!.push({ src: src.index, amount: pts, ability });
  void rel;
  return pts;
}

// ---- Triggers -----------------------------------------------------------------------------------

/** Fire trigger k of `holder`: its effects resolve on the next tick (no same-tick cascades). */
export function fireTrigger(f: Fight, holder: Unit, k: number, triggerTarget: number, triggerSource: number, amount: number): void {
  const tr = holder.triggers[k]!;
  if (!holder.standing) return;
  const t = f.tick;
  if (t < holder.triggerReadyAt[k]!) return;
  if (tr.icdTicks > 0) holder.triggerReadyAt[k] = t + tr.icdTicks;
  let target: number;
  if (tr.target === 'self') target = holder.index;
  else if (tr.target === 'trigger_target') target = triggerTarget;
  else if (tr.target === 'trigger_source') target = triggerSource;
  else target = lowestAllyWithin(f, holder, tr.target.withinMm, tr.target.includeSelf);
  if (target < 0 || !f.units[target]!.standing) return;
  // M1.1 trigger `if`: checked when the event happens; target_* predicates read the trigger target.
  if (tr.ifPred && !f.predVs(tr.ifPred, holder, f.units[triggerTarget >= 0 ? triggerTarget : holder.index]!)) return;
  if (tr.perkId) holder.perkProcs.set(tr.perkId, (holder.perkProcs.get(tr.perkId) ?? 0) + 1);
  const rel = f.newRelease(holder.index, holder.cls.passive, { fromTrigger: true, triggerAmount: amount });
  const tg = f.units[target]!;
  f.schedule(t + f.tb.timing.triggerDelay, { kind: 'effects', seq: f.nextSeq(), source: holder.index, rel, effects: tr.effects, target, cx: tg.x, cy: tg.y });
}

// ---- Commit: statuses ------------------------------------------------------------------------------

function drStep(f: Fight, u: Unit, track: 0 | 1, releaseId: number): number {
  const d = f.dr[u.index]![track]!;
  if (d.lastRelease === releaseId) return d.lastStepBp;
  const idx = f.tick - d.lastApplied >= f.tb.cc.windowTicks ? 0 : d.idx;
  const steps = f.tb.cc.steps;
  return steps[Math.min(idx, steps.length - 1)]!;
}

function drCommit(f: Fight, u: Unit, track: 0 | 1, releaseId: number, stepBp: number): number {
  const d = f.dr[u.index]![track]!;
  if (d.lastRelease === releaseId) return d.idx;
  if (f.tick - d.lastApplied >= f.tb.cc.windowTicks) d.idx = 0;
  d.idx++;
  d.lastApplied = f.tick;
  d.lastRelease = releaseId;
  d.lastStepBp = stepBp;
  return d.idx;
}

export function applyQueuedStatus(f: Fight, q: QueuedStatus): void {
  const tgt = f.units[q.target]!;
  if (!tgt.standing) return;
  const srcIdx = q.rel.source;
  const src = f.units[srcIdx]!;
  const eff = q.eff;
  const st: CStatus = eff.status;
  const t = f.tick;
  let dur = eff.durationTicks;
  let drStepOut: number | null = null;
  if (st.dr === 'control') {
    const step = drStep(f, tgt, 0, q.rel.id);
    if (step <= 0) {
      if (f.rec && f.rec.full) f.rec.emit('status.resist', t, tgt.index, srcIdx, { status: st.id, reason: 'dr_immune' });
      return;
    }
    const ten = f.tenacityBp(tgt);
    dur = Math.trunc((dur * (BP + src.mods[ST.ccDurationDealt]!) * step * (BP - ten)) / (BP * BP * BP));
    if (dur > f.tb.cc.maxHardTicks) dur = f.tb.cc.maxHardTicks;
    if (dur < f.tb.cc.minTicks) {
      if (f.rec && f.rec.full) f.rec.emit('status.resist', t, tgt.index, srcIdx, { status: st.id, reason: 'below_min' });
      return;
    }
    drStepOut = drCommit(f, tgt, 0, q.rel.id, step);
    src.tally.ccAppliedTicks += dur;
    tgt.tally.ccReceivedTicks += dur;
  } else if (st.polarity === 'debuff' && (st.category === 'cc_soft' || st.category === 'debuff')) {
    dur = Math.trunc((dur * (BP + src.mods[ST.debuffDurationDealt]!) * (BP - f.resolveBp(tgt))) / (BP * BP));
  }
  if (dur <= 0) return;
  const end = t + dur;
  const ability = q.rel.ability?.id ?? null;
  tgt.modsDirty = true;
  let inst: StatusInst | null = null;
  if (st.stacking === 'latest') {
    for (let i = tgt.statuses.length - 1; i >= 0; i--) {
      if (tgt.statuses[i]!.st === st) {
        tgt.statuses.splice(i, 1);
        tgt.statusCount[st.code]!--;
      }
    }
  } else if (st.stacking === 'refresh') {
    inst = tgt.statuses.find((s) => s.st === st) ?? null;
    if (inst) {
      if (end > inst.end) {
        inst.end = end;
        inst.source = srcIdx;
        inst.ability = ability;
      }
      inst.magnitude = Math.max(inst.magnitude, eff.magnitude);
    }
  } else {
    inst = tgt.statuses.find((s) => s.st === st && s.source === srcIdx && s.ability === ability) ?? null;
    if (inst) {
      inst.end = Math.max(inst.end, end);
      inst.magnitude = Math.max(inst.magnitude, eff.magnitude);
      if (inst.maxStacks > 1) inst.stacks = Math.min(inst.maxStacks, inst.stacks + 1);
      if (inst.tick && eff.tick) inst.tick.centi = Math.max(inst.tick.centi, evalAmount(eff.tick.amount, q.rel, tgt));
    }
  }
  if (!inst) {
    inst = {
      st,
      source: srcIdx,
      ability,
      appliedAt: t,
      end,
      magnitude: eff.magnitude,
      stacks: 1,
      maxStacks: eff.maxStacks,
      tick: eff.tick ? { interval: eff.tick.intervalTicks, next: t + eff.tick.intervalTicks, centi: evalAmount(eff.tick.amount, q.rel, tgt), dtype: eff.tick.dtype, heal: st.category === 'hot' } : null,
      resetOnTargetChange: eff.resetOnTargetChange,
      wardHealCenti: eff.wardHeal ? Math.trunc((evalAmount(eff.wardHeal, q.rel, tgt) * (BP + healDealtBp(f, src, tgt))) / BP) : 0,
      guardRadiusMm: q.guardRadiusMm,
      seq: f.nextSeq(),
    };
    tgt.statuses.push(inst);
    tgt.statusCount[st.code]!++;
  }
  if (f.rec && (f.rec.full || st.hardCc)) {
    f.rec.emit('status.apply', t, tgt.index, srcIdx, { status: st.id, ability, durationTicks: dur, magnitude: eff.magnitude, stacks: inst.stacks, drStep: drStepOut }, st.hardCc);
  }
  if (st.polarity === 'buff' && tgt.side === src.side && tgt !== src) tgt.lastSupportTick = t;
  // Side effects of control.
  if (st.interrupts) cancelAction(f, tgt, st.id, srcIdx, st.id === 'silence');
  if (st.id === 'root' && tgt.act === ACT_CHANNEL && tgt.actAbility?.channel?.mobile) cancelAction(f, tgt, 'root', srcIdx);
  if (st.id === 'taunt') forceDecision(f, tgt, srcIdx);
  if (src.standing) {
    for (let k = 0; k < src.triggers.length; k++) {
      const tr = src.triggers[k]!;
      if (tr.on === 'cc_applied' && tr.statuses && tr.statuses.includes(st.id)) fireTrigger(f, src, k, tgt.index, srcIdx, 0);
    }
  }
}

// ---- Commit: the remaining queues -----------------------------------------------------------------

export function applyCommitQueues(f: Fight): void {
  const t = f.tick;
  if (
    f.qShield.length === 0 &&
    f.qCleanse.length === 0 &&
    f.qDispel.length === 0 &&
    f.qInterrupt.length === 0 &&
    f.qDisplace.length === 0 &&
    f.qCooldown.length === 0 &&
    f.qFocus.length === 0 &&
    f.qZone.length === 0 &&
    f.qConsume.length === 0 &&
    !f.units.some((u) => u.momentumReset)
  ) {
    return;
  }
  // Shields (cap: total <= shields.maxTotalPctOfMaxHp of max HP; excess trimmed).
  for (const q of f.qShield) {
    const u = f.units[q.target]!;
    if (!u.standing) continue;
    const cap = Math.trunc((u.maxHp * f.tb.shieldCapBp) / BP);
    let total = 0;
    for (const s of u.shields) total += s.amount;
    const add = Math.min(q.amount, cap - total);
    if (add <= 0) continue;
    u.shields.push({ source: q.rel.source, ability: q.rel.ability?.id ?? null, amount: add, end: t + q.duration, createdAt: t, seq: f.nextSeq() });
    f.units[q.rel.source]!.tally.shieldingDone += add;
    u.lastSupportTick = t;
    if (f.rec && f.rec.full) f.rec.emit('shield.gain', t, u.index, q.rel.source, { ability: q.rel.ability?.id ?? null, amount: add, expiresTick: t + q.duration });
  }
  f.qShield.length = 0;
  for (const q of f.qCleanse) {
    const u = f.units[q.target]!;
    if (!u.standing) continue;
    const c = q.eff;
    const cands = u.statuses
      .filter((s) => s.st.polarity === 'debuff' && (c.categories.includes(s.st.category) || c.statuses.includes(s.st.id)))
      .sort((a, b) => b.end - a.end || a.seq - b.seq);
    for (const s of cands.slice(0, c.count)) removeStatusInst(f, u, s, 'cleansed');
  }
  f.qCleanse.length = 0;
  for (const q of f.qDispel) {
    const u = f.units[q.target]!;
    if (!u.standing) continue;
    const cats = q.eff.categories;
    type Cand = { end: number; seq: number; status: StatusInst | null; shield: number };
    const cands: Cand[] = [];
    for (const s of u.statuses) if (s.st.polarity === 'buff' && cats.includes(s.st.category)) cands.push({ end: s.end, seq: s.seq, status: s, shield: -1 });
    if (cats.includes('shield')) u.shields.forEach((s, i) => cands.push({ end: s.end, seq: s.seq, status: null, shield: i }));
    cands.sort((a, b) => b.end - a.end || a.seq - b.seq);
    const drop = new Set<number>();
    for (const c of cands.slice(0, q.eff.count)) {
      if (c.status) removeStatusInst(f, u, c.status, 'dispelled');
      else drop.add(c.shield);
    }
    if (drop.size > 0) u.shields = u.shields.filter((_, i) => !drop.has(i));
  }
  f.qDispel.length = 0;
  for (const q of f.qInterrupt) {
    const u = f.units[q.target]!;
    if (u.standing) cancelAction(f, u, 'interrupt', q.rel.source);
  }
  f.qInterrupt.length = 0;
  for (const q of f.qDisplace) startDisplacement(f, q);
  f.qDisplace.length = 0;
  for (const q of f.qCooldown) {
    const u = f.units[q.target]!;
    const slot = q.eff.slot === 'self' ? q.rel.ability?.slot : q.eff.slot;
    const real = slot === 'a1' || slot === 'a2' ? slot : null;
    if (!real) continue;
    const cur = real === 'a1' ? u.cdA1 : u.cdA2;
    const next = q.eff.reset ? 0 : Math.max(0, cur - q.eff.ticks * BP);
    if (real === 'a1') u.cdA1 = next;
    else u.cdA2 = next;
  }
  f.qCooldown.length = 0;
  for (const q of f.qFocus) {
    const u = f.units[q.target]!;
    if (u.standing) u.focus = Math.min(f.tb.derived.focusMaxMilli, u.focus + q.milli);
  }
  f.qFocus.length = 0;
  for (const z of f.qZone) {
    const limit = z.maxActive;
    if (limit > 0) {
      const mine = f.zones.filter((o) => !o.dead && o.owner === z.owner && o.ability === z.ability);
      if (mine.length >= limit) mine.sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)[0]!.dead = true;
    }
    f.zones.push(z);
    if (f.rec && f.rec.full) f.rec.emit('zone.spawn', t, z.owner, undefined, { ability: z.ability ?? '', x: cm(z.x), y: cm(z.y), radius: cm(z.radiusMm) });
  }
  f.qZone.length = 0;
  for (const q of f.qConsume) {
    const u = f.units[q.target]!;
    for (const s of [...u.statuses]) if (s.st.id === q.status) removeStatusInst(f, u, s, 'consumed');
  }
  f.qConsume.length = 0;
  for (const u of f.units) {
    if (!u.momentumReset) continue;
    u.momentumReset = false;
    for (const s of [...u.statuses]) if (s.resetOnTargetChange) removeStatusInst(f, u, s, 'reset');
  }
}

function startDisplacement(f: Fight, q: Fight['qDisplace'][number]): void {
  const u = f.units[q.target]!;
  if (!u.standing) return;
  const a = f.tb.arena;
  const clampX = (v: number): number => Math.min(a.widthMm - a.radiusMm, Math.max(a.radiusMm, v));
  const clampY = (v: number): number => Math.min(a.heightMm - a.radiusMm, Math.max(a.radiusMm, v));
  const t = f.tick;
  let tx: number;
  let ty: number;
  let speed: number;
  let stopUnit = -1;
  let stopGap = -1;
  if (q.kind === 'dash') {
    if (has(u, SC_ROOT) || has(u, SC_ANCHORED)) return;
    const p = f.units[q.d.stopUnit]!;
    const dx = p.x - u.x;
    const dy = p.y - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const dist = q.d.speed;
    if (q.mode === 'away') {
      const ux = d === 0 ? (u.side === 0 ? -1 : 1) : -dx / d;
      const uy = d === 0 ? 0 : -dy / d;
      tx = u.x + Math.trunc(ux * dist);
      ty = u.y + Math.trunc(uy * dist);
    } else if (q.mode === 'toward') {
      const travel = Math.max(0, Math.min(dist, d - 2 * a.radiusMm - f.tb.movement.insetMm));
      tx = d === 0 ? u.x : u.x + Math.trunc((dx * travel) / d);
      ty = d === 0 ? u.y : u.y + Math.trunc((dy * travel) / d);
    } else {
      const reach = 2 * a.radiusMm + 200;
      tx = d === 0 ? p.x : p.x + Math.trunc((dx * reach) / d);
      ty = d === 0 ? p.y : p.y + Math.trunc((dy * reach) / d);
    }
    speed = f.tb.movement.dashMm;
    if (u.act === ACT_WINDUP) cancelAction(f, u, null);
  } else {
    if (displaceImmune(u)) return;
    const step = drStep(f, u, 1, q.rel.id);
    if (step <= 0) {
      if (f.rec && f.rec.full) f.rec.emit('status.resist', t, u.index, q.rel.source, { status: q.kind, reason: 'dr_immune' });
      return;
    }
    const distance = Math.trunc((q.d.speed * step) / BP);
    if (q.kind === 'knockback') {
      let dx = u.x - q.d.fromX;
      let dy = u.y - q.d.fromY;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0) {
        dx = f.units[q.rel.source]!.side === 0 ? 1 : -1;
        dy = 0;
        d = 1;
      }
      tx = u.x + Math.trunc((dx * distance) / d);
      ty = u.y + Math.trunc((dy * distance) / d);
    } else {
      const dx = q.d.fromX - u.x;
      const dy = q.d.fromY - u.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const minDist = q.d.stopUnit >= 0 ? 2 * a.radiusMm + q.d.stopGapMm : q.d.stopGapMm;
      const travel = Math.min(distance, Math.max(0, d - minDist));
      if (travel <= 0 || d === 0) return;
      tx = u.x + Math.trunc((dx * travel) / d);
      ty = u.y + Math.trunc((dy * travel) / d);
      stopUnit = q.d.stopUnit;
      stopGap = q.d.stopGapMm;
    }
    drCommit(f, u, 1, q.rel.id, step);
    speed = f.tb.movement.displaceMm;
    cancelAction(f, u, q.kind, q.rel.source);
  }
  tx = clampX(tx);
  ty = clampY(ty);
  u.disp = { kind: q.kind, tx, ty, speed, stopUnit, stopGapMm: stopGap, arrive: null, fromX: u.x, fromY: u.y, startedAt: t };
  if (f.rec && f.rec.full) {
    const dd = Math.sqrt((tx - u.x) * (tx - u.x) + (ty - u.y) * (ty - u.y));
    f.rec.emit('displace', t, u.index, q.rel.source, { kind: q.kind, from: [cm(u.x), cm(u.y)], to: [cm(tx), cm(ty)], ticks: Math.ceil(dd / speed) });
  }
}
