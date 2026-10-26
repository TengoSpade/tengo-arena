/**
 * sys-development aging (M1.1: progression.md "season end (step 6) and
 * aging"). Growth is in-season level-ups (./progression.ts); the M1
 * season-end development clocks are frozen after generation, so this module
 * keeps only what aging still needs:
 *
 *   usage   = min(1, season round XP ÷ xp.seasonTarget)        (retirement modifiers; bench XP does not count)
 *   wear_i += d_g(floor(human-age) − declineShift) × k × race.declineMult_g × traitDecline_g
 *
 * with d_g the decline step table of the stat's group (Stamina is physical).
 * Mental decline reads human-age when decline.mentalDeclineScalesWithLifespan
 * (D-B: human 60, elf 90, dwarf 54, orc 48, Ashkin 39), else absolute age
 * without k. traitDevMult (devClock traits) feeds xpNeeded (./levels.ts).
 */
import type { ContentDB } from '../content';
import type { Fighter, StatId } from '../model';
import { effectSources, multFactorsBp } from './effects';
import { BP, bp, multOf, stepLookup, truncN } from './fixed';
import { fighterHumanAge100 } from './stats';
import { tables, type StatGroup } from './tables';

/** Retirement usage in bp: min(1, round XP ÷ xp.seasonTarget) (development.json retirement._usageDoc). */
export function usageBpOf(roundXp: number, content: ContentDB): number {
  const target = content.development.xp.seasonTarget;
  return roundXp >= target ? BP : truncN((roundXp * BP) / target);
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

/** Wear added this season per stat of a group, in centipoints (uses the age held during the season). */
export function seasonWear100(fighter: Fighter, content: ContentDB, group: StatGroup): number {
  const dev = content.development;
  const race = content.races.require(fighter.raceId);
  const t = tables(content);
  const ha = Math.floor(fighterHumanAge100(fighter, content) / 100);
  const scaled = group === 'physical' || dev.decline.mentalDeclineScalesWithLifespan;
  const lookup = (scaled ? ha : fighter.age) - declineShift(fighter, content, group);
  const d = stepLookup(t.decline[group], lookup);
  if (d === 0) return 0;
  const k = scaled ? dev.time.humanBaselineLifespan / race.lifespan : 1;
  const v = truncN(d * k * (bp(race.declineMult[group]) / BP) * traitDeclineMult(fighter, content, group));
  return v < 0 ? 0 : v;
}

export interface AgingDelta {
  wearPhysical: number;
  wearMental: number;
}

/** One season of decline (wear on every stat of each group; age unchanged). Wear never heals. */
export function applySeasonWear(fighter: Fighter, content: ContentDB): AgingDelta {
  const t = tables(content);
  const wearP = seasonWear100(fighter, content, 'physical');
  const wearM = seasonWear100(fighter, content, 'mental');
  const wear = { ...fighter.wear100 } as Record<StatId, number>;
  for (const id of t.statIds) wear[id] = (wear[id] ?? 0) + (t.groupOf[id] === 'physical' ? wearP : wearM);
  fighter.wear100 = wear;
  return { wearPhysical: wearP, wearMental: wearM };
}
