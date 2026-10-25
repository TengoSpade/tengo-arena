/**
 * The BattleView core/tactics evaluates against (declared in core/tactics,
 * implemented here). Fight-observable state only (03 §1): positions, HP bars,
 * statuses, casts, roles, the captain marker, who targets whom (start-of-tick
 * snapshot), damage dealt so far, and the deciding fighter's own focus.
 */
import type { Side, UnitIndex } from '../model';
import type { Band, BattleView, Role } from '../tactics';
import type { Fight } from './fight';
import { hasStatus, statusInst, statusStacks } from './resolve';
import { ACT_CAST, ACT_CHANNEL } from './state';
import { BP, ST } from './tables';

export class SimView implements BattleView {
  private readonly f: Fight;
  tick = 0;
  fightTicks = 0;
  readonly unitCount = 10;

  constructor(f: Fight) {
    this.f = f;
  }

  sync(): void {
    this.tick = this.f.tick;
    this.fightTicks = this.f.tick;
  }

  side(unit: UnitIndex): Side {
    return this.f.units[unit]!.side;
  }
  standing(unit: UnitIndex): boolean {
    return this.f.units[unit]!.standing;
  }
  hpBp(unit: UnitIndex): number {
    return this.f.hpBp(this.f.units[unit]!);
  }
  focus(unit: UnitIndex): number {
    return Math.trunc(this.f.units[unit]!.focus / 1000);
  }
  gapMm(a: UnitIndex, b: UnitIndex): number {
    return this.f.gap(a, b);
  }
  bandOf(gapMm: number): Band {
    const b = this.f.tb.bands;
    return gapMm <= b.melee ? 'melee' : gapMm <= b.close ? 'close' : gapMm <= b.mid ? 'mid' : 'long';
  }
  roles(unit: UnitIndex): readonly Role[] {
    return this.f.units[unit]!.cls.roles;
  }
  isCaptain(unit: UnitIndex): boolean {
    const u = this.f.units[unit]!;
    return this.f.sides[u.side].captain === unit;
  }
  captainOf(side: Side): UnitIndex | null {
    const c = this.f.sides[side].captain;
    return c >= 0 && this.f.units[c]!.standing ? c : null;
  }
  captainTarget(side: Side): UnitIndex | null {
    const c = this.captainOf(side);
    if (c === null) return null;
    const t = this.f.snapAim[c]!;
    return t >= 0 ? t : null;
  }
  hasStatus(unit: UnitIndex, status: string): boolean {
    return hasStatus(this.f.units[unit]!, status);
  }
  statusStacks(unit: UnitIndex, status: string): number {
    return statusStacks(this.f.units[unit]!, status);
  }
  hasStatusCategory(unit: UnitIndex, category: string): boolean {
    const u = this.f.units[unit]!;
    if (category === 'shield') return u.shields.some((s) => s.amount > 0);
    for (const s of u.statuses) if (s.st.category === category) return true;
    return false;
  }
  hasBuff(unit: UnitIndex): boolean {
    const u = this.f.units[unit]!;
    if (u.shields.some((s) => s.amount > 0)) return true;
    for (const s of u.statuses) if (s.st.polarity === 'buff' && (s.st.category === 'buff' || s.st.category === 'hot')) return true;
    return false;
  }
  isCasting(unit: UnitIndex): boolean {
    const u = this.f.units[unit]!;
    return (u.act === ACT_CAST && (u.actAbility?.telegraph ?? false)) || u.act === ACT_CHANNEL;
  }
  currentTarget(unit: UnitIndex): UnitIndex | null {
    const t = this.f.snapTarget[unit]!;
    return t >= 0 ? t : null;
  }
  targetersOf(unit: UnitIndex): readonly UnitIndex[] {
    return this.f.targeters[unit]!;
  }
  damageDealt(unit: UnitIndex): number {
    const t = this.f.units[unit]!.tally;
    return t.damageDealt + t.damageToShields;
  }
  neighboursWithin(unit: UnitIndex, radiusMm: number, side: Side): number {
    let n = 0;
    const d = this.f.dist;
    for (const o of this.f.units) {
      if (o.index === unit || !o.standing || o.side !== side) continue;
      if (d[unit * 10 + o.index]! <= radiusMm) n++;
    }
    return n;
  }
  downedCount(side: Side): number {
    let n = 0;
    for (const u of this.f.units) if (u.side === side && !u.standing) n++;
    return n;
  }
  standingCount(side: Side): number {
    let n = 0;
    for (const u of this.f.units) if (u.side === side && u.standing) n++;
    return n;
  }
  abilityReady(unit: UnitIndex, slot: 'a1' | 'a2'): boolean {
    const u = this.f.units[unit]!;
    return (slot === 'a1' ? u.cdA1 : u.cdA2) <= 0;
  }
  abilityReadyInTicks(unit: UnitIndex, slot: 'a1' | 'a2'): number {
    const u = this.f.units[unit]!;
    const cd = slot === 'a1' ? u.cdA1 : u.cdA2;
    return cd <= 0 ? 0 : Math.ceil(cd / (BP + u.mods[ST.cooldownRate]!));
  }
  abilityInRange(unit: UnitIndex, slot: 'a1' | 'a2', target: UnitIndex): boolean {
    const u = this.f.units[unit]!;
    const ab = slot === 'a1' ? u.cls.a1 : u.cls.a2;
    if (ab.target === 'self' || target === unit) return true;
    return this.f.gap(unit, target) <= ab.rangeMm;
  }
  basicInRange(unit: UnitIndex, target: UnitIndex): boolean {
    return this.f.gap(unit, target) <= this.f.units[unit]!.basicRangeMm;
  }
  ruleReady(unit: UnitIndex, ruleIndex: number): boolean {
    return this.f.tick >= (this.f.units[unit]!.ruleCdEnd[ruleIndex] ?? 0);
  }
  tauntedBy(unit: UnitIndex): UnitIndex | null {
    const s = statusInst(this.f.units[unit]!, 'taunt');
    return s && s.source >= 0 && this.f.units[s.source]!.standing ? s.source : null;
  }
  abilityBlocked(unit: UnitIndex, slot: 'a1' | 'a2'): boolean {
    const u = this.f.units[unit]!;
    const ab = slot === 'a1' ? u.cls.a1 : u.cls.a2;
    return ab.movesCaster && (hasStatus(u, 'root') || hasStatus(u, 'anchored'));
  }
}
