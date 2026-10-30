/**
 * Documentation keys of content files.
 *
 * A key that starts with "_" (`_doc`, `_note`, `_label`, ...) is prose for
 * designers. Code never reads its value (the zod schemas declare the keys
 * only so strict objects accept them, always optional). The production build
 * drops them from the shipped content (scripts/vite/strip-doc-keys.ts), and
 * the content hash ignores them, so a build with and without the keys has the
 * same hash: saves and stored match results stay valid across both.
 *
 * Content ids never start with "_" (ID_PATTERN), so no data key is lost.
 */

/** True for a documentation key. */
export function isDocKey(key: string): boolean {
  return key.startsWith('_');
}

/**
 * A deep copy of parsed JSON without documentation keys on any object (array
 * items and string values are never touched). The input is not modified.
 */
export function stripDocKeys<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (!isDocKey(key)) out[key] = strip(item);
    }
    return out;
  }
  return value;
}
