/**
 * abilities.json: the 168 abilities (basic, a1, a2, passive per class) in the
 * closed effect vocabulary. Owner: combat designer.
 * Spec: docs/design/_drafts/03-combat.md sys-abilities (schema, effect vocabulary,
 * predicates, stat mods, triggers, status catalog).
 *
 * The effect, predicate and trigger types are recursive, so they are written
 * as explicit TypeScript types with matching zod schemas.
 */
import { z } from 'zod';
import {
  ABILITY_KINDS,
  ABILITY_TARGETS,
  AMOUNT_STATS,
  AREA_AFFECTS,
  AREA_SHAPES,
  DELIVERY_TYPES,
  PER_SOURCES,
  type STATUS_CATEGORIES,
  TRIGGER_EVENTS,
  abilitySlot,
  damageType,
  id,
  int,
  note,
  statModStat,
  statusCategory,
  statusId,
} from './common';

type StatusId = z.infer<typeof statusId>;
type StatusCategory = (typeof STATUS_CATEGORIES)[number];
type StatModStat = z.infer<typeof statModStat>;
type DamageType = z.infer<typeof damageType>;

// ---- Amount -------------------------------------------------------------------------
/** Value = base + Σ coef × stat, evaluated at release (stats are the caster's unless prefixed target). */
export interface Amount {
  base?: number;
  scale: { stat: (typeof AMOUNT_STATS)[number]; coef: number }[];
}
export const AmountSchema: z.ZodType<Amount> = z
  .object({
    base: z.number().optional(),
    scale: z.array(z.object({ stat: z.enum(AMOUNT_STATS), coef: z.number() }).strict()),
  })
  .strict();

// ---- Predicates (effects, stat mods, triggers) -------------------------------------------
export type EffectPredicate =
  | { p: 'target_hp_below'; pct: number }
  | { p: 'target_hp_above'; pct: number }
  | { p: 'target_has_status'; status: StatusId | StatusId[] }
  | { p: 'target_casting' }
  | { p: 'target_not_targeting_source' }
  | { p: 'target_distance_above'; gapM: number }
  | { p: 'self_hp_below'; pct: number }
  | { p: 'self_targeted_by'; count: number }
  | { p: 'attacker_distance_above'; gapM: number }
  | { p: 'fight_time_below'; seconds: number }
  | { p: 'fight_time_at_least'; seconds: number }
  | { p: 'ally_downed_within'; seconds: number }
  | { p: 'any'; of: EffectPredicate[] };

export const EffectPredicateSchema: z.ZodType<EffectPredicate> = z.lazy(() =>
  z.discriminatedUnion('p', [
    z.object({ p: z.literal('target_hp_below'), pct: z.number() }).strict(),
    z.object({ p: z.literal('target_hp_above'), pct: z.number() }).strict(),
    z.object({ p: z.literal('target_has_status'), status: z.union([statusId, z.array(statusId).min(1)]) }).strict(),
    z.object({ p: z.literal('target_casting') }).strict(),
    z.object({ p: z.literal('target_not_targeting_source') }).strict(),
    z.object({ p: z.literal('target_distance_above'), gapM: z.number() }).strict(),
    z.object({ p: z.literal('self_hp_below'), pct: z.number() }).strict(),
    z.object({ p: z.literal('self_targeted_by'), count: int().positive() }).strict(),
    z.object({ p: z.literal('attacker_distance_above'), gapM: z.number() }).strict(),
    z.object({ p: z.literal('fight_time_below'), seconds: z.number() }).strict(),
    z.object({ p: z.literal('fight_time_at_least'), seconds: z.number() }).strict(),
    z.object({ p: z.literal('ally_downed_within'), seconds: z.number() }).strict(),
    z.object({ p: z.literal('any'), of: z.array(EffectPredicateSchema).min(1) }).strict(),
  ]),
);

// ---- Effects ------------------------------------------------------------------------------
export interface DamageBonus {
  if: EffectPredicate;
  mult: number;
}
export interface HealRedirect {
  sel: 'lowest_hp_ally';
  withinM: number;
  includeSelf: boolean;
}
export interface Zone {
  center: 'self' | 'target';
  follow: 'none' | 'caster';
  radiusM: number;
  durationS: number;
  tickIntervalS: number | null;
  trigger: { on: 'enemy_enter'; armTimeS: number; consume: boolean } | null;
  maxActive: number | null;
  allies: Effect[];
  enemies: Effect[];
}

export type Effect =
  | {
      type: 'damage';
      amount: Amount;
      damageType: DamageType;
      canCrit: boolean;
      evadable: boolean;
      bonus?: DamageBonus[];
      lifesteal?: number;
      perTargetStack?: { status: StatusId; mult: number; consume: boolean };
      onKill?: Effect[];
    }
  | { type: 'heal'; amount: Amount; bonus?: DamageBonus[]; to?: HealRedirect }
  | { type: 'shield'; amount: Amount; durationS: number }
  | {
      type: 'status';
      status: StatusId;
      durationS: number;
      magnitude?: number;
      maxStacks?: number;
      tick?: { intervalS: number; amount: Amount; damageType?: DamageType };
      resetOnTargetChange?: boolean;
      /** Deathward heal amount. */
      amount?: Amount;
    }
  | { type: 'knockback'; distanceM: number; from: 'caster' | 'area_center' }
  | { type: 'pull'; distanceM: number; toward: 'caster' | 'area_center'; stopGapM: number }
  | { type: 'dash'; mode: 'away_from_target' | 'toward_target' | 'behind_target'; distanceM: number }
  | { type: 'cleanse'; categories: StatusCategory[]; statuses: StatusId[]; count: number | null }
  | { type: 'dispel'; categories: ('buff' | 'shield' | 'hot')[]; count: number | null }
  | { type: 'interrupt' }
  | { type: 'guard'; pct: number; durationS: number; radiusM: number }
  | { type: 'zone'; zone: Zone }
  | { type: 'chain'; bounces: number; radiusM: number; falloff: number; includeInitial: boolean; effects: Effect[] }
  | { type: 'splash'; radiusM: number; affects: (typeof AREA_AFFECTS)[number]; excludePrimary: boolean; effects: Effect[] }
  | { type: 'cooldown'; slot: 'self' | 'a1' | 'a2'; mode: 'reset' | 'reduce'; seconds: number | null }
  | { type: 'focus'; amount: number }
  | { type: 'heal_recent_damage'; windowS: number; pct: number; min: Amount };

const bonusSchema = z.array(z.object({ if: EffectPredicateSchema, mult: z.number().positive() }).strict());

export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z
      .object({
        type: z.literal('damage'),
        amount: AmountSchema,
        damageType,
        canCrit: z.boolean(),
        evadable: z.boolean(),
        bonus: bonusSchema.optional(),
        lifesteal: z.number().optional(),
        perTargetStack: z.object({ status: statusId, mult: z.number(), consume: z.boolean() }).strict().optional(),
        onKill: z.array(EffectSchema).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('heal'),
        amount: AmountSchema,
        bonus: bonusSchema.optional(),
        to: z
          .object({ sel: z.literal('lowest_hp_ally'), withinM: z.number().positive(), includeSelf: z.boolean() })
          .strict()
          .optional(),
      })
      .strict(),
    z.object({ type: z.literal('shield'), amount: AmountSchema, durationS: z.number().positive() }).strict(),
    z
      .object({
        type: z.literal('status'),
        status: statusId,
        durationS: z.number().positive(),
        magnitude: z.number().optional(),
        maxStacks: int().positive().optional(),
        tick: z
          .object({ intervalS: z.number().positive(), amount: AmountSchema, damageType: damageType.optional() })
          .strict()
          .optional(),
        resetOnTargetChange: z.boolean().optional(),
        amount: AmountSchema.optional(),
      })
      .strict(),
    z
      .object({ type: z.literal('knockback'), distanceM: z.number().positive(), from: z.enum(['caster', 'area_center']) })
      .strict(),
    z
      .object({
        type: z.literal('pull'),
        distanceM: z.number().positive(),
        toward: z.enum(['caster', 'area_center']),
        stopGapM: z.number().nonnegative(),
      })
      .strict(),
    z
      .object({
        type: z.literal('dash'),
        mode: z.enum(['away_from_target', 'toward_target', 'behind_target']),
        distanceM: z.number().positive(),
      })
      .strict(),
    z
      .object({
        type: z.literal('cleanse'),
        categories: z.array(statusCategory),
        statuses: z.array(statusId),
        count: int().positive().nullable(),
      })
      .strict(),
    z
      .object({
        type: z.literal('dispel'),
        categories: z.array(z.enum(['buff', 'shield', 'hot'])).min(1),
        count: int().positive().nullable(),
      })
      .strict(),
    z.object({ type: z.literal('interrupt') }).strict(),
    z
      .object({
        type: z.literal('guard'),
        pct: z.number().positive(),
        durationS: z.number().positive(),
        radiusM: z.number().positive(),
      })
      .strict(),
    z
      .object({
        type: z.literal('zone'),
        zone: z
          .object({
            center: z.enum(['self', 'target']),
            follow: z.enum(['none', 'caster']),
            radiusM: z.number().positive(),
            durationS: z.number().positive(),
            tickIntervalS: z.number().positive().nullable(),
            trigger: z
              .object({ on: z.literal('enemy_enter'), armTimeS: z.number().nonnegative(), consume: z.boolean() })
              .strict()
              .nullable(),
            maxActive: int().positive().nullable(),
            allies: z.array(EffectSchema),
            enemies: z.array(EffectSchema),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal('chain'),
        bounces: int().positive(),
        radiusM: z.number().positive(),
        falloff: z.number().positive(),
        includeInitial: z.boolean(),
        effects: z.array(EffectSchema).min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal('splash'),
        radiusM: z.number().positive(),
        affects: z.enum(AREA_AFFECTS),
        excludePrimary: z.boolean(),
        effects: z.array(EffectSchema).min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal('cooldown'),
        slot: z.enum(['self', 'a1', 'a2']),
        mode: z.enum(['reset', 'reduce']),
        seconds: z.number().positive().nullable(),
      })
      .strict(),
    z.object({ type: z.literal('focus'), amount: z.number().positive() }).strict(),
    z
      .object({
        type: z.literal('heal_recent_damage'),
        windowS: z.number().positive(),
        pct: z.number().positive(),
        min: AmountSchema,
      })
      .strict(),
  ]),
);

// ---- Passives: stat mods, auras, triggers --------------------------------------------------
export interface StatMod {
  stat: StatModStat;
  value: number | Amount;
  per?: { source: (typeof PER_SOURCES)[number]; radiusM?: number; coef: number; max: number };
  if?: EffectPredicate;
}
export const StatModSchema: z.ZodType<StatMod> = z
  .object({
    stat: statModStat,
    value: z.union([z.number(), AmountSchema]),
    per: z
      .object({ source: z.enum(PER_SOURCES), radiusM: z.number().positive().optional(), coef: z.number(), max: z.number() })
      .strict()
      .optional(),
    if: EffectPredicateSchema.optional(),
  })
  .strict();

export type TriggerTarget = 'self' | 'trigger_target' | 'trigger_source' | HealRedirect;
export interface Trigger {
  on: (typeof TRIGGER_EVENTS)[number];
  n?: number;
  pct?: number;
  radiusM?: number;
  status?: StatusId;
  statuses?: StatusId[];
  oncePerTarget?: boolean;
  target: TriggerTarget;
  internalCooldownS: number;
  effects: Effect[];
}
export const TriggerSchema: z.ZodType<Trigger> = z
  .object({
    on: z.enum(TRIGGER_EVENTS),
    n: int().positive().optional(),
    pct: z.number().optional(),
    radiusM: z.number().positive().optional(),
    status: statusId.optional(),
    statuses: z.array(statusId).optional(),
    oncePerTarget: z.boolean().optional(),
    target: z.union([
      z.enum(['self', 'trigger_target', 'trigger_source']),
      z.object({ sel: z.literal('lowest_hp_ally'), withinM: z.number().positive(), includeSelf: z.boolean() }).strict(),
    ]),
    internalCooldownS: z.number().nonnegative(),
    effects: z.array(EffectSchema).min(1),
  })
  .strict();

export const PassiveSchema = z
  .object({
    statMods: z.array(StatModSchema),
    aura: z
      .object({
        radiusM: z.number().positive(),
        affects: z.enum(['allies', 'allies_incl_self', 'enemies']),
        statMods: z.array(StatModSchema).min(1),
      })
      .strict()
      .nullable(),
    triggers: z.array(TriggerSchema),
  })
  .strict();

// ---- Ability -------------------------------------------------------------------------------
export const AbilitySchema = z
  .object({
    id: id(),
    classId: id(),
    iconId: z.string(),
    slot: abilitySlot,
    kind: z.enum(ABILITY_KINDS),
    name: z.string().min(1),
    description: z.string(),
    tags: z.array(z.string()),
    cooldownS: z.number().nonnegative(),
    startCooldownS: z.number().nonnegative(),
    focusCost: int().nonnegative(),
    /** null for basics (windup derived from the attack interval). */
    castTimeS: z.number().nonnegative().nullable(),
    channel: z
      .object({
        durationS: z.number().positive(),
        tickIntervalS: z.number().positive(),
        mobile: z.boolean(),
        moveSpeedMult: z.number().nonnegative(),
      })
      .strict()
      .nullable(),
    rangeM: z.number().nonnegative(),
    target: z.enum(ABILITY_TARGETS),
    approach: z.boolean(),
    order: z.enum(['target_first', 'self_first']),
    delivery: z
      .object({
        type: z.enum(DELIVERY_TYPES),
        speedMps: z.number().positive().optional(),
        endAt: z.enum(['adjacent', 'behind']).optional(),
      })
      .strict(),
    area: z
      .object({
        shape: z.enum(AREA_SHAPES),
        center: z.enum(['self', 'target']),
        radiusM: z.number().positive().optional(),
        angleDeg: z.union([z.literal(60), z.literal(90), z.literal(120), z.literal(180)]).optional(),
        lengthM: z.number().positive().optional(),
        widthM: z.number().positive().optional(),
        affects: z.enum(AREA_AFFECTS),
        maxTargets: z.null(),
      })
      .strict()
      .nullable(),
    effects: z.array(EffectSchema),
    allyEffects: z.array(EffectSchema),
    selfEffects: z.array(EffectSchema),
    passive: PassiveSchema.nullable(),
  })
  .strict();

export const AbilitiesFileSchema = z
  .object({
    _doc: note(),
    schemaVersion: z.number().int(),
    status: z.string(),
    abilities: z.array(AbilitySchema).min(1),
  })
  .strict();
