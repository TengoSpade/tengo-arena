/**
 * Retirement (sys-development "aging, decline and retirement"; development.json retirement).
 *
 *   0 below human-age 31; 100% from 41, with a career-ending injury, or in a final season;
 *   otherwise p = 1 − (1 − h)^k from the precomputed per-race table (tables.ts), then
 *   × usage (≥ 0.75: 0.8; ≤ 0.30: 1.5) × contract (none next season: 1.5; running past
 *   this season: 0.6) × trait retirement mults, + 3 points per scar, + 5 points if
 *   average physical wear ≥ 2.4, clamped to 0-100%.
 */
import type { ContentDB } from '../content';
import type { Fighter } from '../model';
import { isCareerEnded } from './captaincy';
import { effectSources, multFactorsBp } from './effects';
import { BP, bp, truncN } from './fixed';
import { humanAge100Of } from './stats';
import { tables } from './tables';
import { scarCount } from './traits';

export interface RetirementInputs {
  /** Age held during the season. */
  age: number;
  /** Season usage in bp (development usage, min(1, xp ÷ 360)). */
  usageBp: number;
  /** The season being judged (contract end comparison). */
  season: number;
  /** GameOptions.retirement */
  enabled: boolean;
}

export function retirementChanceWith(fighter: Fighter, content: ContentDB, inputs: RetirementInputs): number {
  if (isCareerEnded(fighter)) return BP;
  if (!inputs.enabled) return 0;
  if (fighter.finalSeason) return BP;
  const dev = content.development;
  const race = content.races.require(fighter.raceId);
  const ha100 = humanAge100Of(inputs.age, race.lifespan, dev.time.humanBaselineLifespan);
  const r = dev.retirement;
  if (ha100 < r.minHumanAge * 100) return 0;
  if (ha100 >= r.forcedHumanAge * 100) return BP;
  const table = tables(content).hazardBp.get(race.id) ?? [];
  let p = table[Math.floor(ha100 / 100)] ?? 0;
  const m = r.modifiers;
  const factors: number[] = [];
  if (inputs.usageBp >= bp(m.usageHighAtLeast)) factors.push(bp(m.usageHighMult));
  else if (inputs.usageBp <= bp(m.usageLowAtMost)) factors.push(bp(m.usageLowMult));
  const contract = fighter.contract;
  factors.push(contract && contract.endSeason > inputs.season ? bp(m.contractRemainingMult) : bp(m.noContractNextSeasonMult));
  factors.push(...multFactorsBp(effectSources(fighter, content), 'retirement'));
  for (const f of factors) p = (p * f) / BP;
  let v = truncN(p);
  v += scarCount(fighter, content) * bp(m.perScarAdd);
  const t = tables(content);
  let wear = 0;
  for (const id of t.physicalIds) wear += fighter.wear100[id] ?? 0;
  if (t.physicalIds.length > 0 && wear >= t.physicalIds.length * m.heavyWearAvgPhysicalPoints * 100) v += bp(m.heavyWearAdd);
  return v < 0 ? 0 : v > BP ? BP : v;
}
