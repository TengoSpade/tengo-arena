import { describe, expect, it } from 'vitest';
import type { ContentDB, RuleDef } from '../content';
import { asId, type ClassId, type Side, type TacticsPresetId, type UnitIndex } from '../model';
import { fixtureContent } from '../testkit';
import {
  compileTactics,
  defaultTactics,
  describeRule,
  describeStance,
  evaluateTactics,
  presetForStyle,
  presetsForClass,
  resolveTactics,
  type Band,
  type BattleView,
  type CompiledTactics,
  type Role,
} from './index';

// ---- A hand-built BattleView ----------------------------------------------------------------

interface FU {
  side: Side;
  x: number;
  y: number;
  hpBp: number;
  standing: boolean;
  roles: Role[];
  statuses: Record<string, number>;
  categories: string[];
  buff: boolean;
  casting: boolean;
  target: number | null;
  dmg: number;
  focus: number;
}

class FakeView implements BattleView {
  tick = 0;
  fightTicks = 0;
  units: FU[] = [];
  captains: [number | null, number | null] = [null, null];
  cooldown = new Map<string, number>();
  ruleCd = new Set<string>();
  taunts = new Map<number, number>();
  blocked = new Set<string>();
  range = { a1: 6000, a2: 1000, basic: 5000 };
  get unitCount(): number {
    return this.units.length;
  }
  side(u: UnitIndex): Side {
    return this.units[u]!.side;
  }
  standing(u: UnitIndex): boolean {
    return this.units[u]!.standing;
  }
  hpBp(u: UnitIndex): number {
    return this.units[u]!.hpBp;
  }
  focus(u: UnitIndex): number {
    return this.units[u]!.focus;
  }
  private dist(a: UnitIndex, b: UnitIndex): number {
    const A = this.units[a]!;
    const B = this.units[b]!;
    return Math.floor(Math.sqrt((A.x - B.x) * (A.x - B.x) + (A.y - B.y) * (A.y - B.y)));
  }
  gapMm(a: UnitIndex, b: UnitIndex): number {
    return a === b ? 0 : Math.max(0, this.dist(a, b) - 1000);
  }
  bandOf(g: number): Band {
    return g <= 1500 ? 'melee' : g <= 4000 ? 'close' : g <= 7000 ? 'mid' : 'long';
  }
  roles(u: UnitIndex): readonly Role[] {
    return this.units[u]!.roles;
  }
  isCaptain(u: UnitIndex): boolean {
    return this.captains[this.side(u)] === u;
  }
  captainOf(s: Side): UnitIndex | null {
    const c = this.captains[s];
    return c !== null && this.units[c]!.standing ? c : null;
  }
  captainTarget(s: Side): UnitIndex | null {
    const c = this.captainOf(s);
    return c === null ? null : this.units[c]!.target;
  }
  hasStatus(u: UnitIndex, s: string): boolean {
    return (this.units[u]!.statuses[s] ?? 0) > 0;
  }
  statusStacks(u: UnitIndex, s: string): number {
    return this.units[u]!.statuses[s] ?? 0;
  }
  hasStatusCategory(u: UnitIndex, c: string): boolean {
    return this.units[u]!.categories.includes(c);
  }
  hasBuff(u: UnitIndex): boolean {
    return this.units[u]!.buff;
  }
  isCasting(u: UnitIndex): boolean {
    return this.units[u]!.casting;
  }
  currentTarget(u: UnitIndex): UnitIndex | null {
    return this.units[u]!.target;
  }
  targetersOf(u: UnitIndex): readonly UnitIndex[] {
    return this.units.flatMap((x, i) => (x.standing && x.target === u && x.side !== this.units[u]!.side ? [i] : []));
  }
  damageDealt(u: UnitIndex): number {
    return this.units[u]!.dmg;
  }
  neighboursWithin(u: UnitIndex, r: number, s: Side): number {
    let n = 0;
    this.units.forEach((x, i) => {
      if (i !== u && x.standing && x.side === s && this.dist(u, i) <= r) n++;
    });
    return n;
  }
  downedCount(s: Side): number {
    return this.units.filter((x) => x.side === s && !x.standing).length;
  }
  standingCount(s: Side): number {
    return this.units.filter((x) => x.side === s && x.standing).length;
  }
  abilityReady(u: UnitIndex, slot: 'a1' | 'a2'): boolean {
    return (this.cooldown.get(`${u}:${slot}`) ?? 0) <= 0;
  }
  abilityReadyInTicks(u: UnitIndex, slot: 'a1' | 'a2'): number {
    return this.cooldown.get(`${u}:${slot}`) ?? 0;
  }
  abilityInRange(u: UnitIndex, slot: 'a1' | 'a2', t: UnitIndex): boolean {
    return t === u || this.gapMm(u, t) <= this.range[slot];
  }
  basicInRange(u: UnitIndex, t: UnitIndex): boolean {
    return this.gapMm(u, t) <= this.range.basic;
  }
  ruleReady(u: UnitIndex, i: number): boolean {
    return !this.ruleCd.has(`${u}:${i}`);
  }
  tauntedBy(u: UnitIndex): UnitIndex | null {
    return this.taunts.get(u) ?? null;
  }
  abilityBlocked(u: UnitIndex, slot: 'a1' | 'a2'): boolean {
    return this.blocked.has(`${u}:${slot}`);
  }
}

function unit(side: Side, x: number, y: number, roles: Role[] = ['melee'], extra: Partial<FU> = {}): FU {
  return { side, x, y, hpBp: 10_000, standing: true, roles, statuses: {}, categories: [], buff: false, casting: false, target: null, dmg: 0, focus: 100, ...extra };
}

/** Me (0) and four allies on the west; five enemies on the east at increasing distance. */
function scene(): FakeView {
  const v = new FakeView();
  v.units = [
    unit(0, 5000, 9000, ['healer']),
    unit(0, 9000, 6000, ['tank']),
    unit(0, 9000, 12000, ['melee']),
    unit(0, 5000, 5000, ['ranged']),
    unit(0, 5000, 13000, ['controller']),
    unit(1, 12000, 9000, ['tank']),
    unit(1, 14000, 9000, ['melee']),
    unit(1, 18000, 9000, ['ranged']),
    unit(1, 22000, 9000, ['controller']),
    unit(1, 26000, 9000, ['healer', 'melee']),
  ];
  return v;
}

type Bag = Record<string, unknown>;
let ruleSeq = 0;
function rule(conds: Bag[], then: Bag, on: Bag, extra: Partial<RuleDef> = {}): RuleDef {
  return {
    id: `r${ruleSeq++}`,
    if: conds as RuleDef['if'],
    then: then as RuleDef['then'],
    on: on as RuleDef['on'],
    only: null,
    prefer: null,
    cooldownS: 0,
    ...extra,
  };
}

const content: ContentDB = fixtureContent();
const kitOf = (classId: string): { a1: ReturnType<ContentDB['classAbility']>; a2: ReturnType<ContentDB['classAbility']> } => ({
  a1: content.classAbility(classId, 'a1'),
  a2: content.classAbility(classId, 'a2'),
});

function compile(rules: RuleDef[], stance: 'aggressive' | 'steady' | 'cautious' = 'aggressive', classId = 'chirurgeon'): CompiledTactics {
  return compileTactics({ presetId: null, stance, rules }, kitOf(classId), content);
}

function decide(v: FakeView, rules: RuleDef[], me = 0, stance: 'aggressive' | 'steady' | 'cautious' = 'aggressive', classId = 'chirurgeon') {
  return evaluateTactics(compile(rules, stance, classId), v, me);
}

const ALWAYS = { cond: 'always' };
const ATTACK = { type: 'attack' };
const NEAREST = { sel: 'nearest_enemy' };

// ---- Tests -------------------------------------------------------------------------------------------

describe('resolveTactics / presets', () => {
  const oath = asId<ClassId>('oathguard');

  it('resolves a class preset and rejects wrong or unknown presets', () => {
    const ok = resolveTactics({ kind: 'preset', presetId: asId<TacticsPresetId>('oathguard_balanced') }, oath, content);
    expect(ok.ok && ok.value.presetId).toBe('oathguard_balanced');
    expect(ok.ok && ok.value.stance).toBe('aggressive');
    const wrong = resolveTactics({ kind: 'preset', presetId: asId<TacticsPresetId>('longeye_balanced') }, oath, content);
    expect(!wrong.ok && wrong.error.code).toBe('tactics.wrong-class');
    const unknown = resolveTactics({ kind: 'preset', presetId: asId<TacticsPresetId>('nope_balanced') }, oath, content);
    expect(!unknown.ok && unknown.error.code).toBe('tactics.unknown-preset');
    const cls = resolveTactics({ kind: 'preset', presetId: asId<TacticsPresetId>('oathguard_balanced') }, asId<ClassId>('nope'), content);
    expect(!cls.ok && cls.error.code).toBe('tactics.unknown-class');
  });

  it('validates custom rule lists against the vocabulary and limits', () => {
    const good = resolveTactics({ kind: 'custom', name: 'x', stance: 'steady', rules: [rule([ALWAYS], ATTACK, NEAREST)] }, oath, content);
    expect(good.ok).toBe(true);
    const bad = [
      { kind: 'custom' as const, name: 'x', stance: 'wild' as never, rules: [] },
      { kind: 'custom' as const, name: 'x', stance: 'steady' as const, rules: [rule([{ cond: 'nope' }], ATTACK, NEAREST)] },
      { kind: 'custom' as const, name: 'x', stance: 'steady' as const, rules: [rule([ALWAYS], { type: 'dance' }, NEAREST)] },
      { kind: 'custom' as const, name: 'x', stance: 'steady' as const, rules: [rule([ALWAYS], ATTACK, { sel: 'nope' })] },
      { kind: 'custom' as const, name: 'x', stance: 'steady' as const, rules: [rule([ALWAYS], { type: 'ability', slot: 'a9' }, NEAREST)] },
      { kind: 'custom' as const, name: 'x', stance: 'steady' as const, rules: [rule([ALWAYS], ATTACK, NEAREST, { only: { pred: 'in_range' }, prefer: { pred: 'not_self' } })] },
      { kind: 'custom' as const, name: 'x', stance: 'steady' as const, rules: [rule([ALWAYS, ALWAYS, ALWAYS], ATTACK, NEAREST)] },
      { kind: 'custom' as const, name: 'x', stance: 'steady' as const, rules: Array.from({ length: 9 }, () => rule([ALWAYS], ATTACK, NEAREST)) },
    ];
    for (const a of bad) {
      const r = resolveTactics(a, oath, content);
      expect(r.ok, JSON.stringify(a.rules[0] ?? a.stance)).toBe(false);
    }
  });

  it('lists presets default first, gives the default assignment and the AI style pick (cmb-013)', () => {
    const list = presetsForClass(oath, content);
    expect(list[0]!.id).toBe(content.classes.require('oathguard').defaultPresetId);
    expect(list.map((p) => p.id).sort()).toEqual([...content.classes.require('oathguard').presetIds].sort());
    expect(defaultTactics(oath, content)).toEqual({ kind: 'preset', presetId: 'oathguard_balanced' });
    expect(presetForStyle(oath, 'cautious', content)).toEqual({ kind: 'preset', presetId: 'oathguard_protective' });
    expect(presetForStyle(oath, 'aggressive', content)).toEqual({ kind: 'preset', presetId: 'oathguard_aggressive' });
    expect(presetForStyle(oath, 'steady', content)).toEqual({ kind: 'preset', presetId: 'oathguard_balanced' });
    expect(presetsForClass(asId<ClassId>('nope'), content)).toEqual([]);
  });

  it('compiles every fixture preset', () => {
    for (const p of content.presets.list) {
      const k = content.classes.require(p.classId);
      const r = resolveTactics({ kind: 'preset', presetId: asId<TacticsPresetId>(p.id) }, asId<ClassId>(k.id), content);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const c = compileTactics(r.value, kitOf(k.id), content);
      expect(c.ruleCount).toBe(p.rules.length);
      expect(c.stance).toBe(p.stance);
    }
  });
});

describe('conditions (each true, false and negated)', () => {
  const cases: { cond: Bag; setup: (v: FakeView) => void; expect: boolean }[] = [
    { cond: { cond: 'always' }, setup: () => {}, expect: true },
    { cond: { cond: 'self_hp_below', pct: 50 }, setup: (v) => (v.units[0]!.hpBp = 4999), expect: true },
    { cond: { cond: 'self_hp_below', pct: 50 }, setup: (v) => (v.units[0]!.hpBp = 5000), expect: false },
    { cond: { cond: 'ally_hp_below', pct: 40 }, setup: (v) => (v.units[2]!.hpBp = 3999), expect: true },
    { cond: { cond: 'ally_hp_below', pct: 40 }, setup: (v) => (v.units[0]!.hpBp = 1000), expect: false },
    { cond: { cond: 'ally_hp_below', pct: 40, includeSelf: true }, setup: (v) => (v.units[0]!.hpBp = 1000), expect: true },
    { cond: { cond: 'allies_hp_below', pct: 80, count: 2 }, setup: (v) => ((v.units[0]!.hpBp = 7000), (v.units[4]!.hpBp = 7000)), expect: true },
    { cond: { cond: 'allies_hp_below', pct: 80, count: 2, band: 'close' }, setup: (v) => ((v.units[0]!.hpBp = 7000), (v.units[2]!.hpBp = 7000), (v.units[2]!.x = 12000)), expect: false },
    { cond: { cond: 'enemy_hp_below', pct: 30 }, setup: (v) => (v.units[9]!.hpBp = 2000), expect: true },
    { cond: { cond: 'enemy_hp_below', pct: 30, band: 'mid' }, setup: (v) => (v.units[9]!.hpBp = 2000), expect: false },
    { cond: { cond: 'enemy_within', band: 'mid' }, setup: () => {}, expect: true },
    { cond: { cond: 'enemy_within', band: 'close' }, setup: () => {}, expect: false },
    { cond: { cond: 'enemies_within', count: 2, band: 'long' }, setup: () => {}, expect: true },
    { cond: { cond: 'enemies_within', count: 3, band: 'long' }, setup: () => {}, expect: false },
    { cond: { cond: 'enemies_clustered', count: 2, radiusM: 2.5 }, setup: () => {}, expect: true },
    { cond: { cond: 'enemies_clustered', count: 3, radiusM: 2.5 }, setup: () => {}, expect: false },
    { cond: { cond: 'allies_clustered', count: 2, radiusM: 4 }, setup: () => {}, expect: true },
    { cond: { cond: 'allies_clustered', count: 4, radiusM: 4 }, setup: () => {}, expect: false },
    { cond: { cond: 'self_targeted', count: 1 }, setup: (v) => (v.units[6]!.target = 0), expect: true },
    { cond: { cond: 'self_targeted', count: 2 }, setup: (v) => (v.units[6]!.target = 0), expect: false },
    { cond: { cond: 'ally_targeted', count: 1 }, setup: (v) => (v.units[5]!.target = 1), expect: true },
    { cond: { cond: 'ally_targeted', count: 1 }, setup: (v) => (v.units[5]!.target = 0), expect: false },
    { cond: { cond: 'ally_targeted', count: 1, role: 'healer' }, setup: (v) => (v.units[5]!.target = 1), expect: false },
    { cond: { cond: 'enemy_casting', band: 'mid' }, setup: (v) => (v.units[5]!.casting = true), expect: true },
    { cond: { cond: 'enemy_casting', band: 'mid' }, setup: (v) => (v.units[9]!.casting = true), expect: false },
    { cond: { cond: 'self_has_status', status: 'slow' }, setup: (v) => (v.units[0]!.statuses['slow'] = 1), expect: true },
    { cond: { cond: 'self_has_status', category: 'cc_hard' }, setup: (v) => (v.units[1]!.categories = ['cc_hard']), expect: false },
    { cond: { cond: 'ally_has_status', category: 'cc_hard' }, setup: (v) => (v.units[1]!.categories = ['cc_hard']), expect: true },
    { cond: { cond: 'ally_has_status', status: 'root' }, setup: (v) => (v.units[6]!.statuses['root'] = 1), expect: false },
    { cond: { cond: 'enemy_has_status', status: 'marked' }, setup: (v) => (v.units[9]!.statuses['marked'] = 1), expect: true },
    { cond: { cond: 'enemy_has_status', status: 'marked', band: 'mid' }, setup: (v) => (v.units[9]!.statuses['marked'] = 1), expect: false },
    { cond: { cond: 'fight_time_below', seconds: 5 }, setup: (v) => (v.fightTicks = 99), expect: true },
    { cond: { cond: 'fight_time_below', seconds: 5 }, setup: (v) => (v.fightTicks = 100), expect: false },
    { cond: { cond: 'focus_at_least', amount: 60 }, setup: (v) => (v.units[0]!.focus = 60), expect: true },
    { cond: { cond: 'focus_at_least', amount: 60 }, setup: (v) => (v.units[0]!.focus = 59), expect: false },
    { cond: { cond: 'outnumbered' }, setup: (v) => (v.units[1]!.standing = false), expect: true },
    { cond: { cond: 'outnumbered' }, setup: () => {}, expect: false },
    { cond: { cond: 'allies_down', count: 1 }, setup: (v) => (v.units[1]!.standing = false), expect: true },
    { cond: { cond: 'allies_down', count: 1 }, setup: () => {}, expect: false },
    { cond: { cond: 'enemy_role_within', role: 'tank', band: 'mid' }, setup: () => {}, expect: true },
    { cond: { cond: 'enemy_role_within', role: 'healer', band: 'mid' }, setup: () => {}, expect: false },
    { cond: { cond: 'captain_alive' }, setup: (v) => (v.captains = [1, null]), expect: true },
    { cond: { cond: 'captain_alive' }, setup: (v) => ((v.captains = [1, null]), (v.units[1]!.standing = false)), expect: false },
  ];

  it.each(cases.map((c, i) => [i, c] as const))('case %i', (_i, c) => {
    const v = scene();
    c.setup(v);
    const r = [rule([c.cond], ATTACK, NEAREST)];
    expect(decide(v, r).decision.rule).toBe(c.expect ? 0 : 1);
    const neg = [rule([{ ...c.cond, not: true }], ATTACK, NEAREST)];
    expect(decide(v, neg).decision.rule).toBe(c.expect ? 1 : 0);
  });

  it('every vocabulary condition is covered', () => {
    const covered = new Set(cases.map((c) => c.cond['cond']));
    expect([...covered].sort()).toEqual(content.vocabulary.conditions.map((c) => c.id).sort());
  });

  it('AND needs every condition', () => {
    const v = scene();
    v.units[0]!.hpBp = 1000;
    expect(decide(v, [rule([{ cond: 'self_hp_below', pct: 50 }, { cond: 'outnumbered' }], ATTACK, NEAREST)]).decision.rule).toBe(1);
    v.units[1]!.standing = false;
    expect(decide(v, [rule([{ cond: 'self_hp_below', pct: 50 }, { cond: 'outnumbered' }], ATTACK, NEAREST)]).decision.rule).toBe(0);
  });
});

describe('selectors', () => {
  /** The rule's target, or null when it skipped (the stance fired). */
  const pick = (v: FakeView, on: Bag, then: Bag = ATTACK, extra: Partial<RuleDef> = {}, me = 0): number | null => {
    const d = decide(v, [rule([ALWAYS], then, on, extra)], me).decision;
    return d.rule === 0 ? d.target : null;
  };
  const ABILITY_ALLY = { type: 'ability', slot: 'a1' };

  it('enemy selectors', () => {
    const v = scene();
    expect(pick(v, NEAREST)).toBe(5);
    expect(pick(v, { sel: 'furthest_enemy' })).toBe(9);
    v.units[8]!.hpBp = 3000;
    expect(pick(v, { sel: 'lowest_hp_enemy' })).toBe(8);
    v.units[7]!.dmg = 500;
    expect(pick(v, { sel: 'top_damage_enemy' })).toBe(7);
    v.units[6]!.target = 0;
    v.units[9]!.target = 0;
    expect(pick(v, { sel: 'enemy_targeting_me' })).toBe(6);
    v.units[7]!.casting = true;
    expect(pick(v, { sel: 'casting_enemy' })).toBe(7);
    v.units[9]!.statuses['marked'] = 1;
    expect(pick(v, { sel: 'marked_enemy' })).toBe(9);
    expect(pick(v, { sel: 'enemy_role', role: 'healer' })).toBe(9);
    expect(pick(v, { sel: 'enemy_role', role: 'melee' })).toBe(6);
  });

  it('enemy_targeting_ally sorts by the victim HP and filters by role', () => {
    const v = scene();
    v.units[5]!.target = 1;
    v.units[8]!.target = 4;
    v.units[1]!.hpBp = 9000;
    v.units[4]!.hpBp = 5000;
    expect(pick(v, { sel: 'enemy_targeting_ally' })).toBe(8);
    expect(pick(v, { sel: 'enemy_targeting_ally', role: 'tank' })).toBe(5);
    expect(pick(v, { sel: 'enemy_targeting_ally', role: 'healer' })).toBe(null);
  });

  it('densest_enemy, captain_target, current_target', () => {
    const v = scene();
    v.units[6]!.x = 12500;
    v.units[6]!.y = 10000;
    expect(pick(v, { sel: 'densest_enemy', radiusM: 2.5 })).toBe(5);
    v.captains = [1, null];
    v.units[1]!.target = 7;
    expect(pick(v, { sel: 'captain_target' })).toBe(7);
    v.units[0]!.target = 8;
    expect(pick(v, { sel: 'current_target' })).toBe(8);
    v.units[0]!.target = null;
    expect(pick(v, { sel: 'current_target' })).toBe(null);
  });

  it('ally selectors respect includeSelf and the ability target', () => {
    const v = scene();
    v.units[0]!.hpBp = 2000;
    v.units[3]!.hpBp = 5000;
    // Suture targets ally_or_self: includeSelf defaults to true for lowest_hp_ally.
    expect(pick(v, { sel: 'lowest_hp_ally' }, ABILITY_ALLY)).toBe(0);
    expect(pick(v, { sel: 'lowest_hp_ally', includeSelf: false }, ABILITY_ALLY)).toBe(3);
    expect(pick(v, { sel: 'lowest_hp_ally', withinM: 3 }, ABILITY_ALLY)).toBe(0);
    v.units[5]!.target = 2;
    v.units[6]!.target = 2;
    v.units[7]!.target = 1;
    expect(pick(v, { sel: 'most_targeted_ally' }, ABILITY_ALLY)).toBe(2);
    expect(pick(v, { sel: 'ally_role', role: 'tank' }, ABILITY_ALLY)).toBe(1);
    v.units[3]!.x = 9000;
    v.units[3]!.y = 7000;
    v.units[2]!.y = 8000;
    // Units 1, 2 and 3 each have two neighbours within 4 m; the smaller gap to me breaks the tie.
    expect(pick(v, { sel: 'densest_ally', radiusM: 4 }, ABILITY_ALLY)).toBe(2);
    v.captains = [2, null];
    expect(pick(v, { sel: 'captain' }, ABILITY_ALLY)).toBe(2);
    expect(pick(v, { sel: 'self' }, ABILITY_ALLY)).toBe(0);
  });

  it('protect and regroup never pick the deciding unit', () => {
    const v = scene();
    v.units[0]!.hpBp = 1000;
    expect(pick(v, { sel: 'lowest_hp_ally' }, { type: 'protect' })).not.toBe(0);
    expect(pick(v, { sel: 'densest_ally', radiusM: 4 }, { type: 'regroup' })).not.toBe(0);
  });

  it('an ally ability (target ally, not self) excludes the caster even with includeSelf', () => {
    const v = scene();
    v.units[0]!.hpBp = 1000;
    const r = evaluateTactics(compile([rule([ALWAYS], ABILITY_ALLY, { sel: 'lowest_hp_ally', includeSelf: true })], 'aggressive', 'oathguard'), v, 0);
    expect(r.decision.target).not.toBe(0);
  });

  it('tie-breaks: stickiness, then gap, HP fraction and lower slot (cmb-010)', () => {
    const v = scene();
    // Slots 1 and 3 of the enemy side (units 6 and 8) at equal gaps of 3.40 m.
    v.units[6]!.x = 5000 + 4400;
    v.units[6]!.y = 9000;
    v.units[8]!.x = 5000;
    v.units[8]!.y = 9000 + 4400;
    for (const i of [5, 7, 9]) v.units[i]!.x = 30000;
    expect(pick(v, NEAREST)).toBe(6);
    v.units[0]!.target = 8;
    expect(pick(v, NEAREST)).toBe(8);
    // Stickiness tolerance: 1.0 m on gap keys.
    v.units[8]!.y += 999;
    expect(pick(v, NEAREST)).toBe(8);
    v.units[8]!.y += 2;
    expect(pick(v, NEAREST)).toBe(6);
    // HP keys: 5 percentage points.
    const w = scene();
    w.units[5]!.hpBp = 4000;
    w.units[6]!.hpBp = 4500;
    w.units[0]!.target = 6;
    expect(pick(w, { sel: 'lowest_hp_enemy' })).toBe(6);
    w.units[6]!.hpBp = 4501;
    expect(pick(w, { sel: 'lowest_hp_enemy' })).toBe(5);
  });
});

describe('ONLY and PREFER predicates', () => {
  const sel = (v: FakeView, pred: Bag, mode: 'only' | 'prefer', on: Bag = NEAREST, then: Bag = ATTACK) => {
    const e = decide(v, [rule([ALWAYS], then, on, { [mode]: pred })]);
    return { ...e, decision: { ...e.decision, target: e.decision.rule === 0 ? e.decision.target : null } };
  };

  it('ONLY filters and skips with no_target when nothing passes; PREFER never blocks', () => {
    const v = scene();
    expect(sel(v, { pred: 'hp_below', pct: 50 }, 'only').trace[0]!.reason).toBe('only_filtered');
    expect(sel(v, { pred: 'hp_below', pct: 50 }, 'only').trace[0]!.skip).toBe('only_filtered_all');
    expect(sel(v, { pred: 'hp_below', pct: 50 }, 'prefer').decision.target).toBe(5);
    v.units[8]!.hpBp = 4000;
    expect(sel(v, { pred: 'hp_below', pct: 50 }, 'prefer').decision.target).toBe(8);
    expect(sel(v, { pred: 'hp_below', pct: 50 }, 'only').decision.target).toBe(8);
  });

  it('each predicate', () => {
    const v = scene();
    v.units[7]!.hpBp = 9000;
    v.units[8]!.statuses['poison'] = 3;
    v.units[9]!.buff = true;
    v.units[6]!.target = 0;
    v.units[5]!.target = 2;
    const only = (p: Bag, on: Bag = NEAREST, then: Bag = ATTACK) => sel(v, p, 'only', on, then).decision.target;
    v.range.basic = 6000;
    expect(only({ pred: 'in_range' })).toBe(5);
    v.range.basic = 500;
    expect(only({ pred: 'in_range' })).toBe(null);
    v.range.basic = 5000;
    expect(only({ pred: 'within', band: 'mid' })).toBe(5);
    expect(only({ pred: 'hp_above', pct: 95 })).toBe(5);
    expect(only({ pred: 'hp_below', pct: 95 })).toBe(7);
    expect(only({ pred: 'has_status', status: 'poison', minStacks: 3 })).toBe(8);
    expect(only({ pred: 'has_status', status: 'poison', minStacks: 4 })).toBe(null);
    expect(only({ pred: 'lacks_status', status: 'poison' }, { sel: 'furthest_enemy' })).toBe(9);
    expect(only({ pred: 'has_buff' })).toBe(9);
    expect(only({ pred: 'role', role: 'ranged' })).toBe(7);
    expect(only({ pred: 'not_role', role: 'tank' })).toBe(6);
    expect(only({ pred: 'not_targeted_by_ally' }, { sel: 'lowest_hp_enemy' })).toBe(7);
    v.units[2]!.target = 5;
    expect(only({ pred: 'not_targeted_by_ally' })).toBe(6);
    expect(only({ pred: 'targeting_me' })).toBe(6);
    expect(only({ pred: 'not_self' }, { sel: 'lowest_hp_ally', includeSelf: true }, { type: 'ability', slot: 'a1' })).not.toBe(0);
  });

  it('every vocabulary predicate is exercised', () => {
    const used = ['in_range', 'within', 'hp_below', 'hp_above', 'has_status', 'lacks_status', 'has_buff', 'role', 'not_role', 'not_targeted_by_ally', 'targeting_me', 'not_self'];
    expect(used.sort()).toEqual(content.vocabulary.predicates.map((p) => p.id).sort());
  });
});

describe('actions, ordering, cooldowns, stance and traces', () => {
  it('maps each action to a decision', () => {
    const v = scene();
    const d = (then: Bag, on: Bag) => decide(v, [rule([ALWAYS], then, on)]).decision;
    expect(d(ATTACK, NEAREST)).toEqual({ rule: 0, action: 'attack', slot: null, target: 5, band: null });
    expect(d({ type: 'ability', slot: 'a1' }, { sel: 'lowest_hp_ally' })).toMatchObject({ action: 'ability', slot: 'a1' });
    expect(d({ type: 'kite', band: 'close' }, NEAREST)).toEqual({ rule: 0, action: 'kite', slot: null, target: 5, band: 'close' });
    expect(d({ type: 'hold' }, NEAREST)).toMatchObject({ action: 'hold', target: 5 });
    expect(d({ type: 'protect' }, { sel: 'ally_role', role: 'tank' })).toMatchObject({ action: 'protect', target: 1 });
    expect(d({ type: 'regroup' }, { sel: 'ally_role', role: 'melee' })).toMatchObject({ action: 'regroup', target: 2 });
  });

  it('first valid rule wins; the stance fires when nothing passes', () => {
    const v = scene();
    const rules = [rule([{ cond: 'outnumbered' }], ATTACK, { sel: 'furthest_enemy' }), rule([ALWAYS], ATTACK, { sel: 'lowest_hp_enemy' }), rule([ALWAYS], ATTACK, NEAREST)];
    const e = decide(v, rules);
    expect(e.decision.rule).toBe(1);
    expect(e.trace.map((t) => [t.rule, t.fired, t.skip])).toEqual([
      [0, false, 'condition_false'],
      [1, true, null],
    ]);
    const s = decide(v, [rule([{ cond: 'outnumbered' }], ATTACK, NEAREST)], 0, 'cautious');
    expect(s.decision).toEqual({ rule: 1, action: 'stance', slot: null, target: 5, band: null });
    expect(s.trace.at(-1)).toMatchObject({ rule: 1, fired: true });
  });

  it('records every skip reason in the published order', () => {
    const v = scene();
    v.ruleCd.add('0:0');
    v.cooldown.set('0:a1', 36);
    v.units[0]!.focus = 10;
    const rules = [
      rule([ALWAYS], ATTACK, NEAREST),
      rule([{ cond: 'outnumbered' }], ATTACK, NEAREST),
      rule([ALWAYS], { type: 'ability', slot: 'a1' }, { sel: 'lowest_hp_ally' }),
      rule([ALWAYS], { type: 'ability', slot: 'a2' }, { sel: 'lowest_hp_ally' }),
    ];
    let e = decide(v, rules);
    expect(e.trace.map((t) => t.reason)).toEqual(['rule_cooldown', 'cond_false', 'cooldown', 'no_focus', null]);
    expect(e.trace[1]).toMatchObject({ cond: 0, observed: 0 });
    expect(e.trace[2]!.readyInTicks).toBe(36);
    v.units[0]!.focus = 100;
    v.units[0]!.statuses['silence'] = 1;
    e = decide(v, rules);
    expect(e.trace[3]!.reason).toBe('silenced');
    delete v.units[0]!.statuses['silence'];
    v.blocked.add('0:a2');
    e = decide(v, rules);
    expect(e.trace[3]!.reason).toBe('blocked');
    // no_target and out_of_range (Leap Back: approach false, range 4 m).
    const w = scene();
    const le = compile([rule([ALWAYS], ATTACK, { sel: 'enemy_role', role: 'support' as never }), rule([ALWAYS], { type: 'ability', slot: 'a2' }, { sel: 'furthest_enemy' })], 'cautious', 'longeye');
    w.range.a2 = 4000;
    const r = evaluateTactics(le, w, 0);
    expect(r.trace.map((t) => t.reason)).toEqual(['no_target', 'out_of_range', null]);
    expect(r.decision.action).toBe('stance');
  });

  it('a taunt forces "attack ON the taunter" without evaluating rules', () => {
    const v = scene();
    v.taunts.set(0, 7);
    const e = decide(v, [rule([ALWAYS], ATTACK, NEAREST)]);
    expect(e.forced).toBe('taunted');
    expect(e.decision).toEqual({ rule: -1, action: 'attack', slot: null, target: 7, band: null });
    expect(e.trace).toEqual([]);
  });

  it('is pure: the same view gives the same evaluation', () => {
    const v = scene();
    const rules = [rule([{ cond: 'enemy_within', band: 'mid' }], ATTACK, { sel: 'lowest_hp_enemy' })];
    expect(decide(v, rules)).toEqual(decide(v, rules));
  });
});

describe('describeRule', () => {
  it('renders rules from vocabulary labels and content names', () => {
    const oath = asId<ClassId>('oathguard');
    const p = content.presets.require('oathguard_balanced');
    const lines = p.rules.map((r) => describeRule(r, oath, content));
    expect(lines[0]).toBe('IF an enemy within melee range is casting THEN use Shield Bash ON the nearest casting enemy ONLY in range now');
    expect(lines[2]).toBe('IF an ally is below 50% HP THEN use Interpose ON the lowest-HP ally');
    const custom = rule([{ cond: 'enemy_has_status', status: 'marked', not: true }, { cond: 'allies_hp_below', pct: 60, count: 2, band: 'close' }], { type: 'kite', band: 'close' }, NEAREST, {
      prefer: { pred: 'has_status', status: 'poison', minStacks: 2 },
      cooldownS: 3,
    });
    expect(describeRule(custom, oath, content)).toBe(
      'IF NOT an enemy has Marked AND at least 2 allies are below 60% HP within close of me THEN keep away (close) ON the nearest enemy PREFER has Poisoned x2 COOLDOWN 3 s',
    );
    expect(describeStance('cautious', content)).toContain('Cautious');
  });
});
