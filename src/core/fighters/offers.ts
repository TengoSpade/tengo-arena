/**
 * Level-up offers and the auto-pick (progression.md sys-development "level-up
 * offers", "auto-pick"; levels.json offers, traitOfferPool, autoPick;
 * combat-skills.md sys-perks eligibility and offer draw, §5 AI preferences).
 *
 * Generation (once per level reached, stored in pendingLevelUps; P-05):
 *  1. slots: optionsPerLevelUp; one skill slot when level % everyNthLevel = 0, two when
 *     level % twoSkillsEveryNthLevel = 0 (one rank step and one perk when both are eligible);
 *  2. stat options without replacement among stats with room, weight
 *     max(weightFloor, classRatingWeight) (Stamina: staminaWeightFloor) × emphasis
 *     (Body: physical × (1 + a), mental ÷ (1 + a); Mind the reverse; a = emphasis strength);
 *     gain = min(statGainCentipoints, room);
 *  3. skills: combat's draw (kind 1 : 1 while both eligible; ranks uniform; perks by tier weight);
 *  4. fallbacks: no eligible skill -> a stat; no stat with room -> a skill; nothing -> empty;
 *  5. trait offer: chance 12.5% while rolled + learned traits < 4; option 1 positive, option 2
 *     positive 75% else a burden; rollWeight × raceWeight × fit (×2 for the class archetype or,
 *     for 'captain', the club captain and vice).
 * Streams: development (options) and traits (trait offer), keyed by season, week, fighter, level.
 */
import type { ContentDB, PerkDef, TraitDef, TraitOfferEntry } from '../content';
import type {
  AbilityId,
  Fighter,
  GameState,
  LevelOption,
  LevelUpMode,
  PendingLevelUp,
  PerkId,
  RankableSlot,
  StatId,
  TraitId,
} from '../model';
import { Rng, STREAM } from '../rng';
import { effectSources, multFactorsBp } from './effects';
import { multOf, stepLookup } from './fixed';
import { STAMINA_STAT } from './freshness';
import { effectiveStatsOf, fighterHumanAge100 } from './stats';
import { tables } from './tables';

export const RANKABLE_SLOTS: readonly RankableSlot[] = ['a1', 'a2', 'passive'];

/** Context the pure reads cannot see on the fighter alone. */
export interface OfferContext {
  /** Club captain or vice-captain (trait fit 'captain'; the perk captain tag). */
  captainOrVice: boolean;
  /** training.enabled && GameOptions.trainingEmphasis. */
  trainingEnabled: boolean;
  /** The fighter's preset (style and slot use); default: the class default preset. */
  presetId?: string;
}

export function offerContextOf(state: GameState, fighter: Fighter, content: ContentDB): OfferContext {
  const club = fighter.clubId === null ? undefined : state.clubs[fighter.clubId];
  const assignment = club?.lineup.tactics[fighter.id];
  const ctx: OfferContext = {
    captainOrVice: club !== undefined && (club.captainId === fighter.id || club.viceCaptainId === fighter.id),
    trainingEnabled: content.development.training.enabled && state.options.trainingEmphasis,
  };
  if (assignment && assignment.kind === 'preset') ctx.presetId = assignment.presetId;
  return ctx;
}

// ---- emphasis -------------------------------------------------------------------------------------

/** Training-emphasis strength a (racial Adaptable 1.5, Regimented 1.5, Set in Their Ways 0), clamped 0-2. */
export function emphasisStrength(fighter: Fighter, content: ContentDB): number {
  const a = multOf(multFactorsBp(effectSources(fighter, content), 'trainingEmphasis'));
  return a < 0 ? 0 : a > 2 ? 2 : a;
}

function emphasisOf(fighter: Fighter, trainingEnabled: boolean): 'balanced' | 'body' | 'mind' {
  return trainingEnabled ? fighter.trainingEmphasis : 'balanced';
}

/** Offer weight of a stat: max(floor, rating weight) × emphasis weight. */
export function statOfferWeight(fighter: Fighter, stat: StatId, content: ContentDB, trainingEnabled: boolean): number {
  const o = content.levels.offers;
  const t = tables(content);
  const w = (t.ratingWeightsBp.get(fighter.classId)?.[stat] ?? 0) / 10_000;
  const floor = stat === STAMINA_STAT ? o.staminaWeightFloor : o.weightFloor;
  let weight = w > floor ? w : floor;
  const emphasis = emphasisOf(fighter, trainingEnabled);
  if (emphasis !== 'balanced') {
    const k = 1 + o.emphasisWeight.perStrength * emphasisStrength(fighter, content);
    const physical = t.groupOf[stat] === 'physical';
    const favoured = (emphasis === 'body') === physical;
    weight = favoured ? weight * k : k > 0 ? weight / k : weight;
  }
  return weight;
}

// ---- eligibility ----------------------------------------------------------------------------------

function roomOf(fighter: Fighter, stat: StatId): number {
  return (fighter.cap100[stat] ?? 0) - (fighter.train100[stat] ?? 0);
}

export interface RankStep {
  slot: RankableSlot;
  abilityId: AbilityId;
  toRank: 2 | 3;
}

/** Rank steps available now: rankable class abilities below rank 3 with a row for the next rank. */
export function eligibleRanks(fighter: Fighter, content: ContentDB): RankStep[] {
  const klass = content.classes.require(fighter.classId);
  const out: RankStep[] = [];
  for (const slot of RANKABLE_SLOTS) {
    const abilityId = klass.abilities[slot];
    const row = content.abilityRanks(abilityId);
    if (!row || !row.rankable) continue;
    const cur = fighter.abilityRanks?.[slot] ?? 1;
    if (cur >= 3) continue;
    const toRank = (cur + 1) as 2 | 3;
    if (!row.ranks.some((r) => r.rank === toRank)) continue;
    out.push({ slot, abilityId: abilityId as AbilityId, toRank });
  }
  return out;
}

/** combat-skills.md sys-perks eligibility rules 1-6 (stats: effective stats at offer time). */
export function perkEligible(fighter: Fighter, perk: PerkDef, content: ContentDB, stats?: Readonly<Record<string, number>>): boolean {
  const rules = content.perkRules;
  const held = fighter.perkIds ?? [];
  if (held.includes(perk.id as PerkId)) return false;
  if (held.length >= rules.perkCap) return false;
  const klass = content.classes.require(fighter.classId);
  if (perk.archetype !== 'general' && !(klass.archetypes as readonly string[]).includes(perk.archetype)) return false;
  const tierRule = rules.tiers[String(perk.tier) as '1' | '2' | '3'];
  if (tierRule && held.length < tierRule.minPerksHeld) return false;
  if (held.length < perk.requires.minPerksHeld) return false;
  const heldDefs = held.map((id) => content.perks.get(id)).filter((p): p is PerkDef => p !== undefined);
  if (perk.tier === 3) {
    if (heldDefs.filter((p) => p.tier === 3).length >= rules.maxTier3) return false;
    if ((tierRule?.requiresAnyListed ?? false) && !perk.requires.anyPerks.some((id) => held.includes(id as PerkId))) return false;
  }
  for (const p of heldDefs) if (p.exclusiveWith.includes(perk.id) || perk.exclusiveWith.includes(p.id)) return false;
  const s = stats ?? (effectiveStatsOf(fighter, content) as Record<string, number>);
  for (const [stat, min] of Object.entries(perk.requires.minStats)) if ((s[stat] ?? 0) < (min ?? 0)) return false;
  return true;
}

export function eligiblePerks(fighter: Fighter, content: ContentDB): PerkDef[] {
  const stats = effectiveStatsOf(fighter, content) as Record<string, number>;
  return content.perks.list.filter((p) => perkEligible(fighter, p, content, stats));
}

/** Whether an option is still legal now (stat below cap, rank step next, perk eligible). */
export function optionLegal(fighter: Fighter, option: LevelOption, content: ContentDB): boolean {
  switch (option.kind) {
    case 'stat':
      return roomOf(fighter, option.stat) > 0;
    case 'rank': {
      const cur = fighter.abilityRanks?.[option.slot] ?? 1;
      if (cur !== option.toRank - 1) return false;
      const row = content.abilityRanks(option.abilityId);
      return row !== null && row.rankable && row.ranks.some((r) => r.rank === option.toRank);
    }
    case 'perk': {
      const p = content.perks.get(option.perkId);
      return p !== undefined && perkEligible(fighter, p, content);
    }
  }
}

// ---- trait offers ---------------------------------------------------------------------------------

function traitConflicts(a: TraitDef, b: TraitDef): boolean {
  if (a.id === b.id) return true;
  if (a.opposites.includes(b.id) || b.opposites.includes(a.id)) return true;
  if (a.excludes.includes(b.id) || b.excludes.includes(a.id)) return true;
  return a.exclusiveGroup !== undefined && a.exclusiveGroup === b.exclusiveGroup;
}

/** Whether the fighter may learn a trait-offer entry now (pool requires, roll eligibility, category cap). */
export function traitEntryEligible(fighter: Fighter, entry: TraitOfferEntry, content: ContentDB): boolean {
  const def = content.traits.get(entry.id);
  if (!def) return false;
  if (fighter.traits.some((t) => t.id === def.id)) return false;
  const ha100 = fighterHumanAge100(fighter, content);
  const req = entry.requires;
  if (req?.humanAgeAtMost !== undefined && ha100 > req.humanAgeAtMost * 100) return false;
  if (req?.humanAgeAtLeast !== undefined && ha100 < req.humanAgeAtLeast * 100) return false;
  if (req?.ldrAtLeast !== undefined && ((effectiveStatsOf(fighter, content) as Record<string, number>)['ldr'] ?? 0) < req.ldrAtLeast) return false;
  const held = fighter.traits.map((t) => content.traits.get(t.id)).filter((d): d is TraitDef => d !== undefined);
  for (const h of held) if (traitConflicts(def, h)) return false;
  const cap = content.files.traits.rollRules.maxPerCategory[def.category];
  if (cap !== undefined && held.filter((h) => h.category === def.category).length >= cap) return false;
  return true;
}

function traitFit(fighter: Fighter, entry: TraitOfferEntry, content: ContentDB, ctx: OfferContext): number {
  const fit = content.levels.offers.traitOffer.fitMult;
  const archetypes = content.classes.require(fighter.classId).archetypes as readonly string[];
  const fits = entry.fit.some((f) => (f === 'captain' ? ctx.captainOrVice : archetypes.includes(f)));
  return fits ? fit.fits : fit.neutral;
}

export function traitOfferWeight(fighter: Fighter, entry: TraitOfferEntry, content: ContentDB, ctx: OfferContext): number {
  const def = content.traits.require(entry.id);
  return def.rollWeight * (def.raceWeight[fighter.raceId] ?? 1) * traitFit(fighter, entry, content, ctx);
}

function rolledAndLearned(fighter: Fighter): number {
  return fighter.traits.filter((t) => t.source === 'rolled' || t.source === 'worldgen' || t.source === 'level').length;
}

function drawTrait(rng: Rng, fighter: Fighter, pool: readonly TraitOfferEntry[], content: ContentDB, ctx: OfferContext, exclude: string | null): TraitId | null {
  const eligible = pool.filter((e) => e.id !== exclude && traitEntryEligible(fighter, e, content));
  if (eligible.length === 0) return null;
  const weights = eligible.map((e) => traitOfferWeight(fighter, e, content, ctx));
  if (!weights.some((w) => w > 0)) return null;
  return eligible[rng.weightedIndex(weights)]!.id as TraitId;
}

function traitOfferFor(state: GameState, fighter: Fighter, level: number, weekIndex: number, content: ContentDB, ctx: OfferContext): TraitId[] | null {
  const to = content.levels.offers.traitOffer;
  const rng = Rng.create(state.rng.root, STREAM.traits, 'offer', state.calendar.season, weekIndex, fighter.id, level);
  const roll = rng.chanceBp(Math.round(to.chance * 10_000));
  if (!roll) return null;
  if (rolledAndLearned(fighter) >= to.maxRolledAndLearned) return null;
  if (fighter.traits.length >= content.files.traits.rollRules.maxTotalTraits) return null;
  const pool = content.levels.traitOfferPool;
  const first = drawTrait(rng, fighter, pool.positive, content, ctx, null);
  if (!first) return null;
  const secondPositive = rng.chanceBp(Math.round(to.secondOptionPositive * 10_000));
  let second = drawTrait(rng, fighter, secondPositive ? pool.positive : pool.burdens, content, ctx, first);
  if (!second) second = drawTrait(rng, fighter, secondPositive ? pool.burdens : pool.positive, content, ctx, first);
  return second ? [first, second] : [first];
}

// ---- offer generation -----------------------------------------------------------------------------

function drawSkill(rng: Rng, ranks: RankStep[], perks: PerkDef[], content: ContentDB, kind?: 'rank' | 'perk'): LevelOption | null {
  const draw = content.perkRules.offerDraw;
  let k = kind;
  if (!k) {
    if (ranks.length > 0 && perks.length > 0) k = rng.weightedIndex([draw.kindWeights.rank, draw.kindWeights.perk]) === 0 ? 'rank' : 'perk';
    else if (ranks.length > 0) k = 'rank';
    else if (perks.length > 0) k = 'perk';
    else return null;
  }
  if (k === 'rank') {
    if (ranks.length === 0) return null;
    const i = rng.int(0, ranks.length - 1);
    const r = ranks.splice(i, 1)[0]!;
    return { kind: 'rank', slot: r.slot, abilityId: r.abilityId, toRank: r.toRank };
  }
  if (perks.length === 0) return null;
  const i = rng.weightedIndex(perks.map((p) => draw.perkTierWeights[String(p.tier) as '1' | '2' | '3'] ?? 1));
  const p = perks.splice(i, 1)[0]!;
  return { kind: 'perk', perkId: p.id as PerkId };
}

/** Generate the stored offer of a level just reached (deterministic: keyed by season, week, fighter, level). */
export function generateOffer(state: GameState, fighter: Fighter, level: number, content: ContentDB, weekIndex = state.calendar.weekIndex): PendingLevelUp {
  const o = content.levels.offers;
  const ctx = offerContextOf(state, fighter, content);
  const rng = Rng.create(state.rng.root, STREAM.development, 'offer', state.calendar.season, weekIndex, fighter.id, level);
  const n = o.optionsPerLevelUp;
  const wantSkills = Math.min(n, level % o.skillSlots.twoSkillsEveryNthLevel === 0 ? 2 : level % o.skillSlots.everyNthLevel === 0 ? 1 : 0);
  const ranks = eligibleRanks(fighter, content);
  const perks = eligiblePerks(fighter, content);
  const skills: LevelOption[] = [];
  if (wantSkills === 2 && ranks.length > 0 && perks.length > 0) {
    skills.push(drawSkill(rng, ranks, perks, content, 'rank')!, drawSkill(rng, ranks, perks, content, 'perk')!);
  } else {
    for (let i = 0; i < wantSkills; i++) {
      const s = drawSkill(rng, ranks, perks, content);
      if (s) skills.push(s);
    }
  }
  // Stat options: weighted, without replacement, among stats with room.
  const t = tables(content);
  const candidates = t.statIds.filter((id) => roomOf(fighter, id) > 0);
  const stats: LevelOption[] = [];
  const statSlots = n - skills.length;
  for (let i = 0; i < statSlots && candidates.length > 0; i++) {
    const idx = rng.weightedIndex(candidates.map((id) => statOfferWeight(fighter, id, content, ctx.trainingEnabled)));
    const stat = candidates.splice(idx, 1)[0]!;
    stats.push({ kind: 'stat', stat, gain100: Math.min(o.statGainCentipoints, roomOf(fighter, stat)) });
  }
  // Fallback: no stat with room -> the slot becomes a skill.
  while (stats.length + skills.length < n) {
    const s = drawSkill(rng, ranks, perks, content);
    if (!s) break;
    skills.push(s);
  }
  return {
    level,
    season: state.calendar.season,
    weekIndex,
    options: [...stats, ...skills],
    traitOffer: traitOfferFor(state, fighter, level, weekIndex, content, ctx),
  };
}

// ---- auto-pick ------------------------------------------------------------------------------------

function skillPreference(mode: Exclude<LevelUpMode, 'manual'>, content: ContentDB): number {
  return content.levels.autoPick.playerModes.find((m) => m.id === mode)?.skillPreference ?? 1;
}

/** Stat score: 5 × ratingWeight × (gain ÷ 100) × emphasisPreference, plus the Stamina bonus by current Stamina (lvl-011). */
export function statScore(fighter: Fighter, stat: StatId, gain100: number, content: ContentDB, ctx: OfferContext): number {
  const ap = content.levels.autoPick;
  const t = tables(content);
  const w = (t.ratingWeightsBp.get(fighter.classId)?.[stat] ?? 0) / 10_000;
  const emphasis = emphasisOf(fighter, ctx.trainingEnabled);
  const physical = t.groupOf[stat] === 'physical';
  const pref = emphasis === 'balanced' ? ap.emphasisPreference.balanced : (emphasis === 'body') === physical ? ap.emphasisPreference.emphasised : ap.emphasisPreference.other;
  let score = 5 * w * (gain100 / 100) * pref;
  if (stat === STAMINA_STAT) score += stepLookup(ap.staminaBonusByStamina, (effectiveStatsOf(fighter, content) as Record<string, number>)[STAMINA_STAT] ?? 10);
  return score;
}

function presetOf(fighter: Fighter, content: ContentDB, ctx: OfferContext) {
  const id = ctx.presetId ?? content.classes.require(fighter.classId).defaultPresetId;
  return content.presets.get(id) ?? content.presets.get(content.classes.require(fighter.classId).defaultPresetId);
}

function clampSkill(v: number, content: ContentDB): number {
  const [lo, hi] = (content.perkAiPreferences.autoPickValue as { clamp?: [number, number] }).clamp ?? [0.5, 3];
  return v < lo ? lo : v > hi ? hi : v;
}

/** Perk score (combat-skills.md §5): autoPickValue × tag factor × style × context, clamped 0.5-3.0. */
export function perkScore(fighter: Fighter, perkId: string, content: ContentDB, ctx: OfferContext): number {
  const perk = content.perks.get(perkId);
  if (!perk) return content.levels.autoPick.skillDefaultValue;
  const ai = content.perkAiPreferences;
  const archetypes = content.classes.require(fighter.classId).archetypes as readonly string[];
  const tagWeight = (tag: string): number => {
    const vals = archetypes.map((a) => ai.tagWeights[a]?.[tag as keyof (typeof ai.tagWeights)[string]] ?? 1);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 1;
  };
  const tags = perk.tags as readonly string[];
  const tagFactor = tags.length ? tags.reduce((s, tag) => s + tagWeight(tag), 0) / tags.length : 1;
  const style = presetOf(fighter, content, ctx)?.style ?? 'balanced';
  const styleRow = ai.styleMult[style] ?? {};
  const styleFactor = tags.length ? tags.reduce((s, tag) => s + ((styleRow as Record<string, number>)[tag] ?? 1), 0) / tags.length : 1;
  const c = ai.context as {
    captainTag?: { ifCaptainOrVice: number; otherwise: number };
    staminaTag?: { ifStaminaAtMost8: number; ifStaminaAtLeast14: number };
    tier3Mult?: number;
  };
  let context = 1;
  if (tags.includes('captain') && c.captainTag) context *= ctx.captainOrVice ? c.captainTag.ifCaptainOrVice : c.captainTag.otherwise;
  if (tags.includes('stamina') && c.staminaTag) {
    const sta = (effectiveStatsOf(fighter, content) as Record<string, number>)[STAMINA_STAT] ?? 10;
    if (sta <= 8) context *= c.staminaTag.ifStaminaAtMost8;
    else if (sta >= 14) context *= c.staminaTag.ifStaminaAtLeast14;
  }
  if (perk.tier === 3 && c.tier3Mult) context *= c.tier3Mult;
  return clampSkill(perk.autoPickValue * tagFactor * styleFactor * context, content);
}

/** Rank score (combat-skills.md §5): base × 1.25 for the archetype's families × 0.9 passive × 1.2 if the preset uses the slot. */
export function rankScore(fighter: Fighter, slot: RankableSlot, abilityId: string, content: ContentDB, ctx: OfferContext): number {
  const rs = (content.perkAiPreferences.context as { rankScore?: { base: number; familyBonus: Record<string, string[]>; familyBonusMult: number; passiveMult: number; presetUseMult: number } }).rankScore;
  if (!rs) return content.levels.autoPick.skillDefaultValue;
  const row = content.abilityRanks(abilityId);
  const archetypes = content.classes.require(fighter.classId).archetypes as readonly string[];
  let v = rs.base;
  if (row && archetypes.some((a) => (rs.familyBonus[a] ?? []).includes(row.family))) v *= rs.familyBonusMult;
  if (slot === 'passive') v *= rs.passiveMult;
  const preset = presetOf(fighter, content, ctx);
  const uses = preset?.rules.some((r) => (r.then as { type?: string; slot?: string }).type === 'ability' && (r.then as { slot?: string }).slot === slot) ?? false;
  if (uses) v *= rs.presetUseMult;
  return clampSkill(v, content);
}

export function optionScore(fighter: Fighter, option: LevelOption, mode: Exclude<LevelUpMode, 'manual'>, content: ContentDB, ctx: OfferContext): number {
  switch (option.kind) {
    case 'stat':
      return statScore(fighter, option.stat, option.gain100, content, ctx);
    case 'rank':
      return rankScore(fighter, option.slot, option.abilityId, content, ctx) * skillPreference(mode, content);
    case 'perk':
      return perkScore(fighter, option.perkId, content, ctx) * skillPreference(mode, content);
  }
}

export interface AutoPick {
  optionIndex: number | null;
  traitIndex: number | null;
}

/** The policy's pick (highest score; ties stat before skill, then lower index; illegal options skipped; never a burden trait). */
export function autoPick(fighter: Fighter, offer: PendingLevelUp, mode: Exclude<LevelUpMode, 'manual'>, content: ContentDB, ctx: OfferContext): AutoPick {
  let best: { i: number; score: number; stat: boolean } | null = null;
  offer.options.forEach((opt, i) => {
    if (!optionLegal(fighter, opt, content)) return;
    const score = optionScore(fighter, opt, mode, content, ctx);
    const stat = opt.kind === 'stat';
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && stat && !best.stat)) best = { i, score, stat };
  });
  let traitIndex: number | null = null;
  if (offer.traitOffer) {
    let bestW = -1;
    offer.traitOffer.forEach((id, i) => {
      const def = content.traits.get(id);
      if (!def || def.polarity !== 'positive' || (def.kind !== 'boon' && def.kind !== 'edge')) return;
      const entry = content.levels.traitOfferPool.positive.find((e) => e.id === id);
      if (!entry || !traitEntryEligible(fighter, entry, content)) return;
      const w = traitOfferWeight(fighter, entry, content, ctx);
      if (w > bestW + 1e-9) {
        bestW = w;
        traitIndex = i;
      }
    });
  }
  const picked = best as { i: number } | null;
  return { optionIndex: picked ? picked.i : null, traitIndex };
}
