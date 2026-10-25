/**
 * names.json: original name parts per race. Owner: fighter-lifecycle designer.
 * Spec: docs/design/_drafts/03-fighter-lifecycle.md sys-fighters (names).
 */
import { z } from 'zod';
import { int, note } from './common';

const parts = z
  .object({
    prefixes: z.array(z.string()).min(1),
    /** Optional middle syllables ("" allowed). */
    middles: z.array(z.string()).optional(),
    suffixes: z.array(z.string()).min(1),
  })
  .strict();

/**
 * Name set of one race. `patterns[].format` uses placeholders: {given},
 * {given2}, {family}, {familyA}, {familyB}, and list placeholders such as
 * {place}, {house}, {epithet}, {flame} that name extra string arrays on this
 * object (validated: every list placeholder used must exist).
 */
export const RaceNamesSchema = z
  .object({
    patterns: z.array(z.object({ format: z.string().min(1), weight: z.number().positive() }).strict()).min(1),
    given: parts,
    family: parts,
  })
  .catchall(z.array(z.string()).min(1));

export const NamesFileSchema = z
  .object({
    _doc: note(),
    version: z.number().int(),
    status: z.string(),
    rules: z
      .object({
        maxAttempts: int().positive(),
        uniqueFullNameAmongLivingFighters: z.boolean(),
        onExhaustion: z.string(),
        minGivenLength: int(),
        maxGivenLength: int(),
        rejectTripleLetters: z.boolean(),
        /** Designer documentation of the placeholders. */
        placeholders: z.record(z.string(), z.string()),
        blocklistCaseInsensitive: z.boolean(),
        blocklist: z.array(z.string()),
      })
      .strict(),
    /** Keyed by races.json namesKey. */
    races: z.record(z.string(), RaceNamesSchema),
  })
  .strict();
