/**
 * levels.json (M1.1): bench XP, in-season levels and level-up offers, auto-pick and pacing, Stamina
 * generation, Freshness, AI rotation and auto-swap inputs, orchestrator hooks, the v2 -> v3 migration.
 * Owner: fighter-lifecycle designer. Spec: docs/design/_drafts/m1.1/progression.md.
 * Step tables are [key, value] pairs: the entry with the largest key <= the lookup value applies.
 * The match-squad numbers repeat combat.json match (the validator keeps them equal).
 */
import { z } from 'zod';
import { FRESHNESS_LABELS, LEVEL_UP_MODES, LEVEL_UP_PACING, archetypeId, id, int, note } from './common';

const stepTable = z.array(z.tuple([z.number(), z.number()])).min(1);
const band = z.tuple([z.number(), z.number()]);

const traitOfferEntry = z
  .object({
    id: id(),
    /** combat.json archetypes or 'captain' (club captain or vice). */
    fit: z.array(z.union([archetypeId, z.literal('captain')])),
    requires: z
      .object({ humanAgeAtMost: z.number().optional(), humanAgeAtLeast: z.number().optional(), ldrAtLeast: z.number().optional() })
      .strict()
      .optional(),
  })
  .strict();

export const LevelsFileSchema = z
  .object({
    _doc: note(),
    version: int(),
    status: z.string(),
    benchXp: z.object({ _doc: note(), shareOfStarterMean: z.number().positive().max(1), lineupSlots: int().positive() }).strict(),
    level: z.object({ _doc: note(), initialFloorShareOfCap: z.number().min(0).max(1) }).strict(),
    xpPerLevel: z
      .object({
        _doc: note(),
        base: z.number(),
        perLevel: z.number(),
        ageFactorPhysical: stepTable,
        ageFactorMental: stepTable,
        gapFactor: stepTable,
        lifespanScaling: z.boolean(),
        min: int().positive(),
        max: int().positive(),
        rounding: z.string(),
        carryOver: z.string(),
        levelUpsCheckedAt: z.string(),
        maxLevelUpsPerMatch: int().positive(),
        _maxNote: note(),
      })
      .strict(),
    offers: z
      .object({
        _doc: note(),
        optionsPerLevelUp: int().positive(),
        statGainCentipoints: int().positive(),
        weightFloor: z.number().nonnegative(),
        staminaWeightFloor: z.number().nonnegative(),
        emphasisWeight: z.object({ _doc: note(), perStrength: z.number().nonnegative() }).strict(),
        skillSlots: z
          .object({ _doc: note(), everyNthLevel: int().positive(), twoSkillsEveryNthLevel: int().positive(), fallback: z.string() })
          .strict(),
        traitOffer: z
          .object({
            _doc: note(),
            chance: z.number().min(0).max(1),
            options: int().positive(),
            secondOptionPositive: z.number().min(0).max(1),
            allowDecline: z.boolean(),
            maxRolledAndLearned: int().positive(),
            fitMult: z.object({ fits: z.number().positive(), neutral: z.number().positive() }).strict(),
          })
          .strict(),
        pending: z.object({ _doc: note(), maxQueued: int().positive() }).strict(),
      })
      .strict(),
    traitOfferPool: z.object({ _doc: note(), positive: z.array(traitOfferEntry), burdens: z.array(traitOfferEntry), _fitNote: note() }).strict(),
    autoPick: z
      .object({
        _doc: note(),
        emphasisPreference: z.object({ emphasised: z.number(), other: z.number(), balanced: z.number() }).strict(),
        staminaBonusByStamina: stepTable,
        skillDefaultValue: z.number(),
        playerModes: z.array(z.object({ id: z.enum(LEVEL_UP_MODES), label: z.string(), skillPreference: z.number().positive() }).strict()),
        playerClubDefault: z.enum(LEVEL_UP_MODES),
        aiMode: z.enum(LEVEL_UP_MODES),
      })
      .strict(),
    pacing: z
      .object({ _doc: note(), presets: z.record(z.enum(LEVEL_UP_PACING), z.string()), default: z.enum(LEVEL_UP_PACING), _defaultNote: note() })
      .strict(),
    levelEta: z
      .object({
        _doc: note(),
        /** Expected match XP before a fighter's first match of the season: hired blades (starters) and everyone else (bench). */
        defaultStarterMatchXp: z.number().positive(),
        defaultBenchMatchXp: z.number().positive(),
      })
      .strict(),
    stamina: z
      .object({
        _doc: note(),
        /** Class offset fallback by affinity group when a class lacks statEmphasis.stamina. */
        classEmphasisFallback: z.record(z.string(), z.number()),
        capOffsetPoints: z.number(),
        jitterPoints: z.number().nonnegative(),
      })
      .strict(),
    freshness: z
      .object({
        _doc: note(),
        start: z.number(),
        storageUnitsPerPoint: int().positive(),
        drainAt0: z.number(),
        drainPerStaminaPoint: z.number(),
        drainMin: z.number(),
        drainMax: z.number(),
        intensityBase: z.number(),
        intensityPerDuration: z.number(),
        intensityDurationRefS: z.number().positive(),
        intensityPerDamage: z.number(),
        intensityDowned: z.number(),
        intensityMin: z.number(),
        intensityMax: z.number(),
        youngHumanAgeBelow: z.number(),
        youngDrainMult: z.number().positive(),
        restAt0: z.number(),
        restPerStaminaPoint: z.number(),
        squadReserveRestShare: z.number().min(0).max(1),
        preseasonWeekRecovery: z.number(),
        recoveryAgeMult: stepTable,
        seasonEndReset: z.number(),
        threshold: z.number(),
        labels: z.array(z.object({ id: z.enum(FRESHNESS_LABELS), label: z.string(), min: z.number(), icon: z.string() }).strict()).min(1),
        betweenRounds: z.string(),
        withdrawn: z.string(),
        injuryMultPerPointBelow: z.number().nonnegative(),
        injuryMultMax: z.number().min(1),
        _formulas: note(),
      })
      .strict(),
    matchSquad: z
      .object({
        _doc: note(),
        starters: int().positive(),
        reserves: int().nonnegative(),
        maxSwapsPerMatch: int().nonnegative(),
        swapsBetweenRoundsOnly: z.boolean(),
        swappedOutMayReturn: z.boolean(),
      })
      .strict(),
    aiRotation: z
      .object({
        _doc: note(),
        leagueMaxRatingGap: z.number(),
        extraGapPerPointBelow: z.number(),
        projectOneRound: z.boolean(),
        tournamentRestBelow: z.number(),
        tournamentMaxRatingGap: z.number(),
        maxRestsPerMatch: int().nonnegative(),
        spentFloorAtLock: z.number(),
        spentFloorAltMin: z.number(),
      })
      .strict(),
    aiSubstitution: z
      .object({
        _doc: note(),
        /** Keys are economy.json aiPersonalities ids. */
        freshnessBelowByPersonality: z.record(id(), z.number()),
        playerAutoDefault: z.number(),
        /** Added to the threshold for the side that lost the round just played (adopted, docs/design/05 M1.1 addendum). */
        lostRoundThresholdBonus: z.number().nonnegative(),
        reserveMargin: z.number(),
        maxRatingGap: z.number(),
        keepOneForInjury: z.boolean(),
        sameRoleFamilyFirst: z.boolean(),
        freshnessBelow: z.number(),
      })
      .strict(),
    hooks: z
      .object({
        _doc: note(),
        freshnessAfterRound: z.string(),
        xpAfterRound: z.string(),
        injuriesAfterRound: z.string(),
        freshnessBetweenRounds: z.string(),
        matchEnd: z.string(),
      })
      .strict(),
    migration: z
      .object({
        _doc: note(),
        staminaPurpose: z.string().min(1),
        bloomPurpose: z.string().min(1),
        freshness: z.number(),
        carrySeasonXpIntoBar: z.boolean(),
        pendingLevelUps: int().nonnegative(),
      })
      .strict(),
    soakTargets: z
      .object({
        _doc: note(),
        starterLevelsPerSeasonByHumanAge: z.record(z.string(), band),
        matchesPerLevelMidCohort: band,
        benchLevelsToStarterLevelsRatio: band,
        aiTiredRoundStartShareMax: z.number(),
        aiSpentRoundStartShareMax: z.number(),
        starterStaminaMedian: band,
      })
      .strict(),
    /** Designer scratch-model assumptions; NOT game rules. */
    simAssumptions: z.record(z.string(), z.unknown()),
  })
  .strict();
