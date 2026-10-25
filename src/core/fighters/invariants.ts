/**
 * Lifecycle content invariants the shared validator does not check yet
 * (03 §6 content rules; CHANGE REQUEST to core/content): the O11 injury
 * ordering relative to humans, debut ages >= the floor, and the rolled-trait
 * positive share 78-82%. Returns human-readable issues (empty = OK).
 */
import type { ContentDB, RaceDef } from '../content';

export function lifecycleContentIssues(content: ContentDB, races: readonly RaceDef[] = content.races.list): string[] {
  const issues: string[] = [];
  const dev = content.development;
  const baseline = dev.time.humanBaselineLifespan;
  const human = races.find((r) => r.lifespan === baseline) ?? races.find((r) => r.id === 'human');
  for (const r of races) {
    if (r.debutAge.min < dev.time.debutAgeFloor) issues.push(`races.${r.id}.debutAge.min ${r.debutAge.min} is below the floor ${dev.time.debutAgeFloor}`);
    if (!human || r === human) continue;
    if (r.lifespan > human.lifespan && r.injury.chanceMult < human.injury.chanceMult) {
      issues.push(`races.${r.id}: longer-lived than humans but less injury-prone (O11)`);
    }
    if (r.lifespan < human.lifespan && r.injury.chanceMult > human.injury.chanceMult) {
      issues.push(`races.${r.id}: shorter-lived than humans but more injury-prone (O11)`);
    }
  }
  let pos = 0;
  let neg = 0;
  for (const t of content.traits.list) {
    if (t.rollWeight <= 0) continue;
    if (t.polarity === 'positive') pos += t.rollWeight;
    else neg += t.rollWeight;
  }
  const share = pos + neg > 0 ? pos / (pos + neg) : 0;
  if (share < 0.78 || share > 0.82) issues.push(`traits: roll-table positive share ${share.toFixed(4)} outside 0.78-0.82 (O5)`);
  return issues;
}
