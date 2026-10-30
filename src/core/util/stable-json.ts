/**
 * Deterministic JSON serialization: object keys are sorted by UTF-16 code
 * unit order, so equal data always produces the same string regardless of
 * insertion order. Used for content hashes, save checksums and event hashes.
 *
 * Throws on values that are not plain JSON (undefined inside arrays,
 * functions, symbols, bigint, NaN/Infinity, class instances such as Map, Set
 * or Date). Object properties whose value is undefined are omitted, matching
 * JSON.stringify.
 */
export function stableStringify(value: unknown): string {
  return write(value, '$');
}

function write(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`stableStringify: non-finite number at ${path}`);
      }
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        const parts: string[] = [];
        for (let i = 0; i < value.length; i++) {
          const item: unknown = value[i];
          if (item === undefined) {
            throw new TypeError(`stableStringify: undefined array item at ${path}[${i}]`);
          }
          parts.push(write(item, `${path}[${i}]`));
        }
        return `[${parts.join(',')}]`;
      }
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError(`stableStringify: non-plain object at ${path}`);
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort(compareCodeUnits);
      const parts: string[] = [];
      for (const key of keys) {
        const v = record[key];
        if (v === undefined) continue;
        parts.push(`${JSON.stringify(key)}:${write(v, `${path}.${key}`)}`);
      }
      return `{${parts.join(',')}}`;
    }
    default:
      throw new TypeError(`stableStringify: unsupported ${typeof value} at ${path}`);
  }
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
