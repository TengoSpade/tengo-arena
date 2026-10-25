/**
 * Deep copy of JSON-safe data (GameState and everything in it must be
 * JSON-safe because it is saved as JSON). A JSON round trip is used on
 * purpose: anything that would not survive a save also does not survive a
 * clone, so such bugs surface immediately instead of after a reload.
 */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Copy-on-write helper for engine transitions: clone, let `recipe` mutate the
 * draft, return the draft. If `recipe` throws, the input is untouched.
 */
export function produce<T>(base: T, recipe: (draft: T) => void): T {
  const draft = cloneJson(base);
  recipe(draft);
  return draft;
}

/** Recursively freeze (dev builds use this to catch accidental mutation of committed state). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}
