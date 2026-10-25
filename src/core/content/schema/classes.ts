/**
 * classes.json: the 42 classes (O8). Owner: combat designer.
 * Spec: docs/design/_drafts/03-combat.md sys-abilities (content), sys-combat-stats.
 */
import { z } from 'zod';
import { DAMAGE_PROFILES, abilitySlot, affinityGroup, archetypeId, band, hybridPairId, id, note, startingRow, statId } from './common';

/** Weights per stat; every stat must be present. */
const fullStatWeights = z.record(statId, z.number());
/** Weights for a subset of stats. */
const partialStatWeights = z.partialRecord(statId, z.number());

export const ClassSchema = z
  .object({
    id: id(),
    name: z.string().min(1),
    flavor: z.string(),
    description: z.string(),
    iconId: z.string(),
    /** One archetype for base classes, two for hybrids. */
    archetypes: z.array(archetypeId).min(1).max(2),
    /** Set exactly for hybrids. */
    hybridPair: hybridPairId.nullable(),
    /** Descriptive tags for UI and lint (e.g. "interceptor"); free vocabulary. */
    roleTags: z.array(z.string()),
    affinityGroup,
    complexity: z.number().int().min(1).max(3),
    preferredBand: band,
    startingRow,
    damageProfile: z.enum(DAMAGE_PROFILES),
    base: z
      .object({
        hp: z.number().int().positive(),
        armor: z.number(),
        ward: z.number(),
        power: z.number(),
        support: z.number(),
        attackIntervalS: z.number().positive(),
        moveSpeedMps: z.number().positive(),
        critBonus: z.number(),
        evadeBonus: z.number(),
        tenacityBonus: z.number(),
      })
      .strict(),
    powerAttrs: partialStatWeights,
    supportAttrs: partialStatWeights.nullable(),
    /** Rating = round(5 × Σ ratingWeights × stat) (03-combat schema note 12). */
    ratingWeights: fullStatWeights,
    /** Generation cap offsets (03-fighter-lifecycle C-8). */
    statEmphasis: fullStatWeights,
    /** Ability ids per kit slot. */
    abilities: z.record(abilitySlot, id()),
    presetIds: z.array(id()).min(1),
    defaultPresetId: id(),
  })
  .strict();

export const ClassesFileSchema = z
  .object({
    _doc: note(),
    schemaVersion: z.number().int(),
    status: z.string(),
    classes: z.array(ClassSchema).min(1),
  })
  .strict();
