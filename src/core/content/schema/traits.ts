/**
 * traits.json: Crusader-Kings-style traits (O5). Owner: fighter-lifecycle designer.
 * Spec: docs/design/_drafts/03-fighter-lifecycle.md sys-traits; combat-owned
 * effects follow combat.json traitEffectAdapter.
 */
import { z } from 'zod';
import {
  ECONOMY_HOOKS,
  TRAIT_CATEGORIES,
  TRAIT_COMBAT_WHEN,
  TRAIT_EFFECT_TYPES,
  TRAIT_KINDS,
  TRAIT_RARITIES,
  band,
  id,
  int,
  note,
  statId,
} from './common';

const group = z.enum(['physical', 'mental', 'all']);

/**
 * Effects of traits and of lifecycle statuses (development.json statuses),
 * also used by racial features. Owner of each effect (management vs sim) is
 * listed in traits.json effectTypes and 03-fighter-lifecycle merge notes.
 */
export const TraitEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stat'), stat: statId, add: int() }).strict(),
  z.object({ type: z.literal('contextStat'), context: z.enum(['tournament']), stat: statId, add: int() }).strict(),
  z
    .object({
      type: z.literal('devClock'),
      group,
      mult: z.number().positive(),
      humanAgeMin: z.number().optional(),
      humanAgeMax: z.number().optional(),
    })
    .strict(),
  z.object({ type: z.literal('declineMult'), group, mult: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('declineShift'), group, humanYears: z.number() }).strict(),
  z.object({ type: z.literal('xp'), mult: z.number().positive() }).strict(),
  z.object({ type: z.literal('trainingEmphasis'), mult: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('injuryChance'), mult: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('recovery'), mult: z.number().positive() }).strict(),
  z.object({ type: z.literal('scarChance'), mult: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('retirement'), mult: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('captaincy'), add: int() }).strict(),
  z.object({ type: z.literal('mentor'), youngDevMult: z.number().positive() }).strict(),
  z.object({ type: z.literal('chemistry'), add: int() }).strict(),
  z.object({ type: z.literal('chemistrySameRace'), perTeammate: int(), max: int(), ifNone: int() }).strict(),
  z.object({ type: z.literal('chemistryClash'), withTrait: id(), add: int() }).strict(),
  z.object({ type: z.literal('chemistryPair'), withTrait: id(), add: int(), minHolders: int() }).strict(),
  z.object({ type: z.literal('chemistryImmune') }).strict(),
  z.object({ type: z.literal('ruleSlots'), add: int() }).strict(),
  z
    .object({ type: z.literal('economy'), hook: z.enum(ECONOMY_HOOKS), add: z.number().optional(), mult: z.number().optional() })
    .strict(),
  z
    .object({
      type: z.literal('combat'),
      when: z.enum(TRAIT_COMBAT_WHEN),
      /** Threshold for selfHpBelow / targetHpBelow (fraction of max HP). */
      value: z.number().optional(),
      /** Window for openingSeconds / afterSeconds / allyDown. */
      seconds: z.number().optional(),
      mods: z
        .object({
          damageDealtMult: z.number().optional(),
          damageTakenMult: z.number().optional(),
          reactionDelayMult: z.number().optional(),
          composureAdd: z.number().optional(),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('enemyComposureAura'), rangeBand: band, add: z.number() }).strict(),
  z.object({ type: z.literal('shakenImmune'), mult: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('captainRally'), mult: z.number().positive() }).strict(),
]);

export const TraitSchema = z
  .object({
    id: id(),
    name: z.string().min(1),
    category: z.enum(TRAIT_CATEGORIES),
    polarity: z.enum(['positive', 'negative']),
    kind: z.enum(TRAIT_KINDS),
    tradeoff: z.boolean(),
    rarity: z.enum(TRAIT_RARITIES),
    /** 0 = never rolled (acquired or storied traits). */
    rollWeight: z.number().nonnegative(),
    opposites: z.array(id()),
    excludes: z.array(id()),
    /** Roll-weight multiplier per race id; missing races use 1. */
    raceWeight: z.record(z.string(), z.number().nonnegative()),
    flavor: z.string(),
    effectText: z.string(),
    icon: z.string(),
    effects: z.array(TraitEffectSchema).min(1),
    loss: z
      .object({
        rule: z.enum(['seasonEndChance', 'onGainTrait', 'threshold']),
        chance: z.number().min(0).max(1),
        humanAgeAtLeast: z.number().optional(),
        trait: id().optional(),
        requires: z.string().optional(),
        careerRoundsAtLeast: int().optional(),
        checkedAt: z.enum(['seasonEnd', 'weekProcessing', 'matchEnd']).optional(),
      })
      .strict()
      .optional(),
    exclusiveGroup: z.string().optional(),
    rookieOnly: z.boolean().optional(),
    gain: z
      .object({
        rule: z.enum(['threshold', 'event']),
        careerRoundsAtLeast: int().optional(),
        checkedAt: z.enum(['seasonEnd', 'weekProcessing', 'matchEnd']).optional(),
        matchweeksAsClubCaptainAtLeast: int().optional(),
        /** Designer description of the gain event; the engine keys behaviour on the trait id. */
        event: z.string().optional(),
        humanAgeAtLeast: z.number().optional(),
        proSeasonsAtLeast: int().optional(),
      })
      .strict()
      .optional(),
    /** Scar traits come from injuries (development.json injury.scar.pool). */
    scar: z.boolean().optional(),
  })
  .strict();

const categoryCounts = z.partialRecord(z.enum(TRAIT_CATEGORIES), int());

export const TraitsFileSchema = z
  .object({
    _doc: note(),
    version: z.number().int(),
    status: z.string(),
    rollRules: z
      .object({
        _doc: note(),
        /** Weight per number of rolled traits (keys are counts). */
        countWeights: z.record(z.string().regex(/^\d+$/), z.number().nonnegative()),
        negativeChancePerTrait: z.number().min(0).max(1),
        maxRolledNegatives: int(),
        targetPositiveShare: z.number().min(0).max(1),
        maxRolledTraits: int(),
        maxPerCategory: categoryCounts,
        maxTotalTraits: int(),
        rookieOnlyMaxHumanAge: z.number(),
        eligibility: z.array(z.string()),
        kinds: z.record(z.enum(TRAIT_KINDS), z.string()),
        rarityBands: z.object({ _doc: note() }).catchall(z.string()),
        revealOrder: z
          .object({ _doc: note(), byCategory: categoryCounts, negativeTraitsAlwaysTier: int() })
          .strict(),
        /** M1.1: traits offered on level-up (levels.json offers.traitOffer); held with source 'level'. */
        learned: z
          .object({ _doc: note(), source: z.literal('level'), maxRolledAndLearned: int().positive(), neverOffered: z.array(z.string()) })
          .strict(),
      })
      .strict(),
    categories: z.array(
      z.object({ id: z.enum(TRAIT_CATEGORIES), name: z.string(), rolled: z.boolean(), description: z.string() }).strict(),
    ),
    statAddCapPerTrait: int(),
    effectTypes: z.array(
      z
        .object({
          id: z.enum(TRAIT_EFFECT_TYPES),
          owner: z.string(),
          params: z.string(),
          description: z.string(),
        })
        .strict(),
    ),
    traits: z.array(TraitSchema).min(1),
  })
  .strict();
