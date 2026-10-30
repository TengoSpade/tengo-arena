/**
 * ability-ranks.json (M1.1): ranks 1 -> 3 for every active and passive ability. Owner: combat designer.
 * Spec: docs/design/_drafts/m1.1/combat-skills.md sys-ability-ranks. Rank 1 is the ability as written
 * in abilities.json; rank 2 applies its `changes` (JSON pointers into the ability), rank 3 applies rank
 * 3's on top. Basic attacks never rank (`rankable: false`, `ranks: []`).
 */
import { z } from 'zod';
import { ABILITY_SLOTS, RANK_CHANGE_KINDS, RANK_FAMILIES, id, int, note } from './common';

export const RankChangeSchema = z
  .object({
    /** JSON pointer into the Ability object (e.g. "/cooldownS", "/effects/0/amount/scale/0/coef"). */
    path: z.string().regex(/^(\/[^/]+)+$/),
    from: z.number(),
    to: z.number(),
    kind: z.enum(RANK_CHANGE_KINDS),
    label: z.string().min(1),
  })
  .strict();
export type RankChange = z.infer<typeof RankChangeSchema>;

export const RankRowSchema = z
  .object({
    abilityId: id(),
    classId: id(),
    slot: z.enum(ABILITY_SLOTS),
    rankable: z.boolean(),
    family: z.enum(RANK_FAMILIES),
    ranks: z.array(
      z
        .object({
          rank: z.union([z.literal(2), z.literal(3)]),
          summary: z.string().min(1),
          changes: z.array(RankChangeSchema).min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const AbilityRanksFileSchema = z
  .object({
    _doc: note(),
    schemaVersion: int(),
    status: z.string(),
    /** Template multipliers the rank rows were generated with (reference; the rows are authoritative). */
    templates: z.record(z.string(), z.number()),
    familyRules: z.record(z.string(), z.array(z.string())),
    eligibility: z
      .object({ rankableSlots: z.array(z.enum(['a1', 'a2', 'passive'])), rank3Requires: z.string(), maxRank: z.literal(3), note: note() })
      .strict(),
    ranks: z.array(RankRowSchema).min(1),
  })
  .strict();
