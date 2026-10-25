import { describe, expect, it } from 'vitest';
import { divTrunc, floorTo, interpolate, mulDiv, stepLookup } from './math';

describe('integer money helpers (03 §1 rounding)', () => {
  it('floor to 5 / 10 toward zero, one truncation at the end', () => {
    expect(floorTo(363.875, 5)).toBe(360);
    expect(floorTo(1_518, 10)).toBe(1_510);
    expect(floorTo(4, 5)).toBe(0);
    expect(floorTo(-7, 5)).toBe(-5);
    expect(mulDiv(85_008, 7_800, 10_000)).toBe(66_306);
    expect(mulDiv(-497, 3, 2)).toBe(-745);
    expect(divTrunc(-1, 2)).toBe(0);
    expect(() => mulDiv(2 ** 30, 2 ** 30, 1)).toThrow();
  });

  it('step tables use the largest key <= the lookup; curves interpolate toward zero and are flat outside', () => {
    const table: [number, number][] = [[0, 4000], [24, 3000], [25, 2000], [26, 1000], [28, 0]];
    expect([23, 24, 25, 27, 28, 60].map((k) => stepLookup(table, k))).toEqual([4000, 3000, 2000, 1000, 0, 0]);
    const curve: [number, number][] = [[40, 110], [45, 150], [50, 200]];
    expect([30, 44, 45, 47, 60].map((x) => interpolate(curve, x))).toEqual([110, 142, 150, 170, 200]);
  });
});
