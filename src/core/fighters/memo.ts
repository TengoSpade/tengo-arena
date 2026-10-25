/**
 * Memoized derived values (rating, potential, the top-five mean) for the
 * engine's hot paths (05 §8: AI market planning asks for the same ratings
 * many times a week).
 *
 * Validity: every core/fighters function that can change a rating input
 * (stats, traits, statuses, injury, age, wear, new fighters) is a lifecycle
 * step (index.ts `mutating`); the epoch moves on entry and exit and nothing is
 * memoized while one runs. No other module writes rating inputs (tests/
 * architecture). Memos keyed by a Fighter object are used only inside
 * withDerivedMemo, which core/game puts around each transition; outside it
 * (views, tests editing fighters directly) every call computes afresh.
 */
let epoch = 0;
let mutationDepth = 0;
let scopeDepth = 0;

export function lifecycleEpoch(): number {
  return epoch;
}

/** Memos keyed by an indexed roster array (rebuilt whenever membership changes) are valid now. */
export function rosterMemoAllowed(): boolean {
  return mutationDepth === 0;
}

export function enterLifecycleStep(): void {
  mutationDepth++;
  epoch++;
}

export function leaveLifecycleStep(): void {
  mutationDepth--;
  epoch++;
}

/** Run `fn` (one engine transition) with fighter-keyed memos enabled. */
export function withDerivedMemo<T>(fn: () => T): T {
  scopeDepth++;
  epoch++;
  try {
    return fn();
  } finally {
    scopeDepth--;
    epoch++;
  }
}

/** One memoized number per fighter object and content DB, valid for the current epoch. */
export class FighterMemo {
  private readonly entries = new WeakMap<object, { epoch: number; content: object; value: number }>();

  get(fighter: object, content: object, compute: () => number): number {
    if (scopeDepth === 0 || mutationDepth > 0) return compute();
    const hit = this.entries.get(fighter);
    if (hit !== undefined && hit.epoch === epoch && hit.content === content) return hit.value;
    const value = compute();
    this.entries.set(fighter, { epoch, content, value });
    return value;
  }
}
