/**
 * sys-traits: the Crusader-Kings-style roll (O5) and trait bookkeeping.
 *
 * Roll (traits.json rollRules): n by countWeights; exactly one negative with
 * probability negativeChancePerTrait × n, otherwise none; the negative is
 * picked first, then the positives, each weighted by rollWeight × raceWeight
 * among eligible traits (not held, no opposite/exclusion either way, not the
 * same exclusiveGroup, category cap, rookie-only by human-age, rollWeight > 0).
 * An empty pool leaves the slot empty; polarity never swaps.
 */
import type { ContentDB, TraitDef } from '../content';
import type { Fighter, FighterTrait, TraitId } from '../model';
import type { Rng } from '../rng';
import { bp } from './fixed';

function conflicts(a: TraitDef, b: TraitDef): boolean {
  if (a.id === b.id) return true;
  if (a.opposites.includes(b.id) || b.opposites.includes(a.id)) return true;
  if (a.excludes.includes(b.id) || b.excludes.includes(a.id)) return true;
  if (a.exclusiveGroup !== undefined && a.exclusiveGroup === b.exclusiveGroup) return true;
  return false;
}

export function eligibleForRoll(def: TraitDef, held: readonly TraitDef[], raceId: string, humanAge100: number, content: ContentDB): number {
  const rules = content.files.traits.rollRules;
  if (def.rollWeight <= 0) return 0;
  const category = content.files.traits.categories.find((c) => c.id === def.category);
  if (category && !category.rolled) return 0;
  if (def.rookieOnly && humanAge100 > rules.rookieOnlyMaxHumanAge * 100) return 0;
  for (const h of held) if (conflicts(def, h)) return 0;
  const capForCategory = rules.maxPerCategory[def.category];
  if (capForCategory !== undefined && held.filter((h) => h.category === def.category).length >= capForCategory) return 0;
  return bp(def.rollWeight) * bp(def.raceWeight[raceId] ?? 1);
}

/** Roll a fighter's traits at generation. Returns trait ids in roll order (negative first). */
export function rollTraits(rng: Rng, raceId: string, humanAge100: number, content: ContentDB): TraitId[] {
  const rules = content.files.traits.rollRules;
  const counts = Object.entries(rules.countWeights)
    .map(([k, w]) => [Number(k), bp(w)] as const)
    .sort((a, b) => a[0] - b[0]);
  const n = Math.min(rules.maxRolledTraits, counts[rng.weightedIndex(counts.map((c) => c[1]))]![0]);
  const negatives = rng.chanceBp(Math.min(10_000, bp(rules.negativeChancePerTrait) * n)) ? Math.min(1, rules.maxRolledNegatives) : 0;
  const held: TraitDef[] = [];
  const pickOne = (polarity: 'positive' | 'negative'): void => {
    const pool = content.traits.list.filter((t) => t.polarity === polarity);
    const weights = pool.map((t) => eligibleForRoll(t, held, raceId, humanAge100, content));
    if (!weights.some((w) => w > 0)) return;
    held.push(pool[rng.weightedIndex(weights)]!);
  };
  for (let i = 0; i < negatives; i++) pickOne('negative');
  for (let i = negatives; i < n; i++) pickOne('positive');
  return held.map((t) => t.id as TraitId);
}

/** Total trait cap (rollRules.maxTotalTraits). */
export function canAddTrait(fighter: Fighter, content: ContentDB): boolean {
  return fighter.traits.length < content.files.traits.rollRules.maxTotalTraits;
}

/**
 * Add an acquired trait (event, threshold or scar). Physique traits are never
 * added after generation (trait-006). Returns false if held, physique, or the
 * total cap would be exceeded (trait-007: the skip is the caller's to log).
 */
export function addAcquiredTrait(fighter: Fighter, traitId: string, source: FighterTrait['source'], season: number, content: ContentDB): boolean {
  const def = content.traits.get(traitId);
  if (!def || def.category === 'physique') return false;
  if (fighter.traits.some((t) => t.id === traitId)) return false;
  if (!canAddTrait(fighter, content)) return false;
  fighter.traits.push({ id: def.id as TraitId, gainedSeason: season, source });
  return true;
}

/** Remove a trait (never physique). Returns true if removed. */
export function removeTrait(fighter: Fighter, traitId: string, content: ContentDB): boolean {
  const def = content.traits.get(traitId);
  if (def && def.category === 'physique') return false;
  const i = fighter.traits.findIndex((t) => t.id === traitId);
  if (i < 0) return false;
  fighter.traits.splice(i, 1);
  return true;
}

export function scarCount(fighter: Fighter, content: ContentDB): number {
  let n = 0;
  for (const t of fighter.traits) if (content.traits.get(t.id)?.scar) n++;
  return n;
}

/** Rolled-trait polarity counts (for the O5 share): traits with source 'rolled' or 'worldgen' only. */
export function rolledPolarity(fighter: Fighter, content: ContentDB): { positive: number; negative: number } {
  let positive = 0;
  let negative = 0;
  for (const t of fighter.traits) {
    if (t.source !== 'rolled' && t.source !== 'worldgen') continue;
    const def = content.traits.get(t.id);
    if (!def) continue;
    if (def.polarity === 'positive') positive++;
    else negative++;
  }
  return { positive, negative };
}
