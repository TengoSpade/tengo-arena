/**
 * Ability and status cues, derived from content (05-technical-m2 §A5, tech-021; WP-M2C). PURE.
 *
 * Every one of the 168 abilities and every status of content/default gets a cue by construction, from its
 * definition: `delivery` (instant, dash, leap, projectile), `area` (circle, cone, line, centre, radius,
 * angle), `castTimeS`, `channel`, `target` and its effects (damage type, heal, shield, status categories,
 * knockback, pull, zones). No ability id or class id appears in this code; a theme's skin may later add
 * per-ability overrides from its own data file (designer-owned, not in M2).
 *
 * Coverage is by explicit rule, never by fallback: `explainRelease` names the rule that gave an ability its
 * release cue and returns null when none applies, which makes `buildCueTable` throw (the test counts the
 * rules over the 84 active abilities). The effect vocabulary is walked with exhaustive switches
 * (`effectCueKind`, `childEffects`): a new effect type fails to compile until it has a cue.
 */
import type { AbilityDef, ContentDB, Effect, StatusDef } from '../../core/content';
import { secondsToTicks } from '../../core/content';
import { InvariantError, assertNever } from '../../core/util';
import type { AbilityCue, AbilityEffectType, CueTable, EffectKind, PipKind, StatusCue } from '../types';

/** Telegraph threshold (04 §7: casts and channels of 0.3 s or longer). In ticks at 20 per second. */
export const TELEGRAPH_MIN_TICKS = 6;

/** Projectile glyphs are never smaller than this on screen (research A4.2: no tiny projectiles). CSS px. */
export const PROJECTILE_MIN_PX = 10;

/** The cue an effect type draws on the arena: an exhaustive switch, so a new effect type fails to compile until it has one. */
export function effectCueKind(type: AbilityEffectType): EffectKind {
  switch (type) {
    case 'damage':
      return 'impact';
    case 'heal':
    case 'heal_recent_damage':
      return 'heal-pulse';
    case 'shield':
      return 'shield-gain';
    case 'status':
      return 'status-apply';
    case 'knockback':
    case 'pull':
      return 'displace';
    case 'dash':
      return 'dash-trail';
    case 'cleanse':
      return 'cleanse';
    case 'dispel':
      return 'dispel';
    case 'interrupt':
      return 'interrupt';
    case 'guard':
      return 'guard-link';
    case 'zone':
      return 'zone-trigger';
    case 'chain':
      return 'chain-arc';
    case 'splash':
      return 'splash';
    case 'cooldown':
      return 'cooldown-reset';
    case 'focus':
      return 'focus-gain';
    default:
      return assertNever(type, 'effect type');
  }
}

/** The effects nested inside one effect (damage.onKill, zone allies and enemies, chain and splash effects), by an exhaustive switch. */
export function childEffects(effect: Effect): readonly Effect[] {
  switch (effect.type) {
    case 'damage':
      return effect.onKill ?? [];
    case 'zone':
      return [...effect.zone.allies, ...effect.zone.enemies];
    case 'chain':
    case 'splash':
      return effect.effects;
    case 'heal':
    case 'shield':
    case 'status':
    case 'knockback':
    case 'pull':
    case 'dash':
    case 'cleanse':
    case 'dispel':
    case 'interrupt':
    case 'guard':
    case 'cooldown':
    case 'focus':
    case 'heal_recent_damage':
      return [];
    default:
      return assertNever(effect, 'effect');
  }
}

/** Visit effects depth-first, parents before their nested effects. */
export function walkEffects(effects: readonly Effect[], visit: (effect: Effect) => void): void {
  for (const e of effects) {
    visit(e);
    walkEffects(childEffects(e), visit);
  }
}

/** Every effect of an ability in walk order: effects, allyEffects, selfEffects, then the effects of passive triggers; nested effects included. */
export function collectEffects(def: AbilityDef): Effect[] {
  const out: Effect[] = [];
  const add = (e: Effect): void => {
    out.push(e);
  };
  walkEffects(def.effects, add);
  walkEffects(def.allyEffects, add);
  walkEffects(def.selfEffects, add);
  if (def.passive) for (const t of def.passive.triggers) walkEffects(t.effects, add);
  return out;
}

/** The rule that gave an ability its release cue. */
export type ReleaseRule = 'passive' | 'projectile-delivery' | 'dash-delivery' | 'dash-effect' | 'area' | 'self-target' | 'melee-single' | 'single-target';

/**
 * How an ability reads at release, and which rule decided it; null when no rule applies (a content shape the cues do
 * not know: `buildCueTable` throws rather than guess). `meleeReachM` is the longest reach of an instant basic attack.
 */
export function explainRelease(def: AbilityDef, meleeReachM: number): { release: AbilityCue['release']; rule: ReleaseRule } | null {
  if (def.kind === 'passive') return { release: 'none', rule: 'passive' };
  if (def.delivery.type === 'projectile') return { release: 'projectile', rule: 'projectile-delivery' };
  if (def.delivery.type === 'dash' || def.delivery.type === 'leap') return { release: 'dash-trail', rule: 'dash-delivery' };
  if (collectEffects(def).some((e) => e.type === 'dash')) return { release: 'dash-trail', rule: 'dash-effect' };
  if (def.area !== null) return { release: 'area-flash', rule: 'area' };
  if (def.target === 'self') return { release: 'self-pulse', rule: 'self-target' };
  if (def.delivery.type === 'instant' && def.target === 'enemy' && def.rangeM <= meleeReachM) return { release: 'swing', rule: 'melee-single' };
  if (def.delivery.type === 'instant' && (def.target === 'enemy' || def.target === 'ally' || def.target === 'ally_or_self')) return { release: 'beam', rule: 'single-target' };
  return null;
}

/** Where an ability's area (or zone) is centred: the caster, or the target at release. Null for an ability with neither. */
export function areaCenterOf(def: AbilityDef): 'self' | 'target' | null {
  if (def.area) return def.area.center;
  for (const e of collectEffects(def)) if (e.type === 'zone') return e.zone.center;
  return null;
}

function telegraphOf(def: AbilityDef, ticksPerSecond: number): AbilityCue['telegraph'] {
  if (def.kind !== 'active') return null;
  const castTicks = def.castTimeS === null ? 0 : secondsToTicks(def.castTimeS, ticksPerSecond);
  const channelTicks = def.channel ? secondsToTicks(def.channel.durationS, ticksPerSecond) : 0;
  const long = Math.max(castTicks, channelTicks) >= TELEGRAPH_MIN_TICKS;
  const area = def.area;
  if (area) {
    // Every area ability telegraphs for as long as it casts or channels at all; the area flash covers an instant one.
    switch (area.shape) {
      case 'circle':
        return { shape: 'circle', sizeCm: Math.round((area.radiusM ?? 0) * 100), spread: 0, minTicks: 1 };
      case 'cone':
        return { shape: 'cone', sizeCm: Math.round((area.radiusM ?? 0) * 100), spread: ((area.angleDeg ?? 90) * Math.PI) / 180, minTicks: 1 };
      case 'line':
        return { shape: 'line', sizeCm: Math.round((area.lengthM ?? 0) * 100), spread: Math.round((area.widthM ?? 0) * 100), minTicks: 1 };
      default:
        return assertNever(area.shape, 'area shape');
    }
  }
  const zone = collectEffects(def).find((e) => e.type === 'zone');
  if (zone && zone.type === 'zone' && long) return { shape: 'circle', sizeCm: Math.round(zone.zone.radiusM * 100), spread: 0, minTicks: TELEGRAPH_MIN_TICKS };
  if (long && def.target !== 'self') return { shape: 'single', sizeCm: Math.round(def.rangeM * 100), spread: 0, minTicks: TELEGRAPH_MIN_TICKS };
  return null;
}

const TONE_ORDER = ['physical', 'arcane', 'true'] as const;

function toneOf(effects: readonly Effect[]): AbilityCue['tone'] {
  const counts: Record<(typeof TONE_ORDER)[number], number> = { physical: 0, arcane: 0, true: 0 };
  let heal = false;
  let shield = false;
  for (const e of effects) {
    if (e.type === 'damage') counts[e.damageType]++;
    else if (e.type === 'status' && e.tick?.damageType) counts[e.tick.damageType] += 0.5;
    else if (e.type === 'heal' || e.type === 'heal_recent_damage') heal = true;
    else if (e.type === 'shield') shield = true;
  }
  let best: (typeof TONE_ORDER)[number] | null = null;
  for (const t of TONE_ORDER) if (counts[t] > 0 && (best === null || counts[t] > counts[best])) best = t;
  if (best) return best;
  if (heal) return 'heal';
  if (shield) return 'shield';
  return 'neutral';
}

function abilityCue(def: AbilityDef, content: ContentDB, meleeReachM: number, ticksPerSecond: number): AbilityCue {
  const explained = explainRelease(def, meleeReachM);
  if (!explained) {
    throw new InvariantError(`buildCueTable: no release rule covers ability "${def.id}" (${def.kind}, ${def.delivery.type}, target ${def.target}); add a rule to cues/index.ts`);
  }
  const effects = collectEffects(def);
  const control = effects.some((e) => (e.type === 'status' && content.statuses.get(e.status)?.category === 'cc_hard') || e.type === 'knockback' || e.type === 'pull');
  return {
    ability: def.id as AbilityCue['ability'],
    telegraph: telegraphOf(def, ticksPerSecond),
    release: explained.release,
    effects: effects.map((e) => ({ type: e.type, cue: effectCueKind(e.type) })),
    projectile: explained.release === 'projectile' ? { sizePx: def.kind === 'basic' ? PROJECTILE_MIN_PX : PROJECTILE_MIN_PX + 4 } : null,
    tone: toneOf(effects),
    control,
  };
}

/** Category treatments (asset-006: hard control greys the ring) and display order (hard control first). */
const CATEGORY_RING: Readonly<Record<string, StatusCue['ring']>> = { cc_hard: 'grey', dot: 'pulse', hot: 'pulse' };
const CATEGORY_PRIORITY: Readonly<Record<string, number>> = { cc_hard: 80, cc_soft: 60, dot: 50, debuff: 40, hot: 30, buff: 20, special: 10, shield: 10 };

/** The pip a status shows: its category's (A18; the shield category has none, the bar segment shows it). An exhaustive switch. */
export function pipOf(category: StatusDef['category']): PipKind | null {
  switch (category) {
    case 'cc_hard':
      return 'control-hard';
    case 'cc_soft':
      return 'control-soft';
    case 'buff':
      return 'buff';
    case 'debuff':
      return 'debuff';
    case 'dot':
      return 'dot';
    case 'hot':
      return 'hot';
    case 'special':
      return 'special';
    case 'shield':
      return null;
    default:
      return assertNever(category, 'status category');
  }
}

function statusCue(def: StatusDef): StatusCue {
  const blocked = def.blocks?.length ?? 0;
  return {
    status: def.id,
    category: def.category,
    icon: def.iconId,
    pip: pipOf(def.category),
    ring: CATEGORY_RING[def.category] ?? 'none',
    priority: (CATEGORY_PRIORITY[def.category] ?? 0) + blocked * 4 + (def.interrupts ? 2 : 0),
  };
}

/** Build the cue table of a content set (once per content hash; cached by the caller). */
export function buildCueTable(content: ContentDB): CueTable {
  const ticksPerSecond = content.combat.tick.ticksPerSecond;
  // The reach of a melee basic attack, from data: the longest range among instant basics.
  let meleeReachM = 0;
  for (const def of content.abilities.list) if (def.kind === 'basic' && def.delivery.type === 'instant') meleeReachM = Math.max(meleeReachM, def.rangeM);

  const abilities = new Map<string, AbilityCue>();
  for (const def of content.abilities.list) abilities.set(def.id, abilityCue(def, content, meleeReachM, ticksPerSecond));
  const statuses = new Map<string, StatusCue>();
  for (const def of content.statuses.list) statuses.set(def.id, statusCue(def));

  return {
    ability(id) {
      const cue = abilities.get(id);
      if (!cue) throw new InvariantError(`CueTable: unknown ability "${id}"`);
      return cue;
    },
    status(id) {
      const cue = statuses.get(id);
      if (!cue) throw new InvariantError(`CueTable: unknown status "${id}"`);
      return cue;
    },
  };
}
