/**
 * tactics-presets.json: the closed rule vocabulary (conditions, selectors,
 * predicates, actions, stances, roles, bands) and the per-class presets used
 * in M1 (O14). Owner: combat designer. Spec: docs/design/_drafts/03-combat.md
 * sys-tactics, sys-targeting.
 *
 * Rule parts carry their parameters as flat fields next to the discriminator
 * (`{ cond: 'ally_hp_below', pct: 40 }`). The schema accepts scalar params;
 * the cross-file validator checks every param against the vocabulary entry
 * (name, type, range, step, optional/default), so presets can only use the
 * closed vocabulary.
 */
import { z } from 'zod';
import {
  RULE_ACTIONS,
  RULE_CONDITIONS,
  RULE_PARAM_TYPES,
  RULE_PREDICATES,
  RULE_SELECTORS,
  archetypeId,
  band,
  id,
  int,
  note,
  stance,
  statusCategory,
  statusId,
} from './common';

const paramName = z.string().regex(/^[a-z][A-Za-z0-9]*$/);

/** Declaration of one parameter of a vocabulary entry. */
export const RuleParamSpecSchema = z.discriminatedUnion('type', [
  z
    .object({
      name: paramName,
      type: z.literal('int'),
      min: z.number(),
      max: z.number(),
      step: z.number().positive().optional(),
      default: z.number().optional(),
      optional: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      name: paramName,
      type: z.literal('metres'),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().positive().optional(),
      default: z.number().optional(),
      optional: z.boolean().optional(),
    })
    .strict(),
  z
    .object({ name: paramName, type: z.literal('bool'), default: z.boolean().optional(), optional: z.boolean().optional() })
    .strict(),
  z.object({ name: paramName, type: z.literal('band'), default: band.optional(), optional: z.boolean().optional() }).strict(),
  z
    .object({ name: paramName, type: z.literal('role'), default: archetypeId.optional(), optional: z.boolean().optional() })
    .strict(),
  z
    .object({ name: paramName, type: z.literal('status'), optional: z.boolean().optional(), note: z.string().optional() })
    .strict(),
  z
    .object({
      name: paramName,
      type: z.literal('statusCategory'),
      optional: z.boolean().optional(),
      note: z.string().optional(),
    })
    .strict(),
  z
    .object({ name: paramName, type: z.literal('slot'), values: z.array(z.enum(['a1', 'a2'])).min(1) })
    .strict(),
]);
export type RuleParamSpec = z.infer<typeof RuleParamSpecSchema>;
export const RULE_PARAM_TYPE_LIST = RULE_PARAM_TYPES;

const params = z.array(RuleParamSpecSchema);

export const VocabularySchema = z
  .object({
    conditions: z.array(
      z
        .object({
          id: z.enum(RULE_CONDITIONS),
          group: z.string(),
          label: z.string(),
          params,
          starter: z.boolean(),
          description: z.string(),
        })
        .strict(),
    ),
    selectors: z.array(
      z
        .object({
          id: z.enum(RULE_SELECTORS),
          pool: z.enum(['self', 'enemies', 'allies']),
          /** Sort key name implemented by core/tactics (null = special selector). */
          sort: z.string().nullable(),
          label: z.string(),
          params,
          starter: z.boolean(),
          filter: z.string().optional(),
        })
        .strict(),
    ),
    predicates: z.array(
      z
        .object({
          id: z.enum(RULE_PREDICATES),
          label: z.string(),
          params,
          description: z.string().optional(),
        })
        .strict(),
    ),
    actions: z.array(
      z
        .object({
          id: z.enum(RULE_ACTIONS),
          label: z.string(),
          params,
          targetPool: z.enum(['enemies', 'ability', 'any', 'allies_not_self']),
          starter: z.boolean(),
          description: z.string(),
        })
        .strict(),
    ),
    stances: z.array(z.object({ id: stance, name: z.string(), description: z.string() }).strict()),
    roles: z.array(z.object({ id: archetypeId, name: z.string() }).strict()),
    bands: z.array(band),
  })
  .strict();

/** Scalar rule parameter values (validated against the vocabulary). */
const paramValue = z.union([z.number(), z.string(), z.boolean()]);

export const RuleConditionSchema = z
  .object({ cond: z.enum(RULE_CONDITIONS), not: z.boolean().optional() })
  .catchall(paramValue);
export const RuleSelectorSchema = z.object({ sel: z.enum(RULE_SELECTORS) }).catchall(paramValue);
export const RulePredicateSchema = z.object({ pred: z.enum(RULE_PREDICATES) }).catchall(paramValue);
export const RuleActionSchema = z.object({ type: z.enum(RULE_ACTIONS) }).catchall(paramValue);

/** `IF <conditions> THEN <action> ON <selector> [ONLY <predicate> | PREFER <predicate>] [COOLDOWN]` (01 §7). */
export const RuleSchema = z
  .object({
    id: z.string().min(1),
    if: z.array(RuleConditionSchema).min(1),
    then: RuleActionSchema,
    on: RuleSelectorSchema,
    only: RulePredicateSchema.nullable(),
    prefer: RulePredicateSchema.nullable(),
    cooldownS: z.number().nonnegative(),
  })
  .strict();

export const PresetSchema = z
  .object({
    id: id(),
    classId: id(),
    style: z.string(),
    name: z.string().min(1),
    summary: z.string(),
    stance,
    rules: z.array(RuleSchema),
  })
  .strict();

export const TacticsPresetsFileSchema = z
  .object({
    _doc: note(),
    schemaVersion: z.number().int(),
    status: z.string(),
    limits: z
      .object({
        maxRules: int().positive(),
        maxConditionsPerRule: int().positive(),
        onlyOrPreferPerRule: int().nonnegative(),
        thresholdStepPct: int().positive(),
        m1RulesPerPreset: z.object({ min: int(), max: int() }).strict(),
      })
      .strict(),
    vocabulary: VocabularySchema,
    presets: z.array(PresetSchema).min(1),
  })
  .strict();

/** Status / category values used by rule params, for the validator. */
export const RULE_STATUS_VALUE = statusId;
export const RULE_STATUS_CATEGORY_VALUE = statusCategory;
