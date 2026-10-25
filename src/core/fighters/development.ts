/**
 * sys-development: season-end growth and decline (03 §3.2; D-A, D-B).
 *
 *   usage   = usageFloor + (1 − usageFloor) × min(1, seasonXp ÷ 360)       (floor 0 under D-A)
 *   ΔD_g    = min(2.5, k × pace × usage × growth_g × emphasis_g × traitDev_g(human-age) × mentor)
 *   D_g     = max(D_g, min(D_g + ΔD_g, human-age + 4))
 *   wear_i += d_g(floor(human-age) − declineShift) × k × race.declineMult_g × traitDecline_g × emphasisWear
 *
 * Emphasis (D-A): physical = 1 + a × (bonus × fBody − penalty × fMind), mental the mirror;
 * with bonus = penalty the two always sum to 2 (growth is routed, never added).
 * Mental decline reads human-age when decline.mentalDeclineScalesWithLifespan (D-B: human 60,
 * elf 90, dwarf 54, orc 48, Ashkin 39), else absolute age without k.
 * Everything here is deterministic; trait rolls at season end use STREAM.traits.
 */
import type { ContentDB } from '../content';
import type { Fighter, StatId } from '../model';
import { effectSources, multFactorsBp } from './effects';
import { BP, bp, multOf, stepLookup, truncN } from './fixed';
import { fighterHumanAge100 } from './stats';
import { tables, type StatGroup } from './tables';

export interface DevelopmentInputs {
  seasonXp: number;
  /** Mentor multiplier (≤ totalMentorMultCap), 1 when not young or without club. */
  mentor: number;
  /** Weeks under each emphasis this season. */
  emphasisWeeks: { balanced: number; body: number; mind: number };
  /** training.enabled && GameOptions.trainingEmphasis */
  trainingEnabled: boolean;
}

export interface DevelopmentDelta {
  usageBp: number;
  dPhysical: number;
  dMental: number;
  wearPhysical: number;
  wearMental: number;
  emphasisPhysical: number;
  emphasisMental: number;
}

export function usageBpOf(seasonXp: number, content: ContentDB): number {
  const clock = content.development.developmentClock;
  const floorBp = bp(clock.usageFloor);
  const target = content.development.xp.seasonTarget;
  const share = seasonXp >= target ? BP : truncN((seasonXp * BP) / target);
  return floorBp + truncN(((BP - floorBp) * share) / BP);
}

/** Emphasis multipliers (floats) for a season. */
export function emphasisMults(fighter: Fighter, content: ContentDB, weeks: DevelopmentInputs['emphasisWeeks'], enabled: boolean): { physical: number; mental: number; wear: number } {
  if (!enabled) return { physical: 1, mental: 1, wear: 1 };
  const tr = content.development.training;
  const total = tables(content).weeksPerSeason;
  if (total <= 0) return { physical: 1, mental: 1, wear: 1 };
  let a = multOf(multFactorsBp(effectSources(fighter, content), 'trainingEmphasis'));
  if (a < 0) a = 0;
  if (a > 2) a = 2;
  const fBody = weeks.body / total;
  const fMind = weeks.mind / total;
  const bonus = bp(tr.emphasisBonus) / BP;
  const penalty = bp(tr.offEmphasisPenalty) / BP;
  return {
    physical: 1 + a * (bonus * fBody - penalty * fMind),
    mental: 1 + a * (bonus * fMind - penalty * fBody),
    wear: 1 - a * (bp(tr.bodyWearReduction) / BP) * fBody,
  };
}

/** Product of devClock trait multipliers for a group at a human-age (min inclusive, max exclusive). */
export function traitDevMult(fighter: Fighter, content: ContentDB, group: StatGroup, humanAge100: number): number {
  const factors = multFactorsBp(effectSources(fighter, content), 'devClock', (e) => {
    if (e.type !== 'devClock') return false;
    if (e.group !== 'all' && e.group !== group) return false;
    if (e.humanAgeMin !== undefined && humanAge100 < e.humanAgeMin * 100) return false;
    if (e.humanAgeMax !== undefined && humanAge100 >= e.humanAgeMax * 100) return false;
    return true;
  });
  return multOf(factors);
}

function declineShift(fighter: Fighter, content: ContentDB, group: StatGroup): number {
  let shift = 0;
  for (const s of effectSources(fighter, content)) {
    for (const e of s.effects) if (e.type === 'declineShift' && (e.group === 'all' || e.group === group)) shift += e.humanYears;
  }
  return shift;
}

function traitDeclineMult(fighter: Fighter, content: ContentDB, group: StatGroup): number {
  return multOf(multFactorsBp(effectSources(fighter, content), 'declineMult', (e) => e.type === 'declineMult' && (e.group === 'all' || e.group === group)));
}

/** ΔD in hundredths of a human-year for a group (before the human-age + 4 cap). */
export function clockDelta100(fighter: Fighter, content: ContentDB, group: StatGroup, inputs: DevelopmentInputs): number {
  const dev = content.development;
  const race = content.races.require(fighter.raceId);
  const pace = dev.pace.levels.find((l) => l.id === fighter.paceId);
  const usage = usageBpOf(inputs.seasonXp, content) / BP;
  if (usage === 0) return 0;
  const ha100 = fighterHumanAge100(fighter, content);
  const emph = emphasisMults(fighter, content, inputs.emphasisWeeks, inputs.trainingEnabled);
  const k = dev.time.humanBaselineLifespan / race.lifespan;
  const raw =
    100 *
    k *
    (bp(pace?.mult ?? 1) / BP) *
    usage *
    (bp(race.growthMult[group]) / BP) *
    (group === 'physical' ? emph.physical : emph.mental) *
    traitDevMult(fighter, content, group, ha100) *
    inputs.mentor;
  const cap = Math.round(dev.developmentClock.maxDeltaPerSeason * 100);
  const v = truncN(raw);
  return v > cap ? cap : v < 0 ? 0 : v;
}

/** Wear added this season per stat of a group, in centipoints. */
export function seasonWear100(fighter: Fighter, content: ContentDB, group: StatGroup, inputs: DevelopmentInputs): number {
  const dev = content.development;
  const race = content.races.require(fighter.raceId);
  const t = tables(content);
  const ha = Math.floor(fighterHumanAge100(fighter, content) / 100);
  const scaled = group === 'physical' || dev.decline.mentalDeclineScalesWithLifespan;
  const lookup = (scaled ? ha : fighter.age) - declineShift(fighter, content, group);
  const d = stepLookup(t.decline[group], lookup);
  if (d === 0) return 0;
  const k = scaled ? dev.time.humanBaselineLifespan / race.lifespan : 1;
  const emph = emphasisMults(fighter, content, inputs.emphasisWeeks, inputs.trainingEnabled);
  const raw = d * k * (bp(race.declineMult[group]) / BP) * traitDeclineMult(fighter, content, group) * (group === 'physical' ? emph.wear : 1);
  const v = truncN(raw);
  return v < 0 ? 0 : v;
}

/** Apply one season of development and decline to a fighter (age unchanged). Pure apart from mutating `fighter`. */
export function developSeason(fighter: Fighter, content: ContentDB, inputs: DevelopmentInputs): DevelopmentDelta {
  const t = tables(content);
  const ha100 = fighterHumanAge100(fighter, content);
  const ahead = Math.round(content.development.developmentClock.maxAheadOfHumanAge * 100);
  const capD = ha100 + ahead;
  const advance = (current: number, delta: number): number => {
    const next = current + delta;
    if (next <= capD) return next;
    return current > capD ? current : capD;
  };
  const before = { physical: fighter.dev100.physical, mental: fighter.dev100.mental };
  fighter.dev100 = {
    physical: advance(before.physical, clockDelta100(fighter, content, 'physical', inputs)),
    mental: advance(before.mental, clockDelta100(fighter, content, 'mental', inputs)),
  };
  // Wear uses the traits and age held during the season (computed on the pre-change state is identical: wear does not read clocks).
  const wearP = seasonWear100(fighter, content, 'physical', inputs);
  const wearM = seasonWear100(fighter, content, 'mental', inputs);
  const wear = { ...fighter.wear100 } as Record<StatId, number>;
  for (const id of t.statIds) wear[id] = (wear[id] ?? 0) + (t.groupOf[id] === 'physical' ? wearP : wearM);
  fighter.wear100 = wear;
  const emph = emphasisMults(fighter, content, inputs.emphasisWeeks, inputs.trainingEnabled);
  return {
    usageBp: usageBpOf(inputs.seasonXp, content),
    dPhysical: fighter.dev100.physical - before.physical,
    dMental: fighter.dev100.mental - before.mental,
    wearPhysical: wearP,
    wearMental: wearM,
    emphasisPhysical: emph.physical,
    emphasisMental: emph.mental,
  };
}
