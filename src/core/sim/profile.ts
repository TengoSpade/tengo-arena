/**
 * Derived combat values (03 sys-combat-stats). d(x) = attribute - 10; each
 * formula truncates toward zero once at its end. Values here are static
 * (attributes, class base, race combatMods, unconditional passive mods);
 * statuses, auras, conditional mods and in-fight composure are applied per tick.
 */
import type { FightFighterInput } from '../model';
import { InvariantError } from '../util';
import type { Unit } from './state';
import { ATTR, ATTR_IDS, BP, ST, STAT_COUNT, type CClass, type CStatMod, type SimTables } from './tables';

export interface StaticValues {
  attrs: number[];
  maxHp: number;
  armor0: number;
  ward0: number;
  power0: number;
  support0: number;
  speedE4: number;
  intervalTicks: number;
  atkSpeed0: number;
  atkSpeedMax: number;
  crit0: number;
  evade0: number;
  tenacity0: number;
  resolve0: number;
  focusRegen0: number;
  basicRangeMm: number;
  staticMods: Int32Array;
  condMods: CStatMod[];
  hitDealtMods: CStatMod[];
  hitTakenMods: CStatMod[];
  traitMods: CStatMod[];
  enemyAura: { bandMm: number; composure: number } | null;
  shakenMultBp: number;
  rallyMultBp: number;
}

export function clampAttrs(f: FightFighterInput): number[] {
  return ATTR_IDS.map((id) => {
    const v = (f.stats as Record<string, number | undefined>)[id];
    if (v === undefined || !Number.isFinite(v)) throw new InvariantError(`sim: fighter ${f.fighterId} lacks stat ${id}`);
    return Math.min(20, Math.max(1, Math.trunc(v)));
  });
}

export function staticValues(input: FightFighterInput, cls: CClass, tb: SimTables): StaticValues {
  const a = clampAttrs(input);
  const d = tb.derived;
  const dd = (i: number): number => a[i]! - 10;
  const base = cls.def.base;
  const def = tb.combatModsDefaults;
  const cmods = input.combatMods ?? {};
  const hpMult = cmods.hpMult === undefined ? def.hpMultBp : Math.round(cmods.hpMult * BP);
  const armorFlat = cmods.armorFlat ?? def.armorFlat;
  const wardFlat = cmods.wardFlat ?? def.wardFlat;
  const moveMult = cmods.moveSpeedMult === undefined ? def.moveSpeedMultBp : Math.round(cmods.moveSpeedMult * BP);
  const tenFlat = cmods.tenacityFlat === undefined ? def.tenacityFlatBp : Math.round(cmods.tenacityFlat * BP);

  const staticMods = new Int32Array(STAT_COUNT);
  const condMods: CStatMod[] = [];
  const hitDealtMods: CStatMod[] = [];
  const hitTakenMods: CStatMod[] = [];
  const traitMods: CStatMod[] = [];
  const passive = cls.passive.passive;
  for (const m of passive?.statMods ?? []) {
    if (!m.pred && !m.per && !m.amount) staticMods[m.stat]! += m.value;
    else if (m.pred && m.pred.kind === 'target') hitDealtMods.push(m);
    else if (m.pred && m.pred.kind === 'attacker') hitTakenMods.push(m);
    else condMods.push(m);
  }
  let enemyAura: StaticValues['enemyAura'] = null;
  let shakenMultBp = BP;
  let rallyMultBp = BP;
  for (const id of input.traitIds) {
    const ct = tb.traits.get(id);
    if (!ct) throw new InvariantError(`sim: unknown trait "${id}"`);
    for (const m of ct.mods) {
      if (m.pred && m.pred.kind === 'target') hitDealtMods.push(m);
      else traitMods.push(m);
    }
    if (ct.enemyAura && (!enemyAura || Math.abs(ct.enemyAura.composure) > Math.abs(enemyAura.composure))) enemyAura = ct.enemyAura;
    if (ct.shakenMultBp !== null) shakenMultBp = Math.min(shakenMultBp, ct.shakenMultBp);
    if (ct.rallyMultBp !== null) rallyMultBp = Math.max(rallyMultBp, ct.rallyMultBp);
  }

  const hpFactor = Math.max(d.hpMinFactorBp, BP + d.hpPerTghBp * dd(ATTR.tgh) + d.hpPerStrBp * dd(ATTR.str));
  const hpStep = Math.trunc((base.hp * hpFactor * (BP + staticMods[ST.maxHp]!)) / (BP * BP));
  const maxHp = Math.max(1, Math.trunc((hpStep * hpMult) / BP));
  const armor0 = Math.trunc((base.armor * 100 + d.armorPerTghCenti * dd(ATTR.tgh) + Math.round(armorFlat * 100)) / 100);
  const ward0 = Math.trunc((base.ward * 100 + d.wardPerWilCenti * dd(ATTR.wil) + Math.round(wardFlat * 100)) / 100);
  let pw = 0;
  for (const [i, w] of cls.powerW) pw += w * dd(i);
  const power0 = Math.max(1, Math.trunc((base.power * (BP * BP + d.powerPerPointBp * pw)) / (BP * BP)));
  let sw = 0;
  for (const [i, w] of cls.supportW) sw += w * dd(i);
  const support0 = cls.supportW.length === 0 ? 0 : Math.max(0, Math.trunc((base.support * (BP * BP + d.supportPerPointBp * sw)) / (BP * BP)));
  const baseMm = Math.round((base.moveSpeedMps * 1000) / tb.tps);
  const speedE4 = Math.trunc((baseMm * (BP + d.movePerPacBp * dd(ATTR.pac)) * moveMult) / BP);
  const intervalTicks = Math.max(1, Math.round(base.attackIntervalS * tb.tps));
  return {
    attrs: a,
    maxHp,
    armor0,
    ward0,
    power0,
    support0,
    speedE4,
    intervalTicks,
    atkSpeed0: BP + d.atkPerAgiBp * dd(ATTR.agi),
    atkSpeedMax: Math.trunc((intervalTicks * BP) / Math.max(1, d.minIntervalTicks)),
    crit0: d.critBaseBp + d.critPerPreBp * dd(ATTR.pre) + Math.round(base.critBonus * BP),
    evade0: Math.round(base.evadeBonus * BP) + Math.max(0, d.evadePerAgiBp * dd(ATTR.agi)),
    tenacity0: Math.round(base.tenacityBonus * BP) + tenFlat,
    resolve0: d.resPerWilBp * dd(ATTR.wil),
    focusRegen0: Math.trunc((d.focusRegenMilliPerTick * (BP + d.focusPerDisBp * dd(ATTR.dis))) / BP),
    basicRangeMm: cls.basic.rangeMm,
    staticMods,
    condMods,
    hitDealtMods,
    hitTakenMods,
    traitMods,
    enemyAura,
    shakenMultBp,
    rallyMultBp,
  };
}

export function initStatic(u: Unit, tb: SimTables): void {
  const s = staticValues(u.input, u.cls, tb);
  u.maxHp = s.maxHp;
  u.armor0 = s.armor0;
  u.ward0 = s.ward0;
  u.power0 = s.power0;
  u.support0 = s.support0;
  u.speedE4 = s.speedE4;
  u.intervalTicks = s.intervalTicks;
  u.swingThreshold = s.intervalTicks * BP;
  u.atkSpeed0 = s.atkSpeed0;
  u.atkSpeedMax = s.atkSpeedMax;
  u.crit0 = s.crit0;
  u.evade0 = s.evade0;
  u.tenacity0 = s.tenacity0;
  u.resolve0 = s.resolve0;
  u.focusRegen0 = s.focusRegen0;
  u.basicRangeMm = s.basicRangeMm;
  u.staticMods = s.staticMods;
  u.condMods = s.condMods;
  u.hitDealtMods = s.hitDealtMods;
  u.hitTakenMods = s.hitTakenMods;
  u.traitMods = s.traitMods;
  u.enemyAura = s.enemyAura;
  u.shakenMultBp = s.shakenMultBp;
  u.rallyMultBp = s.rallyMultBp;
  u.cq = Math.min(100, Math.max(0, Math.trunc(u.input.captainQuality)));
  u.triggers = u.cls.passive.passive?.triggers ?? [];
  for (const m of [...s.condMods, ...s.traitMods]) {
    const kinds = new Set<string>();
    if (m.per) kinds.add(m.per.source);
    collectPreds(m.pred, kinds);
    for (const k of kinds) {
      if (k === 'self_hp_below' || k === 'selfMissingHpPct') u.hpMods = true;
      else if (k === 'self_targeted_by' || k === 'attackersOnSelf') u.targetedMods = true;
      else u.modsVolatile = true;
    }
  }
}

function collectPreds(p: CStatMod['pred'], out: Set<string>): void {
  if (!p) return;
  if (p.p === 'any') for (const x of p.of) collectPreds(x, out);
  else out.add(p.p);
}
