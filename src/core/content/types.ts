/**
 * Content types, inferred from the zod schemas (the schema is the single
 * source of truth). Values are in AUTHORING units (seconds, metres,
 * fractions); convert with ./units.ts at the point of use or when a module
 * builds its own precomputed tables.
 */
import type { z } from 'zod';
import type {
  AbilitySchema,
  ClassSchema,
  ClubTemplateSchema,
  ContentFiles,
  PresetSchema,
  RaceNamesSchema,
  RaceSchema,
  RuleActionSchema,
  RuleConditionSchema,
  RulePredicateSchema,
  RuleSchema,
  RuleSelectorSchema,
  TraitEffectSchema,
  TraitSchema,
  VocabularySchema,
} from './schema';

export type {
  Amount,
  Effect,
  EffectPredicate,
  StatMod,
  Trigger,
  TriggerTarget,
  RuleParamSpec,
  ContentFiles,
  ContentFileName,
  PerkLifecycleEffect,
  RankChange,
} from './schema';

export type CombatConstants = ContentFiles['combat'];
/** M1.1 levels.json (lifecycle: XP, levels, offers, Freshness, AI rotation and auto-swap inputs). */
export type LevelsConstants = ContentFiles['levels'];
export type PerkDef = ContentFiles['perks']['perks'][number];
export type PerkRules = ContentFiles['perks']['rules'];
export type PerkAiPreferences = ContentFiles['perks']['aiPreferences'];
export type RankRow = ContentFiles['ability-ranks']['ranks'][number];
export type FreshnessPenaltyConstants = CombatConstants['freshness'];
export type MatchSquadConstants = CombatConstants['match'];
export type AutoSwapDefaults = CombatConstants['match']['autoSwapDefaults'];
export type FreshnessLevelsConstants = LevelsConstants['freshness'];
export type FreshnessLabelDef = LevelsConstants['freshness']['labels'][number];
export type TraitOfferEntry = LevelsConstants['traitOfferPool']['positive'][number];
export type DevelopmentConstants = ContentFiles['development'];
export type EconomyConstants = ContentFiles['economy'];
export type LeaguesConfig = ContentFiles['leagues'];
export type NamesConfig = ContentFiles['names'];
export type TacticsLimits = ContentFiles['tactics-presets']['limits'];

export type StatDef = CombatConstants['attributes'][number];
export type ArchetypeDef = CombatConstants['archetypes'][number];
export type HybridPairDef = CombatConstants['hybridPairs'][number];
export type BandDef = CombatConstants['bands'][number];
export type StatusDef = CombatConstants['statuses'][number];

export type ClassDef = z.infer<typeof ClassSchema>;
export type AbilityDef = z.infer<typeof AbilitySchema>;
export type PresetDef = z.infer<typeof PresetSchema>;
export type RuleDef = z.infer<typeof RuleSchema>;
export type RuleCondition = z.infer<typeof RuleConditionSchema>;
export type RuleSelector = z.infer<typeof RuleSelectorSchema>;
export type RulePredicate = z.infer<typeof RulePredicateSchema>;
export type RuleAction = z.infer<typeof RuleActionSchema>;
export type Vocabulary = z.infer<typeof VocabularySchema>;

export type RaceDef = z.infer<typeof RaceSchema>;
export type RaceNames = z.infer<typeof RaceNamesSchema>;
export type TraitDef = z.infer<typeof TraitSchema>;
export type TraitEffect = z.infer<typeof TraitEffectSchema>;
export type LifecycleStatusDef = DevelopmentConstants['statuses'][number];
export type CaptaincyGradeDef = DevelopmentConstants['captaincy']['grades'][number];
export type InjurySeverityDef = DevelopmentConstants['injury']['severityLadder'][number];

export type ClubTemplate = z.infer<typeof ClubTemplateSchema>;
export type RegionDef = LeaguesConfig['regions'][number];
export type TierDef = LeaguesConfig['tiers'][number];
export type WingDef = LeaguesConfig['wings']['list'][number];
export type VenueDef = LeaguesConfig['venues'][number];
export type CalendarWeekDef = LeaguesConfig['calendar']['weeks'][number];
export type TournamentRoundDef = LeaguesConfig['tournament']['rounds'][number];

export type TierProfile = EconomyConstants['tierProfiles'][number];
export type AiPersonalityDef = EconomyConstants['aiPersonalities'][number];
