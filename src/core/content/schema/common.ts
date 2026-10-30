/**
 * Shared schema pieces and the CLOSED vocabularies of the content contract.
 *
 * A closed vocabulary is a list the engine implements one-to-one (an effect
 * type, a status, a rule condition, ...). Adding an entry is a code change
 * (sim, tactics or fighters must implement it), so these lists live in code
 * and content is validated against them. Everything else (names, numbers,
 * which classes exist) is data.
 *
 * Source: docs/design/_drafts/03-combat.md "Schema notes for the architect"
 * item 3, 03-fighter-lifecycle.md, 03-league-economy.md.
 */
import { z } from 'zod';

/** Content ids: lowercase letters and digits, words joined by "-" or "_" (e.g. "oathguard_mace_strike", "varrow-lanternguard"). */
export const ID_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
export const id = () => z.string().regex(ID_PATTERN, { message: 'must be a lowercase id (a-z, 0-9, words joined by "-" or "_")' });

/** Free text meant for designers (`_doc`, `_note`, ...). Never read by code; the production build strips every `_` key (core/content/doc-keys.ts). */
export const note = () => z.string().optional();

/** Whole number. */
export const int = () => z.number().int();

/** A [x, y] point of a piecewise-linear curve. */
export const curvePoint = () => z.tuple([z.number(), z.number()]);

// ---- Combat stats (combat.json attributes) -----------------------------------
/** M1.1: `stamina` (STA, physical) has no fight formula; it acts through Freshness (lifecycle). */
export const STAT_IDS = ['str', 'agi', 'pac', 'tgh', 'pre', 'stamina', 'arc', 'spi', 'wil', 'cmp', 'ldr', 'awr', 'dis'] as const;
export const PHYSICAL_STAT_IDS = ['str', 'agi', 'pac', 'tgh', 'pre', 'stamina'] as const;
export const MENTAL_STAT_IDS = ['arc', 'spi', 'wil', 'cmp', 'ldr', 'awr', 'dis'] as const;
export const statId = z.enum(STAT_IDS);
export const STAT_GROUPS = ['physical', 'mental'] as const;

// ---- Classes -----------------------------------------------------------------
export const ARCHETYPE_IDS = ['tank', 'melee', 'ranged', 'controller', 'healer'] as const;
export const archetypeId = z.enum(ARCHETYPE_IDS);
export const ROLE_FAMILIES = ['tank', 'dps', 'controller', 'healer'] as const;
export const roleFamily = z.enum(ROLE_FAMILIES);
export const HYBRID_PAIR_IDS = [
  'tank_dps',
  'tank_controller',
  'tank_healer',
  'dps_controller',
  'dps_healer',
  'controller_healer',
] as const;
export const hybridPairId = z.enum(HYBRID_PAIR_IDS);
export const AFFINITY_GROUPS = ['frontline', 'skirmisher', 'ranged', 'caster', 'support'] as const;
export const affinityGroup = z.enum(AFFINITY_GROUPS);
export const BANDS = ['melee', 'close', 'mid', 'long'] as const;
export const band = z.enum(BANDS);
export const STARTING_ROWS = ['front', 'back'] as const;
export const startingRow = z.enum(STARTING_ROWS);
export const DAMAGE_PROFILES = ['physical', 'arcane', 'mixed'] as const;
export const STANCES = ['aggressive', 'steady', 'cautious'] as const;
export const stance = z.enum(STANCES);
export const ABILITY_SLOTS = ['basic', 'a1', 'a2', 'passive'] as const;
export const abilitySlot = z.enum(ABILITY_SLOTS);

// ---- Abilities and statuses -----------------------------------------------------
export const DAMAGE_TYPES = ['physical', 'arcane', 'true'] as const;
export const damageType = z.enum(DAMAGE_TYPES);
export const STATUS_IDS = [
  'stun', 'sleep', 'root', 'silence', 'taunt', 'slow', 'sluggish', 'haste', 'frenzy', 'momentum', 'empower', 'weaken',
  'shaken', 'fortify', 'vulnerable', 'marked', 'armor_up', 'armor_shred', 'ward_up', 'ward_shred', 'heal_reduction',
  'thorns', 'lifesteal', 'evasive', 'bleed', 'burn', 'poison', 'regen', 'guarded', 'riposte', 'deathward', 'anchored',
  'illuminated', 'rallied',
] as const;
export const statusId = z.enum(STATUS_IDS);
export const STATUS_CATEGORIES = ['cc_hard', 'cc_soft', 'buff', 'debuff', 'dot', 'hot', 'special', 'shield'] as const;
export const statusCategory = z.enum(STATUS_CATEGORIES);
export const STAT_MOD_STATS = [
  'maxHp', 'armor', 'ward', 'moveSpeed', 'attackSpeed', 'power', 'support', 'crit', 'evade', 'tenacity', 'resolve',
  'composure', 'reactionDelay', 'damageDealt', 'damageTaken', 'healingDealt', 'healingReceived', 'thorns', 'lifesteal',
  'hpRegenPct', 'hpRegenFlat', 'ccDurationDealt', 'debuffDurationDealt', 'focusRegen', 'cooldownRate', 'windup',
  'displaceImmune',
  // M1.1 (perks): share of the freshness penalty ignored, summed and clamped 0..1, constant per round.
  'fatigueResist',
] as const;
export const statModStat = z.enum(STAT_MOD_STATS);
export const EFFECT_TYPES = [
  'damage', 'heal', 'shield', 'status', 'knockback', 'pull', 'dash', 'cleanse', 'dispel', 'interrupt', 'guard', 'zone',
  'chain', 'splash', 'cooldown', 'focus', 'heal_recent_damage',
] as const;
export const EFFECT_PREDICATES = [
  'target_hp_below', 'target_hp_above', 'target_has_status', 'target_casting', 'target_not_targeting_source',
  'target_distance_above', 'self_hp_below', 'self_targeted_by', 'attacker_distance_above', 'fight_time_below',
  'fight_time_at_least', 'ally_downed_within', 'any',
  // M1.1 (perks; sim WP-A): acting captain; freshness at this round's start below pct; entered from the reserves this round.
  'self_is_captain', 'self_freshness_below', 'self_fresh_entry',
] as const;
export const TRIGGER_EVENTS = [
  'basic_hit', 'every_n_basic', 'hit', 'damage_taken', 'evade', 'kill', 'status_target_down', 'ally_hp_below',
  'every_n_heals', 'cc_applied', 'shield_broken', 'round_start',
  // M1.1 (perks; sim WP-A): once per round when HP first drops below pct; an active ability is released.
  'self_hp_below', 'ability_release',
] as const;
export const AMOUNT_STATS = [
  'power', 'support', 'maxHp', 'missingHp', 'armor', 'ward', 'targetMaxHp', 'targetMissingHp', 'triggerAmount', 'lastDamage',
] as const;
export const PER_SOURCES = ['selfMissingHpPct', 'alliesWithin', 'enemiesWithin', 'attackersOnSelf'] as const;
export const AREA_SHAPES = ['circle', 'cone', 'line'] as const;
export const AREA_AFFECTS = ['enemies', 'allies', 'allies_incl_self', 'both'] as const;
export const CONE_ANGLES = [60, 90, 120, 180] as const;
export const ABILITY_TARGETS = ['enemy', 'ally', 'self', 'ally_or_self'] as const;
export const ABILITY_KINDS = ['basic', 'active', 'passive'] as const;
export const DELIVERY_TYPES = ['instant', 'dash', 'leap', 'projectile'] as const;

// ---- Tactics rule vocabulary (tactics-presets.json vocabulary.*) ----------------
export const RULE_CONDITIONS = [
  'always', 'self_hp_below', 'ally_hp_below', 'allies_hp_below', 'enemy_hp_below', 'enemy_within', 'enemies_within',
  'enemies_clustered', 'allies_clustered', 'self_targeted', 'ally_targeted', 'enemy_casting', 'self_has_status',
  'ally_has_status', 'enemy_has_status', 'fight_time_below', 'focus_at_least', 'outnumbered', 'allies_down',
  'enemy_role_within', 'captain_alive',
] as const;
export const RULE_SELECTORS = [
  'self', 'nearest_enemy', 'furthest_enemy', 'lowest_hp_enemy', 'top_damage_enemy', 'enemy_targeting_me',
  'enemy_targeting_ally', 'casting_enemy', 'densest_enemy', 'captain_target', 'marked_enemy', 'enemy_role',
  'lowest_hp_ally', 'most_targeted_ally', 'ally_role', 'densest_ally', 'captain', 'current_target',
] as const;
export const RULE_PREDICATES = [
  'in_range', 'within', 'hp_below', 'hp_above', 'has_status', 'lacks_status', 'has_buff', 'role', 'not_role',
  'not_targeted_by_ally', 'targeting_me', 'not_self',
] as const;
export const RULE_ACTIONS = ['attack', 'ability', 'kite', 'hold', 'protect', 'regroup'] as const;
export const RULE_PARAM_TYPES = ['int', 'bool', 'band', 'metres', 'role', 'status', 'statusCategory', 'slot'] as const;

// ---- M1.1 skills, squads and level-ups (perks.json, ability-ranks.json, levels.json, combat.json match) ----
export const PERK_TAGS = ['offense', 'defense', 'sustain', 'control', 'support', 'tempo', 'mobility', 'stamina', 'captain'] as const;
export const perkTag = z.enum(PERK_TAGS);
export const PERK_ARCHETYPES = ['general', ...ARCHETYPE_IDS] as const;
export const PERK_LIFECYCLE_EFFECTS = ['freshnessDrainMult', 'freshnessBetweenRounds', 'captaincy'] as const;
export const RANKABLE_SLOTS = ['a1', 'a2', 'passive'] as const;
export const rankableSlot = z.enum(RANKABLE_SLOTS);
export const RANK_FAMILIES = [
  'basic', 'damage', 'area_damage', 'control', 'heal', 'shield', 'buff', 'debuff', 'mobility', 'protect', 'ward', 'passive',
] as const;
export const RANK_CHANGE_KINDS = ['magnitude', 'cooldown', 'duration', 'area', 'focus', 'extra'] as const;
export const LEVEL_UP_MODES = ['manual', 'auto', 'auto_stats', 'auto_skills'] as const;
export const LEVEL_UP_PACING = ['detailed', 'balanced', 'fast'] as const;
export const AUTO_SWAP_MODES = ['off', 'injured_only', 'threshold'] as const;
export const PAUSE_BETWEEN_ROUNDS = ['always', 'when_urgent', 'never'] as const;
export const FRESHNESS_LABELS = ['fresh', 'ready', 'tired', 'spent'] as const;
export const SWAP_REJECTIONS = ['match_decided', 'no_swaps_left', 'not_active', 'not_a_reserve', 'reserve_unfit', 'duplicate'] as const;

// ---- Fighter lifecycle -------------------------------------------------------------
export const TRAIT_CATEGORIES = ['temperament', 'physique', 'style', 'mind', 'leadership', 'acquired'] as const;
export const TRAIT_KINDS = ['boon', 'edge', 'burden', 'flaw'] as const;
export const TRAIT_RARITIES = ['common', 'uncommon', 'rare', 'storied'] as const;
export const TRAIT_EFFECT_TYPES = [
  'stat', 'contextStat', 'devClock', 'declineMult', 'declineShift', 'xp', 'trainingEmphasis', 'injuryChance', 'recovery',
  'scarChance', 'retirement', 'captaincy', 'mentor', 'chemistry', 'chemistrySameRace', 'chemistryClash', 'chemistryPair',
  'chemistryImmune', 'ruleSlots', 'economy', 'combat', 'enemyComposureAura', 'shakenImmune', 'captainRally',
] as const;
export const TRAIT_COMBAT_WHEN = ['always', 'selfHpBelow', 'targetHpBelow', 'openingSeconds', 'afterSeconds', 'allyDown'] as const;
export const TRAIT_COMBAT_MODS = ['damageDealtMult', 'damageTakenMult', 'reactionDelayMult', 'composureAdd'] as const;
export const ECONOMY_HOOKS = ['fanAppeal', 'wageDemandMult', 'loyalty'] as const;
export const INJURY_SEVERITIES = ['knock', 'minor', 'moderate', 'serious'] as const;
export const injurySeverity = z.enum(INJURY_SEVERITIES);
export const TRAINING_EMPHASES = ['balanced', 'body', 'mind'] as const;
export const PACE_IDS = ['slow', 'measured', 'steady', 'brisk', 'rapid'] as const;
export const LIFECYCLE_STATUS_IDS = [
  'final_season', 'still_tender', 'at_risk', 'snubbed', 'passed_over', 'losing_the_room', 'captain_departed',
] as const;

// ---- League and economy ---------------------------------------------------------------
export const SEASON_WEEK_PHASES = ['preseason', 'regular', 'tournament'] as const;
export const TOURNAMENT_ROUNDS = ['quarterfinal', 'semifinal', 'final'] as const;
export const STANDINGS_TIEBREAKERS = [
  'points', 'matchWins', 'roundDifference', 'headToHeadPoints', 'roundsWon', 'downsDifference', 'lot',
] as const;
export const AI_PERSONALITY_IDS = ['balanced', 'thrifty', 'star_chasing', 'youth_focused', 'veteran'] as const;
export const ROUND_TIEBREAKS = ['fighters_standing', 'hp_fraction_sum', 'damage_dealt', 'first_down', 'seeded_coin'] as const;
