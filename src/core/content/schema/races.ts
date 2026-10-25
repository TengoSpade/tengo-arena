/**
 * races.json: playable races and lifespan scaling (O11). Owner: fighter-lifecycle designer.
 * Spec: docs/design/_drafts/03-fighter-lifecycle.md sys-races.
 */
import { z } from 'zod';
import { AFFINITY_GROUPS, affinityGroup, id, int, note, statId } from './common';
import { TraitEffectSchema } from './traits';

export const RaceSchema = z
  .object({
    id: id(),
    name: z.string().min(1),
    plural: z.string(),
    flavor: z.string(),
    /** Years; human baseline 80. humanAge = age × 80 / lifespan. */
    lifespan: z.number().positive(),
    debutAge: z.object({ min: int(), max: int() }).strict(),
    intakeWeight: z.number().nonnegative(),
    growthMult: z.object({ physical: z.number().positive(), mental: z.number().positive() }).strict(),
    declineMult: z.object({ physical: z.number().nonnegative(), mental: z.number().nonnegative() }).strict(),
    /** Race stat tendency in stat points per stat (|value| <= stats.tendencyCapPerStat). */
    statTendencies: z.record(statId, z.number()),
    injury: z
      .object({
        chanceMult: z.number().nonnegative(),
        recoveryMult: z.number().positive(),
        scarMult: z.number().nonnegative(),
      })
      .strict(),
    /** Generation weight multiplier per class affinity group. */
    classAffinity: z.record(affinityGroup, z.number().nonnegative()),
    racialFeature: z
      .object({
        id: id(),
        name: z.string(),
        text: z.string(),
        effects: z.array(TraitEffectSchema),
        _note: note(),
      })
      .strict(),
    /** Key into names.json races. */
    namesKey: z.string(),
    /** EXAMPLE values for designers; never read by code. */
    derived: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const RacesFileSchema = z
  .object({
    _doc: note(),
    version: z.number().int(),
    status: z.string(),
    stats: z
      .object({
        _doc: note(),
        ids: z.array(statId),
        tendencyCapPerStat: z.number().positive(),
        _capNote: note(),
      })
      .strict(),
    classArchetypes: z.object({ _doc: note(), archetypes: z.array(z.enum(AFFINITY_GROUPS)) }).strict(),
    races: z.array(RaceSchema).min(1),
  })
  .strict();
