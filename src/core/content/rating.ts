import type { ContentDB } from './db';
import { fractionToBp } from './units';

const BP = 10_000;
const weightCache = new WeakMap<ContentDB, Map<string, readonly (readonly [string, number])[]>>();

function weightsBp(content: ContentDB, classId: string): readonly (readonly [string, number])[] {
  let byClass = weightCache.get(content);
  if (!byClass) weightCache.set(content, (byClass = new Map()));
  let w = byClass.get(classId);
  if (!w) {
    const k = content.classes.require(classId);
    w = Object.entries(k.ratingWeights as Record<string, number>).map(([id, f]) => [id, fractionToBp(f)] as const);
    byClass.set(classId, w);
  }
  return w;
}

/**
 * The one rating formula (D-Q, sys-combat-stats; displayed = used):
 * rating = clamp(round(5 × Σ wᵢ × statᵢ), ratingMin, ratingMax) on the integer
 * effective stats (1-20) a fight receives, wᵢ = classes.json ratingWeights,
 * rounded half away from zero in integer basis points. Fighter ratings and
 * potentials (core/fighters) and combat's OVR (fight inputs, the balance
 * harness) all call this function.
 */
export function combatRating(content: ContentDB, classId: string, stats: Readonly<Record<string, number>>): number {
  let sum = 0;
  for (const [id, w] of weightsBp(content, classId)) sum += w * (stats[id] ?? 0);
  const r = sum >= 0 ? Math.floor((5 * sum + BP / 2) / BP) : -Math.floor((-5 * sum + BP / 2) / BP);
  const { ratingMin, ratingMax } = content.development.scale;
  return r < ratingMin ? ratingMin : r > ratingMax ? ratingMax : r;
}
