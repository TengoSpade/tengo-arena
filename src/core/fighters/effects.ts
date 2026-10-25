/**
 * Management-applied effects of traits, racial features and lifecycle
 * statuses (traits.json effectTypes with owner "management"; 03 boundary
 * contract 3). Sim-applied types (combat, enemyComposureAura, shakenImmune,
 * captainRally) are ignored here: the sim applies them from the trait ids.
 */
import type { ContentDB, TraitDef, TraitEffect } from '../content';
import type { Fighter, StatId, TraitId } from '../model';
import { bp } from './fixed';

export interface EffectSource {
  /** trait id, racial feature id or status id */
  id: string;
  kind: 'trait' | 'race' | 'status';
  effects: readonly TraitEffect[];
  /** Trait category (traits only). */
  category?: string;
  /** Scar trait (traits only). */
  scar?: boolean;
}

/** Every management effect source of a fighter: traits (held), racial feature, fighter statuses. */
export function effectSources(fighter: Fighter, content: ContentDB): EffectSource[] {
  const out: EffectSource[] = [];
  for (const t of fighter.traits) {
    const def = content.traits.get(t.id);
    if (def) out.push({ id: def.id, kind: 'trait', effects: def.effects, category: def.category, scar: def.scar === true });
  }
  const race = content.races.get(fighter.raceId);
  if (race) out.push({ id: race.racialFeature.id, kind: 'race', effects: race.racialFeature.effects });
  for (const s of fighter.statuses) {
    const def = content.development.statuses.find((d) => d.id === s.id);
    if (def) out.push({ id: def.id, kind: 'status', effects: def.effects });
  }
  return out;
}

export function hasTrait(fighter: Fighter, traitId: string): boolean {
  return fighter.traits.some((t) => t.id === traitId);
}

export function hasStatus(fighter: Fighter, statusId: string): boolean {
  return fighter.statuses.some((s) => s.id === statusId);
}

/** Product of `mult` of every effect of `type` (as basis-point factors, so callers keep integer chains). */
export function multFactorsBp(sources: readonly EffectSource[], type: TraitEffect['type'], filter?: (e: TraitEffect) => boolean): number[] {
  const out: number[] = [];
  for (const s of sources) {
    for (const e of s.effects) {
      if (e.type !== type) continue;
      if (filter && !filter(e)) continue;
      if ('mult' in e && typeof e.mult === 'number') out.push(bp(e.mult));
    }
  }
  return out;
}

/** Sum of integer `add` of every effect of `type` (captaincy, chemistry). */
export function sumAdds(sources: readonly EffectSource[], type: 'captaincy' | 'chemistry'): number {
  let total = 0;
  for (const s of sources) for (const e of s.effects) if (e.type === type) total += e.add;
  return total;
}

export function hasEffect(sources: readonly EffectSource[], type: TraitEffect['type']): boolean {
  return sources.some((s) => s.effects.some((e) => e.type === type));
}

export interface StatAddOptions {
  /** Potential: only permanent modifiers (physique and scar traits). */
  permanentOnly?: boolean;
  /** Tournament match: contextStat effects apply. */
  tournament?: boolean;
}

/**
 * Whole-point stat modifiers: trait `stat` adds (each trait's add per stat
 * clamped to ±traitStatAddCapPerTrait, D-F), status stat mods and, in a
 * tournament, `contextStat`. Chemistry is added by the caller.
 */
export function statAdds(fighter: Fighter, content: ContentDB, options: StatAddOptions = {}): Record<string, number> {
  const cap = content.development.scale.traitStatAddCapPerTrait;
  const out: Record<string, number> = {};
  for (const s of effectSources(fighter, content)) {
    if (options.permanentOnly && !(s.kind === 'trait' && (s.category === 'physique' || s.scar))) continue;
    const perStat: Record<string, number> = {};
    for (const e of s.effects) {
      if (e.type === 'stat') perStat[e.stat] = (perStat[e.stat] ?? 0) + e.add;
      else if (e.type === 'contextStat' && options.tournament && e.context === 'tournament') perStat[e.stat] = (perStat[e.stat] ?? 0) + e.add;
    }
    for (const [stat, add] of Object.entries(perStat)) {
      const v = s.kind === 'trait' ? (add > cap ? cap : add < -cap ? -cap : add) : add;
      out[stat] = (out[stat] ?? 0) + v;
    }
  }
  return out;
}

export function traitDef(content: ContentDB, id: TraitId | string): TraitDef | undefined {
  return content.traits.get(id);
}

export function statIdsOf(content: ContentDB): StatId[] {
  return content.stats.list.map((s) => s.id as StatId);
}
