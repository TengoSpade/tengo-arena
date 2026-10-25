/**
 * Deterministic comparators. Core sorting must use a total order with an id
 * tie-break, and must never use localeCompare/Intl (locale-dependent).
 */

/** Compare strings by UTF-16 code units (locale-independent). */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareNumbers(a: number, b: number): number {
  return a - b;
}

export type Comparator<T> = (a: T, b: T) => number;

/** Combine comparators: the first non-zero result wins. */
export function chain<T>(...comparators: readonly Comparator<T>[]): Comparator<T> {
  return (a, b) => {
    for (const c of comparators) {
      const r = c(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
}

/** Comparator on a numeric key; pass descending=true for high-to-low. */
export function byNumber<T>(key: (item: T) => number, descending = false): Comparator<T> {
  return descending ? (a, b) => key(b) - key(a) : (a, b) => key(a) - key(b);
}

/** Comparator on a string key (code-unit order). */
export function byString<T>(key: (item: T) => string): Comparator<T> {
  return (a, b) => compareStrings(key(a), key(b));
}
