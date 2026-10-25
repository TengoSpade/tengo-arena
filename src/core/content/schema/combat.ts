/**
 * combat.json: shared fight constants, stat and archetype definitions, the
 * status catalog and the trait-effect adapter. Owner: combat designer.
 * Spec: docs/design/_drafts/03-combat.md (sys-combat-stats, sys-fight-sim,
 * sys-abilities, sys-fight-captain). Structure generated from the content and
 * curated by hand; units by key suffix (see ../units.ts).
 */
import { z } from 'zod';
import {
  ROUND_TIEBREAKS,
  STAT_GROUPS,
  affinityGroup,
  archetypeId,
  band,
  hybridPairId,
  id,
  roleFamily,
  statId,
  statModStat,
  statusCategory,
  statusId,
} from './common';

export const CombatFileSchema = z.object({
  _doc: z.string().optional(),
  schemaVersion: z.number(),
  simVersion: z.string(),
  status: z.string(),
  attributeScale: z.object({
    min: z.number(),
    max: z.number(),
    average: z.number(),
    integer: z.boolean(),
  }).strict(),
  attributes: z.array(z.object({
    id: statId,
    name: z.string(),
    abbr: z.string(),
    group: z.enum(STAT_GROUPS),
    lifecycleTag: z.string().nullable(),
    description: z.string(),
    usedFor: z.array(z.string()),
  }).strict()),
  archetypes: z.array(z.object({
    id: archetypeId,
    name: z.string(),
    shortName: z.string(),
    iconId: z.string(),
    description: z.string(),
  }).strict()),
  hybridPairs: z.array(z.object({
    id: hybridPairId,
    name: z.string(),
    families: z.array(roleFamily).length(2),
  }).strict()),
  affinityGroups: z.array(affinityGroup),
  tick: z.object({
    ticksPerSecond: z.number(),
    tickMs: z.number(),
  }).strict(),
  arena: z.object({
    id: id(),
    widthM: z.number(),
    heightM: z.number(),
    origin: z.string(),
    xAxis: z.string(),
    yAxis: z.string(),
    fighterRadiusM: z.number(),
    spawn: z.object({
      home: z.object({
        frontXM: z.number(),
        backXM: z.number(),
      }).strict(),
      away: z.object({
        frontXM: z.number(),
        backXM: z.number(),
      }).strict(),
      laneCenterYM: z.number(),
      laneSpacingM: z.number(),
      maxPerRow: z.number(),
    }).strict(),
  }).strict(),
  bands: z.array(z.object({
    id: band,
    name: z.string(),
    maxGapM: z.number(),
  }).strict()),
  derived: z.object({
    _doc: z.string().optional(),
    maxHp: z.object({
      perTgh: z.number(),
      perStr: z.number(),
      minFactor: z.number(),
    }).strict(),
    armor: z.object({
      perTgh: z.number(),
    }).strict(),
    ward: z.object({
      perWil: z.number(),
    }).strict(),
    moveSpeed: z.object({
      perPac: z.number(),
    }).strict(),
    attackSpeed: z.object({
      perAgi: z.number(),
      minIntervalS: z.number(),
    }).strict(),
    power: z.object({
      perWeightedPoint: z.number(),
    }).strict(),
    support: z.object({
      perWeightedPoint: z.number(),
    }).strict(),
    crit: z.object({
      base: z.number(),
      perPre: z.number(),
      max: z.number(),
      multiplier: z.number(),
    }).strict(),
    evade: z.object({
      perAgiAbove10: z.number(),
      max: z.number(),
    }).strict(),
    tenacity: z.object({
      perCmp: z.number(),
      min: z.number(),
      max: z.number(),
    }).strict(),
    resolve: z.object({
      perWil: z.number(),
      min: z.number(),
      max: z.number(),
    }).strict(),
    focus: z.object({
      max: z.number(),
      startFull: z.boolean(),
      regenPerSec: z.number(),
      regenPerDis: z.number(),
    }).strict(),
    reaction: z.object({
      baseS: z.number(),
      perAwrS: z.number(),
      perCmpS: z.number(),
      minS: z.number(),
      maxS: z.number(),
      pressureHpBelow: z.number(),
      pressureMaxS: z.number(),
      jitterTicksMax: z.number(),
    }).strict(),
    composureInFight: z.object({
      min: z.number(),
      max: z.number(),
    }).strict(),
    speedMultClamp: z.tuple([z.number(), z.number()]),
    damageDealtClamp: z.tuple([z.number(), z.number()]),
    damageTakenClamp: z.tuple([z.number(), z.number()]),
    healingReceivedClamp: z.tuple([z.number(), z.number()]),
    traitModCaps: z.object({
      fractionPerStat: z.number(),
      composurePoints: z.number(),
    }).strict(),
  }).strict(),
  combatModsDefaults: z.object({
    _doc: z.string().optional(),
    hpMult: z.number(),
    armorFlat: z.number(),
    wardFlat: z.number(),
    moveSpeedMult: z.number(),
    tenacityFlat: z.number(),
  }).strict(),
  timing: z.object({
    decisionIntervalTicks: z.number(),
    basicWindupFraction: z.object({
      melee: z.number(),
      ranged: z.number(),
    }).strict(),
    rangeLeewayM: z.number(),
    openingStaggerTicksMax: z.number(),
    triggeredEffectsDelayTicks: z.number(),
    regenTickIntervalS: z.number(),
    auraRecalcTicks: z.number(),
    castingTelegraphMinS: z.number(),
  }).strict(),
  movement: z.object({
    approachInsetM: z.number(),
    separationPasses: z.number(),
    dashSpeedMps: z.number(),
    leapSpeedMps: z.number(),
    displaceSpeedMps: z.number(),
    sidestep: z.object({
      lookAheadM: z.number(),
      corridorM: z.number(),
      weight: z.number(),
    }).strict(),
    cautiousMinGapFraction: z.number(),
    cautiousMinGapFloorM: z.number(),
    protectOffsetM: z.number(),
    regroupGapM: z.number(),
    steadyLeadAllowanceM: z.number(),
    stickiness: z.object({
      gapM: z.number(),
      hpPct: z.number(),
    }).strict(),
  }).strict(),
  damage: z.object({
    variance: z.number(),
    minDamage: z.number(),
    mitigationConstant: z.number(),
    thornsMaxAttackerGapM: z.number(),
    riposteMaxAttackerGapM: z.number(),
    downCreditWindowS: z.number(),
    assistWindowS: z.number(),
    recentDamageWindowMaxS: z.number(),
  }).strict(),
  shields: z.object({
    maxTotalPctOfMaxHp: z.number(),
    consumeOrder: z.string(),
  }).strict(),
  cc: z.object({
    drCategories: z.array(z.enum(['control', 'displace'])),
    drWindowS: z.number(),
    drSteps: z.array(z.number()),
    maxHardDurationS: z.number(),
    minAppliedDurationS: z.number(),
    onePerAbilityCast: z.boolean(),
  }).strict(),
  overtime: z.object({
    startS: z.number(),
    hardCapS: z.number(),
    stepS: z.number(),
    damagePerStep: z.number(),
    healingPerStep: z.number(),
    healingFloor: z.number(),
  }).strict(),
  roundEnd: z.object({
    _doc: z.string().optional(),
    tiebreaks: z.array(z.enum(ROUND_TIEBREAKS)).min(1),
  }).strict(),
  match: z.object({
    formats: z.object({
      regular: z.object({
        bestOf: z.number(),
      }).strict(),
      final: z.object({
        bestOf: z.number(),
      }).strict(),
    }).strict(),
    resetBetweenRounds: z.array(z.string()),
  }).strict(),
  captain: z.object({
    _doc: z.string().optional(),
    gradeSource: z.string(),
    aura: z.object({
      stat: z.string(),
      from: z.string(),
      scope: z.string(),
    }).strict(),
    rally: z.object({
      from: z.string(),
      durationS: z.number(),
      usesPerRound: z.number(),
      suppressesAllyDownPenalties: z.boolean(),
      trigger: z.string(),
    }).strict(),
    down: z.object({
      shakenComposure: z.number(),
      shakenDurationS: z.number(),
      handover: z.string(),
    }).strict(),
    effectCap: z.number(),
    defaultCq: z.number(),
  }).strict(),
  traitEffectAdapter: z.object({
    _doc: z.string().optional(),
    when: z.object({
      always: z.null(),
      selfHpBelow: z.object({
        p: z.string(),
        param: z.string(),
        from: z.string(),
        scale: z.number(),
      }).strict(),
      targetHpBelow: z.object({
        p: z.string(),
        param: z.string(),
        from: z.string(),
        scale: z.number(),
      }).strict(),
      openingSeconds: z.object({
        p: z.string(),
        param: z.string(),
        from: z.string(),
        scale: z.number(),
      }).strict(),
      afterSeconds: z.object({
        p: z.string(),
        param: z.string(),
        from: z.string(),
        scale: z.number(),
      }).strict(),
      allyDown: z.object({
        p: z.string(),
        param: z.string(),
        from: z.string(),
        scale: z.number(),
      }).strict(),
    }).strict(),
    mods: z.object({
      damageDealtMult: z.object({
        stat: z.string(),
        transform: z.string(),
      }).strict(),
      damageTakenMult: z.object({
        stat: z.string(),
        transform: z.string(),
      }).strict(),
      reactionDelayMult: z.object({
        stat: z.string(),
        transform: z.string(),
      }).strict(),
      composureAdd: z.object({
        stat: z.string(),
        transform: z.string(),
      }).strict(),
    }).strict(),
    otherTypes: z.object({
      enemyComposureAura: z.string(),
      shakenImmune: z.string(),
      captainRally: z.string(),
    }).strict(),
  }).strict(),
  randomness: z.object({
    _doc: z.string().optional(),
    streams: z.array(z.object({
      path: z.array(z.string()),
      use: z.string(),
    }).strict()),
  }).strict(),
  coneHalfAngleCos: z.object({
    "60": z.number(),
    "90": z.number(),
    "120": z.number(),
    "180": z.number(),
  }).strict(),
  events: z.object({
    frameEveryTicks: z.number(),
    positionUnit: z.string(),
    recordLevels: z.array(z.enum(['none', 'summary', 'full'])),
  }).strict(),
  statuses: z.array(z.object({
    id: statusId,
    name: z.string(),
    category: statusCategory,
    polarity: z.enum(['buff', 'debuff']),
    dr: z.enum(['control', 'displace']).nullable(),
    stacking: z.enum(['refresh', 'latest', 'strongest', 'stacks']),
    stat: statModStat.nullable(),
    cap: z.number().nullable(),
    blocks: z.array(z.enum(['move', 'attack', 'ability', 'rules'])).optional(),
    interrupts: z.boolean().optional(),
    iconId: z.string(),
    description: z.string(),
    breakOnDamagePct: z.number().optional(),
    sign: z.number().optional(),
  }).strict()),
  statusCategories: z.array(z.object({
    id: statusCategory,
    name: z.string(),
  }).strict()),
  statModStats: z.array(z.object({
    id: statModStat,
    kind: z.enum(['fraction', 'flat', 'chance', 'points', 'fraction_per_s', 'hp_per_s', 'flag']),
  }).strict()),
}).strict();
