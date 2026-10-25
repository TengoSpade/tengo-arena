/**
 * Save text and checksum of a GameState without re-encoding the write-once
 * parts every autosave (05 §8: an autosave stays cheap however long the
 * career). Results, archived seasons and alumni are deep-frozen once a
 * transition shares them (model/transition.ts), so their JSON text and hash
 * are cached per entry object; everything else is encoded fresh.
 *
 * Checksum v2 (schema version 2+) covers the state as written: an
 * order-sensitive StreamHasher over each top-level key and its JSON text,
 * with the shared maps and arrays folded in per entry (key, then the entry's
 * hashString). JSON.parse keeps key order, so the parsed state hashes the same.
 * Saves of schema version 1 use the v1 rule, hashString(stableStringify(state)).
 */
import { SHARED_STATE_KEYS } from '../model';
import { StreamHasher, hashString, stableStringify } from '../util';

const SHARED = new Set<string>(SHARED_STATE_KEYS);
const textCache = new WeakMap<object, string>();
const hashCache = new WeakMap<object, string>();

function isFrozenObject(v: unknown): v is object {
  return v !== null && typeof v === 'object' && Object.isFrozen(v);
}

/** JSON text of one shared entry (cached when frozen: it can never change). */
function entryText(v: unknown): string {
  if (!isFrozenObject(v)) return JSON.stringify(v);
  let s = textCache.get(v);
  if (s === undefined) {
    s = JSON.stringify(v);
    textCache.set(v, s);
  }
  return s;
}

function entryHash(v: unknown): string {
  if (!isFrozenObject(v)) return hashString(JSON.stringify(v));
  let h = hashCache.get(v);
  if (h === undefined) {
    h = hashString(entryText(v));
    hashCache.set(v, h);
  }
  return h;
}

function sharedText(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((e: unknown) => (e === undefined ? 'null' : entryText(e))).join(',')}]`;
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const parts: string[] = [];
  const map = v as Record<string, unknown>;
  for (const k of Object.keys(map)) {
    const e = map[k];
    if (e !== undefined) parts.push(`${JSON.stringify(k)}:${entryText(e)}`);
  }
  return `{${parts.join(',')}}`;
}

/** JSON.stringify(state), byte for byte, reusing the cached text of frozen shared entries. */
export function stateText(state: object): string {
  const parts: string[] = [];
  const s = state as Record<string, unknown>;
  for (const key of Object.keys(s)) {
    const v = s[key];
    if (v === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${SHARED.has(key) ? sharedText(v) : JSON.stringify(v)}`);
  }
  return `{${parts.join(',')}}`;
}

/** Checksum v2 of a state (see the module comment). Throws on values that are not plain JSON. */
export function checksumV2(state: object): string {
  const h = new StreamHasher();
  const s = state as Record<string, unknown>;
  for (const key of Object.keys(s)) {
    const v = s[key];
    if (v === undefined) continue;
    h.update(key);
    if (!SHARED.has(key) || v === null || typeof v !== 'object') {
      const text = JSON.stringify(v);
      if (text === undefined) throw new TypeError(`checksum: "${key}" is not JSON`);
      h.update(text);
    } else if (Array.isArray(v)) {
      h.update('[');
      for (const e of v as unknown[]) h.update(entryHash(e));
    } else {
      h.update('{');
      const map = v as Record<string, unknown>;
      for (const k of Object.keys(map)) {
        const e = map[k];
        if (e === undefined) continue;
        h.update(k);
        h.update(entryHash(e));
      }
    }
  }
  return h.digest();
}

/** Checksum v1 (schema version 1 saves): key-order independent, over stableStringify. */
export function checksumV1(state: unknown): string {
  return hashString(stableStringify(state));
}

/** The checksum rule of a schema version. */
export function checksumFor(schemaVersion: number, state: object): string {
  return schemaVersion < 2 ? checksumV1(state) : checksumV2(state);
}
