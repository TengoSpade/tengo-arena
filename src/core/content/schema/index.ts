import type { z } from 'zod';
import { AbilitiesFileSchema } from './abilities';
import { AbilityRanksFileSchema } from './ability-ranks';
import { ClassesFileSchema } from './classes';
import { ClubsFileSchema } from './clubs';
import { CombatFileSchema } from './combat';
import { DevelopmentFileSchema } from './development';
import { EconomyFileSchema } from './economy';
import { LeaguesFileSchema } from './leagues';
import { LevelsFileSchema } from './levels';
import { NamesFileSchema } from './names';
import { PerksFileSchema } from './perks';
import { RacesFileSchema } from './races';
import { TacticsPresetsFileSchema } from './tactics';
import { TraitsFileSchema } from './traits';

export * from './common';
export * from './abilities';
export * from './ability-ranks';
export * from './classes';
export * from './clubs';
export * from './combat';
export * from './development';
export * from './economy';
export * from './leagues';
export * from './levels';
export * from './names';
export * from './perks';
export * from './races';
export * from './tactics';
export * from './traits';

/** One schema per content file, keyed by file name (without .json). */
export const CONTENT_SCHEMAS = {
  combat: CombatFileSchema,
  classes: ClassesFileSchema,
  abilities: AbilitiesFileSchema,
  'tactics-presets': TacticsPresetsFileSchema,
  races: RacesFileSchema,
  traits: TraitsFileSchema,
  names: NamesFileSchema,
  development: DevelopmentFileSchema,
  leagues: LeaguesFileSchema,
  clubs: ClubsFileSchema,
  economy: EconomyFileSchema,
  // M1.1
  levels: LevelsFileSchema,
  perks: PerksFileSchema,
  'ability-ranks': AbilityRanksFileSchema,
} as const;

export type ContentFileName = keyof typeof CONTENT_SCHEMAS;

/** Parsed content per file. */
export interface ContentFiles {
  combat: z.infer<typeof CombatFileSchema>;
  classes: z.infer<typeof ClassesFileSchema>;
  abilities: z.infer<typeof AbilitiesFileSchema>;
  'tactics-presets': z.infer<typeof TacticsPresetsFileSchema>;
  races: z.infer<typeof RacesFileSchema>;
  traits: z.infer<typeof TraitsFileSchema>;
  names: z.infer<typeof NamesFileSchema>;
  development: z.infer<typeof DevelopmentFileSchema>;
  leagues: z.infer<typeof LeaguesFileSchema>;
  clubs: z.infer<typeof ClubsFileSchema>;
  economy: z.infer<typeof EconomyFileSchema>;
  levels: z.infer<typeof LevelsFileSchema>;
  perks: z.infer<typeof PerksFileSchema>;
  'ability-ranks': z.infer<typeof AbilityRanksFileSchema>;
}
