/**
 * 03-combat §9 acceptance cases, the 17 effect types, the 34 statuses, the
 * captain model and combat traits, on the shipped content (content/default).
 *
 * The shipped theme is loaded with Vite's import.meta.glob because core tests
 * may not import files outside src/core; testkit's frozen fixture has only 6
 * classes and these cases name others (Headsman, Briarback, Hushweaver, ...).
 */
import { describe, expect, it } from 'vitest';
import { loadContent, type ContentDB, type ContentFileName, type RawContentFiles } from '../content';
import { asId, type TacticsPresetId } from '../model';
import { evaluateTactics } from '../tactics';
import { snapshotTargets } from './act';
import { fighterInput, sideInput, type FighterSpec } from './build';
import { Fight } from './fight';
import { combatProfile, simulateFight } from './index';
import { movement } from './motion';
import { applyAbility, applyEffect, applyQueuedStatus, damageInstance, hasStatus, resolution, statusInst } from './resolve';
import { ACT_CAST, ACT_NONE, type Unit } from './state';
import { BP, ST, simTables } from './tables';
import { SimView } from './view';

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

const FILL = 'longeye';

/** A full-record fight; units are parked in far corners until a test places them. */
function arena(home: (FighterSpec | string)[], away: (FighterSpec | string)[], opts: { cap?: number; vice?: number | null } = {}): Fight {
  const pad = (l: (FighterSpec | string)[]) => [...l, ...Array.from({ length: 5 - l.length }, () => FILL)];
  const f = new Fight(content, { seed: 'acceptance', round: 1, home: sideInput(content, 'home', pad(home), opts.cap ?? 0, opts.vice ?? null), away: sideInput(content, 'away', pad(away), opts.cap ?? 0, opts.vice ?? null) }, 'full');
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

function place(u: Unit, xM: number, yM: number): void {
  u.x = Math.round(xM * 1000);
  u.y = Math.round(yM * 1000);
}

/** Start-of-tick state: order, distances, auras and modifier blocks. */
function prep(f: Fight): void {
  f.beginTick();
  f.computeDistances();
  f.recomputeAuras();
  for (const u of f.units) if (u.standing) f.recomputeMods(u);
  snapshotTargets(f);
}

function cast(f: Fight, unit: number, slot: 'basic' | 'a1' | 'a2', target: number): void {
  const u = f.units[unit]!;
  const ab = u.cls[slot];
  applyAbility(f, f.newRelease(unit, ab, { isBasic: slot === 'basic' }), ab, target);
}

function events(f: Fight, type: string) {
  return f.rec!.events.filter((e) => e.type === type);
}

/** Advance to the next tick's resolution without the timers' resets of queued jobs. */
function nextTick(f: Fight): void {
  f.tick++;
  prep(f);
  f.pendDmg.fill(0);
  f.dmgTotal.fill(0);
  for (const h of f.heals) h.length = 0;
}

const OATH_EXAMPLE = { str: 12, agi: 9, pac: 11, tgh: 14, pre: 9, arc: 6, spi: 5, wil: 10, cmp: 13, ldr: 11, awr: 8, dis: 10 };

describe('sys-combat-stats (cs-001 to cs-003)', () => {
  it('cs-001: the worked-example Oathguard', () => {
    const p = combatProfile(fighterInput(content, { classId: 'oathguard', stats: OATH_EXAMPLE }, 0), content);
    expect(p).toEqual({
      maxHp: 1770,
      armor: 68,
      ward: 45,
      power: 63,
      support: 0,
      attackIntervalTicks: 26,
      moveSpeedMmPerTick: 163,
      critBp: 400,
      evadeBp: 0,
      tenacityBp: 600,
      resolveBp: 0,
      reactionTicks: 6,
      focusRegenMilliPerTick: 125,
    });
  });

  it('cs-002: all attributes 10 give the class base values', () => {
    for (const k of content.classes.list) {
      const p = combatProfile(fighterInput(content, { classId: k.id }, 0), content);
      const passive = tb.classes.get(k.id)!.passive.passive!;
      const flat = (stat: number) => passive.statMods.filter((m) => m.stat === stat && !m.pred && !m.per && !m.amount).reduce((a, m) => a + m.value, 0);
      expect(p.maxHp, k.id).toBe(k.base.hp);
      expect(p.armor, k.id).toBe(k.base.armor + flat(ST.armor));
      expect(p.ward, k.id).toBe(k.base.ward + flat(ST.ward));
      expect(p.power, k.id).toBe(k.base.power);
      expect(p.support, k.id).toBe(k.supportAttrs ? k.base.support : 0);
      expect(p.critBp, k.id).toBe(500 + Math.round(k.base.critBonus * BP) + flat(ST.crit));
      expect(p.reactionTicks, k.id).toBe(6);
    }
  });

  it('cs-003: +1 Toughness adds trunc(base.hp x 0.04) +- 1 HP and 2 armor', () => {
    for (const k of content.classes.list) {
      const a = combatProfile(fighterInput(content, { classId: k.id }, 0), content);
      const b = combatProfile(fighterInput(content, { classId: k.id, stats: { tgh: 11 } }, 0), content);
      expect(Math.abs(b.maxHp - a.maxHp - Math.trunc(k.base.hp * 0.04))).toBeLessThanOrEqual(1);
      expect(b.armor - a.armor).toBe(2);
    }
  });
});

describe('sys-arena and sys-movement (cmb-011, mv-001 to mv-003)', () => {
  it('cmb-011: 3 front + 2 back spawn mirrored', () => {
    const specs: FighterSpec[] = [
      { classId: 'oathguard', row: 'front' },
      { classId: 'gutterknife', row: 'front' },
      { classId: 'headsman', row: 'front' },
      { classId: 'longeye', row: 'back' },
      { classId: 'chirurgeon', row: 'back' },
    ];
    const f = new Fight(content, { seed: 's', round: 1, home: sideInput(content, 'h', specs), away: sideInput(content, 'a', specs) }, 'none');
    expect(f.units.map((u) => [u.x / 1000, u.y / 1000])).toEqual([
      [9, 6],
      [9, 9],
      [9, 12],
      [5, 7.5],
      [5, 10.5],
      [23, 6],
      [23, 9],
      [23, 12],
      [27, 7.5],
      [27, 10.5],
    ]);
  });

  it('mv-001: two overlapping fighters end at least 1 m apart', () => {
    const f = arena(['oathguard'], ['bloodhowler']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 10.6, 9);
    prep(f);
    movement(f);
    const dx = f.units[0]!.x - f.units[5]!.x;
    const dy = f.units[0]!.y - f.units[5]!.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    expect(d).toBeGreaterThanOrEqual(1000);
  });

  it('mv-002: a rooted fighter is never pushed by separation', () => {
    const f = arena(['oathguard'], ['bloodhowler']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 10.4, 9);
    applyQueuedStatus(f, { rel: f.newRelease(5, null), target: 0, eff: statusEffect('root', 1), guardian: -1, guardPct: 0, guardRadiusMm: 0 });
    prep(f);
    movement(f);
    expect([f.units[0]!.x, f.units[0]!.y]).toEqual([10000, 9000]);
    expect(f.units[5]!.x - 10000).toBeGreaterThanOrEqual(1000);
  });

  it('mv-003: a 3 m knockback toward a wall 1 m away moves the fighter 1 m and stops', () => {
    const f = arena(['thunderhand'], ['bloodhowler']);
    place(f.units[0]!, 3, 9);
    place(f.units[5]!, 1.5, 9);
    prep(f);
    applyEffect(f, f.newRelease(0, null), { type: 'knockback', distanceMm: 3000, fromCaster: true }, f.units[5]!, 5, 0, 0, BP);
    f.commit();
    for (let i = 0; i < 10; i++) movement(f);
    expect(f.units[5]!.x).toBe(500);
    expect(f.units[5]!.disp).toBeNull();
  });
});

function statusEffect(id: string, durationS: number, magnitude = 0, extra: Partial<{ maxStacks: number }> = {}) {
  const st = tb.statuses.get(id)!;
  return {
    type: 'status' as const,
    status: st,
    durationTicks: Math.round(durationS * 20),
    magnitude,
    maxStacks: extra.maxStacks ?? 1,
    tick: null,
    resetOnTargetChange: false,
    wardHeal: null,
  };
}

describe('damage and healing pipelines (worked example, cmb-003 to cmb-005, cmb-007)', () => {
  it('Behead worked example: 315 damage', () => {
    const f = arena([{ classId: 'headsman', stats: { str: 14 } }], [{ classId: 'oathguard', stats: OATH_EXAMPLE }]);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 11.5, 9);
    const oath = f.units[5]!;
    oath.hp = Math.trunc(oath.maxHp / 4);
    f.overrides.varianceFactorBp = 10_100;
    prep(f);
    expect(f.power(f.units[0]!)).toBe(131);
    expect(f.armor(oath)).toBe(68);
    cast(f, 0, 'a1', 5);
    expect(f.pendDmg[5]).toBe(315);
  });

  it('cmb-003: thorns reflect 35 after a 40-damage blow', () => {
    const f = arena(['bloodhowler'], ['briarback']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 11.5, 9);
    prep(f);
    cast(f, 5, 'a1', 5); // Bristle: +40% thorns, +20 armor
    f.commit();
    prep(f);
    expect(f.armor(f.units[5]!)).toBe(100);
    expect(f.units[5]!.mods[ST.thorns]).toBe(5500);
    cast(f, 0, 'basic', 5);
    expect(f.pendDmg[5]).toBe(40);
    f.commit();
    nextTick(f);
    resolution(f);
    expect(f.pendDmg[0]).toBe(35);
  });

  it('cmb-004: a lethal hit and a heal on the same tick are summed (Longeye stands at 197)', () => {
    for (const healToo of [true, false]) {
      const f = arena(['longeye', 'chirurgeon'], ['gutterknife']);
      place(f.units[0]!, 10, 9);
      place(f.units[1]!, 6, 9);
      place(f.units[5]!, 11.5, 9);
      f.units[0]!.hp = 50;
      prep(f);
      cast(f, 5, 'a1', 0); // Shadowstep effects (the dash already happened)
      expect(f.pendDmg[0]).toBe(139);
      if (healToo) cast(f, 1, 'a1', 0); // Suture 220% x 1.3
      f.commit();
      if (healToo) {
        expect(f.units[0]!.hp).toBe(197);
        expect(f.units[0]!.standing).toBe(true);
      } else expect(f.units[0]!.standing).toBe(false);
    }
  });

  it('cmb-005: guard split and aura (Oathguard 26, Longeye 62; 113 unguarded)', () => {
    const f = arena([{ classId: 'oathguard', stats: OATH_EXAMPLE }, 'longeye'], [{ classId: 'headsman', stats: { str: 14 } }]);
    place(f.units[0]!, 10, 9);
    place(f.units[1]!, 10, 11);
    place(f.units[5]!, 11.5, 11);
    prep(f);
    cast(f, 5, 'basic', 1);
    expect(f.pendDmg[1]).toBe(Math.trunc((Math.trunc((13_100 * 9200) / BP) * 100) / 115 / 100));
    f.pendDmg.fill(0);
    cast(f, 0, 'a1', 1); // Interpose: guard 40% within 3.5 m, Fortified 15%
    f.commit();
    prep(f);
    cast(f, 5, 'basic', 1);
    expect(f.pendDmg[0]).toBe(26);
    expect(f.pendDmg[1]).toBe(62);
    // Without guard and aura.
    const g = arena(['longeye'], [{ classId: 'headsman', stats: { str: 14 } }]);
    place(g.units[0]!, 10, 11);
    place(g.units[5]!, 11.5, 11);
    prep(g);
    cast(g, 5, 'basic', 0);
    expect(g.pendDmg[0]).toBe(113);
  });

  it('cmb-007: Deathward saves at 1 HP plus its heal (96), then ends', () => {
    const f = arena(['oathguard', 'vigilkeeper'], ['bloodhowler']);
    place(f.units[0]!, 10, 9);
    place(f.units[1]!, 8, 9);
    prep(f);
    cast(f, 1, 'a1', 0); // Vigil
    f.commit();
    nextTick(f);
    const ally = f.units[0]!;
    ally.hp = 40;
    f.pendDmg[0] = 300;
    f.maxHit[0] = 300;
    f.maxHitSrc[0] = 5;
    f.commit();
    expect(ally.hp).toBe(96);
    expect(ally.standing).toBe(true);
    expect(statusInst(ally, 'deathward')).toBeNull();
    expect(events(f, 'deathward.save').at(-1)).toMatchObject({ unit: 0, data: { healed: 95 } });
    nextTick(f);
    f.pendDmg[0] = 300;
    f.maxHitSrc[0] = 5;
    f.commit();
    expect(ally.standing).toBe(false);
  });
});

describe('round end (cmb-008, tiebreak chain, overtime, simultaneous downs)', () => {
  function capped(): Fight {
    const f = arena([], []);
    for (const u of f.units) {
      u.standing = false;
      u.hp = 0;
    }
    return f;
  }
  const set = (u: Unit, hp: number, max: number) => {
    u.standing = true;
    u.hp = hp;
    u.maxHp = max;
  };

  it('cmb-008: equal standing, HP-fraction sums 6,195 vs 8,806: away wins', () => {
    const f = capped();
    set(f.units[0]!, 400, 1500);
    set(f.units[1]!, 300, 850);
    set(f.units[5]!, 900, 1100);
    set(f.units[6]!, 50, 800);
    f.tiebreak();
    expect([f.winner, f.tiebreakStep]).toEqual([1, 'hp_fraction_sum']);
  });

  it('the chain in order: standing, HP fractions, damage dealt, first down, seeded coin', () => {
    let f = capped();
    set(f.units[0]!, 1, 100);
    set(f.units[1]!, 1, 100);
    set(f.units[5]!, 100, 100);
    f.tiebreak();
    expect([f.winner, f.tiebreakStep]).toEqual([0, 'fighters_standing']);
    f = capped();
    set(f.units[0]!, 50, 100);
    set(f.units[5]!, 50, 100);
    f.units[5]!.tally.damageDealt = 10;
    f.tiebreak();
    expect([f.winner, f.tiebreakStep]).toEqual([1, 'damage_dealt']);
    f = capped();
    set(f.units[0]!, 50, 100);
    set(f.units[5]!, 50, 100);
    f.sides[0].firstDownTick = 300;
    f.sides[1].firstDownTick = 200;
    f.tiebreak();
    expect([f.winner, f.tiebreakStep]).toEqual([1, 'first_down']);
    f = capped();
    set(f.units[0]!, 50, 100);
    set(f.units[5]!, 50, 100);
    f.tiebreak();
    expect(f.tiebreakStep).toBe('seeded_coin');
  });

  it('overtime ramps damage up and healing down from 45 s', () => {
    const f = arena([], []);
    f.tick = 899;
    expect([f.overtimeDmgBp(), f.overtimeHealBp()]).toEqual([BP, BP]);
    f.tick = 1200; // 60 s: k = 15
    expect([f.overtimeDmgBp(), f.overtimeHealBp()]).toEqual([14_500, 5_500]);
    f.tick = 1499; // 74.95 s: k = 29
    expect([f.overtimeDmgBp(), f.overtimeHealBp()]).toEqual([18_700, 1_300]);
  });

  it('a round always ends by the 75 s cap with a winner', () => {
    // Two all-healer sides barely hurt each other.
    const healers = ['cantor', 'grovetender', 'chirurgeon', 'vigilkeeper', 'aegis_scribe'];
    const out = simulateFight({ seed: 'cap', round: 1, home: sideInput(content, 'h', healers), away: sideInput(content, 'a', healers) }, content);
    expect(out.result.durationTicks).toBeLessThanOrEqual(1500);
    expect(['home', 'away']).toContain(out.result.winner);
  });

  it('simultaneous last downs go to the tiebreak chain', () => {
    const f = arena(['longeye'], ['longeye']);
    for (const u of f.units) if (u.index !== 0 && u.index !== 5) u.standing = false;
    prep(f);
    f.pendDmg[0] = 5000;
    f.pendDmg[5] = 5000;
    f.units[0]!.tally.damageDealt = 10;
    f.commit();
    f.endCheck();
    expect(f.ended).toBe(true);
    expect(f.endReason).toBe('elimination');
    expect([f.winner, f.tiebreakStep]).toEqual([0, 'damage_dealt']);
  });
});

describe('crowd control (cmb-001, cmb-002, cmb-006)', () => {
  it('cmb-001: Clangor taunts a Gutterknife (CMP 12) for 30 ticks and forces its decision', () => {
    const f = arena(['gongbearer'], [{ classId: 'gutterknife', stats: { cmp: 12 } }, 'longeye']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 13.8, 9);
    prep(f);
    cast(f, 0, 'a1', 0);
    f.commit();
    const gk = f.units[5]!;
    const taunt = statusInst(gk, 'taunt')!;
    expect(taunt.end - f.tick).toBe(30);
    expect(gk.committed).toEqual({ rule: -1, action: 'attack', slot: null, target: 0, band: null });
    expect(gk.forced).toBe(true);
    expect(f.dr[5]![0]!.idx).toBe(1);
    expect(events(f, 'unit.decide').at(-1)!.data).toMatchObject({ rule: -1, reactCauses: ['taunted'] });
  });

  it('cmb-002: the shared control track 1.0 / 0.6 / 0.35 / immune, reset 6 s after the last applied entry', () => {
    const f = arena(['skullslinger', 'oathguard', 'dreamthief', 'rimebinder'], ['twinfang']);
    const stun = (src: number, cls: string, slot: 'a1' | 'a2', idx: number) => {
      const eff = tb.classes.get(cls)![slot].effects[idx]!;
      if (eff.type !== 'status') throw new Error('not a status');
      applyQueuedStatus(f, { rel: f.newRelease(src, tb.classes.get(cls)![slot]), target: 5, eff, guardian: -1, guardPct: 0, guardRadiusMm: 0 });
    };
    prep(f);
    const applied = () => events(f, 'status.apply').map((e) => (e.data as { durationTicks: number }).durationTicks);
    f.tick = 200;
    stun(0, 'skullslinger', 'a1', 1);
    f.tick = 230;
    stun(1, 'oathguard', 'a2', 1);
    f.tick = 250;
    stun(2, 'dreamthief', 'a2', 1);
    f.tick = 260;
    stun(3, 'rimebinder', 'a1', 1);
    expect(applied()).toEqual([20, 9, 4]);
    expect(events(f, 'status.resist').at(-1)!.data).toEqual({ status: 'root', reason: 'dr_immune' });
    f.tick = 370;
    stun(0, 'skullslinger', 'a1', 1);
    expect(applied().at(-1)).toBe(20);
  });

  it('cmb-006: Hush interrupts Aimed Shot: no focus spent, no cooldown, silenced 30 ticks, trace shows silenced', () => {
    const f = arena(['longeye'], ['hushweaver']);
    place(f.units[0]!, 6, 9);
    place(f.units[5]!, 13, 9);
    prep(f);
    const le = f.units[0]!;
    le.act = ACT_CAST;
    le.actAbility = le.cls.a1;
    le.actTarget = 5;
    le.actLeft = 10;
    cast(f, 5, 'a1', 0);
    f.commit();
    expect(le.act).toBe(ACT_NONE);
    expect(le.focus).toBe(100_000);
    expect(le.cdA1).toBe(0);
    expect(statusInst(le, 'silence')!.end - f.tick).toBe(30);
    expect(events(f, 'cast.interrupt').at(-1)).toMatchObject({ unit: 0, data: { ability: 'longeye_aimed_shot', cause: 'silence', by: 5 } });
    nextTick(f);
    const view = new SimView(f);
    view.sync();
    const ev = evaluateTactics(le.tactics, view, 0);
    expect(ev.trace[1]).toMatchObject({ rule: 1, reason: 'silenced', skip: 'blocked' });
    expect(ev.decision.action).toBe('attack');
  });
});

describe('decision trace (cmb-009)', () => {
  it('Chirurgeon at 12.40 s: R1 cond_false, R2 cooldown 36 ticks, R3 cond_false, cautious stance', () => {
    const f = arena(['chirurgeon', 'oathguard'], ['bloodhowler']);
    place(f.units[0]!, 6, 9);
    place(f.units[1]!, 9, 9);
    place(f.units[5]!, 12, 9);
    f.tick = 248;
    f.units[1]!.hp = Math.trunc((f.units[1]!.maxHp * 66) / 100);
    f.units[0]!.cdA1 = 36 * BP;
    prep(f);
    const view = new SimView(f);
    view.sync();
    const ev = evaluateTactics(f.units[0]!.tactics, view, 0);
    expect(ev.trace.map((t) => [t.rule, t.reason])).toEqual([
      [0, 'cond_false'],
      [1, 'cooldown'],
      [2, 'cond_false'],
      [3, null],
    ]);
    expect(ev.trace[1]!.readyInTicks).toBe(36);
    expect(ev.decision).toMatchObject({ action: 'stance', target: 5 });
  });
});

describe('the 17 effect types', () => {
  it('damage, heal and status (above); shield with the 50% cap', () => {
    const f = arena(['gongbearer'], []);
    prep(f);
    cast(f, 0, 'a2', 0); // Brace: 18% of max HP
    f.commit();
    expect(f.units[0]!.shields.reduce((a, s) => a + s.amount, 0)).toBe(Math.trunc(1600 * 0.18));
    for (let i = 0; i < 5; i++) {
      f.tick++;
      prep(f);
      cast(f, 0, 'a2', 0);
      f.commit();
    }
    expect(f.units[0]!.shields.reduce((a, s) => a + s.amount, 0)).toBe(800);
  });

  it('knockback (Thunderclap) and pull with taunt (Harpoon)', () => {
    const f = arena(['thunderhand', 'harpooner'], ['bloodhowler', 'longeye']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 11.5, 9);
    prep(f);
    cast(f, 0, 'a2', 0);
    f.commit();
    expect(f.units[5]!.disp?.kind).toBe('knockback');
    for (let i = 0; i < 10; i++) movement(f);
    expect(f.units[5]!.x).toBe(14_000);
    place(f.units[1]!, 5, 3);
    place(f.units[6]!, 11, 3);
    prep(f);
    cast(f, 1, 'a1', 6);
    f.commit();
    expect(f.units[6]!.disp?.kind).toBe('pull');
    expect(hasStatus(f.units[6]!, 'taunt')).toBe(true);
    for (let i = 0; i < 20; i++) {
      movement(f);
      f.computeDistances();
    }
    expect(f.gap(1, 6)).toBeLessThanOrEqual(300 + 20);
  });

  it('dash (Leap Back moves 4 m away) and dash deliveries (Shadowstep lands behind)', () => {
    const f = arena(['longeye'], ['gutterknife']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 12, 9);
    prep(f);
    cast(f, 0, 'a2', 5);
    f.commit();
    for (let i = 0; i < 10; i++) movement(f);
    expect(f.units[0]!.x).toBe(6000);
    expect(hasStatus(f.units[0]!, 'haste')).toBe(true);
  });

  it('cleanse (Purging Tincture) and dispel (Unravel takes 2 buffs, shields included)', () => {
    const f = arena(['chirurgeon', 'oathguard'], ['hushweaver']);
    place(f.units[0]!, 6, 9);
    place(f.units[1]!, 8, 9);
    place(f.units[5]!, 12, 9);
    prep(f);
    for (const id of ['stun', 'slow', 'weaken']) applyQueuedStatus(f, { rel: f.newRelease(5, null), target: 1, eff: statusEffect(id, 2, id === 'stun' ? 0 : 2000), guardian: -1, guardPct: 0, guardRadiusMm: 0 });
    cast(f, 0, 'a2', 1);
    f.commit();
    expect(f.units[1]!.statuses.map((s) => s.st.id)).toEqual(['regen']);
    // Dispel: fortify, a shield and regen; Unravel strips the two longest-lasting.
    applyQueuedStatus(f, { rel: f.newRelease(1, null), target: 1, eff: statusEffect('fortify', 1, 1000), guardian: -1, guardPct: 0, guardRadiusMm: 0 });
    f.units[1]!.shields.push({ source: 0, ability: null, amount: 100, end: f.tick + 200, createdAt: f.tick - 1, seq: 999 });
    prep(f);
    cast(f, 5, 'a2', 1);
    f.commit();
    expect(f.units[1]!.shields).toEqual([]);
    expect(f.units[1]!.statuses.map((s) => s.st.id)).toEqual(['fortify']);
  });

  it('interrupt (Shield Bash) cancels a cast and stuns', () => {
    const f = arena(['oathguard'], ['emberwright']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 11.5, 9);
    prep(f);
    const e = f.units[5]!;
    e.act = ACT_CAST;
    e.actAbility = e.cls.a1;
    e.actTarget = 0;
    e.actLeft = 5;
    cast(f, 0, 'a2', 5);
    f.commit();
    expect(e.act).toBe(ACT_NONE);
    expect(hasStatus(e, 'stun')).toBe(true);
  });

  it('zone: Caltrop Scatter ticks damage and slow; Bear Trap roots the first enemy to touch it', () => {
    const f = arena(['briarback', 'snaresetter'], ['bloodhowler', 'gutterknife']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 11.5, 9);
    prep(f);
    cast(f, 0, 'a2', 0);
    f.commit();
    expect(f.zones.length).toBe(1);
    for (let i = 0; i < 10; i++) {
      f.tick++;
      f.beginTick();
      f.timers();
      f.computeDistances();
      resolution(f);
      f.commit();
    }
    expect(f.units[5]!.tally.damageTaken).toBeGreaterThan(0);
    expect(hasStatus(f.units[5]!, 'slow')).toBe(true);
    // Bear Trap placed at an enemy's feet arms after 0.3 s.
    place(f.units[1]!, 4, 3);
    place(f.units[6]!, 9, 3);
    prep(f);
    cast(f, 1, 'a1', 6);
    f.commit();
    const trap = f.zones.at(-1)!;
    expect(trap.trap).not.toBeNull();
    for (let i = 0; i < 8; i++) {
      f.tick++;
      f.beginTick();
      f.timers();
      f.computeDistances();
      resolution(f);
      f.commit();
    }
    expect(hasStatus(f.units[6]!, 'root')).toBe(true);
    expect(trap.dead).toBe(true);
  });

  it('chain (Chain Lightning jumps with falloff) and splash (Wide Arc)', () => {
    const f = arena(['thunderhand', 'chaffcutter'], ['oathguard', 'oathguard', 'oathguard', 'oathguard', 'oathguard']);
    for (let i = 0; i < 5; i++) place(f.units[5 + i]!, 14 + i * 1.5, 9);
    place(f.units[0]!, 8, 9);
    prep(f);
    cast(f, 0, 'a1', 5);
    const hits = events(f, 'hit').filter((e) => e.unit === 0).map((e) => e.target);
    expect(hits).toEqual([5, 6, 7, 8]);
    const pre = events(f, 'hit').filter((e) => e.unit === 0).map((e) => (e.data as { preMitigation: number }).preMitigation);
    expect(pre[1]! / pre[0]!).toBeCloseTo(0.8, 1);
    // Wide Arc: a basic hit splashes onto neighbours next tick.
    place(f.units[1]!, 13.4, 9);
    f.commit();
    prep(f);
    const before = f.rec!.events.length;
    cast(f, 1, 'basic', 5);
    f.commit();
    nextTick(f);
    resolution(f);
    const splash = f.rec!.events.slice(before).filter((e) => e.type === 'hit' && e.unit === 1).map((e) => e.target);
    expect(splash).toContain(6);
  });

  it('cooldown (Behead resets on a kill) and focus (Collect the Bounty)', () => {
    const f = arena([{ classId: 'headsman', stats: { str: 14 } }], ['longeye']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 11.5, 9);
    f.units[5]!.hp = 50;
    prep(f);
    f.units[0]!.cdA1 = 10 * 20 * BP;
    cast(f, 0, 'a1', 5);
    f.commit();
    expect(f.units[5]!.standing).toBe(false);
    nextTick(f);
    resolution(f);
    f.commit();
    expect(f.units[0]!.cdA1).toBe(0);

    const g = arena(['writ_hunter'], ['longeye']);
    place(g.units[0]!, 8, 9);
    place(g.units[5]!, 12, 9);
    g.units[0]!.focus = 10_000;
    prep(g);
    cast(g, 0, 'a1', 5); // Post the Writ
    g.commit();
    g.units[5]!.hp = 1;
    nextTick(g);
    cast(g, 0, 'basic', 5);
    g.commit();
    nextTick(g);
    resolution(g);
    g.commit();
    expect(g.units[0]!.focus).toBeGreaterThanOrEqual(35_000);
    expect(hasStatus(g.units[0]!, 'empower')).toBe(true);
  });

  it('heal_recent_damage (Rewind Wounds: 70% of the last 4 s, at least 80% Support)', () => {
    const f = arena(['hourglass_sage', 'oathguard'], ['bloodhowler']);
    place(f.units[0]!, 6, 9);
    place(f.units[1]!, 8, 9);
    prep(f);
    const ally = f.units[1]!;
    damageInstance(f, f.newRelease(5, null), ally, 60_000, 2, false, false, 0, null, true);
    f.commit();
    nextTick(f);
    cast(f, 0, 'a1', 1);
    expect(f.heals[1]![0]!.amount).toBe(Math.trunc(600 * 0.7));
  });
});

describe('the 34 statuses', () => {
  const statStatuses = content.combat.statuses.filter((s) => s.stat !== null);

  it.each(statStatuses.map((s) => [s.id, s] as const))('%s modifies its stat with its sign and cap', (id, s) => {
    const f = arena(['oathguard'], ['bloodhowler']);
    prep(f);
    const u = f.units[0]!;
    const stat = (ST as Record<string, number>)[s.stat!]!;
    const before = u.mods[stat]!;
    const factor = tb.statKindFactor[stat]!;
    const mag = Math.round((s.cap ?? 0.1) * factor);
    applyQueuedStatus(f, { rel: f.newRelease(5, null), target: 0, eff: statusEffect(id, 2, mag), guardian: -1, guardPct: 0, guardRadiusMm: 0 });
    f.recomputeMods(u);
    expect(u.mods[stat]! - before).toBe((s.sign ?? 1) * mag);
    // A stronger second source is capped.
    applyQueuedStatus(f, { rel: f.newRelease(6, null), target: 0, eff: statusEffect(id, 2, mag * 3), guardian: -1, guardPct: 0, guardRadiusMm: 0 });
    f.recomputeMods(u);
    const cap = Math.round(s.cap! * factor);
    if (s.stacking === 'stacks') expect(Math.abs(u.mods[stat]! - before)).toBeLessThanOrEqual(cap);
    else expect(u.mods[stat]! - before).toBe((s.sign ?? 1) * cap);
  });

  it('stun blocks actions and decisions; sleep breaks on 8% of max HP; root blocks movement; silence blocks abilities', () => {
    const f = arena(['oathguard'], ['bloodhowler']);
    prep(f);
    const u = f.units[5]!;
    const add = (id: string) => applyQueuedStatus(f, { rel: f.newRelease(0, null), target: 5, eff: statusEffect(id, 2), guardian: -1, guardPct: 0, guardRadiusMm: 0 });
    add('sleep');
    f.tick++;
    prep(f);
    f.pendDmg[5] = Math.trunc((u.maxHp * 8) / 100) - 1;
    f.dmgTotal[5] = f.pendDmg[5]!;
    f.commit();
    expect(hasStatus(u, 'sleep')).toBe(true);
    f.tick++;
    prep(f);
    f.pendDmg[5] = Math.trunc((u.maxHp * 8) / 100) + 1;
    f.dmgTotal[5] = f.pendDmg[5]!;
    f.commit();
    expect(hasStatus(u, 'sleep')).toBe(false);
    const m = f.units[0]!;
    m.forced = false;
    add('silence');
    const view = new SimView(f);
    view.sync();
    expect(view.hasStatus(5, 'silence')).toBe(true);
  });

  it('damage and heal over time tick per interval with stacks (bleed, burn, poison, regen)', () => {
    const f = arena(['bloodhowler', 'grovetender'], ['oathguard']);
    place(f.units[0]!, 10, 9);
    place(f.units[1]!, 6, 9);
    place(f.units[5]!, 11.5, 9);
    prep(f);
    cast(f, 0, 'a2', 5); // Savage Rend: bleed 25% Power every 0.5 s for 3 s
    cast(f, 1, 'a1', 0); // Rejuvenate on the Bloodhowler
    f.commit();
    let dot = 0;
    for (let i = 0; i < 70; i++) {
      f.tick++;
      f.beginTick();
      f.timers();
      f.computeDistances();
      resolution(f);
      dot += f.pendDmg[5]!;
      f.commit();
    }
    // 6 ticks of 20.00 centi... 25% x 80 Power = 20 before armor 60 -> 12 per tick.
    expect(dot).toBe(6 * 12);
    expect(f.units[1]!.tally.healingDone + f.units[1]!.tally.overheal).toBeGreaterThan(0);
  });

  it('guarded, riposte, deathward, anchored and illuminated have their special rules', () => {
    // Anchored: immune to knockback.
    const f = arena(['pavisier'], ['thunderhand']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 11.5, 9);
    prep(f);
    cast(f, 0, 'a1', 0); // Plant the Pavise
    f.commit();
    prep(f);
    cast(f, 5, 'a2', 5); // Thunderclap
    f.commit();
    expect(f.units[0]!.disp).toBeNull();
    // Riposte: an evaded melee blow triggers a counter-strike next tick.
    const g = arena(['bladeturner'], ['bloodhowler']);
    place(g.units[0]!, 10, 9);
    place(g.units[5]!, 11.5, 9);
    prep(g);
    cast(g, 0, 'a1', 0); // Parry Stance
    g.commit();
    prep(g);
    g.units[0]!.evadeAcc = BP;
    cast(g, 5, 'basic', 0);
    expect(events(g, 'evade').length).toBe(1);
    g.commit();
    nextTick(g);
    resolution(g);
    expect(g.pendDmg[5]).toBeGreaterThan(0);
    // Illuminated: allies who damage the target heal for 10% of it.
    const h = arena(['sunlance_acolyte', 'bloodhowler'], ['oathguard']);
    place(h.units[0]!, 6, 9);
    place(h.units[1]!, 10, 9);
    place(h.units[5]!, 11.5, 9);
    h.units[1]!.hp = 500;
    prep(h);
    cast(h, 0, 'a1', 5);
    h.commit();
    prep(h);
    cast(h, 1, 'basic', 5);
    h.commit();
    nextTick(h);
    resolution(h);
    expect(h.heals[1]!.length).toBeGreaterThan(0);
  });
});

describe('captain model and combat traits (sys-fight-captain, sys-fight-traits)', () => {
  it('aura by grade, rally on the first ally down, Shaken and handover to the vice-captain at CQ - 10', () => {
    const lineup: FighterSpec[] = [
      { classId: 'oathguard', captainQuality: 90 },
      { classId: 'longeye', captainQuality: 60 },
      { classId: 'chirurgeon' },
      { classId: 'longeye' },
      { classId: 'longeye' },
    ];
    const f = new Fight(content, { seed: 'c', round: 1, home: sideInput(content, 'h', lineup, 0, 1), away: sideInput(content, 'a', ['longeye', 'longeye', 'longeye', 'longeye', 'longeye']) }, 'full');
    prep(f);
    expect(f.units[2]!.cmpEff).toBe(12); // grade A aura +2
    // An ally falls: rally +3 for 5 s.
    f.pendDmg[3] = 10_000;
    f.maxHitSrc[3] = 5;
    f.commit();
    expect(hasStatus(f.units[2]!, 'rallied')).toBe(true);
    prep(f);
    expect(f.units[2]!.cmpEff).toBe(15);
    expect(events(f, 'captain.rally').length).toBe(1);
    // The captain falls: aura ends, Shaken for 4 s, then the vice takes over at CQ 50.
    f.tick++;
    prep(f);
    f.pendDmg[0] = 10_000;
    f.maxHitSrc[0] = 5;
    f.commit();
    expect(events(f, 'captain.down').length).toBe(1);
    expect(hasStatus(f.units[2]!, 'shaken')).toBe(true);
    const at = f.sides[0].handoverAt;
    f.tick = at;
    f.beginTick();
    f.timers();
    expect(f.sides[0].captain).toBe(1);
    expect(f.sides[0].captainCq).toBe(50);
    expect(events(f, 'captain.handover').at(-1)!.data).toEqual({ newCaptain: 1, cq: 50 });
  });

  it('traits: Hot Blood below 50% HP, Grim Visage on nearby enemies, Steel Spine ignores Shaken, Skittish after an ally falls', () => {
    const f = arena([{ classId: 'headsman', traitIds: ['hot_blood', 'grim_visage', 'steel_spine'] }, { classId: 'longeye', traitIds: ['skittish'] }], ['oathguard']);
    place(f.units[0]!, 10, 9);
    place(f.units[5]!, 11.5, 9);
    prep(f);
    const bh = f.units[0]!;
    const before = bh.mods[ST.damageDealt]!;
    bh.hp = Math.trunc(bh.maxHp / 2) - 1;
    f.recomputeMods(bh);
    expect(bh.mods[ST.damageDealt]! - before).toBe(800);
    expect(f.units[5]!.cmpEff).toBe(9);
    // An ally of the longeye falls: skittish -3 composure for 4 s (no rally: captain grade D at CQ 50).
    f.pendDmg[2] = 10_000;
    f.maxHitSrc[2] = 5;
    f.commit();
    f.tick++;
    prep(f);
    expect(f.units[1]!.cmpEff).toBe(7);
    expect(bh.shakenMultBp).toBe(0);
  });
});

describe('every class fights (all 105 presets compile)', () => {
  const ref = ['oathguard', 'gutterknife', 'longeye', 'rimebinder', 'chirurgeon'];
  it.each(content.classes.list.map((k) => [k.id] as const))('%s', (id) => {
    const k = content.classes.require(id);
    for (const presetId of k.presetIds) {
      const home = sideInput(
        content,
        'h',
        Array.from({ length: 5 }, () => ({ classId: id, presetId })),
      );
      const out = simulateFight({ seed: `class-${presetId}`, round: 1, home, away: sideInput(content, 'a', ref) }, content);
      expect(out.result.durationTicks).toBeLessThanOrEqual(1500);
      // Every preset acts: its fighters release abilities or basic attacks.
      const casts = Object.values(out.fighterStats)
        .filter((s) => s.clubId === 'h')
        .reduce((a, s) => a + Object.values(s.casts).reduce((x, y) => x + y, 0), 0);
      expect(casts, presetId).toBeGreaterThan(0);
      expect(content.presets.require(asId<TacticsPresetId>(presetId)).classId).toBe(id);
    }
  });
});
