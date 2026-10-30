import { describe, expect, it } from 'vitest';
import {
  StreamHasher,
  byNumber,
  byString,
  chain,
  clamp,
  cloneJson,
  deepFreeze,
  hashString,
  powi,
  produce,
  roundHalfAway,
  stableStringify,
} from './index';

describe('hashString', () => {
  it('is pinned (save checksums and content hashes depend on it)', () => {
    expect(hashString('')).toBe('027ae52ecfc796215593990d4b41437c');
    expect(hashString('arena-league')).toBe('9d07575765aebc5e92d68d923c26feae');
  });

  it('differs for different input', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('StreamHasher', () => {
  it('is deterministic and order-sensitive', () => {
    const h = (chunks: string[]) => chunks.reduce((s, c) => s.update(c), new StreamHasher()).digest();
    expect(h(['a', 'b', 'c'])).toBe(h(['a', 'b', 'c']));
    expect(h(['a', 'b', 'c'])).not.toBe(h(['c', 'b', 'a']));
    expect(h(['ab', 'c'])).not.toBe(h(['a', 'bc']));
    expect(h([])).not.toBe(h(['']));
  });
});

describe('stableStringify', () => {
  it('sorts keys at every depth', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 'x', c: null }] })).toBe('{"a":[1,{"c":null,"d":"x"}],"b":1}');
    expect(stableStringify({ x: 1, y: 2 })).toBe(stableStringify({ y: 2, x: 1 }));
  });

  it('omits undefined properties like JSON.stringify', () => {
    expect(stableStringify({ a: undefined, b: 2 })).toBe('{"b":2}');
  });

  it('rejects values that are not plain JSON', () => {
    expect(() => stableStringify({ n: Number.NaN })).toThrow(TypeError);
    expect(() => stableStringify([undefined])).toThrow(TypeError);
    expect(() => stableStringify(new Map())).toThrow(TypeError);
    expect(() => stableStringify({ f: () => 1 })).toThrow(TypeError);
  });
});

describe('math', () => {
  it('clamp, powi, roundHalfAway', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(powi(3, 4)).toBe(81);
    expect(powi(2, 0)).toBe(1);
    expect(() => powi(2, 1.5)).toThrow(RangeError);
    expect(roundHalfAway(2.5)).toBe(3);
    expect(roundHalfAway(-2.5)).toBe(-3);
    expect(roundHalfAway(-2.4)).toBe(-2);
  });
});

describe('comparators', () => {
  it('chain() gives a total order with tie-breaks', () => {
    const rows = [
      { id: 'b', pts: 3 },
      { id: 'a', pts: 3 },
      { id: 'c', pts: 6 },
    ];
    const sorted = rows.slice().sort(chain(byNumber((r) => r.pts, true), byString((r) => r.id)));
    expect(sorted.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('clone helpers', () => {
  it('produce() leaves the base untouched and returns the mutated draft', () => {
    const base = { list: [1, 2], nested: { v: 1 } };
    const next = produce(base, (d) => {
      d.list.push(3);
      d.nested.v = 2;
    });
    expect(base).toEqual({ list: [1, 2], nested: { v: 1 } });
    expect(next).toEqual({ list: [1, 2, 3], nested: { v: 2 } });
  });

  it('cloneJson() drops what a save would drop', () => {
    expect(cloneJson({ a: undefined, b: 1 })).toEqual({ b: 1 });
  });

  it('deepFreeze() blocks mutation', () => {
    const v = deepFreeze({ a: { b: [1] } });
    expect(() => {
      (v.a.b as number[]).push(2);
    }).toThrow(TypeError);
  });
});
