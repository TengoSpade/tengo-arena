/**
 * Gain and loss of storied traits (sys-traits "Gain and loss"). Generic over
 * traits.json `gain` / `loss` blocks:
 *   - gain.rule 'threshold': every listed condition must hold (careerRoundsAtLeast,
 *     humanAgeAtLeast, proSeasonsAtLeast, matchweeksAsClubCaptainAtLeast), checked at gain.checkedAt;
 *   - loss.rule 'threshold': careerRoundsAtLeast reached (Green Nerves fades), at loss.checkedAt;
 *   - loss.rule 'onGainTrait': chance when the named trait is gained (Skittish, Glory-Hungry);
 *   - loss.rule 'seasonEndChance': rolled by core/fighters development with the trait's
 *     condition (humanAgeAtLeast, or the captain / emphasis requirement).
 * Event gains (Title-Tested, Back from the Brink, Pain-Tempered, scars) are keyed on
 * the trait id by their callers (structural content request 3 in 05 §4).
 */
import type { ContentDB, TraitDef } from '../content';
import type { Fighter, FighterTrait } from '../model';
import { Rng, STREAM } from '../rng';
import { bp } from './fixed';
import { fighterHumanAge100 } from './stats';
import { addAcquiredTrait, removeTrait } from './traits';

export interface TraitChange {
  traitId: string;
  change: 'gained' | 'lost' | 'skipped';
}

export type CheckPoint = 'seasonEnd' | 'weekProcessing' | 'matchEnd';

/**
 * Gain a trait and resolve onGainTrait losses it triggers. `root` + `season`
 * key the loss rolls on the traits stream (fighter id, trait ids).
 */
export function gainTrait(
  fighter: Fighter,
  traitId: string,
  source: FighterTrait['source'],
  season: number,
  content: ContentDB,
  root: string,
): TraitChange[] {
  if (fighter.traits.some((t) => t.id === traitId)) return [];
  if (!addAcquiredTrait(fighter, traitId, source, season, content)) return [{ traitId, change: 'skipped' }];
  const changes: TraitChange[] = [{ traitId, change: 'gained' }];
  for (const held of fighter.traits.slice()) {
    const def = content.traits.get(held.id);
    if (!def?.loss || def.loss.rule !== 'onGainTrait' || def.loss.trait !== traitId) continue;
    const rng = Rng.create(root, STREAM.traits, season, fighter.id, 'loss-on-gain', def.id);
    if (rng.chanceBp(bp(def.loss.chance)) && removeTrait(fighter, def.id, content)) changes.push({ traitId: def.id, change: 'lost' });
  }
  return changes;
}

function thresholdMet(def: TraitDef, fighter: Fighter, content: ContentDB): boolean {
  const g = def.gain;
  if (!g || g.rule !== 'threshold') return false;
  if (g.careerRoundsAtLeast !== undefined && fighter.career.roundsStarted < g.careerRoundsAtLeast) return false;
  if (g.proSeasonsAtLeast !== undefined && fighter.career.proSeasons < g.proSeasonsAtLeast) return false;
  if (g.matchweeksAsClubCaptainAtLeast !== undefined && fighter.career.matchweeksAsClubCaptain < g.matchweeksAsClubCaptainAtLeast) return false;
  if (g.humanAgeAtLeast !== undefined && fighterHumanAge100(fighter, content) < g.humanAgeAtLeast * 100) return false;
  return true;
}

/**
 * Threshold gains and threshold losses due at a check point (`null` = all,
 * used once at generation for veteran history).
 */
export function checkThresholds(fighter: Fighter, at: CheckPoint | null, season: number, content: ContentDB, root: string): TraitChange[] {
  const changes: TraitChange[] = [];
  for (const def of content.traits.list) {
    if (def.gain?.rule === 'threshold' && (at === null || def.gain.checkedAt === at) && thresholdMet(def, fighter, content)) {
      if (!fighter.traits.some((t) => t.id === def.id)) changes.push(...gainTrait(fighter, def.id, 'event', season, content, root));
    }
  }
  for (const held of fighter.traits.slice()) {
    const def = content.traits.get(held.id);
    const loss = def?.loss;
    if (!def || !loss || loss.rule !== 'threshold') continue;
    if (at !== null && (loss.checkedAt ?? 'seasonEnd') !== at) continue;
    if (loss.careerRoundsAtLeast !== undefined && fighter.career.roundsStarted >= loss.careerRoundsAtLeast) {
      if (removeTrait(fighter, def.id, content)) changes.push({ traitId: def.id, change: 'lost' });
    }
  }
  return changes;
}

/** Scar pick among scars the fighter lacks (development.json injury.scar.poolWeights). Null if the pool is exhausted. */
export function pickScar(rng: Rng, fighter: Fighter, content: ContentDB): string | null {
  const scar = content.development.injury.scar;
  const pool = scar.pool.filter((id) => !fighter.traits.some((t) => t.id === id));
  if (pool.length === 0) return null;
  const weights = pool.map((id) => bp(scar.poolWeights[id] ?? 0));
  if (!weights.some((w) => w > 0)) return null;
  return pool[rng.weightedIndex(weights)] ?? null;
}
