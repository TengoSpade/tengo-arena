/**
 * Cue derivation tests (05-technical-m2 §A5 / §A11, tech-021): coverage of every ability and status of content/default
 * by explicit rule, the exhaustive effect switch, nested effects, and "no ids in code".
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { EFFECT_TYPES, type AbilityDef, type Effect } from '../../core/content';
import { InvariantError } from '../../core/util';
import { defaultContent } from '../timeline/support.mts';
import type { AbilityCue, AbilityEffectType, EffectKind } from '../types';
import { PROJECTILE_MIN_PX, TELEGRAPH_MIN_TICKS, buildCueTable, childEffects, collectEffects, effectCueKind, explainRelease, walkEffects, type ReleaseRule } from './index';

const content = defaultContent();
const cues = buildCueTable(content);
const abilities = content.abilities.list;
const actives = abilities.filter((a) => a.kind === 'active');

let meleeReachM = 0;
for (const a of abilities) if (a.kind === 'basic' && a.delivery.type === 'instant') meleeReachM = Math.max(meleeReachM, a.rangeM);

const EFFECT_KINDS: readonly EffectKind[] = [
  'swing', 'beam', 'impact', 'number', 'evade', 'heal-pulse', 'shield-gain', 'shield-break', 'status-apply', 'status-resist', 'interrupt', 'dash-trail',
  'displace', 'cleanse', 'dispel', 'guard-link', 'chain-arc', 'splash', 'cooldown-reset', 'focus-gain', 'zone-trigger', 'down', 'deathward', 'rally',
  'captain-down', 'call',
];

describe('content shape the cues are checked against', () => {
  it('is the M1 set: 168 abilities (84 actives, 42 basics, 42 passives) and 34 statuses', () => {
    expect(abilities).toHaveLength(168);
    expect(actives).toHaveLength(84);
    expect(abilities.filter((a) => a.kind === 'basic')).toHaveLength(42);
    expect(abilities.filter((a) => a.kind === 'passive')).toHaveLength(42);
    expect(content.statuses.list).toHaveLength(34);
    expect(EFFECT_TYPES).toHaveLength(17);
  });
});

describe('effect cues: an exhaustive switch over the 17 effect types', () => {
  it('maps every effect type of the vocabulary to a cue, with no fallback', () => {
    // The switch in effectCueKind ends in assertNever(type): adding a type to the Effect union without a case fails to compile.
    expectTypeOf<Parameters<typeof effectCueKind>[0]>().toEqualTypeOf<AbilityEffectType>();
    expectTypeOf<AbilityEffectType>().toEqualTypeOf<(typeof EFFECT_TYPES)[number]>();
    const seen = new Map<string, EffectKind>();
    for (const type of EFFECT_TYPES) {
      const cue = effectCueKind(type);
      expect(EFFECT_KINDS).toContain(cue);
      seen.set(type, cue);
    }
    expect(seen.size).toBe(17);
    // A type outside the vocabulary is an error, not a quiet default.
    expect(() => effectCueKind('teleport' as AbilityEffectType)).toThrow(InvariantError);
  });

  it('draws the cue the design table names for each type', () => {
    const expected: Record<AbilityEffectType, EffectKind> = {
      damage: 'impact',
      heal: 'heal-pulse',
      heal_recent_damage: 'heal-pulse',
      shield: 'shield-gain',
      status: 'status-apply',
      knockback: 'displace',
      pull: 'displace',
      dash: 'dash-trail',
      cleanse: 'cleanse',
      dispel: 'dispel',
      interrupt: 'interrupt',
      guard: 'guard-link',
      zone: 'zone-trigger',
      chain: 'chain-arc',
      splash: 'splash',
      cooldown: 'cooldown-reset',
      focus: 'focus-gain',
    };
    for (const type of EFFECT_TYPES) expect(effectCueKind(type)).toBe(expected[type]);
  });

  it('walks nested effects (chain, splash, zone, onKill) through an exhaustive child switch', () => {
    const damage = (extra: Partial<Extract<Effect, { type: 'damage' }>> = {}): Effect => ({ type: 'damage', amount: { scale: [] }, damageType: 'physical', canCrit: false, evadable: false, ...extra });
    const heal: Effect = { type: 'heal', amount: { scale: [] } };
    const nested: Effect[] = [
      damage({ onKill: [heal] }),
      { type: 'chain', bounces: 2, radiusM: 3, falloff: 0.5, includeInitial: true, effects: [damage()] },
      { type: 'splash', radiusM: 2, affects: 'enemies', excludePrimary: true, effects: [{ type: 'interrupt' }] },
      {
        type: 'zone',
        zone: { center: 'target', follow: 'none', radiusM: 2, durationS: 3, tickIntervalS: 1, trigger: null, maxActive: null, allies: [heal], enemies: [{ type: 'pull', distanceM: 1, toward: 'caster', stopGapM: 0 }] },
      },
    ];
    const visited: string[] = [];
    walkEffects(nested, (e) => visited.push(e.type));
    expect(visited).toEqual(['damage', 'heal', 'chain', 'damage', 'splash', 'interrupt', 'zone', 'heal', 'pull']);
    expect(childEffects(nested[0]!)).toHaveLength(1);
    expect(childEffects(heal)).toEqual([]);
  });

  it('lists every effect of a real ability in the cue, nested ones included', () => {
    let nestedSeen = 0;
    for (const def of abilities) {
      const all = collectEffects(def);
      const cue = cues.ability(def.id as never);
      expect(cue.effects.map((e) => e.type)).toEqual(all.map((e) => e.type));
      expect(cue.effects.map((e) => e.cue)).toEqual(all.map((e) => effectCueKind(e.type)));
      const top = def.effects.length + def.allyEffects.length + def.selfEffects.length + (def.passive?.triggers.reduce((n, t) => n + t.effects.length, 0) ?? 0);
      if (all.length > top) nestedSeen++;
    }
    expect(nestedSeen).toBeGreaterThan(5);
    // A zone's own effects, a chain's and a splash's appear.
    const withZone = abilities.filter((a) => collectEffects(a).some((e) => e.type === 'zone'));
    expect(withZone.length).toBeGreaterThan(0);
    for (const def of withZone) {
      const zone = collectEffects(def).find((e) => e.type === 'zone')!;
      if (zone.type !== 'zone') continue;
      const inner = [...zone.zone.allies, ...zone.zone.enemies].length;
      expect(collectEffects(def).length).toBeGreaterThanOrEqual(inner + 1);
    }
  });
});

describe('release cues: every one of the 84 active abilities reads at release, by an explicit rule', () => {
  it('has a release rule for every ability (no fallback), and a visible release for all 84 actives', () => {
    const byRule = new Map<ReleaseRule, number>();
    for (const def of abilities) {
      const explained = explainRelease(def, meleeReachM);
      expect(explained, `${def.id} matches a release rule`).not.toBeNull();
      byRule.set(explained!.rule, (byRule.get(explained!.rule) ?? 0) + 1);
      const cue = cues.ability(def.id as never);
      expect(cue.release).toBe(explained!.release);
      expect(cue.ability).toBe(def.id);
    }
    for (const def of actives) {
      const cue = cues.ability(def.id as never);
      expect(cue.release, `${def.id} release`).not.toBe('none');
    }
    const activeRules = new Map<ReleaseRule, number>();
    for (const def of actives) {
      const rule = explainRelease(def, meleeReachM)!.rule;
      expect(rule).not.toBe('passive');
      activeRules.set(rule, (activeRules.get(rule) ?? 0) + 1);
    }
    // All 84 actives are covered by a named rule; the counts are pinned so a content change that moves one is seen.
    expect([...activeRules.values()].reduce((a, b) => a + b, 0)).toBe(84);
    expect(Object.fromEntries([...activeRules].sort())).toEqual({
      area: 25,
      'dash-delivery': 6,
      'dash-effect': 2,
      'melee-single': 11,
      'projectile-delivery': 7,
      'self-target': 11,
      'single-target': 22,
    });
    expect(byRule.get('passive')).toBe(42);
    expect(abilities.filter((a) => a.kind === 'passive').every((a) => cues.ability(a.id as never).release === 'none')).toBe(true);
  });

  it('throws on a content shape no rule covers instead of picking a default', () => {
    const odd = { ...abilities.find((a) => a.kind === 'active' && a.delivery.type === 'instant' && a.area === null && a.target === 'enemy')!, target: 'nobody' } as unknown as AbilityDef;
    expect(explainRelease(odd, meleeReachM)).toBeNull();
    const broken = { ...content, abilities: { ...content.abilities, list: [...abilities, odd] } } as typeof content;
    expect(() => buildCueTable(broken)).toThrow(/no release rule covers ability/);
  });

  it('reads the design table: melee basics swing, ranged basics and projectile actives fly, instant singles beam, areas flash, dashes trail', () => {
    const release = (id: string): AbilityCue['release'] => cues.ability(id as never).release;
    for (const def of abilities.filter((a) => a.kind === 'basic')) {
      expect(release(def.id)).toBe(def.delivery.type === 'projectile' ? 'projectile' : 'swing');
    }
    for (const def of actives) {
      const r = release(def.id);
      if (def.delivery.type === 'projectile') expect(r).toBe('projectile');
      else if (def.delivery.type === 'dash' || def.delivery.type === 'leap') expect(r).toBe('dash-trail');
      else if (def.area) expect(r).toBe('area-flash');
      else if (collectEffects(def).some((e) => e.type === 'dash')) expect(r).toBe('dash-trail');
      else if (def.target === 'self') expect(r).toBe('self-pulse');
      else expect(['swing', 'beam']).toContain(r);
    }
    const kinds = new Set(abilities.map((a) => release(a.id)));
    expect([...kinds].sort()).toEqual(['area-flash', 'beam', 'dash-trail', 'none', 'projectile', 'self-pulse', 'swing']);
  });

  it('gives projectile abilities a glyph of at least 10 px and no one else', () => {
    for (const def of abilities) {
      const cue = cues.ability(def.id as never);
      if (def.delivery.type === 'projectile') {
        expect(cue.projectile).not.toBeNull();
        expect(cue.projectile!.sizePx).toBeGreaterThanOrEqual(PROJECTILE_MIN_PX);
      } else expect(cue.projectile).toBeNull();
    }
  });
});

describe('telegraphs', () => {
  it('gives every active area ability one, shaped by its area, and no basic or passive any', () => {
    const shapes = new Set<string>();
    for (const def of abilities) {
      const cue = cues.ability(def.id as never);
      if (def.kind !== 'active') {
        expect(cue.telegraph).toBeNull();
        continue;
      }
      if (def.area) {
        expect(cue.telegraph, def.id).not.toBeNull();
        expect(cue.telegraph!.shape).toBe(def.area.shape);
        expect(cue.telegraph!.minTicks).toBe(1);
        if (def.area.shape === 'circle') expect(cue.telegraph!.sizeCm).toBe(Math.round(def.area.radiusM! * 100));
        if (def.area.shape === 'cone') {
          expect(cue.telegraph!.sizeCm).toBe(Math.round(def.area.radiusM! * 100));
          expect(cue.telegraph!.spread).toBeCloseTo((def.area.angleDeg! * Math.PI) / 180, 9);
        }
        if (def.area.shape === 'line') {
          expect(cue.telegraph!.sizeCm).toBe(Math.round(def.area.lengthM! * 100));
          expect(cue.telegraph!.spread).toBe(Math.round(def.area.widthM! * 100));
        }
        shapes.add(def.area.shape);
      }
    }
    expect([...shapes].sort()).toEqual(['circle', 'cone', 'line']);
  });

  it('telegraphs other casts and channels of 0.3 s (6 ticks) or longer as a line to the target, or as the zone they drop', () => {
    expect(TELEGRAPH_MIN_TICKS).toBe(6);
    let singles = 0;
    for (const def of actives.filter((a) => !a.area)) {
      const cue = cues.ability(def.id as never);
      const ticks = Math.max(def.castTimeS === null ? 0 : Math.round(def.castTimeS * 20), def.channel ? Math.round(def.channel.durationS * 20) : 0);
      const hasZone = collectEffects(def).some((e) => e.type === 'zone');
      if (ticks >= 6 && (hasZone || def.target !== 'self')) {
        expect(cue.telegraph, def.id).not.toBeNull();
        expect(cue.telegraph!.minTicks).toBe(6);
        expect(cue.telegraph!.shape).toBe(hasZone ? 'circle' : 'single');
        if (cue.telegraph!.shape === 'single') singles++;
      } else expect(cue.telegraph, def.id).toBeNull();
    }
    expect(singles).toBeGreaterThan(5);
  });
});

describe('tone and control', () => {
  it('reads hits by damage type, heals, shields and neutral effects', () => {
    const tones = new Set<string>();
    for (const def of abilities) {
      const cue = cues.ability(def.id as never);
      tones.add(cue.tone);
      const all = collectEffects(def);
      const damage = all.filter((e) => e.type === 'damage');
      if (damage.length > 0) expect(['physical', 'arcane', 'true']).toContain(cue.tone);
      else if (all.some((e) => e.type === 'heal' || e.type === 'heal_recent_damage')) expect(cue.tone).toBe('heal');
    }
    expect([...tones].sort()).toEqual(expect.arrayContaining(['arcane', 'heal', 'neutral', 'physical', 'shield']));
    const arcane = abilities.find((a) => a.kind === 'basic' && collectEffects(a).some((e) => e.type === 'damage' && e.damageType === 'arcane'))!;
    expect(cues.ability(arcane.id as never).tone).toBe('arcane');
  });

  it('marks abilities that apply hard control or displace as control', () => {
    let control = 0;
    for (const def of abilities) {
      const cue = cues.ability(def.id as never);
      const hard = collectEffects(def).some((e) => (e.type === 'status' && content.statuses.require(e.status).category === 'cc_hard') || e.type === 'knockback' || e.type === 'pull');
      expect(cue.control, def.id).toBe(hard);
      if (hard) control++;
    }
    expect(control).toBeGreaterThan(8);
  });
});

describe('status cues: all 34 statuses map to a pip', () => {
  it('has an icon, a category and a ring treatment for every status; hard control greys the ring and leads', () => {
    expect(content.statuses.list).toHaveLength(34);
    const byPriority = new Map<string, number>();
    for (const def of content.statuses.list) {
      const cue = cues.status(def.id);
      expect(cue.status).toBe(def.id);
      expect(cue.category).toBe(def.category);
      expect(cue.icon).toBe(def.iconId);
      expect(cue.icon.length).toBeGreaterThan(0);
      expect(cue.ring).toBe(def.category === 'cc_hard' ? 'grey' : def.category === 'dot' || def.category === 'hot' ? 'pulse' : 'none');
      byPriority.set(def.id, cue.priority);
    }
    const hard = content.statuses.list.filter((s) => s.category === 'cc_hard').map((s) => byPriority.get(s.id)!);
    const rest = content.statuses.list.filter((s) => s.category !== 'cc_hard').map((s) => byPriority.get(s.id)!);
    expect(Math.min(...hard)).toBeGreaterThan(Math.max(...rest));
    // Stun and sleep (block everything) outrank root (blocks movement only).
    const stun = content.statuses.list.find((s) => (s.blocks ?? []).length === 3 && s.category === 'cc_hard')!;
    const root = content.statuses.list.find((s) => (s.blocks ?? []).length === 1 && s.category === 'cc_hard')!;
    expect(byPriority.get(stun.id)!).toBeGreaterThan(byPriority.get(root.id)!);
  });

  it('refuses an unknown id', () => {
    expect(() => cues.ability('no_such_ability' as never)).toThrow(InvariantError);
    expect(() => cues.status('no_such_status')).toThrow(InvariantError);
  });
});

describe('no ids in code (tech-021)', () => {
  const dir = new URL('.', import.meta.url);
  const timelineDir = new URL('../timeline/', import.meta.url);
  const sources = [
    ...readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => new URL(f, dir)),
    ...readdirSync(timelineDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => new URL(f, timelineDir)),
  ].map((url) => ({ file: url.pathname.split('/').slice(-2).join('/'), text: readFileSync(url, 'utf8') }));

  it('names no ability or class of the content set in the cue and timeline sources', () => {
    expect(sources.length).toBeGreaterThan(8);
    const ids = [...abilities.map((a) => a.id), ...content.classes.list.map((c) => c.id)];
    for (const { file, text } of sources) {
      for (const id of ids) expect(text.includes(`'${id}'`) || text.includes(`"${id}"`), `${file} names ${id}`).toBe(false);
    }
  });

  it('names no status id in the cue source (statuses are read from content: category, blocks, stacking)', () => {
    const cuesSource = sources.find((s) => s.file === 'cues/index.ts')!;
    const kinds = new Set<string>(EFFECT_KINDS);
    for (const def of content.statuses.list) {
      if (kinds.has(def.id)) continue; // 'deathward' is also an effect cue kind
      expect(cuesSource.text.includes(`'${def.id}'`), `cues/index.ts names status ${def.id}`).toBe(false);
    }
  });
});
