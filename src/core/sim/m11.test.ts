/**
 * M1.1 combat (combat-skills.md §9): ability ranks rk-001..005, the Freshness
 * penalty fr-001..004, perks pk-001..005, Stamina st-001, every perk and every
 * rank row, the new predicates and triggers, determinism of the round API.
 * Shipped content is loaded with import.meta.glob (core tests may not import
 * outside src/core; the fixture has only 6 classes).
 */
import { describe, expect, it } from 'vitest';
import { loadContent, type ContentDB, type ContentFileName, type RawContentFiles } from '../content';
import { asId, type AbilityRanks, type PerkId, type RoundInput, type SideInput } from '../model';
import { actions, snapshotTargets } from './act';
import { fighterInput, sideInput, type FighterSpec } from './build';
import { Fight } from './fight';
import { combatProfile, eligiblePerks, eligibleRankSteps, perkEligible, simulateFight, simulateRound } from './index';
import type { RoundRecapM11 } from './match';
import { fatigueSeverityBp, staticValues } from './profile';
import { applyAbility, evalAmount, fireTrigger, hasStatus, resolution } from './resolve';
import { ACT_CAST } from './state';
import { BP, ST, compilePred, kitFor, rankedAbilityDef, simTables } from './tables';

const rawFiles = import.meta.glob('../../../content/default/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

function loadDefault(): ContentDB {
  const raw: RawContentFiles = {};
  for (const [path, json] of Object.entries(rawFiles)) raw[path.split('/').pop()!.replace(/\.json$/, '') as ContentFileName] = json;
  const r = loadContent('default', raw);
  if (!r.ok) throw new Error(`content/default invalid: ${r.error.map((e) => e.message).join('; ')}`);
  return r.value;
}

const content = loadDefault();
const tb = simTables(content);
const TARGET_HP_BELOW_50 = compilePred({ p: 'target_hp_below', pct: 50 }, tb.tps);
const KNIGHT = { str: 12, agi: 9, pac: 11, tgh: 14, pre: 9, arc: 6, spi: 5, wil: 10, cmp: 13, ldr: 11, awr: 8, dis: 10 };
const R = (a1: 1 | 2 | 3, a2: 1 | 2 | 3, passive: 1 | 2 | 3): AbilityRanks => ({ a1, a2, passive });
const perks = (...ids: string[]): PerkId[] => ids.map((id) => asId<PerkId>(id));

type Spec = FighterSpec & { freshness?: number; abilityRanks?: AbilityRanks; perkIds?: PerkId[]; enteredThisRound?: boolean };

function side(club: string, specs: (Spec | string)[], cap = 0, vice: number | null = null): SideInput {
  const pad = [...specs, ...Array.from({ length: 5 - specs.length }, () => 'longeye')];
  const s = sideInput(content, club, pad.map((x) => (typeof x === 'string' ? x : x)), cap, vice);
  s.fighters = s.fighters.map((f, i) => {
    const sp = pad[i];
    if (typeof sp === 'string' || !sp) return f;
    const out = { ...f };
    if (sp.freshness !== undefined) out.freshness = sp.freshness;
    if (sp.abilityRanks) out.abilityRanks = sp.abilityRanks;
    if (sp.perkIds) out.perkIds = sp.perkIds;
    if (sp.enteredThisRound !== undefined) out.enteredThisRound = sp.enteredThisRound;
    return out;
  });
  return s;
}

function arena(home: (Spec | string)[], away: (Spec | string)[], cap = 0): Fight {
  const f = new Fight(content, { seed: 'm11', round: 1, home: side('home', home, cap), away: side('away', away, cap) }, 'full');
  f.units.forEach((u, i) => {
    u.x = u.side === 0 ? 500 : 31500;
    u.y = 500 + (i % 5) * 4000;
  });
  f.overrides.varianceFactorBp = BP;
  for (const u of f.units) {
    u.critAcc = 0;
    u.evadeAcc = 0;
  }
  return f;
}

function prep(f: Fight): void {
  f.beginTick();
  f.computeDistances();
  f.recomputeAuras();
  for (const u of f.units) if (u.standing) f.recomputeMods(u);
  snapshotTargets(f);
}

/** Advance to the next tick with the per-tick accumulators cleared. */
function nextTick(f: Fight): void {
  f.tick++;
  prep(f);
  f.pendDmg.fill(0);
  f.dmgTotal.fill(0);
  for (const h of f.heals) h.length = 0;
}

/** Commit `amount` damage on `unit` from the first away fighter. */
function hit(f: Fight, unit: number, amount: number): void {
  f.pendDmg[unit] = amount;
  f.maxHitSrc[unit] = 5;
  f.commit();
}

function profileOf(spec: Spec) {
  const fi = { ...fighterInput(content, spec, 0), freshness: spec.freshness, abilityRanks: spec.abilityRanks, perkIds: spec.perkIds, enteredThisRound: spec.enteredThisRound };
  return combatProfile(fi, content);
}

function statics(spec: Spec) {
  const fi = { ...fighterInput(content, spec, 0), freshness: spec.freshness, abilityRanks: spec.abilityRanks, perkIds: spec.perkIds, enteredThisRound: spec.enteredThisRound };
  return staticValues(fi, kitFor(tb, spec.classId, spec.abilityRanks), tb);
}

describe('ability ranks (rk-001 to rk-005)', () => {
  it('rk-001: Knight Shield Bash rank 3: cooldown 6 s, focus 15, coefficient 1.54 (117.04 at Power 76), stun still 0.8 s', () => {
    const r1 = kitFor(tb, 'oathguard', R(1, 1, 1)).a2;
    const r3 = kitFor(tb, 'oathguard', R(1, 3, 1)).a2;
    // Balance pass: control cooldown steps 9 -> 7.5 -> 6 s (rank 3 = 6 s x 20 ticks = 120).
    expect([r3.cooldownTicks, r3.focusMilli]).toEqual([120, 15_000]);
    const f = arena([{ classId: 'oathguard', stats: KNIGHT, abilityRanks: R(1, 3, 1) }], ['bloodhowler']);
    prep(f);
    expect(f.power(f.units[0]!)).toBe(76);
    const dmg = (ab: typeof r1) => {
      const e = ab.effects[0]!;
      if (e.type !== 'damage') throw new Error('damage expected');
      return evalAmount(e.amount, f.newRelease(0, ab), f.units[5]!);
    };
    expect(dmg(r3)).toBe(11_704);
    expect(dmg(r1)).toBe(10_640);
    const stun = (ab: typeof r1) => ab.effects.find((e) => e.type === 'status' && e.status.id === 'stun');
    expect(stun(r3)).toMatchObject({ durationTicks: 16 });
    expect(stun(r1)).toMatchObject({ durationTicks: 16 });
  });

  it('rk-002: Chirurgeon Suture rank 2 heals 2.46 x 100 x 1.3 = 319 on an ally at 30%; rank 3 keeps the 5 s cooldown and costs 15 focus', () => {
    const f = arena([{ classId: 'chirurgeon', abilityRanks: R(2, 1, 1) }, 'oathguard'], ['bloodhowler']);
    f.units[1]!.hp = Math.trunc((f.units[1]!.maxHp * 30) / 100);
    prep(f);
    const ab = f.units[0]!.cls.a1;
    applyAbility(f, f.newRelease(0, ab), ab, 1);
    expect(f.heals[1]![0]!.amount).toBe(319);
    // Balance pass: rank 3 trimmed from a 4.5 s cooldown to a focus-cost step (20 -> 15): cooldown stays 5 s = 100 ticks.
    const suture3 = kitFor(tb, 'chirurgeon', R(3, 1, 1)).a1;
    expect([suture3.cooldownTicks, suture3.focusMilli]).toEqual([100, 15_000]);
  });

  it('rk-003: Wizard Firebloom rank 3: radius 3.0 m (rank 1: 2.5 m), coefficient 1.32', () => {
    const r1 = kitFor(tb, 'emberwright', R(1, 1, 1)).a1;
    const r3 = kitFor(tb, 'emberwright', R(3, 1, 1)).a1;
    expect(r1.area!.radiusMm).toBe(2500);
    expect(r3.area!.radiusMm).toBe(3000);
    const e = r3.effects[0]!;
    expect(e.type === 'damage' && e.amount.scale[0]!.coefBp).toBe(13_200);
  });

  it('rk-004: Knight Sworn Shield rank 3: an ally within 3 m takes -12% (rank 1: -8%)', () => {
    for (const [rank, value] of [[1, -800], [3, -1200]] as const) {
      const f = arena([{ classId: 'oathguard', abilityRanks: R(1, 1, rank) }, 'longeye'], ['bloodhowler']);
      f.units[0]!.x = 10_000;
      f.units[0]!.y = 9000;
      f.units[1]!.x = 10_000;
      f.units[1]!.y = 11_000;
      prep(f);
      expect(f.units[1]!.mods[ST.damageTaken]).toBe(value);
    }
  });

  it('rk-005: hard-control durations are identical at every rank (Slumber 2.5 s, Shield Bash 0.8 s)', () => {
    const hard = (ab: ReturnType<typeof kitFor>['a1']) =>
      JSON.stringify(ab.effects.flatMap((e) => (e.type === 'status' && e.status.hardCc ? [[e.status.id, e.durationTicks]] : [])));
    for (const k of content.classes.list) {
      for (const slot of ['a1', 'a2'] as const) {
        const base = hard(kitFor(tb, k.id, R(1, 1, 1))[slot]);
        for (const r of [2, 3] as const) {
          const ranks = slot === 'a1' ? R(r, 1, 1) : R(1, r, 1);
          expect(hard(kitFor(tb, k.id, ranks)[slot]), `${k.id} ${slot} rank ${r}`).toBe(base);
        }
      }
    }
    expect(hard(kitFor(tb, 'dreamthief', R(3, 1, 1)).a1)).toBe(JSON.stringify([['sleep', 50]]));
    expect(hard(kitFor(tb, 'oathguard', R(1, 3, 1)).a2)).toBe(JSON.stringify([['stun', 16]]));
  });

  it('every rank row applies: each change lands on its path and every ranked kit compiles and fights', () => {
    let changes = 0;
    for (const row of content.files['ability-ranks'].ranks) {
      if (!row.rankable) continue;
      const def = content.abilities.require(row.abilityId);
      for (const step of row.ranks) {
        const ranked = rankedAbilityDef(content, def, step.rank) as unknown as Record<string, unknown>;
        for (const ch of step.changes) {
          let node: unknown = ranked;
          for (const part of ch.path.split('/').slice(1)) node = (node as Record<string, unknown>)[part];
          expect(node, `${row.abilityId} r${step.rank} ${ch.path}`).toBe(ch.to);
          changes++;
        }
      }
    }
    expect(changes).toBeGreaterThan(250);
    for (const k of content.classes.list) {
      const out = simulateRound({ round: 1, home: side('h', Array.from({ length: 5 }, () => ({ classId: k.id, abilityRanks: R(3, 3, 3) }))), away: side('a', ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon']) }, `rank-${k.id}`, content);
      expect(out.result.durationTicks, k.id).toBeLessThanOrEqual(1500);
    }
  });
});

describe('Freshness penalty (fr-001 to fr-004)', () => {
  it('fr-001: worked-example Knight at F 45 (Tired tier, 2 of 3): interval 1.486 s, Power 68, move 146 mm/tick, reaction 7 ticks, Tired (45)', () => {
    expect(fatigueSeverityBp(tb, 45, 0)).toBe(6666);
    const f = arena([{ classId: 'oathguard', stats: KNIGHT, freshness: 45 }], ['bloodhowler']);
    prep(f);
    const u = f.units[0]!;
    // Stepped tiers (KI-21, O36): F 25-49 is the Tired tier, -10% attack speed, move, Power and Support and +20% reaction delay, whatever the value inside it.
    // Attack speed 0.975 - 0.10 = 0.875; interval 1.3 / 0.875 = 1.486 s; Power trunc(76.03 x 0.90) = trunc(68.4) = 68;
    // move trunc(163.2 x 0.90) = trunc(146.9) = 146; reaction 305 ms x 1.2 = 366 ms = 7.3 ticks -> 7.
    expect(f.attackSpeedBp(u)).toBe(8750);
    expect(Math.round(((u.intervalTicks * BP) / f.attackSpeedBp(u)) * 50)).toBe(1486);
    expect(f.power(u)).toBe(68);
    expect(f.speedMm(u)).toBe(146);
    expect(f.reactionTicks(u).ticks).toBe(7);
    const p = profileOf({ classId: 'oathguard', stats: KNIGHT, freshness: 45 });
    expect([p.power, p.moveSpeedMmPerTick, p.reactionTicks]).toEqual([68, 146, 7]);
    const out = simulateRound({ round: 1, home: side('h', [{ classId: 'oathguard', stats: KNIGHT, freshness: 45 }]), away: side('a', []) }, 'fr', content, { record: 'summary' });
    const recap = out.log!.events.find((e) => e.type === 'round.summary')!.data!.units[0] as RoundRecapM11;
    expect([recap.freshness, recap.fatigueTag, recap.fatigueBp]).toEqual([45, 'tired', 6666]);
    const spawn = out.log!.events.find((e) => e.type === 'fight.start')!.data!.units[0] as unknown as Record<string, unknown>;
    expect(spawn).toMatchObject({ freshness: 45, fatigueBp: 6666, abilityRanks: { a1: 1, a2: 1, passive: 1 }, perkIds: [], enteredThisRound: false });
  });

  it('fr-001 in the engine: the swing accumulator keeps its sub-tick overshoot, so F 45 swings every 1.486 s on average', () => {
    const swingsOver = (freshness: number, ticks: number): number => {
      const f = arena([{ classId: 'oathguard', stats: KNIGHT, freshness }], ['bloodhowler']);
      prep(f);
      const u = f.units[0]!;
      let swings = 0;
      for (let t = 0; t < ticks; t++) {
        f.tick = t;
        f.timers();
        if (u.swingAcc >= u.swingThreshold) {
          swings++;
          u.swingAcc -= u.swingThreshold;
        }
      }
      return swings;
    };
    // 2750 ticks x 8750 / 260000 = 92.55 swings (engine 1 quantized every swing to 28 ticks: 98).
    expect(swingsOver(45, 2750)).toBe(92);
    // Fresh (Agility 9: attack speed 9750): 2600 x 9750 / 260000 = 97.5 (engine 1: every 27 ticks, 96).
    expect(swingsOver(100, 2600)).toBe(97);
  });

  it('Power and Support take one truncation: a small malus does not always cost a whole point', () => {
    // Raw Power 76.03 (worked example): x 0.9987 = 75.93 -> 75; flat-10 stats give exactly 72: x 0.9987 = 71.9 -> 71 (both engines).
    // With raw 72 x 1.04 x 1.0 + a 0.1% malus: engine 1 trunc(trunc(74.88) x 0.999) = 73; engine 2 trunc(74.81) = 74.
    const f = arena([{ classId: 'oathguard', stats: { ...KNIGHT, str: 11, tgh: 11 } }], ['bloodhowler']);
    prep(f);
    const u = f.units[0]!;
    const raw = u.powerX / (BP * BP);
    expect(f.power(u)).toBe(Math.trunc(raw));
    u.mods[ST.power] = -10;
    expect(f.power(u)).toBe(Math.trunc((raw * (BP - 10)) / BP));
  });

  it('fr-002: F 10 (Spent tier): interval 1.576 s, Power 64, move 138, reaction 7 ticks, Spent (10)', () => {
    const f = arena([{ classId: 'oathguard', stats: KNIGHT, freshness: 10 }], ['bloodhowler']);
    prep(f);
    const u = f.units[0]!;
    // Spent tier (F below 25): attack speed 0.975 - 0.15 = 0.825; interval 1.3 / 0.825 = 1.576 s -> 1576; Power trunc(76.03 x 0.85) = 64;
    // move trunc(163.2 x 0.85) = 138; reaction 305 ms x 1.3 = 396 ms = 7.9 ticks -> 7.
    expect(f.attackSpeedBp(u)).toBe(8250);
    expect(Math.round(((u.intervalTicks * BP) / f.attackSpeedBp(u)) * 50)).toBe(1576);
    expect([f.power(u), f.speedMm(u), f.reactionTicks(u).ticks]).toEqual([64, 138, 7]);
    const out = simulateRound({ round: 1, home: side('h', [{ classId: 'oathguard', stats: KNIGHT, freshness: 10 }]), away: side('a', []) }, 'fr', content, { record: 'summary' });
    const recap = out.log!.events.find((e) => e.type === 'round.summary')!.data!.units[0] as RoundRecapM11;
    expect([recap.fatigueTag, recap.freshnessLabel]).toEqual(['spent', 'spent']);
  });

  it('fr-003: F 75 and above: no penalty, no tag; missing freshness is 100', () => {
    expect(fatigueSeverityBp(tb, 75, 0)).toBe(0);
    expect(fatigueSeverityBp(tb, 74, 0)).toBe(3333);
    const base = profileOf({ classId: 'oathguard', stats: KNIGHT });
    expect(profileOf({ classId: 'oathguard', stats: KNIGHT, freshness: 75 })).toEqual(base);
    expect(profileOf({ classId: 'oathguard', stats: KNIGHT, freshness: 100 })).toEqual(base);
    expect(statics({ classId: 'oathguard', freshness: 75 }).fatigueBp).toBe(0);
  });

  it('fr-004: the tier is read at the round start and constant for the round: F 80 none, F 70 Winded (-5%), F 49 Tired (-10%), F 24 Spent (-15%)', () => {
    const mods = (freshness: number) => {
      const s = statics({ classId: 'oathguard', freshness });
      const m = s.staticMods;
      return [s.fatigueBp, m[ST.attackSpeed], m[ST.moveSpeed], m[ST.power], m[ST.support], m[ST.reactionDelay]];
    };
    expect(mods(80)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(mods(70)).toEqual([3333, -500, -500, -500, -500, 1000]);
    expect(mods(50)).toEqual(mods(70)); // the same tier: no sliding scale inside it
    expect(mods(49)).toEqual([6666, -1000, -1000, -1000, -1000, 2000]);
    expect(mods(25)).toEqual(mods(49));
    expect(mods(24)).toEqual([10000, -1500, -1500, -1500, -1500, 3000]);
  });
});

describe('perks (pk-001 to pk-005)', () => {
  it('pk-001: F 28 with Long Wind: Tired tier x 0.6: -6% attack speed, move, Power and Support, +12% reaction', () => {
    const s = statics({ classId: 'oathguard', freshness: 28, perkIds: perks('g_long_wind') });
    expect(s.fatigueBp).toBe(3999);
    const m = s.staticMods;
    expect([m[ST.attackSpeed], m[ST.moveSpeed], m[ST.power], m[ST.support], m[ST.reactionDelay]]).toEqual([-600, -600, -600, -600, 1200]);
  });

  it('pk-002: Second Breath fires once per round on first dropping below 35%: heals trunc(0.10 x 1475) = 147', () => {
    const f = arena([{ classId: 'oathguard', stats: KNIGHT, perkIds: perks('g_second_breath') }], ['bloodhowler']);
    const u = f.units[0]!;
    expect(u.maxHp).toBe(1475);
    u.hp = 600;
    prep(f);
    hit(f, 0, 150);
    expect(u.hp).toBe(450);
    nextTick(f);
    resolution(f);
    f.commit();
    expect(u.hp).toBe(597);
    expect(u.perkProcs.get('g_second_breath')).toBe(1);
    // Never again that round.
    nextTick(f);
    hit(f, 0, 400);
    nextTick(f);
    resolution(f);
    f.commit();
    expect(u.hp).toBe(197);
    expect(u.perkProcs.get('g_second_breath')).toBe(1);
  });

  it('pk-003: acting captain grade A (+2) with Banner Voice: every fielded ally +3 composure, tenacity +6%', () => {
    const f = arena([{ classId: 'oathguard', captainQuality: 90, perkIds: perks('g_banner_voice') }, 'longeye', 'chirurgeon'], ['bloodhowler'], 0);
    prep(f);
    for (const i of [0, 1, 2]) {
      expect(f.units[i]!.cmpEff).toBe(13);
      expect(f.tenacityBp(f.units[i]!)).toBe(600);
    }
    expect(f.units[5]!.cmpEff).toBe(10);
    // Not the acting captain: no Banner Voice aura (aura `requires` self_is_captain).
    const g = arena([{ classId: 'oathguard', captainQuality: 90 }, { classId: 'longeye', perkIds: perks('g_banner_voice') }], ['bloodhowler'], 0);
    prep(g);
    expect(g.units[2]!.cmpEff).toBe(12);
  });

  it('pk-004: with Finisher and one other perk, First Cut is never offered and Executioner\'s Rush is eligible', () => {
    const held = ['m_finisher', 'g_quick_hands'];
    const ids = eligiblePerks(content, 'gutterknife', held).map((p) => p.id);
    expect(ids).not.toContain('m_first_cut');
    expect(ids).toContain('m_executioners_rush');
    expect(ids).not.toContain('m_finisher');
    // Tier III needs 2 held and a listed prerequisite; the cap is 4 with at most 1 tier III.
    expect(perkEligible(content, 'gutterknife', content.perks.require('m_executioners_rush'), ['m_finisher'])).toBe(false);
    expect(eligiblePerks(content, 'gutterknife', ['m_finisher', 'g_quick_hands', 'm_executioners_rush']).some((p) => p.tier === 3)).toBe(false);
    expect(eligiblePerks(content, 'gutterknife', ['m_finisher', 'g_quick_hands', 'm_executioners_rush', 'm_keen_edge'])).toEqual([]);
    // Pools: pure classes 24, hybrids 36; stat gates (Banner Voice: Leadership 12).
    expect(eligiblePerks(content, 'gutterknife', []).length + 0).toBeLessThanOrEqual(24);
    expect(perkEligible(content, 'gutterknife', content.perks.require('g_banner_voice'), ['g_quick_hands'], { ldr: 11 })).toBe(false);
    expect(perkEligible(content, 'gutterknife', content.perks.require('g_banner_voice'), ['g_quick_hands'], { ldr: 12 })).toBe(true);
    expect(eligibleRankSteps(content, 'oathguard', R(1, 3, 2)).map((s) => [s.slot, s.toRank])).toEqual([
      ['a1', 2],
      ['passive', 3],
    ]);
  });

  it('pk-005: Fresh Legs: +8% damage and +2 composure in the round it enters from the reserves, not later', () => {
    const entered = statics({ classId: 'gutterknife', perkIds: perks('g_fresh_legs'), enteredThisRound: true }).staticMods;
    const later = statics({ classId: 'gutterknife', perkIds: perks('g_fresh_legs'), enteredThisRound: false }).staticMods;
    const base = statics({ classId: 'gutterknife' }).staticMods;
    expect(entered[ST.damageDealt]! - base[ST.damageDealt]!).toBe(800);
    expect(entered[ST.composure]! - base[ST.composure]!).toBe(2);
    expect(later[ST.damageDealt]).toBe(base[ST.damageDealt]);
    expect(later[ST.composure]).toBe(base[ST.composure]);
  });
});

describe('Stamina (st-001)', () => {
  it('13 rating weights summing to 1.00 with stamina 0.02; stamina has no fight formula', () => {
    for (const k of content.classes.list) {
      const w = Object.values(k.ratingWeights).reduce((a, b) => a + b, 0);
      expect(Object.keys(k.ratingWeights)).toHaveLength(13);
      expect(Math.abs(w - 1)).toBeLessThan(1e-6);
      expect(k.ratingWeights.stamina).toBe(0.02);
    }
    const lo = profileOf({ classId: 'oathguard', stats: { ...KNIGHT, stamina: 3 } });
    const hi = profileOf({ classId: 'oathguard', stats: { ...KNIGHT, stamina: 19 } });
    expect(hi).toEqual(lo);
    const fight = (stamina: number) => {
      const s = (club: string) => side(club, [{ classId: 'oathguard', stats: { stamina } }, { classId: 'gutterknife', stats: { stamina } }]);
      return simulateRound({ round: 1, home: s('h'), away: s('a') }, 'st', content).result.checksum;
    };
    expect(fight(2)).toBe(fight(18));
  });
});

describe('every perk compiles and works in a round', () => {
  it.each(content.perks.list.map((p) => [p.id] as const))('%s', (id) => {
    const pk = tb.perks.get(id)!;
    expect(pk).toBeDefined();
    const perk = content.perks.require(id);
    const k = content.classes.list.find((c) => perk.archetype === 'general' || (c.archetypes as readonly string[]).includes(perk.archetype))!;
    const held = [...perk.requires.anyPerks.slice(0, 1), id].filter((x, i, a) => a.indexOf(x) === i);
    while (held.length < perk.requires.minPerksHeld + 1) {
      const filler = content.perks.list.find((p) => p.tier === 1 && p.archetype === 'general' && !held.includes(p.id) && !p.exclusiveWith.includes(id) && !perk.exclusiveWith.includes(p.id));
      held.unshift(filler!.id);
    }
    const specs: Spec[] = Array.from({ length: 5 }, () => ({ classId: k.id, perkIds: perks(...held), captainQuality: 90, freshness: 30 }));
    const out = simulateRound({ round: 2, home: side('h', specs), away: side('a', ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon']) }, `perk-${id}`, content, { record: 'summary' });
    expect(out.result.durationTicks).toBeLessThanOrEqual(1500);
    const spawn = out.log!.events.find((e) => e.type === 'fight.start')!.data!.units[0] as unknown as { perkIds: string[] };
    expect(spawn.perkIds).toEqual(held);
    // Perks with triggers report their procs in the recap.
    if (pk.passive && pk.passive.triggers.length > 0) {
      const recaps = out.log!.events.find((e) => e.type === 'round.summary')!.data!.units as RoundRecapM11[];
      expect(recaps.slice(0, 5).every((r) => typeof r.perkProcs === 'object')).toBe(true);
    }
  });

  it('triggered perks proc over a few rounds (Overload, Hexed Ground, Spotter, Whirling Steel, Shoulder Check, Wellspring)', () => {
    const cases: [string, string][] = [
      ['c_overload', 'rimebinder'],
      ['c_hexed_ground', 'rimebinder'],
      ['r_spotter', 'longeye'],
      ['m_whirling_steel', 'gutterknife'],
      ['t_shoulder_check', 'oathguard'],
      ['h_wellspring', 'chirurgeon'],
    ];
    for (const [id, cls] of cases) {
      const perk = content.perks.require(id);
      const held = perk.tier === 3 ? [content.perks.list.find((p) => p.tier === 1 && p.archetype === 'general')!.id, perk.requires.anyPerks[0]!, id] : [id];
      let procs = 0;
      for (let i = 0; i < 4; i++) {
        const out = simulateRound({ round: 1, home: side('h', [{ classId: cls, perkIds: perks(...held) }, 'oathguard', 'longeye', 'rimebinder', 'chirurgeon']), away: side('a', ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon']) }, `proc-${id}-${i}`, content, { record: 'summary' });
        const r = out.log!.events.find((e) => e.type === 'round.summary')!.data!.units[0] as RoundRecapM11;
        procs += r.perkProcs[id] ?? 0;
      }
      expect(procs, id).toBeGreaterThan(0);
    }
  });
});

describe('new predicates, triggers and extensions', () => {
  it('self_is_captain follows the acting captain; self_freshness_below and self_fresh_entry are fixed at round start', () => {
    const f = arena([{ classId: 'oathguard', freshness: 30, enteredThisRound: true }, { classId: 'longeye', freshness: 90 }], ['bloodhowler']);
    const isCap = compilePred({ p: 'self_is_captain' }, tb.tps);
    const below40 = compilePred({ p: 'self_freshness_below', pct: 40 }, tb.tps);
    const entry = compilePred({ p: 'self_fresh_entry' }, tb.tps);
    expect(f.predSelf(isCap, f.units[0]!)).toBe(true);
    expect(f.predSelf(isCap, f.units[1]!)).toBe(false);
    expect(f.predSelf(below40, f.units[0]!)).toBe(true);
    expect(f.predSelf(below40, f.units[1]!)).toBe(false);
    expect(f.predSelf(entry, f.units[0]!)).toBe(true);
    expect(f.predSelf(entry, f.units[1]!)).toBe(false);
    f.sides[0].captain = 1;
    expect(f.predSelf(isCap, f.units[1]!)).toBe(true);
    expect(f.predSelf(isCap, f.units[0]!)).toBe(false);
  });

  it('ability_release fires on releases (optionally one slot); trigger `if` reads the trigger target', () => {
    const f = arena([{ classId: 'rimebinder', perkIds: perks('c_overload') }], ['bloodhowler']);
    const u = f.units[0]!;
    u.x = 8000;
    u.y = 9000;
    f.units[5]!.x = 12_000;
    f.units[5]!.y = 9000;
    prep(f);
    const release = (slot: 'a1' | 'a2') => {
      u.act = ACT_CAST;
      u.actAbility = u.cls[slot];
      u.actTarget = 5;
      u.actLeft = 1;
      u.focus = 100_000;
      actions(f);
      expect(u.act).not.toBe(ACT_CAST);
    };
    release('a2');
    expect(u.perkProcs.get('c_overload')).toBe(1);
    // A slot-filtered trigger ignores the other slot.
    const k = u.triggers.findIndex((t) => t.on === 'ability_release');
    u.triggers[k] = { ...u.triggers[k]!, slot: 'a1', icdTicks: 0 };
    u.triggerReadyAt[k] = 0;
    release('a2');
    expect(u.perkProcs.get('c_overload')).toBe(1);
    release('a1');
    expect(u.perkProcs.get('c_overload')).toBe(2);
    // `if` false blocks the trigger; true lets it fire (target_* reads the trigger target).
    u.triggers[k] = { ...u.triggers[k]!, on: 'basic_hit', slot: null, ifPred: { ...TARGET_HP_BELOW_50 } };
    fireTrigger(f, u, k, 5, 0, 0);
    expect(u.perkProcs.get('c_overload')).toBe(2);
    f.units[5]!.hp = 10;
    fireTrigger(f, u, k, 5, 0, 0);
    expect(u.perkProcs.get('c_overload')).toBe(3);
  });

  it('Last Wall shields once per round below 25% HP; Warding Lantern and Lamplight keep separate once-per-target memories', () => {
    const f = arena([{ classId: 'oathguard', perkIds: perks('t_thick_plating', 't_unbreakable', 't_last_wall') }, { classId: 'vigilkeeper', perkIds: perks('h_warding_lantern') }], ['bloodhowler']);
    const u = f.units[0]!;
    f.units[1]!.x = u.x;
    f.units[1]!.y = u.y + 2000;
    prep(f);
    hit(f, 0, u.hp - Math.trunc(u.maxHp / 5));
    nextTick(f);
    resolution(f);
    f.commit();
    // Balance passes: Last Wall shield 20% -> 12% -> 8% -> 5% of max HP (harness lift +6.0 at 12%, +5.2 at 8%; KI-19). Shield = trunc(maxHp x 500 bp / 10000).
    expect(u.shields.reduce((a, s) => a + s.amount, 0)).toBe(Math.trunc((u.maxHp * 500) / 10000));
    expect(u.perkProcs.get('t_last_wall')).toBe(1);
    expect(f.units[1]!.perkProcs.get('h_warding_lantern')).toBe(1);
    // Lamplight (30%) fired too, from its own memory.
    expect(f.units[1]!.oncePerTarget.filter((m) => m !== 0)).toHaveLength(2);
    expect(hasStatus(u, 'deathward')).toBe(false);
  });

  it('fatigueResist is clamped 0-1 and only scales the Freshness penalty', () => {
    expect(fatigueSeverityBp(tb, 10, 20_000)).toBe(0);
    expect(fatigueSeverityBp(tb, 10, -5000)).toBe(10_000);
    expect(fatigueSeverityBp(tb, 35, 5000)).toBe(3333);
  });
});

describe('round API: parity and determinism', () => {
  const lineup = (club: string, extra: boolean) =>
    side(
      club,
      ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon'].map((classId, i) =>
        extra ? { classId, freshness: 30 + 12 * i, abilityRanks: R(((i % 3) + 1) as 1 | 2 | 3, 2, 3), perkIds: perks(i % 2 ? 'g_quick_hands' : 'g_hardened_hide'), enteredThisRound: i === 4 } : { classId },
      ),
      0,
      1,
    );

  it('default per-round fields equal simulateFight on content/default', () => {
    for (const n of [1, 2]) {
      const input: RoundInput = { round: n, home: lineup('h', false), away: lineup('a', false) };
      const a = simulateRound(input, `p-${n}`, content, { record: 'full' });
      const b = simulateFight({ seed: `p-${n}`, round: n, home: input.home, away: input.away }, content, { record: 'full' });
      expect(a.result).toEqual(b.result);
      expect(a.log!.hash).toBe(b.log!.hash);
    }
  });

  it('ranks, perks and freshness change the round and stay deterministic over 3 runs', () => {
    const input: RoundInput = { round: 2, home: lineup('h', true), away: lineup('a', false) };
    const runs = [0, 1, 2].map(() => simulateRound(input, 'det', content, { record: 'full' }));
    for (const r of runs) {
      expect(r.result).toEqual(runs[0]!.result);
      expect(r.log!.hash).toBe(runs[0]!.log!.hash);
      expect(r.aftermath).toEqual(runs[0]!.aftermath);
    }
    const plain = simulateRound({ round: 2, home: lineup('h', false), away: lineup('a', false) }, 'det', content);
    expect(plain.result.checksum).not.toBe(runs[0]!.result.checksum);
    const none = simulateRound(input, 'det', content, { record: 'none' });
    expect(none.result.checksum).toBe(runs[0]!.result.checksum);
  });
});

describe('healing received (R2-T001 box score: a counter, in no event and no checksum)', () => {
  it('a heal lands as healingDone on the healer and healingReceived on the target, both effective', () => {
    const f = arena(['chirurgeon', 'oathguard'], ['bloodhowler']);
    f.units[1]!.hp = Math.trunc((f.units[1]!.maxHp * 30) / 100);
    prep(f);
    const ab = f.units[0]!.cls.a1;
    applyAbility(f, f.newRelease(0, ab), ab, 1);
    const queued = f.heals[1]![0]!.amount;
    expect(queued).toBeGreaterThan(0);
    f.commit();
    const [healer, target] = [f.units[0]!, f.units[1]!];
    expect(target.tally.healingReceived).toBe(queued);
    expect(healer.tally.healingDone).toBe(queued);
    expect(healer.tally.healingReceived).toBe(0);
    expect(target.tally.healingDone).toBe(0);
  });

  it('overheal is not counted: a heal on a nearly full ally counts only the room he had', () => {
    const f = arena(['chirurgeon', 'oathguard'], ['bloodhowler']);
    const target = f.units[1]!;
    target.hp = target.maxHp - 10;
    prep(f);
    const ab = f.units[0]!.cls.a1;
    applyAbility(f, f.newRelease(0, ab), ab, 1);
    const queued = f.heals[1]![0]!.amount;
    expect(queued).toBeGreaterThan(10);
    f.commit();
    expect(target.hp).toBe(target.maxHp);
    expect(target.tally.healingReceived).toBe(10);
    expect(f.units[0]!.tally.healingDone).toBe(10);
    expect(f.units[0]!.tally.overheal).toBe(queued - 10);
  });

  it('over a whole round every unit\'s healingReceived equals the effective heal events aimed at him, and no hash moves with the counter', () => {
    const home = side('h', ['chirurgeon', 'oathguard', 'chirurgeon', 'rimebinder', 'longeye']);
    const away = side('a', ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon']);
    let healed = 0;
    for (const seed of ['hr-1', 'hr-2', 'hr-3']) {
      const out = simulateRound({ round: 1, home, away }, seed, content, { record: 'full' });
      const log = out.log!;
      const byUnit = new Map<number, number>();
      for (const ev of log.events) if (ev.type === 'heal') byUnit.set(ev.target!, (byUnit.get(ev.target!) ?? 0) + ev.data!.amount);
      let done = 0;
      let received = 0;
      for (const u of log.header.units) {
        const st = out.fighterStats[u.fighterId]!;
        expect(st.healingReceived, `${seed} unit ${u.index}`).toBe(byUnit.get(u.index) ?? 0);
        done += st.healingDone;
        received += st.healingReceived!;
      }
      // Every heal here is aimed at an ally and counted on both ends, so the sides' books agree (no Deathward in these kits).
      expect(received).toBe(done);
      healed += received;
      // Same checksum at every record level (the counter is outside the hash).
      expect(simulateRound({ round: 1, home, away }, seed, content, { record: 'none' }).result.checksum).toBe(out.result.checksum);
    }
    expect(healed).toBeGreaterThan(0);
  });
});
