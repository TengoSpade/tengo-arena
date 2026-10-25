import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed, isValidSeed, seedFromEntropy, STREAM } from './index';

function draws(rng: Rng, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng.nextU32());
  return out;
}

describe('Rng: reproducibility', () => {
  it('produces the pinned golden sequence (algorithm must never change silently)', () => {
    // If this fails, sfc32, cyrb128, the key encoding or the warm-up changed.
    // That breaks every replay and saved seed: it needs an ENGINE_VERSION bump
    // and an architect decision, not a new golden value.
    expect(draws(Rng.create('arena-league'), 5)).toEqual([1239222242, 1422067025, 94157655, 1054752474, 1743656081]);
    expect(draws(Rng.create('arena-league', 'match', 'fx-1'), 3)).toEqual([1514395190, 699843454, 824852287]);
    expect(deriveSeed('arena-league', 'match', 1, 'fx-1')).toBe('62f04929e664bc39');
  });

  it('same seed gives the same sequence; different seeds differ', () => {
    expect(draws(Rng.create('s1'), 50)).toEqual(draws(Rng.create('s1'), 50));
    expect(draws(Rng.create('s1'), 50)).not.toEqual(draws(Rng.create('s2'), 50));
  });

  it('instances share no hidden state', () => {
    const a = Rng.create('shared');
    const b = Rng.create('shared');
    const interleaved: number[] = [];
    const solo: number[] = [];
    for (let i = 0; i < 20; i++) {
      interleaved.push(a.nextU32());
      b.nextU32();
    }
    const c = Rng.create('shared');
    for (let i = 0; i < 20; i++) solo.push(c.nextU32());
    expect(interleaved).toEqual(solo);
  });
});

describe('Rng: substreams', () => {
  it('create(seed, ...path) equals chained derive() calls', () => {
    const direct = draws(Rng.create('root', STREAM.match, 3, 'fx-9'), 10);
    const chained = draws(Rng.create('root').derive(STREAM.match).derive(3).derive('fx-9'), 10);
    const multi = draws(Rng.create('root').derive(STREAM.match, 3, 'fx-9'), 10);
    expect(chained).toEqual(direct);
    expect(multi).toEqual(direct);
  });

  it('derive() does not depend on how many draws the parent made', () => {
    const parent = Rng.create('root');
    const before = draws(parent.derive('injury'), 10);
    draws(parent, 137);
    const after = draws(parent.derive('injury'), 10);
    expect(after).toEqual(before);
  });

  it('different labels and orders give different streams', () => {
    const ab = draws(Rng.create('root', 'a', 'b'), 5);
    const ba = draws(Rng.create('root', 'b', 'a'), 5);
    const a = draws(Rng.create('root', 'a'), 5);
    const root = draws(Rng.create('root'), 5);
    expect(new Set([ab, ba, a, root].map((x) => x.join(','))).size).toBe(4);
  });

  it('labels cannot collide by concatenation', () => {
    expect(draws(Rng.create('root', 'ab', 'c'), 5)).not.toEqual(draws(Rng.create('root', 'a', 'bc'), 5));
  });

  it('a number label equals its string form (documented)', () => {
    expect(draws(Rng.create('root', 7), 5)).toEqual(draws(Rng.create('root', '7'), 5));
  });

  it('rejects invalid seeds and labels', () => {
    expect(() => Rng.create('')).toThrow(RangeError);
    expect(() => Rng.create('ok', '')).toThrow(RangeError);
    expect(() => Rng.create('ok', 'bad\u001flabel')).toThrow(RangeError);
    expect(() => Rng.create('ok', 1.5)).toThrow(RangeError);
    expect(() => Rng.create('ok', Number.NaN)).toThrow(RangeError);
    expect(() => Rng.create('ok').derive()).toThrow(RangeError);
    expect(isValidSeed('x'.repeat(129))).toBe(false);
    expect(isValidSeed('62f04929e664bc39')).toBe(true);
  });

  it('exposes a readable path', () => {
    expect(Rng.create('root', 'match', 4).path).toBe('root/match/4');
  });
});

describe('Rng: distributions', () => {
  it('float() stays in [0, 1) with mean near 0.5', () => {
    const rng = Rng.create('float');
    let total = 0;
    for (let i = 0; i < 100_000; i++) {
      const x = rng.float();
      expect(x >= 0 && x < 1).toBe(true);
      total += x;
    }
    expect(Math.abs(total / 100_000 - 0.5)).toBeLessThan(0.01);
  });

  it('int(min, max) is inclusive and roughly uniform', () => {
    const rng = Rng.create('int');
    const counts = new Map<number, number>();
    const n = 60_000;
    for (let i = 0; i < n; i++) {
      const v = rng.int(-2, 3);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3]);
    for (const c of counts.values()) expect(Math.abs(c - n / 6) / (n / 6)).toBeLessThan(0.05);
  });

  it('int() with min === max returns min and still consumes a draw', () => {
    const rng = Rng.create('int-single');
    expect(rng.int(4, 4)).toBe(4);
    expect(rng.draws).toBe(1);
  });

  it('int() validates its bounds', () => {
    const rng = Rng.create('int-bad');
    expect(() => rng.int(3, 2)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
    expect(() => rng.int(0, 8_589_934_592)).toThrow(RangeError);
  });

  it('range() stays within [min, max)', () => {
    const rng = Rng.create('range');
    for (let i = 0; i < 10_000; i++) {
      const v = rng.range(10, 12.5);
      expect(v >= 10 && v < 12.5).toBe(true);
    }
    expect(() => rng.range(2, 1)).toThrow(RangeError);
  });

  it('chance() respects 0 and 1 and always consumes exactly one draw', () => {
    const rng = Rng.create('chance');
    for (let i = 0; i < 1000; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
    expect(rng.draws).toBe(2000);
    let hits = 0;
    for (let i = 0; i < 50_000; i++) if (rng.chance(0.3)) hits++;
    expect(Math.abs(hits / 50_000 - 0.3)).toBeLessThan(0.01);
    expect(() => rng.chance(Number.NaN)).toThrow(RangeError);
  });

  it('chanceBp() uses integer basis points', () => {
    const rng = Rng.create('chance-bp');
    for (let i = 0; i < 500; i++) {
      expect(rng.chanceBp(0)).toBe(false);
      expect(rng.chanceBp(10_000)).toBe(true);
    }
    let hits = 0;
    for (let i = 0; i < 50_000; i++) if (rng.chanceBp(2_500)) hits++;
    expect(Math.abs(hits / 50_000 - 0.25)).toBeLessThan(0.01);
    expect(() => rng.chanceBp(12.5)).toThrow(RangeError);
  });

  it('pick() and weighted() choose valid items; zero weights never win', () => {
    const rng = Rng.create('pick');
    expect(() => rng.pick([])).toThrow(RangeError);
    const items = ['a', 'b', 'c'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(rng.pick(items));
    expect(seen.size).toBe(3);

    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) counts[rng.weightedIndex([1, 0, 3, 0])]! += 1;
    expect(counts[1]).toBe(0);
    expect(counts[3]).toBe(0);
    expect(Math.abs(counts[2]! / 40_000 - 0.75)).toBeLessThan(0.015);

    expect(rng.weighted(['x', 'y'], (item) => (item === 'y' ? 1 : 0))).toBe('y');
    expect(() => rng.weightedIndex([0, 0])).toThrow(RangeError);
    expect(() => rng.weightedIndex([1, -1])).toThrow(RangeError);
  });

  it('shuffle() returns a deterministic permutation and leaves the input alone', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const frozen = Object.freeze(input.slice());
    const a = Rng.create('shuffle').shuffle(frozen);
    const b = Rng.create('shuffle').shuffle(frozen);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(input);
    expect(a).not.toEqual(input);
    expect(frozen).toEqual(input);
  });

  it('normalish() is bounded and centred', () => {
    const rng = Rng.create('normal');
    let total = 0;
    const n = 40_000;
    for (let i = 0; i < n; i++) {
      const v = rng.normalish(50, 10);
      expect(Math.abs(v - 50)).toBeLessThanOrEqual(34.65);
      total += v;
    }
    expect(Math.abs(total / n - 50)).toBeLessThan(0.3);
  });
});

describe('Rng: persistence and seeds', () => {
  it('getState() survives JSON and continues the same sequence', () => {
    const rng = Rng.create('persist', 'sim');
    draws(rng, 33);
    const restored = Rng.fromState(JSON.parse(JSON.stringify(rng.getState())));
    expect(restored.draws).toBe(33);
    expect(draws(restored, 20)).toEqual(draws(rng, 20));
    expect(restored.key).toBe(rng.key);
  });

  it('fromState() rejects malformed state', () => {
    expect(() => Rng.fromState({ key: '', s: [1, 2, 3, 4], draws: 0 })).toThrow(RangeError);
    expect(() => Rng.fromState({ key: 'k', s: [1, 2, 3] as unknown as [number, number, number, number], draws: 0 })).toThrow(
      RangeError,
    );
    expect(() => Rng.fromState({ key: 'k', s: [1, 2, 3, 4], draws: -1 })).toThrow(RangeError);
  });

  it('deriveSeed() is a deterministic 16-hex seed that depends on every label', () => {
    const s = deriveSeed('root', 'match', 1, 'fx-1');
    expect(s).toMatch(/^[0-9a-f]{16}$/);
    expect(isValidSeed(s)).toBe(true);
    expect(deriveSeed('root', 'match', 1, 'fx-1')).toBe(s);
    expect(deriveSeed('root', 'match', 1, 'fx-2')).not.toBe(s);
    expect(deriveSeed('root', 'match', 2, 'fx-1')).not.toBe(s);
    // A derived seed is a new root, not the same stream as the path.
    expect(draws(Rng.create(s), 5)).not.toEqual(draws(Rng.create('root', 'match', 1, 'fx-1'), 5));
  });

  it('seedFromEntropy() normalizes external entropy into a seed', () => {
    expect(seedFromEntropy([1, 2])).toBe('85c82f78c17a25d0');
    expect(seedFromEntropy([1, 2])).not.toBe(seedFromEntropy([2, 1]));
    expect(() => seedFromEntropy([1])).toThrow(RangeError);
  });
});
