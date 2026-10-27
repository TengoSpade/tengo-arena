/**
 * sys-freshness (progression.md; levels.json freshness): the 0-100 meter,
 * stored in tenths (Fighter.freshness10, 0-1000).
 *
 *   base      = clamp(drainAt0 + drainPerStaminaPoint × STA, drainMin, drainMax)
 *   intensity = clamp(0.55 + 0.25 × min(2, duration ÷ 30 s) + 0.20 × min(2, damage ÷ maxHp) + 0.12 × [downed], 0.6, 1.5)
 *   drain     = round(base × intensity × (1.1 under human-age 21) × perk freshnessDrainMult × tiredDrainShare at the round's start × 10)   tenths per round played
 *   rest      = round((restAt0 + restPerStaminaPoint × STA) × recoveryAgeMult(human-age) × (0.8 unused squad reserve) × 10)
 *
 * STA is the effective Stamina at that moment. Every formula rounds once at
 * its end (./fixed.ts). Perk lifecycle effects (perks.json lifecycleEffects):
 * Campaign Legs drain × 0.85, Second Breath +8 between rounds, Banner Voice
 * +5 captaincy (read by ./captaincy.ts).
 */
import type { ContentDB, PerkDef } from '../content';
import { FRESHNESS10_MAX, type Fighter, type StatId } from '../model';
import { roundN, stepLookup } from './fixed';
import { effectiveStatsOf, fighterHumanAge100 } from './stats';

export const STAMINA_STAT = 'stamina' as StatId;

function heldPerks(fighter: Fighter, content: ContentDB): PerkDef[] {
  const out: PerkDef[] = [];
  for (const id of fighter.perkIds ?? []) {
    const p = content.perks.get(id);
    if (p) out.push(p);
  }
  return out;
}

/** Product of the held perks' freshnessDrainMult (1 without). */
export function perkDrainMult(fighter: Fighter, content: ContentDB): number {
  let m = 1;
  for (const p of heldPerks(fighter, content)) for (const e of p.lifecycleEffects) if (e.type === 'freshnessDrainMult') m *= e.mult;
  return m;
}

/** Sum of the held perks' freshnessBetweenRounds gains, in tenths (Second Breath +8 -> 80). */
export function perkBetweenRoundsGain10(fighter: Fighter, content: ContentDB): number {
  let add = 0;
  for (const p of heldPerks(fighter, content)) for (const e of p.lifecycleEffects) if (e.type === 'freshnessBetweenRounds') add += e.add;
  return roundN(add * content.levels.freshness.storageUnitsPerPoint);
}

/** Sum of the held perks' captaincy adds (Banner Voice +5). */
export function perkCaptaincyAdd(fighter: Fighter, content: ContentDB): number {
  let add = 0;
  for (const p of heldPerks(fighter, content)) for (const e of p.lifecycleEffects) if (e.type === 'captaincy') add += e.add;
  return roundN(add);
}

/** Effective Stamina 1-20 now. */
export function staminaOf(fighter: Fighter, content: ContentDB): number {
  return (effectiveStatsOf(fighter, content) as Record<string, number>)[STAMINA_STAT] ?? 10;
}

/** Drain of a typical round per Stamina point (points, float): clamp(drainAt0 + drainPerStaminaPoint × STA, drainMin, drainMax). */
export function drainBase(stamina: number, content: ContentDB): number {
  const fr = content.levels.freshness;
  const v = fr.drainAt0 + fr.drainPerStaminaPoint * stamina;
  return v < fr.drainMin ? fr.drainMin : v > fr.drainMax ? fr.drainMax : v;
}

export interface RoundLoad {
  durationS: number;
  damageTaken: number;
  maxHp: number;
  downed: boolean;
}

/** Round intensity 0.6-1.5 (a typical round of 30 s, 60% of max HP, downed 55% of the time is about 1.0). */
export function roundIntensity(load: RoundLoad, content: ContentDB): number {
  const fr = content.levels.freshness;
  const dur = Math.min(2, load.durationS / fr.intensityDurationRefS);
  const dmg = load.maxHp > 0 ? Math.min(2, load.damageTaken / load.maxHp) : 0;
  const v = fr.intensityBase + fr.intensityPerDuration * dur + fr.intensityPerDamage * dmg + (load.downed ? fr.intensityDowned : 0);
  return v < fr.intensityMin ? fr.intensityMin : v > fr.intensityMax ? fr.intensityMax : v;
}

function drainMults(fighter: Fighter, content: ContentDB): number {
  const fr = content.levels.freshness;
  const young = fighterHumanAge100(fighter, content) < fr.youngHumanAgeBelow * 100 ? fr.youngDrainMult : 1;
  return young * perkDrainMult(fighter, content);
}

/**
 * Share of a round's drain a fighter pays when the round starts at `freshness10` (tenths): levels.json
 * freshness.tiredDrainShare below the threshold (a Tired fighter paces himself), 1 from the threshold up
 * (so the rounds-until-Tired calibration is untouched) and when the constant is absent.
 */
export function drainShareAt(freshness10: number, content: ContentDB): number {
  const fr = content.levels.freshness;
  return freshness10 < fr.threshold * fr.storageUnitsPerPoint ? (fr.tiredDrainShare ?? 1) : 1;
}

/**
 * Drain of one round played, tenths (frs-001: STA 16, 30 s, 60%, not downed -> 39). Reads the fighter's Freshness
 * as the round's start value, so call it before the drain is applied (freshnessAfterRound does).
 */
export function roundDrain10(fighter: Fighter, load: RoundLoad, content: ContentDB): number {
  const fr = content.levels.freshness;
  return roundN(
    drainBase(staminaOf(fighter, content), content) *
      roundIntensity(load, content) *
      drainMults(fighter, content) *
      drainShareAt(freshness10Of(fighter), content) *
      fr.storageUnitsPerPoint,
  );
}

/** Drain of a typical round (intensity 1.0), tenths: UI forecasts and the AI rotation. */
export function typicalDrain10(fighter: Fighter, content: ContentDB): number {
  const fr = content.levels.freshness;
  return roundN(drainBase(staminaOf(fighter, content), content) * drainMults(fighter, content) * fr.storageUnitsPerPoint);
}

function recoveryAgeMult(fighter: Fighter, content: ContentDB): number {
  return stepLookup(content.levels.freshness.recoveryAgeMult, Math.floor(fighterHumanAge100(fighter, content) / 100));
}

/** Weekly rest gain in tenths (frs-005: STA 16 human 26 -> 460; STA 6 human 34 -> 306; as a squad reserve -> 245). */
export function rest10(fighter: Fighter, content: ContentDB, wasSquadReserve: boolean): number {
  const fr = content.levels.freshness;
  const share = wasSquadReserve ? fr.squadReserveRestShare : 1;
  return roundN((fr.restAt0 + fr.restPerStaminaPoint * staminaOf(fighter, content)) * recoveryAgeMult(fighter, content) * share * fr.storageUnitsPerPoint);
}

/** Preseason week recovery in tenths (+50 × age multiplier). */
export function preseasonRest10(fighter: Fighter, content: ContentDB): number {
  const fr = content.levels.freshness;
  return roundN(fr.preseasonWeekRecovery * recoveryAgeMult(fighter, content) * fr.storageUnitsPerPoint);
}

/** Set Freshness (tenths), clamped 0-1000. */
export function setFreshness10(fighter: Fighter, value: number): void {
  fighter.freshness10 = value < 0 ? 0 : value > FRESHNESS10_MAX ? FRESHNESS10_MAX : Math.trunc(value);
}

export function freshness10Of(fighter: Pick<Fighter, 'freshness10'>): number {
  const v = fighter.freshness10;
  if (typeof v !== 'number') return FRESHNESS10_MAX;
  return v < 0 ? 0 : v > FRESHNESS10_MAX ? FRESHNESS10_MAX : v;
}
