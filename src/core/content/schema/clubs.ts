/**
 * clubs.json: the 48 clubs of the default theme. Owner: league-economy designer.
 * Spec: docs/design/_drafts/03-league-economy.md sys-league, 04 kit rules.
 * Club ids are used directly as engine ClubIds.
 */
import { z } from 'zod';
import { id, int, note, stance } from './common';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: 'must be a #RRGGBB colour' });

export const ClubTemplateSchema = z
  .object({
    id: id(),
    name: z.string().min(1),
    shortName: z.string().min(1),
    /** Three-letter code shown in tables. */
    code: z.string().regex(/^[A-Z]{3}$/, { message: 'must be 3 capital letters' }),
    regionId: id(),
    districtId: id(),
    city: z.string(),
    arena: z.string(),
    motto: z.string(),
    colors: z.object({ primary: hexColor, secondary: hexColor }).strict(),
    startTierLevel: int().min(1),
    startPrestige: int().min(0).max(100),
    /** economy.json aiPersonalities id. */
    aiPersonality: id(),
    tacticsStyle: stance,
  })
  .strict();

export const ClubsFileSchema = z
  .object({
    _doc: note(),
    schemaVersion: z.number().int(),
    status: z.string(),
    colorRules: z
      .object({
        _doc: note(),
        minPrimarySecondaryContrast: z.number(),
        minPrimaryDeltaESameStartTier: z.number(),
        minPairDistance: z.number(),
        minKitDistance: z.number(),
        clashDeltaE: z.number(),
      })
      .strict(),
    clubs: z.array(ClubTemplateSchema).min(1),
  })
  .strict();
