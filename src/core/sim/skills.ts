/**
 * M1.1 skill eligibility (combat-skills.md sys-perks "Eligibility rules",
 * sys-ability-ranks): which perks and rank steps a fighter may be offered.
 * Lifecycle's offer generator applies the same rules; the balance harness
 * and the acceptance tests use these.
 */
import type { ContentDB, PerkDef } from '../content';
import type { AbilityRanks, RankableSlot } from '../model';

const RANKABLE: readonly RankableSlot[] = ['a1', 'a2', 'passive'];

/** General perks plus the perks of each archetype the class lists (pure classes 24, hybrids 36). */
export function perkPool(content: ContentDB, classId: string): PerkDef[] {
  const k = content.classes.require(classId);
  const arch = new Set<string>(k.archetypes);
  return content.perks.list.filter((p) => p.archetype === 'general' || arch.has(p.archetype));
}

/** Whether `perk` may be offered to a fighter of `classId` holding `held` (with effective stats `stats`, if given). */
export function perkEligible(content: ContentDB, classId: string, perk: PerkDef, held: readonly string[], stats?: Readonly<Record<string, number>>): boolean {
  const rules = content.perkRules;
  if (held.includes(perk.id)) return false;
  if (held.length >= rules.perkCap) return false;
  const k = content.classes.require(classId);
  if (perk.archetype !== 'general' && !(k.archetypes as readonly string[]).includes(perk.archetype)) return false;
  if (held.length < perk.requires.minPerksHeld) return false;
  if (perk.requires.anyPerks.length > 0 && !perk.requires.anyPerks.some((id) => held.includes(id))) return false;
  if (perk.tier === 3) {
    const tier3 = held.filter((id) => content.perks.get(id)?.tier === 3).length;
    if (tier3 >= rules.maxTier3) return false;
  }
  if (perk.exclusiveWith.some((id) => held.includes(id))) return false;
  for (const p of content.perks.list) if (held.includes(p.id) && p.exclusiveWith.includes(perk.id)) return false;
  if (stats) {
    for (const [stat, min] of Object.entries(perk.requires.minStats)) if ((stats[stat] ?? 0) < (min ?? 0)) return false;
  }
  return true;
}

export function eligiblePerks(content: ContentDB, classId: string, held: readonly string[], stats?: Readonly<Record<string, number>>): PerkDef[] {
  return perkPool(content, classId).filter((p) => perkEligible(content, classId, p, held, stats));
}

/** The next rank step of each rankable slot (rank 3 needs rank 2). */
export function eligibleRankSteps(content: ContentDB, classId: string, ranks: AbilityRanks): { slot: RankableSlot; abilityId: string; toRank: 2 | 3 }[] {
  const k = content.classes.require(classId);
  const out: { slot: RankableSlot; abilityId: string; toRank: 2 | 3 }[] = [];
  for (const slot of RANKABLE) {
    const abilityId = k.abilities[slot];
    const row = content.abilityRanks(abilityId);
    if (!row || !row.rankable) continue;
    const r = ranks[slot];
    if (r < 3) out.push({ slot, abilityId, toRank: (r + 1) as 2 | 3 });
  }
  return out;
}
