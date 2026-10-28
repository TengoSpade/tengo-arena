/** Small array helpers shared by the timeline modules. PURE. */

/** First index whose value is greater than `value` in an ascending array (the count of entries ≤ value). */
export function bisectRight(values: ArrayLike<number>, value: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid]! <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose value is greater than or equal to `value` in an ascending array (the count of entries < value). */
export function bisectLeft(values: ArrayLike<number>, value: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index of the last entry of `items` (ascending by `key`) with key(entry) ≤ value, or -1. */
export function lastAtOrBefore<T>(items: readonly T[], value: number, key: (item: T) => number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (key(items[mid]!) <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}
