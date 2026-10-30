/**
 * Ids index plain objects throughout GameState (clubs, fighters, ledger
 * balances, lineup tactics, ...). A key that every plain object inherits
 * (constructor, toString, hasOwnProperty, __proto__, ...) would resolve to a
 * prototype member instead of an entry, so such names are never valid ids:
 * content and save validation reject them, and lookups by an id that did not
 * come from the state itself go through getOwn.
 */

/** True for names every plain object inherits (constructor, toString, __proto__, ...). */
export function isReservedName(name: string): boolean {
  return name in Object.prototype;
}

/** The map's own entry for `key`, never an inherited member. */
export function getOwn<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}
