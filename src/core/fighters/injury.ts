/**
 * sys-injury: the injury ladder (P-11, O11; development.json injury).
 *
 *   p = (base + damagePerMaxHp × min(2, damageTaken ÷ maxHp) + downedAdd × [downed])
 *       × clamp(1 + (10 − tgh) × 0.05, 0.6, 1.4) × race.chanceMult × ageMult(human-age)
 *       × trait and status injuryChance multipliers (Still tender ×1.25 is a status effect)
 *       × the M1.1 Freshness multiplier min(1.4, 1 + 0.006 × (60 − F)) for a round started at F < 60, capped at 15%
 *
 * Integer basis points; the product truncates once at its end.
 */
import type { ContentDB, InjurySeverityDef } from '../content';
import type { Fighter, Injury } from '../model';
import type { Rng } from '../rng';
import { effectSources, multFactorsBp } from './effects';
import { BP, bp, roundN, stepLookup, truncN } from './fixed';
import { scarCount } from './traits';
import { freshnessInjuryMultBp, freshnessOf } from './levels';
import { effectiveStatsOf, fighterHumanAge100 } from './stats';

export type Severity = Injury['severity'];

/**
 * PROVISIONAL (OPEN, content request): the "typical round" behind the
 * lineup-screen odds (03 sys-injury player information: 55% downed, 60% of
 * max HP taken) and the typical rounds per match (development.json xp
 * _seasonTargetNote: ~2.5) are not data fields yet.
 */
export const PROVISIONAL_TYPICAL_ROUND = { downedBp: 5_500, damageRatioBp: 6_000 } as const;
export const PROVISIONAL_TYPICAL_ROUNDS_PER_MATCH_X10 = 25;

export interface RoundExposure {
  /** damage taken ÷ max HP in basis points (uncapped). */
  damageRatioBp: number;
  downed: boolean;
  /** M1.1: Freshness 0-100 at the round's start (default: the fighter's current value). */
  freshness?: number;
}

function durabilityMultBp(tgh: number, content: ContentDB): number {
  const d = content.development.injury.durability;
  const v = BP + (d.pivot - tgh) * bp(d.multPerPointBelowPivot);
  const lo = bp(d.min);
  const hi = bp(d.max);
  return v < lo ? lo : v > hi ? hi : v;
}

/** Proneness factors (bp): durability, race, age, traits and statuses, and Freshness (frs-009; default the current value). */
export function pronenessFactorsBp(fighter: Fighter, content: ContentDB, tgh?: number, freshness?: number): number[] {
  const race = content.races.require(fighter.raceId);
  const inj = content.development.injury;
  const ha = Math.floor(fighterHumanAge100(fighter, content) / 100);
  const stats = effectiveStatsOf(fighter, content) as Record<string, number>;
  const tough = tgh ?? stats[inj.durability.stat] ?? inj.durability.pivot;
  return [
    durabilityMultBp(tough, content),
    bp(race.injury.chanceMult),
    bp(stepLookup(inj.ageMultByHumanAge, ha)),
    ...multFactorsBp(effectSources(fighter, content), 'injuryChance'),
    freshnessInjuryMultBp(freshness ?? freshnessOf(fighter), content),
  ];
}

/** Proneness index (1.0 = average human of durability 10 under 30) in bp. */
export function pronenessIndexBp(fighter: Fighter, content: ContentDB): number {
  let m = BP;
  for (const f of pronenessFactorsBp(fighter, content)) m = (m * f) / BP;
  return truncN(m);
}

export function pronenessLabel(fighter: Fighter, content: ContentDB): string {
  const idx = pronenessIndexBp(fighter, content);
  const labels = content.development.injury.pronenessLabels;
  for (const l of labels) if (idx <= bp(l.maxIndex)) return l.id;
  return labels[labels.length - 1]?.id ?? 'average';
}

/** Per-round injury chance in bp for one round's exposure. */
export function roundInjuryChanceBp(fighter: Fighter, content: ContentDB, exposure: RoundExposure, tgh?: number): number {
  const pr = content.development.injury.perRound;
  const capRatio = bp(pr.damageRatioCap);
  const ratio = exposure.damageRatioBp > capRatio ? capRatio : exposure.damageRatioBp < 0 ? 0 : exposure.damageRatioBp;
  let p = bp(pr.base) + (bp(pr.damagePerMaxHp) * ratio) / BP + (exposure.downed ? bp(pr.downedAdd) : 0);
  for (const f of pronenessFactorsBp(fighter, content, tgh, exposure.freshness)) p = (p * f) / BP;
  const v = truncN(p);
  const cap = bp(pr.cap);
  return v > cap ? cap : v;
}

/** Lineup-screen odds: per-round chance for a typical round (downed 55% of the time, 60% of max HP taken). */
export function typicalRoundChanceBp(fighter: Fighter, content: ContentDB): number {
  return typicalBlend(fighter, content);
}

function typicalBlend(fighter: Fighter, content: ContentDB): number {
  // Expected chance: base + damagePerMaxHp × 0.6 + downedAdd × 0.55, then proneness.
  const pr = content.development.injury.perRound;
  let p = bp(pr.base) + (bp(pr.damagePerMaxHp) * PROVISIONAL_TYPICAL_ROUND.damageRatioBp) / BP + (bp(pr.downedAdd) * PROVISIONAL_TYPICAL_ROUND.downedBp) / BP;
  for (const f of pronenessFactorsBp(fighter, content)) p = (p * f) / BP;
  const v = truncN(p);
  const cap = bp(pr.cap);
  return v > cap ? cap : v;
}

/** At risk (career-ending possible on a serious injury): ≥ 2 scars or human-age ≥ 34. */
export function isAtRisk(fighter: Fighter, content: ContentDB): boolean {
  const ce = content.development.injury.careerEnding;
  return scarCount(fighter, content) >= ce.atRiskIf.scarsAtLeast || fighterHumanAge100(fighter, content) >= ce.atRiskIf.humanAgeAtLeast * 100;
}

/** Severity weights (bp-free integers) for one round. */
export function severityWeights(fighter: Fighter, content: ContentDB, exposure: RoundExposure): Record<Severity, number> {
  const sev = content.development.injury.severity;
  const w: Record<Severity, number> = { knock: 0, minor: 0, moderate: 0, serious: 0 };
  for (const k of Object.keys(w) as Severity[]) w[k] = bp(sev.baseWeights[k] ?? 0);
  const heavy = (!sev.heavyHit.requiresDowned || exposure.downed) && exposure.damageRatioBp >= bp(sev.heavyHit.damageRatioAtLeast);
  if (heavy) for (const [k, v] of Object.entries(sev.heavyHit.shift)) w[k as Severity] += bp(v ?? 0);
  if (fighterHumanAge100(fighter, content) >= sev.veteran.humanAgeAtLeast * 100) {
    for (const [k, v] of Object.entries(sev.veteran.shift)) w[k as Severity] += bp(v ?? 0);
  }
  for (const k of Object.keys(w) as Severity[]) if (w[k] < 0) w[k] = 0;
  return w;
}

export const SEVERITY_ORDER: readonly Severity[] = ['knock', 'minor', 'moderate', 'serious'];

export function seriousShareBp(weights: Record<Severity, number>): number {
  const total = weights.knock + weights.minor + weights.moderate + weights.serious;
  return total > 0 ? Math.trunc((weights.serious * BP) / total) : 0;
}

export function ladderOf(severity: Severity, content: ContentDB): InjurySeverityDef {
  const def = content.development.injury.severityLadder.find((s) => s.id === severity);
  if (!def) throw new RangeError(`development.json injury.severityLadder lacks ${severity}`);
  return def;
}

/** Weeks out: base weeks (uniform in the ladder range) × race recovery × age × trait recovery, rounded half up, minimum 1. */
export function weeksOutFor(fighter: Fighter, severity: Severity, baseWeeks: number, content: ContentDB): number {
  const def = ladderOf(severity, content);
  if (!def.scaleWithRecovery) return baseWeeks;
  const race = content.races.require(fighter.raceId);
  const ha = Math.floor(fighterHumanAge100(fighter, content) / 100);
  let w = baseWeeks;
  const factors = [bp(race.injury.recoveryMult), bp(stepLookup(content.development.injury.recoveryAgeMultByHumanAge, ha)), ...multFactorsBp(effectSources(fighter, content), 'recovery')];
  for (const f of factors) w = (w * f) / BP;
  const v = roundN(w);
  return v < 1 ? 1 : v;
}

export function rollWeeksOut(rng: Rng, fighter: Fighter, severity: Severity, content: ContentDB): number {
  const def = ladderOf(severity, content);
  return weeksOutFor(fighter, severity, rng.int(def.weeks.min, def.weeks.max), content);
}

/** Scar chance in bp for a severity (0 for knocks and minors). */
export function scarChanceBp(fighter: Fighter, severity: Severity, content: ContentDB): number {
  const def = ladderOf(severity, content);
  const base = bp(def.scarChance);
  if (base === 0) return 0;
  const scar = content.development.injury.scar;
  const race = content.races.require(fighter.raceId);
  let p = base;
  const factors = [
    fighterHumanAge100(fighter, content) >= scar.veteranHumanAgeAtLeast * 100 ? bp(scar.veteranMult) : BP,
    bp(race.injury.scarMult),
    ...multFactorsBp(effectSources(fighter, content), 'scarChance'),
  ];
  for (const f of factors) p = (p * f) / BP;
  return truncN(p);
}

/**
 * Conditional career-ending chance given a serious injury of an At-risk
 * fighter, so the unconditional per-match chance never exceeds
 * careerEnding.maxChancePerMatch: min(chance, cap ÷ P(serious this match)).
 */
export function careerEndingGivenSeriousBp(seriousThisMatchBp: number, content: ContentDB): number {
  const ce = content.development.injury.careerEnding;
  const chance = bp(ce.chanceGivenSeriousAndAtRisk);
  if (seriousThisMatchBp <= 0) return chance;
  const capped = Math.trunc((bp(ce.maxChancePerMatch) * BP) / seriousThisMatchBp);
  return capped < chance ? capped : chance;
}

/** Lineup-screen career-ending odds per match for an At-risk fighter (0 otherwise), in bp. */
export function careerEndingChancePerMatchBp(fighter: Fighter, content: ContentDB): number {
  if (!isAtRisk(fighter, content)) return 0;
  const exposure: RoundExposure = { damageRatioBp: PROVISIONAL_TYPICAL_ROUND.damageRatioBp, downed: false };
  const perRound = typicalBlend(fighter, content);
  const share = seriousShareBp(severityWeights(fighter, content, exposure));
  const seriousMatch = truncN((perRound * share * PROVISIONAL_TYPICAL_ROUNDS_PER_MATCH_X10) / (BP * 10));
  return truncN((seriousMatch * careerEndingGivenSeriousBp(seriousMatch, content)) / BP);
}
