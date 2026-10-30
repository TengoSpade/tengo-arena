/**
 * core/content — public API.
 *
 *   loadContent(themeId, raw, { profile }) -> Result<ContentDB, ContentIssue[]>
 *   parseContentFiles(raw)                 -> Result<ContentFiles, ContentIssue[]>
 *   validateContentFiles(files, profile)   -> ContentIssue[]
 *   hashContent(raw), formatContentIssues(issues)
 *   stripDocKeys(json), isDocKey(key)      -> "_"-prefixed documentation keys (never read; stripped from production builds)
 *   units: secondsToTicks, metresToCm, metresToMm, mpsToMmPerTick, fractionToBp, mulBp
 *
 * Content types are inferred from the zod schemas in ./schema; closed
 * vocabularies (statuses, effect types, rule vocabulary, ...) are exported
 * as const lists.
 */
export { loadContent, parseContentFiles, hashContent, CONTENT_FILE_NAMES } from './load';
export type { RawContentFiles, LoadContentOptions } from './load';
export { isDocKey, stripDocKeys } from './doc-keys';
export { validateContentFiles, THEME_RULES } from './validate';
export type { ValidationProfile } from './validate';
export { formatContentIssues } from './issues';
export type { ContentIssue } from './issues';
export { buildContentDB, createRegistry } from './db';
export { combatRating } from './rating';
export { autoSwapRulesFor, clubMatchDefaults } from './match-defaults';
export { SAVE_BOUNDS } from './save-bounds';
export type { SaveBounds } from './save-bounds';
export type { ClubMatchDefaults } from './match-defaults';
export type { ContentDB, Registry } from './db';
export * from './types';
export {
  TICKS_PER_SECOND,
  BP,
  secondsToTicks,
  secondsToMs,
  metresToCm,
  metresToMm,
  mpsToMmPerTick,
  fractionToBp,
  mulBp,
  isExact,
} from './units';
export {
  CONTENT_SCHEMAS,
  STAT_IDS,
  PHYSICAL_STAT_IDS,
  MENTAL_STAT_IDS,
  ARCHETYPE_IDS,
  ROLE_FAMILIES,
  HYBRID_PAIR_IDS,
  AFFINITY_GROUPS,
  BANDS,
  STARTING_ROWS,
  STANCES,
  ABILITY_SLOTS,
  DAMAGE_TYPES,
  STATUS_IDS,
  STATUS_CATEGORIES,
  STAT_MOD_STATS,
  EFFECT_TYPES,
  EFFECT_PREDICATES,
  TRIGGER_EVENTS,
  AMOUNT_STATS,
  RULE_CONDITIONS,
  RULE_SELECTORS,
  RULE_PREDICATES,
  RULE_ACTIONS,
  TRAIT_CATEGORIES,
  TRAIT_EFFECT_TYPES,
  INJURY_SEVERITIES,
  TRAINING_EMPHASES,
  LIFECYCLE_STATUS_IDS,
  TOURNAMENT_ROUNDS,
  STANDINGS_TIEBREAKERS,
  ROUND_TIEBREAKS,
  // M1.1
  PERK_TAGS,
  PERK_ARCHETYPES,
  PERK_LIFECYCLE_EFFECTS,
  RANKABLE_SLOTS,
  RANK_FAMILIES,
  RANK_CHANGE_KINDS,
  LEVEL_UP_MODES,
  LEVEL_UP_PACING,
  AUTO_SWAP_MODES,
  PAUSE_BETWEEN_ROUNDS,
  FRESHNESS_LABELS,
  SWAP_REJECTIONS,
} from './schema';
