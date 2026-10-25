/**
 * One round (fight): setup, the fixed tick loop and the commit / end phases
 * (03 sys-fight-sim, sys-arena, sys-fight-captain, sys-fight-traits).
 *
 * Tick t: 1 timers -> 2 decisions -> 3 actions -> 4 movement -> 5 resolution
 * -> 6 commit -> 7 end check. order(t) = home then away on even ticks, away
 * then home on odd ticks, slot order within a side.
 */
import type { ContentDB } from '../content';
import type { FightHeader, FightFighterInput, RecordLevel, RoundTiebreakStep, SideInput } from '../model';
import { FIGHT_LOG_FORMAT } from '../model';
import { Rng, type Seed } from '../rng';
import { compileTactics, resolveTactics, type CompiledTactics } from '../tactics';
import { InvariantError, StreamHasher, stableStringify } from '../util';
import { actions, decisions } from './act';
import { movement } from './motion';
import { cm, Recorder } from './record';
import {
  applyCommitQueues,
  applyQueuedStatus,
  cancelAction,
  fireTrigger,
  hasStatus,
  removeStatusInst,
  resolution,
  statusInst,
  has,
} from './resolve';
import { clampAttrs, initStatic } from './profile';
import {
  Unit,
  type Displacement,
  type Job,
  type Projectile,
  type QueuedStatus,
  type Release,
  type ShieldInst,
  type Snap,
  type Zone,
} from './state';
import { BP, SC_RALLIED, SC_ROOT, SC_SILENCE, SC_SLEEP, SC_STUN, ST, STAT_COUNT, simTables, type CClass, type CEffect, type CPred, type CStatMod, type CStatus, type SimTables } from './tables';

export interface SideState {
  /** Acting captain unit index, or -1 while vacant (Shaken window) or gone. */
  captain: number;
  captainCq: number;
  vice: number;
  rallyAvailable: boolean;
  handoverAt: number;
  lastAllyDownTick: number;
  /** Tick this side first downed an enemy (tiebreak step first_down), or -1. */
  firstDownTick: number;
  downs: number;
}

export interface FightSetup {
  seed: Seed;
  round: number;
  home: SideInput;
  away: SideInput;
}

export interface FightTestOverrides {
  /** Fixed damage variance factor (bp, 10,000 = none) instead of the variance stream. Tests only. */
  varianceFactorBp?: number;
}

export class Fight {
  readonly tb: SimTables;
  readonly content: ContentDB;
  readonly setup: FightSetup;
  readonly units: Unit[] = [];
  readonly sides: [SideState, SideState];
  readonly rec: Recorder | null;
  readonly header: FightHeader;
  readonly rngTiebreak: Rng;
  overrides: FightTestOverrides = {};

  tick = 0;
  ended = false;
  winner: 0 | 1 = 0;
  endReason: 'elimination' | 'time-limit' = 'time-limit';
  tiebreakStep: RoundTiebreakStep | null = null;
  durationTicks = 0;

  /** order(t) and each unit's rank in it. */
  order: number[] = [];
  rank = new Int32Array(10);
  /** Centre distances in mm (floor), row-major 10 x 10. */
  dist = new Int32Array(100);
  /** Start-of-tick decision targets (any side) and enemy aims, and the enemies aiming at each unit. */
  snapTarget = new Int32Array(10).fill(-1);
  snapAim = new Int32Array(10).fill(-1);
  targeters: number[][] = Array.from({ length: 10 }, () => []);

  seq = 0;
  releaseSeq = 0;
  /** Jobs keyed by the tick they resolve on. */
  jobsAt = new Map<number, Job[]>();
  projectiles: Projectile[] = [];
  zones: Zone[] = [];

  // Per-tick accumulation (reset in timers).
  pendDmg = new Int32Array(10);
  dmgTotal = new Int32Array(10);
  maxHit = new Int32Array(10);
  maxHitSrc = new Int32Array(10).fill(-1);
  maxHitAbility: (string | null)[] = new Array<string | null>(10).fill(null);
  heals: { src: number; amount: number; ability: string | null }[][] = Array.from({ length: 10 }, () => []);
  onKill: { src: number; target: number; rel: Release; effects: CEffect[] }[] = [];
  qStatus: QueuedStatus[] = [];
  qShield: { rel: Release; target: number; amount: number; duration: number }[] = [];
  qCleanse: { rel: Release; target: number; eff: Extract<CEffect, { type: 'cleanse' }> }[] = [];
  qDispel: { rel: Release; target: number; eff: Extract<CEffect, { type: 'dispel' }> }[] = [];
  qInterrupt: { rel: Release; target: number }[] = [];
  qDisplace: { rel: Release; target: number; kind: 'knockback' | 'pull' | 'dash'; d: Displacement; mode: 'away' | 'toward' | 'behind' | null }[] = [];
  qCooldown: { rel: Release; target: number; eff: Extract<CEffect, { type: 'cooldown' }> }[] = [];
  qFocus: { target: number; milli: number }[] = [];
  qZone: Zone[] = [];
  qConsume: { target: number; status: string }[] = [];
  /** DR tracks per unit: [control, displace]. */
  dr: { lastApplied: number; idx: number; lastRelease: number; lastStepBp: number }[][];
  /** Hard-CC ticks applied in total (balance metric). */

  constructor(content: ContentDB, setup: FightSetup, record: RecordLevel) {
    this.content = content;
    this.tb = simTables(content);
    this.setup = setup;
    this.rec = record === 'none' ? null : new Recorder(record);
    this.rngTiebreak = Rng.create(setup.seed, 'tiebreak');
    this.sides = [this.sideState(), this.sideState()];
    this.dr = Array.from({ length: 10 }, () => [
      { lastApplied: -1_000_000, idx: 0, lastRelease: -1, lastStepBp: 0 },
      { lastApplied: -1_000_000, idx: 0, lastRelease: -1, lastStepBp: 0 },
    ]);
    this.buildSide(0, setup.home);
    this.buildSide(1, setup.away);
    this.spawn();
    this.initCaptains(setup);
    this.hasAllyHpTrigger = this.units.some((u) => u.triggers.some((tr) => tr.on === 'ally_hp_below'));
    this.header = {
      format: FIGHT_LOG_FORMAT,
      engineVersion: SIM_ENGINE_VERSION,
      contentHash: content.ref.hash,
      seed: setup.seed,
      round: setup.round,
      tickMs: content.combat.tick.tickMs,
      frameEvery: this.tb.frameEvery,
      arena: { width: cm(this.tb.arena.widthMm), height: cm(this.tb.arena.heightMm) },
      units: this.units.map((u) => ({
        index: u.index,
        side: u.side,
        fighterId: u.input.fighterId,
        clubId: u.side === 0 ? setup.home.clubId : setup.away.clubId,
        classId: u.input.classId,
        slot: u.slot,
        row: u.input.row,
        isCaptain: u.slot === (u.side === 0 ? setup.home.captainIndex : setup.away.captainIndex),
      })),
    };
  }

  private sideState(): SideState {
    return { captain: -1, captainCq: 0, vice: -1, rallyAvailable: true, handoverAt: -1, lastAllyDownTick: -1_000_000, firstDownTick: -1, downs: 0 };
  }

  private buildSide(side: 0 | 1, s: SideInput): void {
    if (s.fighters.length !== 5) throw new InvariantError(`sim: side ${side} has ${s.fighters.length} fighters, need 5`);
    const ringSize = this.tb.damage.recentMaxTicks + 1;
    s.fighters.forEach((f: FightFighterInput, slot) => {
      const index = side * 5 + slot;
      const cls = this.tb.classes.get(f.classId);
      if (!cls) throw new InvariantError(`sim: unknown class "${f.classId}"`);
      const tactics = compiledFor(this.content, f, cls);
      const attrs = clampAttrs(f);
      const u = new Unit(
        index,
        side,
        slot,
        f,
        cls,
        tactics,
        attrs,
        Rng.create(this.setup.seed, 'variance', index),
        Rng.create(this.setup.seed, 'react', index),
        ringSize,
      );
      initStatic(u, this.tb);
      const phase = Rng.create(this.setup.seed, 'phase', index);
      u.critAcc = phase.int(0, BP - 1);
      u.evadeAcc = phase.int(0, BP - 1);
      u.stagger = u.rngReact.int(0, this.tb.timing.staggerMax);
      u.hp = u.maxHp;
      u.focus = this.content.combat.derived.focus.startFull ? this.tb.derived.focusMaxMilli : 0;
      u.cdA1 = cls.a1.startCooldownTicks * BP;
      u.cdA2 = cls.a2.startCooldownTicks * BP;
      u.triggerReadyAt = u.triggers.map(() => 0);
      this.units.push(u);
    });
  }

  /** sys-arena spawn: rows in slot order, x by side and row, y centred on the lane line. */
  private spawn(): void {
    const a = this.tb.arena;
    for (const side of [0, 1] as const) {
      for (const row of ['front', 'back'] as const) {
        const members = this.units.filter((u) => u.side === side && u.input.row === row);
        const n = members.length;
        members.forEach((u, i) => {
          u.x = side === 0 ? (row === 'front' ? a.homeFront : a.homeBack) : row === 'front' ? a.awayFront : a.awayBack;
          u.y = a.laneCenterMm + Math.trunc(((2 * i - (n - 1)) * a.laneSpacingMm) / 2);
        });
      }
    }
  }

  private initCaptains(setup: FightSetup): void {
    for (const side of [0, 1] as const) {
      const s = side === 0 ? setup.home : setup.away;
      const st = this.sides[side];
      if (s.captainIndex < 0 || s.captainIndex > 4) throw new InvariantError(`sim: captainIndex ${s.captainIndex} out of range`);
      st.captain = side * 5 + s.captainIndex;
      st.captainCq = this.units[st.captain]!.cq;
      st.vice = s.viceCaptainIndex === null || s.viceCaptainIndex === s.captainIndex ? -1 : side * 5 + s.viceCaptainIndex;
    }
  }

  // ---- Grade lookups (development.json captaincy.grades) --------------------------------------
  gradeOf(cq: number): { aura: number; rally: number } {
    for (const g of this.tb.captain.grades) if (cq >= g.minCq) return g;
    return this.tb.captain.grades[this.tb.captain.grades.length - 1] ?? { aura: 0, rally: 0 };
  }

  // ---- Job scheduling -------------------------------------------------------------------------
  nextSeq(): number {
    return this.seq++;
  }

  schedule(tick: number, job: Job): void {
    let list = this.jobsAt.get(tick);
    if (!list) {
      list = [];
      this.jobsAt.set(tick, list);
    }
    list.push(job);
  }

  newRelease(source: number, ability: Release['ability'], opts: { fromTrigger?: boolean; reflect?: boolean; isBasic?: boolean; triggerAmount?: number } = {}): Release {
    return {
      id: this.releaseSeq++,
      source,
      ability,
      snap: this.snap(this.units[source]!),
      fromTrigger: opts.fromTrigger === true,
      reflect: opts.reflect === true,
      isBasic: opts.isBasic === true,
      triggerAmount: opts.triggerAmount ?? 0,
      lastDamage: null,
    };
  }

  snap(u: Unit): Snap {
    return { power: this.power(u), support: this.support(u), maxHp: u.maxHp, hp: u.hp, armor: this.armor(u), ward: this.ward(u) };
  }

  // ---- Derived dynamic values ---------------------------------------------------------------------
  power(u: Unit): number {
    return Math.max(1, Math.trunc((u.power0 * (BP + u.mods[ST.power]!)) / BP));
  }
  support(u: Unit): number {
    return Math.max(0, Math.trunc((u.support0 * (BP + u.mods[ST.support]!)) / BP));
  }
  armor(u: Unit): number {
    return u.armor0 + u.mods[ST.armor]!;
  }
  ward(u: Unit): number {
    return u.ward0 + u.mods[ST.ward]!;
  }
  hpBp(u: Unit): number {
    return u.standing ? Math.trunc((u.hp * BP) / u.maxHp) : 0;
  }
  attackSpeedBp(u: Unit): number {
    const v = u.atkSpeed0 + u.mods[ST.attackSpeed]!;
    return Math.min(u.atkSpeedMax, Math.max(4000, v));
  }
  speedMm(u: Unit): number {
    const [lo, hi] = this.tb.derived.speedClamp;
    const mult = Math.min(hi, Math.max(lo, BP + u.mods[ST.moveSpeed]!));
    return Math.trunc((u.speedE4 * mult) / (BP * BP));
  }
  tenacityBp(u: Unit): number {
    const d = this.tb.derived;
    const v = d.tenPerCmpBp * (u.cmpEff - 10) + u.tenacity0 + u.mods[ST.tenacity]!;
    return Math.min(d.tenMaxBp, Math.max(d.tenMinBp, v));
  }
  resolveBp(u: Unit): number {
    const d = this.tb.derived;
    return Math.min(d.resMaxBp, Math.max(d.resMinBp, u.resolve0 + u.mods[ST.resolve]!));
  }
  evadeBp(u: Unit): number {
    return Math.min(this.tb.derived.evadeMaxBp, Math.max(0, u.evade0 + u.mods[ST.evade]!));
  }
  /** Reaction delay in ticks before jitter (sys-combat-stats), and whether pressure applied. */
  reactionTicks(u: Unit): { ticks: number; pressure: boolean } {
    const d = this.tb.derived;
    const awr = u.attrs[10]! - 10;
    let us = d.reactBaseUs + d.reactPerAwrUs * awr + d.reactPerCmpUs * (u.cmpEff - 10);
    const pressure = this.hpBp(u) < d.pressureHpBp;
    if (pressure) us += Math.trunc((d.pressureMaxUs * (20 - u.cmpEff)) / 19);
    us = Math.trunc((us * (BP + u.mods[ST.reactionDelay]!)) / BP);
    us = Math.min(d.reactMaxUs, Math.max(d.reactMinUs, us));
    return { ticks: Math.trunc((us * this.tb.tps) / 1_000_000), pressure };
  }
  overtimeK(): number {
    const o = this.tb.overtime;
    return this.tick < o.start ? 0 : Math.floor((this.tick - o.start) / o.step);
  }
  overtimeDmgBp(): number {
    return BP + this.tb.overtime.dmgPerStepBp * this.overtimeK();
  }
  overtimeHealBp(): number {
    const o = this.tb.overtime;
    return Math.max(o.healFloorBp, BP + o.healPerStepBp * this.overtimeK());
  }

  gap(a: number, b: number): number {
    if (a === b) return 0;
    const g = this.dist[a * 10 + b]! - 2 * this.tb.arena.radiusMm;
    return g < 0 ? 0 : g;
  }

  computeDistances(): void {
    const us = this.units;
    for (let i = 0; i < 10; i++) {
      const a = us[i]!;
      this.dist[i * 10 + i] = 0;
      for (let j = i + 1; j < 10; j++) {
        const b = us[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.floor(Math.sqrt(dx * dx + dy * dy));
        this.dist[i * 10 + j] = d;
        this.dist[j * 10 + i] = d;
      }
    }
  }

  // ---- Predicates on fight state (effects, stat mods, triggers) -----------------------------------
  predSelf(p: CPred, holder: Unit): boolean {
    switch (p.p) {
      case 'self_hp_below':
        return this.hpBp(holder) < p.hpBp;
      case 'self_targeted_by':
        return this.targeters[holder.index]!.length >= p.count;
      case 'fight_time_below':
        return this.tick < p.ticks;
      case 'fight_time_at_least':
        return this.tick >= p.ticks;
      case 'ally_downed_within': {
        const last = this.sides[holder.side].lastAllyDownTick;
        return this.tick - last <= p.ticks;
      }
      case 'any':
        return p.of.some((x) => this.predSelf(x, holder));
      default:
        return false;
    }
  }

  /** A predicate seen from `holder` against `other` (the hit's target, or its attacker). */
  predVs(p: CPred, holder: Unit, other: Unit): boolean {
    switch (p.p) {
      case 'target_hp_below':
        return this.hpBp(other) < p.hpBp;
      case 'target_hp_above':
        return this.hpBp(other) > p.hpBp;
      case 'target_has_status':
        return p.statuses.some((s) => hasStatus(other, s));
      case 'target_casting':
        return other.act === 2 || other.act === 3;
      case 'target_not_targeting_source':
        return this.snapAim[other.index] !== holder.index;
      case 'target_distance_above':
        return this.gap(holder.index, other.index) > p.gapMm;
      case 'attacker_distance_above':
        return this.gap(holder.index, other.index) > p.gapMm;
      case 'any':
        return p.of.some((x) => this.predVs(x, holder, other));
      default:
        return this.predSelf(p, holder);
    }
  }

  statModValue(m: CStatMod, holder: Unit, owner: Unit): number {
    let v = m.value;
    if (m.amount) v = this.amountInUnits(m, owner);
    if (m.per) {
      let q = 0;
      switch (m.per.source) {
        case 'selfMissingHpPct':
          q = BP - this.hpBp(holder);
          v += Math.trunc((m.per.coef * q) / BP);
          break;
        case 'alliesWithin':
        case 'enemiesWithin': {
          const wantAlly = m.per.source === 'alliesWithin';
          for (const o of this.units) {
            if (o === holder || !o.standing || (o.side === holder.side) !== wantAlly) continue;
            if (this.gap(holder.index, o.index) <= m.per.radiusMm) q++;
          }
          v += m.per.coef * q;
          break;
        }
        case 'attackersOnSelf':
          q = this.targeters[holder.index]!.length;
          v += m.per.coef * q;
          break;
      }
      if (m.per.max >= 0 ? v > m.per.max : v < m.per.max) v = m.per.max;
    }
    return v;
  }

  /** An Amount-valued stat mod (e.g. Resonant Voice: 5% of the owner's Support as HP per second) in stat units. */
  private amountInUnits(m: CStatMod, owner: Unit): number {
    const a = m.amount!;
    let sum = 0;
    for (const s of a.scale) {
      const val = s.stat === 'power' ? this.power(owner) : s.stat === 'support' ? this.support(owner) : s.stat === 'maxHp' ? owner.maxHp : 0;
      sum += s.coefBp * val;
    }
    const centi = a.baseCenti + Math.trunc(sum / 100);
    const f = this.tb.statKindFactor[m.stat]!;
    return f === 100 ? centi : f === 1 ? Math.trunc(centi / 100) : centi * 100;
  }

  // ---- Auras and modifier blocks ---------------------------------------------------------------
  /** Units projecting an aura, with a per-fight slot per distinct aura ability (strongest-of-same-aura rule). */
  private auraOwners: { u: Unit; slot: number }[] | null = null;
  private auraBest = new Int32Array(10 * 10 * 4);
  private auraSeen = new Uint8Array(10 * 10 * 4);
  private enemyAuraOwners: Unit[] = [];

  private initAuras(): void {
    const slots = new Map<string, number>();
    this.auraOwners = [];
    for (const u of this.units) {
      const aura = u.cls.passive.passive?.aura;
      if (aura) {
        let slot = slots.get(u.cls.passive.id);
        if (slot === undefined) {
          slot = slots.size;
          slots.set(u.cls.passive.id, slot);
        }
        this.auraOwners.push({ u, slot });
      }
      if (u.enemyAura) this.enemyAuraOwners.push(u);
    }
  }

  recomputeAuras(): void {
    if (!this.auraOwners) this.initAuras();
    for (const u of this.units) {
      u.auraMods.fill(0);
      if (u.auraHitTaken.length > 0) u.auraHitTaken = [];
      u.auraTraitComposure = 0;
    }
    if (this.auraOwners!.length > 0) {
      this.auraSeen.fill(0);
      for (const { u: owner, slot } of this.auraOwners!) {
        if (!owner.standing) continue;
        const aura = owner.cls.passive.passive!.aura!;
        for (const r of this.units) {
          if (!r.standing) continue;
          const ally = r.side === owner.side;
          if (aura.affects === 'enemies' ? ally : !ally) continue;
          if (r === owner && aura.affects !== 'allies_incl_self') continue;
          if (r !== owner && this.gap(owner.index, r.index) > aura.radiusMm) continue;
          for (let k = 0; k < aura.statMods.length && k < 4; k++) {
            const m = aura.statMods[k]!;
            if (m.pred && m.pred.kind === 'attacker') {
              if (!r.auraHitTaken.includes(m)) r.auraHitTaken.push(m);
              continue;
            }
            const v = this.statModValue(m, r, owner);
            // Several fighters projecting the same aura: only the strongest counts.
            const key = (r.index * 10 + slot) * 4 + k;
            if (this.auraSeen[key] === 0) {
              this.auraSeen[key] = 1;
              this.auraBest[key] = v;
              r.auraMods[m.stat]! += v;
            } else {
              const prev = this.auraBest[key]!;
              if (Math.abs(v) > Math.abs(prev)) {
                this.auraBest[key] = v;
                r.auraMods[m.stat]! += v - prev;
              }
            }
          }
        }
      }
    }
    for (const owner of this.enemyAuraOwners) {
      if (!owner.standing) continue;
      for (const r of this.units) {
        if (!r.standing || r.side === owner.side) continue;
        if (this.gap(owner.index, r.index) <= owner.enemyAura!.bandMm) r.auraTraitComposure += owner.enemyAura!.composure;
      }
    }
  }

  /** Set when an acting captain changes (aura on / off), so every block is rebuilt this tick. */
  captainChanged = true;

  recomputeMods(u: Unit): void {
    const m = u.mods;
    m.set(u.staticMods);
    for (const cm of u.condMods) {
      if (cm.pred && !this.predSelf(cm.pred, u)) continue;
      m[cm.stat]! += this.statModValue(cm, u, u);
    }
    for (let i = 0; i < STAT_COUNT; i++) m[i]! += u.auraMods[i]!;
    // Statuses: strongest instance per status (stacks statuses sum), signed, capped.
    if (u.statuses.length > 0) this.addStatusMods(u);
    // Traits: summed per stat and capped (derived.traitModCaps).
    if (u.traitMods.length > 0 || u.auraTraitComposure !== 0) this.addTraitMods(u);
    const side = this.sides[u.side];
    if (side.captain >= 0 && this.units[side.captain]!.standing) m[ST.composure]! += this.gradeOf(side.captainCq).aura;
    const d = this.tb.derived;
    u.cmpEff = Math.min(d.cmpMax, Math.max(d.cmpMin, u.attrs[8]! + m[ST.composure]!));
  }

  private addStatusMods(u: Unit): void {
    const total = this.statusScratch;
    const longest = this.statusScratch2;
    const touched = this.statusTouched;
    touched.length = 0;
    for (const inst of u.statuses) {
      const st = inst.st;
      if (st.stat < 0) continue;
      const i = st.index;
      const mag = inst.magnitude * inst.stacks;
      if (!touched.includes(st)) {
        touched.push(st);
        total[i] = mag;
        longest[i] = inst.end;
      } else if (st.stacking === 'stacks') total[i]! += mag;
      else if (mag > total[i]! || (mag === total[i]! && inst.end > longest[i]!)) {
        total[i] = mag;
        longest[i] = inst.end;
      }
    }
    for (const st of touched) {
      const v = total[st.index]!;
      if (v === 0) continue;
      const capped = st.cap >= 0 && v > st.cap ? st.cap : v;
      u.mods[st.stat]! += st.sign * capped;
    }
  }
  private statusTouched: CStatus[] = [];
  private statusScratch = new Int32Array(64);
  private statusScratch2 = new Int32Array(64);
  private traitScratch = new Int32Array(STAT_COUNT);

  private addTraitMods(u: Unit): void {
    const sum = this.traitScratch;
    sum.fill(0);
    const rallied = has(u, SC_RALLIED);
    for (const tm of u.traitMods) {
      if (tm.pred && !this.predSelf(tm.pred, u)) continue;
      let v = tm.value;
      if (tm.allyDown && v < 0) {
        if (rallied) continue;
        v = Math.trunc((v * u.shakenMultBp) / BP);
      }
      sum[tm.stat]! += v;
    }
    sum[ST.composure]! += u.auraTraitComposure;
    const capBp = this.tb.derived.traitCapBp;
    const capCmp = this.tb.derived.traitCapComposure;
    for (let i = 0; i < STAT_COUNT; i++) {
      const v = sum[i]!;
      if (v === 0) continue;
      const cap = i === ST.composure ? capCmp : capBp;
      u.mods[i]! += Math.min(cap, Math.max(-cap, v));
    }
  }

  // ---- The tick loop --------------------------------------------------------------------------------
  run(): void {
    if (this.rec) this.emitStart();
    while (!this.ended) this.step();
  }

  /** Set order(t) and each unit's rank in it. */
  beginTick(): void {
    this.order = this.tick % 2 === 0 ? ORDER_EVEN : ORDER_ODD;
    for (let i = 0; i < 10; i++) this.rank[this.order[i]!] = i;
  }

  step(): void {
    const t = this.tick;
    this.beginTick();
    // Positions change only in the movement phase, so last tick's post-movement distances are this tick's start.
    if (t === 0) this.computeDistances();
    this.timers();
    decisions(this);
    actions(this);
    movement(this);
    this.computeDistances();
    resolution(this);
    this.commit();
    this.endCheck();
    if (this.rec && this.rec.full && !this.ended && t % this.tb.frameEvery === 0) this.emitFrame();
    this.tick++;
  }

  emitStart(): void {
    this.rec!.emit('fight.start', 0, undefined, undefined, {
      units: this.units.map((u) => ({ unit: u.index, x: cm(u.x), y: cm(u.y), hp: u.hp, maxHp: u.maxHp, focus: Math.trunc(u.focus / 1000) })),
    });
  }

  private emitFrame(): void {
    this.rec!.emit('frame', this.tick, undefined, undefined, {
      u: this.units.map((u) => {
        let bits = 0;
        if (u.act === 2 || u.act === 3) bits |= 1;
        if (has(u, SC_STUN) || has(u, SC_SLEEP)) bits |= 2;
        if (has(u, SC_ROOT)) bits |= 4;
        if (has(u, SC_SILENCE)) bits |= 8;
        if (!u.standing) bits |= 16;
        return [cm(u.x), cm(u.y), u.hp, bits] as [number, number, number, number];
      }),
    });
  }

  /** Phase 1: timers, status expiry, over-time ticks, zones, auras, modifier blocks, accumulators, regeneration. */
  timers(): void {
    const t = this.tick;
    const tb = this.tb;
    if (this.touchedDamage) {
      this.touchedDamage = false;
      this.pendDmg.fill(0);
      this.dmgTotal.fill(0);
      this.maxHit.fill(0);
      this.maxHitSrc.fill(-1);
      for (let i = 0; i < 10; i++) this.maxHitAbility[i] = null;
    }
    if (this.touchedHeals) {
      this.touchedHeals = false;
      for (let i = 0; i < 10; i++) {
        const h = this.heals[i]!;
        if (h.length > 0) h.length = 0;
      }
    }
    if (t === tb.overtime.start && this.rec) this.rec.emit('overtime.start', t, undefined, undefined, {});

    for (const u of this.units) {
      if (!u.standing) continue;
      if (u.statuses.length > 0) {
        for (let i = u.statuses.length - 1; i >= 0; i--) {
          const inst = u.statuses[i]!;
          if (t > inst.end) {
            removeStatusInst(this, u, inst, 'expire');
            continue;
          }
          if (inst.tick && t === inst.tick.next) {
            inst.tick.next += inst.tick.interval;
            this.schedule(t, { kind: 'dot', seq: this.nextSeq(), source: inst.source < 0 ? u.index : inst.source, inst, holder: u.index });
          }
        }
      }
      if (u.shields.length > 0 && u.shields.some((s: ShieldInst) => t > s.end || s.amount <= 0)) {
        u.shields = u.shields.filter((s: ShieldInst) => t <= s.end && s.amount > 0);
      }
    }

    for (const z of this.zones) {
      if (z.dead) continue;
      if (t > z.end) {
        z.dead = true;
        if (this.rec) this.rec.emit('zone.expire', t, z.owner, undefined, {});
        continue;
      }
      if (z.follow) {
        const o = this.units[z.owner]!;
        z.x = o.x;
        z.y = o.y;
      }
      if (z.interval > 0 && t === z.next) {
        z.next += z.interval;
        this.schedule(t, { kind: 'zone', seq: this.nextSeq(), source: z.owner, zone: z });
      }
    }
    if (this.zones.length > 16) this.zones = this.zones.filter((z) => !z.dead);

    if (this.sides[0].handoverAt === t) this.handover(0);
    if (this.sides[1].handoverAt === t) this.handover(1);

    const auraTick = t % tb.timing.auraRecalc === 0;
    if (auraTick) this.recomputeAuras();
    for (const u of this.units) {
      if (!u.standing) continue;
      if (auraTick || u.modsDirty || u.modsVolatile || this.captainChanged) {
        this.recomputeMods(u);
        u.modsDirty = false;
        u.atkNow = this.attackSpeedBp(u);
        u.cdRateNow = BP + u.mods[ST.cooldownRate]!;
        u.focusRegenNow = Math.trunc((u.focusRegen0 * (BP + u.mods[ST.focusRegen]!)) / BP);
        u.regenNow = u.mods[ST.hpRegenPct]! !== 0 || u.mods[ST.hpRegenFlat]! !== 0;
      }
      u.tally.ticksStanding++;
      // Accumulators (03 sys-combat-stats "Integer implementation").
      const sw = u.swingAcc + u.atkNow;
      u.swingAcc = sw < u.swingThreshold ? sw : u.swingThreshold;
      if (u.cdA1 > 0) u.cdA1 = u.cdA1 > u.cdRateNow ? u.cdA1 - u.cdRateNow : 0;
      if (u.cdA2 > 0) u.cdA2 = u.cdA2 > u.cdRateNow ? u.cdA2 - u.cdRateNow : 0;
      if (u.focus < tb.derived.focusMaxMilli) u.focus = Math.min(tb.derived.focusMaxMilli, u.focus + u.focusRegenNow);
      if (u.regenNow && t > 0 && t % tb.timing.regenInterval === 0) {
        this.schedule(t, { kind: 'regen', seq: this.nextSeq(), source: u.index });
      }
      if (u.committed) {
        const r = u.committed.rule;
        if (r >= 0) u.tally.ruleTicks[r]!++;
      }
    }
    this.captainChanged = false;
  }

  /** sys-fight-captain handover when Shaken ends. */
  private handover(side: 0 | 1): void {
    const s = this.sides[side];
    s.handoverAt = -1;
    let next = -1;
    if (s.vice >= 0 && this.units[s.vice]!.standing) next = s.vice;
    else {
      let bestCq = -1;
      for (const u of this.units) {
        if (u.side !== side || !u.standing) continue;
        if (u.cq > bestCq) {
          bestCq = u.cq;
          next = u.index;
        }
      }
    }
    if (next < 0) return;
    s.captain = next;
    this.captainChanged = true;
    s.captainCq = Math.max(0, this.units[next]!.cq - this.tb.captain.actingPenalty);
    if (s.vice === next) s.vice = -1;
    if (this.rec) this.rec.emit('captain.handover', this.tick, next, undefined, { newCaptain: next, cq: s.captainCq });
  }

  // ---- Phase 6: commit ------------------------------------------------------------------------------
  commit(): void {
    const t = this.tick;
    const prevHpBp = this.prevHpBp;
    if (this.hasAllyHpTrigger) for (const u of this.units) prevHpBp[u.index] = this.hpBp(u);

    // HP = min(maxHp, HP - damage + healing); overheal attributed in processing order.
    for (const u of this.units) {
      if (!u.standing) continue;
      const dmg = this.pendDmg[u.index]!;
      const heals = this.heals[u.index]!;
      if (dmg === 0 && heals.length === 0) continue;
      const base = u.hp - dmg;
      let room = u.maxHp - base;
      let total = 0;
      for (const h of heals) {
        const eff = Math.min(h.amount, Math.max(0, room));
        room -= eff;
        total += eff;
        const healer = this.units[h.src]!;
        healer.tally.healingDone += eff;
        healer.tally.overheal += h.amount - eff;
        if (this.rec && this.rec.full) this.rec.emit('heal', t, h.src, u.index, { ability: h.ability, amount: eff, overheal: h.amount - eff });
        if (eff > 0) u.lastSupportTick = t;
      }
      const hp = Math.min(u.maxHp, base + total);
      if (hp !== u.hp && u.hpMods) u.modsDirty = true;
      u.hp = hp;
    }

    // Deathward: active at the start of the tick, saves at 1 HP plus its heal.
    for (const idx of this.order) {
      const u = this.units[idx]!;
      if (!u.standing || u.hp > 0) continue;
      const ward = statusInst(u, 'deathward');
      if (!ward || ward.appliedAt >= t) continue;
      const recv = this.healRecvBp(u);
      const healed = Math.trunc((Math.trunc((ward.wardHealCenti * recv) / BP) * this.overtimeHealBp()) / BP / 100);
      u.hp = Math.min(u.maxHp, 1 + healed);
      u.modsDirty = true;
      removeStatusInst(this, u, ward, 'consumed');
      if (ward.source >= 0) this.units[ward.source]!.tally.healingDone += healed;
      if (this.rec) this.rec.emit('deathward.save', t, u.index, ward.source >= 0 ? ward.source : undefined, { by: ward.source >= 0 ? ward.source : null, healed });
    }

    // Downs (simultaneous).
    const downed: Unit[] = [];
    for (const idx of this.order) {
      const u = this.units[idx]!;
      if (u.standing && u.hp <= 0) downed.push(u);
    }
    if (downed.length > 0) this.processDowns(downed);

    // Sleep breaks on a tick with >= breakOnDamagePct of max HP taken.
    for (const u of this.units) {
      if (!u.standing || this.dmgTotal[u.index] === 0) continue;
      const sleep = statusInst(u, 'sleep');
      if (sleep && this.dmgTotal[u.index]! * BP >= sleep.st.breakOnDamageBp * u.maxHp) {
        removeStatusInst(this, u, sleep, 'broken');
      }
    }

    // Queued statuses (DR, tenacity, resolve) in resolution order (= source order(t)).
    if (this.qStatus.length > 0) {
      for (const q of this.qStatus) applyQueuedStatus(this, q);
      this.qStatus.length = 0;
    }

    this.applyQueues();

    // ally_hp_below triggers (Lamplight): an ally crossing below the threshold this tick.
    if (this.hasAllyHpTrigger) for (const holder of this.units) {
      if (!holder.standing) continue;
      for (let k = 0; k < holder.triggers.length; k++) {
        const trig = holder.triggers[k]!;
        if (trig.on !== 'ally_hp_below') continue;
        for (const a of this.units) {
          if (a === holder || !a.standing || a.side !== holder.side) continue;
          if (trig.oncePerTarget && (holder.lamplightDone & (1 << a.index)) !== 0) continue;
          if (trig.radiusMm > 0 && this.gap(holder.index, a.index) > trig.radiusMm) continue;
          const before = prevHpBp[a.index]!;
          const now = this.hpBp(a);
          if (before >= trig.hpBp && now < trig.hpBp) {
            if (trig.oncePerTarget) holder.lamplightDone |= 1 << a.index;
            fireTrigger(this, holder, k, a.index, -1, 0);
          }
        }
      }
    }
  }
  private prevHpBp = new Int32Array(10);
  private hasAllyHpTrigger = false;
  /** Per-tick accumulators need a reset at the next timers phase. */
  touchedDamage = true;
  touchedHeals = true;

  healRecvBp(u: Unit): number {
    const [lo, hi] = this.tb.derived.healRecvClamp;
    return Math.min(hi, Math.max(lo, BP + u.mods[ST.healingReceived]!));
  }

  private processDowns(downed: Unit[]): void {
    const t = this.tick;
    for (const u of downed) {
      u.standing = false;
      u.downTick = t;
      const by = this.maxHitSrc[u.index]!;
      const assists: number[] = [];
      for (const e of this.units) {
        if (e.side === u.side || e.index === by) continue;
        if (u.lastHitBy[e.index]! >= t - this.tb.damage.assistTicks) assists.push(e.index);
      }
      const hit = this.maxHit[u.index]!;
      const overkill = Math.max(0, -u.hp);
      u.down = { tick: t, by, ability: this.maxHitAbility[u.index]!, hit, overkill, damageTakenRound: u.roundDamageTaken };
      u.hp = 0;
      if (by >= 0) {
        const killer = this.units[by]!;
        if (killer.side !== u.side) killer.tally.downsInflicted++;
        const ks = this.sides[killer.side];
        if (ks.firstDownTick < 0 && killer.side !== u.side) ks.firstDownTick = t;
      }
      for (const a of assists) this.units[a]!.tally.assists++;
      if (this.rec) this.rec.emit('unit.down', t, u.index, by >= 0 ? by : undefined, { by: by >= 0 ? by : null, ability: u.down.ability, hit, overkill, assists });
      cancelAction(this, u, null);
      u.disp = null;
      u.pending = null;
      for (const z of this.zones) if (z.follow && z.owner === u.index && !z.dead) z.dead = true;
      this.sides[u.side].downs++;
    }
    for (const u of downed) {
      // Kill and status_target_down triggers; onKill effects of the credited source's damage.
      const by = u.down!.by;
      if (by >= 0) {
        const killer = this.units[by]!;
        if (killer.standing) killer.triggers.forEach((tr, k) => {
          if (tr.on === 'kill') fireTrigger(this, killer, k, u.index, u.index, 0);
        });
      }
      for (const holder of this.units) {
        if (!holder.standing || holder.side === u.side) continue;
        holder.triggers.forEach((tr, k) => {
          if (tr.on === 'status_target_down' && tr.status && hasStatus(u, tr.status)) fireTrigger(this, holder, k, u.index, u.index, 0);
        });
      }
      for (const ok of this.onKill) {
        if (ok.target === u.index && ok.src === by) {
          this.schedule(this.tick + this.tb.timing.triggerDelay, {
            kind: 'effects',
            seq: this.nextSeq(),
            source: ok.src,
            rel: ok.rel,
            effects: ok.effects,
            target: ok.src,
            cx: 0,
            cy: 0,
          });
        }
      }
      // Taunts by a downed taunter end.
      for (const o of this.units) {
        if (!o.standing) continue;
        const taunt = statusInst(o, 'taunt');
        if (taunt && taunt.source === u.index) removeStatusInst(this, o, taunt, 'source_down');
      }
      // Re-evaluate units whose target went down.
      for (const o of this.units) if (o.standing && (o.committed?.target === u.index || o.actTarget === u.index)) o.nextEval = Math.min(o.nextEval, t + 1);
      u.statuses = [];
      u.statusCount.fill(0);
      u.shields = [];
    }
    this.onKill = [];
    // Captain model: captain down (aura ends, Shaken, handover later) or rally.
    for (const side of [0, 1] as const) {
      const s = this.sides[side];
      const fallen = downed.filter((u) => u.side === side);
      if (fallen.length === 0) continue;
      s.lastAllyDownTick = this.tick;
      const captainFell = s.captain >= 0 && fallen.some((u) => u.index === s.captain);
      if (captainFell) {
        const fallenCaptain = s.captain;
        s.captain = -1;
        this.captainChanged = true;
        if (this.rec) this.rec.emit('captain.down', this.tick, fallenCaptain, undefined, {});
        for (const a of this.units) {
          if (a.side !== side || !a.standing) continue;
          const mag = Math.trunc((this.tb.captain.shakenComposure * a.shakenMultBp) / BP);
          if (mag > 0) this.addCaptainStatus(a, 'shaken', mag, this.tb.captain.shakenTicks);
        }
        s.handoverAt = this.tick + this.tb.captain.shakenTicks + 1;
      } else if (s.captain >= 0 && this.units[s.captain]!.standing && s.rallyAvailable) {
        const cap = this.units[s.captain]!;
        const grade = this.gradeOf(s.captainCq);
        const comp = Math.trunc((grade.rally * cap.rallyMultBp) / BP);
        if (comp > 0) {
          s.rallyAvailable = false;
          const dur = Math.trunc((this.tb.captain.rallyTicks * cap.rallyMultBp) / BP);
          for (const a of this.units) if (a.side === side && a.standing) this.addCaptainStatus(a, 'rallied', comp, dur);
          if (this.rec) this.rec.emit('captain.rally', this.tick, cap.index, undefined, { composure: comp });
        }
      }
    }
  }

  private addCaptainStatus(u: Unit, id: string, magnitude: number, duration: number): void {
    const st: CStatus = this.tb.statuses.get(id)!;
    u.modsDirty = true;
    const existing = u.statuses.find((s) => s.st === st && s.source === -1);
    if (existing) {
      existing.end = Math.max(existing.end, this.tick + duration);
      existing.magnitude = Math.max(existing.magnitude, magnitude);
      return;
    }
    u.statusCount[st.code]!++;
    u.statuses.push({
      st,
      source: -1,
      ability: null,
      appliedAt: this.tick,
      end: this.tick + duration,
      magnitude,
      stacks: 1,
      maxStacks: 1,
      tick: null,
      resetOnTargetChange: false,
      wardHealCenti: 0,
      guardRadiusMm: 0,
      seq: this.nextSeq(),
    });
    if (this.rec && this.rec.full) {
      this.rec.emit('status.apply', this.tick, u.index, undefined, { status: id, ability: null, durationTicks: duration, magnitude, stacks: 1, drStep: null });
    }
  }

  /** Shields, cleanses, dispels, interrupts, displacements, cooldowns, focus, zones, stack consumption. */
  private applyQueues(): void {
    applyCommitQueues(this);
  }

  // ---- Phase 7: end check ------------------------------------------------------------------------------
  endCheck(): void {
    const t = this.tick;
    const homeUp = this.units.some((u) => u.side === 0 && u.standing);
    const awayUp = this.units.some((u) => u.side === 1 && u.standing);
    if (homeUp && awayUp && t + 1 < this.tb.overtime.cap) return;
    this.ended = true;
    this.durationTicks = t + 1;
    if (homeUp !== awayUp) {
      this.winner = homeUp ? 0 : 1;
      this.endReason = 'elimination';
      this.tiebreakStep = null;
    } else {
      this.endReason = !homeUp && !awayUp ? 'elimination' : 'time-limit';
      this.tiebreak();
    }
    if (this.rec) {
      this.rec.emit('fight.end', t, undefined, undefined, { winner: this.winner, reason: this.endReason, tiebreakStep: this.tiebreakStep });
    }
  }

  /** Round-end tiebreak chain (combat.json roundEnd.tiebreaks): the first difference decides. */
  tiebreak(): void {
    for (const step of this.tb.tiebreaks) {
      let home = 0;
      let away = 0;
      switch (step) {
        case 'fighters_standing':
          for (const u of this.units) if (u.standing) u.side === 0 ? home++ : away++;
          break;
        case 'hp_fraction_sum':
          for (const u of this.units) {
            const v = u.standing ? Math.trunc((u.hp * BP) / u.maxHp) : 0;
            if (u.side === 0) home += v;
            else away += v;
          }
          break;
        case 'damage_dealt':
          for (const u of this.units) {
            const v = u.tally.damageDealt + u.tally.damageToShields;
            if (u.side === 0) home += v;
            else away += v;
          }
          break;
        case 'first_down': {
          const h = this.sides[0].firstDownTick;
          const a = this.sides[1].firstDownTick;
          // Earlier first down wins; a side that never downed anyone ranks last.
          home = h < 0 ? 0 : 1_000_000 - h;
          away = a < 0 ? 0 : 1_000_000 - a;
          break;
        }
        case 'seeded_coin':
          home = this.rngTiebreak.int(0, 1);
          away = 1 - home;
          break;
      }
      if (home !== away) {
        this.winner = home > away ? 0 : 1;
        this.tiebreakStep = step;
        return;
      }
    }
    this.winner = 0;
    this.tiebreakStep = 'seeded_coin';
  }

  /** Hash of the final fight state; never depends on the record level. */
  checksum(): string {
    const h = new StreamHasher();
    h.update(stableStringify({ t: this.durationTicks, w: this.winner, r: this.endReason, s: this.tiebreakStep }));
    for (const u of this.units) {
      h.update(
        stableStringify([
          u.index,
          u.hp,
          u.x,
          u.y,
          u.focus,
          u.downTick,
          u.tally.damageDealt,
          u.tally.damageToShields,
          u.tally.damageTaken,
          u.tally.healingDone,
          u.tally.shieldingDone,
          u.tally.ruleFires,
        ]),
      );
    }
    return h.digest();
  }
}

export const SIM_ENGINE_VERSION = 1;

/** Compiled presets are immutable: cache them per content and (class, preset). Custom lists compile per fight. */
const compiledCache = new WeakMap<ContentDB, Map<string, CompiledTactics>>();

function compiledFor(content: ContentDB, f: FightFighterInput, cls: CClass): CompiledTactics {
  const key = f.tactics.kind === 'preset' ? `${f.classId}|${f.tactics.presetId}` : null;
  let cache = compiledCache.get(content);
  if (!cache) {
    cache = new Map();
    compiledCache.set(content, cache);
  }
  if (key) {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  const list = resolveTactics(f.tactics, f.classId, content);
  if (!list.ok) throw new InvariantError(`sim: ${list.error.message}`);
  const compiled = compileTactics(list.value, { a1: cls.a1.def, a2: cls.a2.def }, content);
  if (key) cache.set(key, compiled);
  return compiled;
}

const ORDER_EVEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ORDER_ODD = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4];

