/**
 * Derived combat values (03 sys-combat-stats). d(x) = attribute - 10; each
 * formula truncates toward zero once at its end. Values here are static
 * (attributes, class base, race combatMods, unconditional passive mods);
 * statuses, auras, conditional mods and in-fight composure are applied per tick.
 */
import type { FightFighterInput } from '../model';
import { InvariantError } from '../util';
import type { Unit } from './state';
import { ATTR, ATTR_IDS, BP, ST, STAT_COUNT, type CAura, type CClass, type CPred, type CStatMod, type CTrait, type CTrigger, type SimTables } from './tables';

export interface StaticValues {
  attrs: number[];
  maxHp: number;
  armor0: number;
  ward0: number;
  power0: number;
  /** Power and Support before truncation, x BP^2 (engine 2: modifiers apply to these, one truncation). */
  powerX: number;
  supportX: number;
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
  /** M1.1: Freshness at round start (0-100) and the penalty severity applied (bp, after fatigueResist). */
  freshness: number;
  fatigueBp: number;
  /** M1.1: class passive aura and perk auras, keyed for the strongest-only rule. */
  auras: { key: string; aura: CAura }[];
  /** Class passive triggers, then perk triggers. */
  triggers: CTrigger[];
}

/**
 * M1.1: a predicate fixed for the round (self_freshness_below, self_fresh_entry): its value, or null when
 * it depends on fight state (e.g. self_is_captain follows the acting captain).
 */
function constantPred(p: CPred, freshness: number, entered: boolean): boolean | null {
  switch (p.p) {
    case 'self_freshness_below':
      return freshness < p.count;
    case 'self_fresh_entry':
      return entered;
    case 'any': {
      let any = false;
      for (const x of p.of) {
        const v = constantPred(x, freshness, entered);
        if (v === null) return null;
        if (v) any = true;
      }
      return any;
    }
    default:
      return null;
  }
}

/** The Freshness penalty tier at a round start (KI-21, O36): the first tier, from the top, whose minimum `freshness` reaches. */
export function fatigueTier(tb: SimTables, freshness: number): SimTables['freshness']['tiers'][number] {
  const tiers = tb.freshness.tiers;
  return tiers.find((t) => freshness >= t.min) ?? tiers[tiers.length - 1]!;
}

/** Freshness penalty severity in bp: the tier's rank among the penalty tiers (0, 3,333, 6,666, 10,000) x (1 - fatigueResist). Display and tags only. */
export function fatigueSeverityBp(tb: SimTables, freshness: number, fatigueResistBp: number): number {
  const fr = tb.freshness;
  const resist = Math.min(fr.resistMaxBp, Math.max(fr.resistMinBp, fatigueResistBp));
  return Math.trunc((fatigueTier(tb, freshness).severityBp * (BP - resist)) / BP);
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
  const base = cls.base;
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
  const freshness = Math.min(100, Math.max(0, Math.trunc(input.freshness ?? tb.freshness.default)));
  const entered = input.enteredThisRound === true;
  const classify = (m: CStatMod): void => {
    let pred = m.pred;
    if (pred && pred.kind === 'self') {
      const v = constantPred(pred, freshness, entered);
      if (v === false) return;
      if (v === true) pred = null;
    }
    if (!pred && !m.per && !m.amount) staticMods[m.stat]! += m.value;
    else if (pred && pred.kind === 'target') hitDealtMods.push(m);
    else if (pred && pred.kind === 'attacker') hitTakenMods.push(m);
    else condMods.push(pred === m.pred ? m : { ...m, pred });
  };
  const auras: StaticValues['auras'] = [];
  const triggers: CTrigger[] = [];
  const passive = cls.passive.passive;
  for (const m of passive?.statMods ?? []) classify(m);
  if (passive?.aura) auras.push({ key: cls.passive.id, aura: passive.aura });
  if (passive) triggers.push(...passive.triggers);
  let enemyAura: StaticValues['enemyAura'] = null;
  let shakenMultBp = BP;
  let rallyMultBp = BP;
  const addTrait = (ct: CTrait): void => {
    for (const m of ct.mods) {
      if (m.pred && m.pred.kind === 'target') hitDealtMods.push(m);
      else traitMods.push(m);
    }
    if (ct.enemyAura && (!enemyAura || Math.abs(ct.enemyAura.composure) > Math.abs(enemyAura.composure))) enemyAura = ct.enemyAura;
    if (ct.shakenMultBp !== null) shakenMultBp = Math.min(shakenMultBp, ct.shakenMultBp);
    if (ct.rallyMultBp !== null) rallyMultBp = Math.max(rallyMultBp, ct.rallyMultBp);
  };
  for (const id of input.traitIds) {
    const ct = tb.traits.get(id);
    if (!ct) throw new InvariantError(`sim: unknown trait "${id}"`);
    addTrait(ct);
  }
  // M1.1 perks: extra passive blocks (stat mods, aura, triggers) and combat-owned trait effects.
  const perkIds = input.perkIds ?? [];
  if (perkIds.length > tb.perkCap) throw new InvariantError(`sim: fighter ${input.fighterId} holds ${perkIds.length} perks`);
  for (const id of perkIds) {
    const pk = tb.perks.get(id);
    if (!pk) throw new InvariantError(`sim: unknown perk "${id}"`);
    if (pk.passive) {
      for (const m of pk.passive.statMods) classify(m);
      if (pk.passive.aura) auras.push({ key: `perk:${pk.id}`, aura: pk.passive.aura });
      triggers.push(...pk.passive.triggers);
    }
    addTrait(pk.trait);
  }
  // M1.1 Freshness penalty at round build: constant stat mods for the whole round.
  const fatigueBp = fatigueSeverityBp(tb, freshness, staticMods[ST.fatigueResist]!);
  {
    // Stepped tiers: the tier's penalties, each scaled by (1 - fatigueResist), fixed for the whole round.
    const fr = tb.freshness;
    const tier = fatigueTier(tb, freshness);
    const keep = BP - Math.min(fr.resistMaxBp, Math.max(fr.resistMinBp, staticMods[ST.fatigueResist]!));
    staticMods[ST.attackSpeed]! += Math.trunc((tier.attackSpeedBp * keep) / BP);
    staticMods[ST.moveSpeed]! += Math.trunc((tier.moveSpeedBp * keep) / BP);
    staticMods[ST.power]! += Math.trunc((tier.powerBp * keep) / BP);
    staticMods[ST.support]! += Math.trunc((tier.supportBp * keep) / BP);
    staticMods[ST.reactionDelay]! += Math.trunc((tier.reactionDelayBp * keep) / BP);
  }

  const hpFactor = Math.max(d.hpMinFactorBp, BP + d.hpPerTghBp * dd(ATTR.tgh) + d.hpPerStrBp * dd(ATTR.str));
  const hpStep = Math.trunc((base.hp * hpFactor * (BP + staticMods[ST.maxHp]!)) / (BP * BP));
  const maxHp = Math.max(1, Math.trunc((hpStep * hpMult) / BP));
  const armor0 = Math.trunc((base.armor * 100 + d.armorPerTghCenti * dd(ATTR.tgh) + Math.round(armorFlat * 100)) / 100);
  const ward0 = Math.trunc((base.ward * 100 + d.wardPerWilCenti * dd(ATTR.wil) + Math.round(wardFlat * 100)) / 100);
  let pw = 0;
  for (const [i, w] of cls.powerW) pw += w * dd(i);
  const powerX = base.power * (BP * BP + d.powerPerPointBp * pw);
  const power0 = Math.max(1, Math.trunc(powerX / (BP * BP)));
  let sw = 0;
  for (const [i, w] of cls.supportW) sw += w * dd(i);
  const supportX = cls.supportW.length === 0 ? 0 : base.support * (BP * BP + d.supportPerPointBp * sw);
  const support0 = cls.supportW.length === 0 ? 0 : Math.max(0, Math.trunc(supportX / (BP * BP)));
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
    powerX,
    supportX,
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
    freshness,
    fatigueBp,
    auras,
    triggers,
  };
}

export function initStatic(u: Unit, tb: SimTables): void {
  const s = staticValues(u.input, u.cls, tb);
  u.maxHp = s.maxHp;
  u.armor0 = s.armor0;
  u.ward0 = s.ward0;
  u.power0 = s.power0;
  u.support0 = s.support0;
  u.powerX = s.powerX;
  u.supportX = s.supportX;
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
  u.triggers = s.triggers;
  u.auras = s.auras;
  u.freshness = s.freshness;
  u.fatigueBp = s.fatigueBp;
  u.oncePerTarget = s.triggers.map(() => 0);
  u.hpBelowFired = new Uint8Array(s.triggers.length);
  for (const m of [...s.condMods, ...s.traitMods]) {
    const kinds = new Set<string>();
    if (m.per) kinds.add(m.per.source);
    collectPreds(m.pred, kinds);
    for (const k of kinds) {
      if (k === 'self_hp_below' || k === 'selfMissingHpPct') u.hpMods = true;
      else if (k === 'self_targeted_by' || k === 'attackersOnSelf') u.targetedMods = true;
      // Constant for the round (folded above) or rebuilt on every captain change.
      else if (k === 'self_freshness_below' || k === 'self_fresh_entry' || k === 'self_is_captain') continue;
      else u.modsVolatile = true;
    }
  }
}

function collectPreds(p: CStatMod['pred'], out: Set<string>): void {
  if (!p) return;
  if (p.p === 'any') for (const x of p.of) collectPreds(x, out);
  else out.add(p.p);
}
