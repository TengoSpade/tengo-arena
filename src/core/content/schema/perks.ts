/**
 * perks.json (M1.1): 72 permanent perks offered in level-up skill slots. Owner: combat designer.
 * Spec: docs/design/_drafts/m1.1/combat-skills.md sys-perks. A perk is an extra passive block in the
 * abilities.json passive vocabulary (plus the M1.1 extensions), combat-owned trait effects, and
 * lifecycle effects that never reach the sim.
 */
import { z } from 'zod';
import { PassiveSchema } from './abilities';
import { PERK_ARCHETYPES, id, int, note, perkTag, statId } from './common';
import { TraitEffectSchema } from './traits';

export const PerkLifecycleEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('freshnessDrainMult'), mult: z.number().positive() }).strict(),
  z.object({ type: z.literal('freshnessBetweenRounds'), add: z.number() }).strict(),
  z.object({ type: z.literal('captaincy'), add: z.number() }).strict(),
]);
export type PerkLifecycleEffect = z.infer<typeof PerkLifecycleEffectSchema>;

export const PerkSchema = z
  .object({
    id: id(),
    name: z.string().min(1),
    archetype: z.enum(PERK_ARCHETYPES),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    iconId: z.string().min(1),
    tags: z.array(perkTag).min(1),
    text: z.string().min(1),
    requires: z
      .object({
        minPerksHeld: int().min(0).max(3),
        /** Tier III: at least one of these held (lower tier, same archetype or general). */
        anyPerks: z.array(id()),
        /** Effective stats at offer time. */
        minStats: z.partialRecord(statId, z.number()),
      })
      .strict(),
    autoPickValue: z.number().positive(),
    /** Symmetric; never offered while the partner is held. */
    exclusiveWith: z.array(id()),
    passive: PassiveSchema.nullable(),
    traitEffects: z.array(TraitEffectSchema),
    lifecycleEffects: z.array(PerkLifecycleEffectSchema),
  })
  .strict();

const tagWeights = z.partialRecord(perkTag, z.number());

export const PerksFileSchema = z
  .object({
    _doc: note(),
    schemaVersion: int(),
    status: z.string(),
    rules: z
      .object({
        perkCap: int().positive(),
        maxTier3: int().nonnegative(),
        tiers: z.record(z.enum(['1', '2', '3']), z.object({ minPerksHeld: int().nonnegative(), requiresAnyListed: z.boolean().optional() }).strict()),
        offerDraw: z
          .object({
            _doc: note(),
            kindWeights: z.object({ rank: z.number().nonnegative(), perk: z.number().nonnegative() }).strict(),
            perkTierWeights: z.record(z.enum(['1', '2', '3']), z.number().nonnegative()),
          })
          .strict(),
        pool: z.string(),
        exclusive: z.string(),
        owned: z.string(),
        minStats: z.string(),
      })
      .strict(),
    /** The sim extensions perks rely on (documentation; the closed lists are in core/content/schema/common.ts). */
    extensions: z.record(z.string(), z.unknown()),
    tags: z.array(perkTag),
    aiPreferences: z
      .object({
        _doc: note(),
        tagWeights: z.record(z.string(), tagWeights),
        styleMult: z.record(z.string(), tagWeights),
        context: z.record(z.string(), z.unknown()),
        autoPickValue: z.record(z.string(), z.unknown()),
        tieBreak: z.unknown(),
      })
      .strict(),
    perks: z.array(PerkSchema).min(1),
  })
  .strict();
