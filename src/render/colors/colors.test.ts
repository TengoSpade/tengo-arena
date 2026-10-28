/**
 * Team colours and contrast (05-technical-m2 §A5, §A9, asset-006, research §6): the clash rule and 3:1 against the floor
 * for every club pair and both themes, plus the contrast maths.
 */
import { describe, expect, it } from 'vitest';
import { InvariantError } from '../../core/util';
import type { Side } from '../../core/model';
import { defaultContent } from '../timeline/support.mts';
import type { ArenaPalette, RoleId } from '../types';
import { DEFAULT_ARENA_PALETTES, MIN_ARENA_CONTRAST, PRIMARY_CLASH_DELTA_E, colorDistance, colorsForMatch, contrastRatio, defaultArenaPalette, deltaE2000Lab, ensureContrast, parseHexColor, relativeLuminance } from './index';

const content = defaultContent();
const clubs = content.clubs.list.map((c) => ({ id: c.id, primary: parseHexColor(c.colors.primary), secondary: parseHexColor(c.colors.secondary) }));
const THEMES = ['dark', 'light'] as const;
const ROLES: readonly RoleId[] = ['tank', 'melee', 'ranged', 'controller', 'healer'];

describe('parseHexColor', () => {
  it('reads #rrggbb, #rgb and bare hex, any case', () => {
    expect(parseHexColor('#1A2D5A')).toBe(0x1a2d5a);
    expect(parseHexColor('#f2b83b')).toBe(0xf2b83b);
    expect(parseHexColor('abc')).toBe(0xaabbcc);
    expect(parseHexColor('#FFF')).toBe(0xffffff);
    expect(parseHexColor('#000000')).toBe(0);
    expect(parseHexColor(' #0e1013 ')).toBe(0x0e1013);
  });
  it('refuses anything else', () => {
    for (const bad of ['', '#', '#12', '#12345', '#1234567', 'xyz', '#gggggg', 'rgb(1,2,3)']) expect(() => parseHexColor(bad)).toThrow(InvariantError);
  });
  it('parses every club colour of content/default', () => {
    expect(clubs).toHaveLength(48);
    for (const c of clubs) {
      expect(c.primary).toBeGreaterThanOrEqual(0);
      expect(c.secondary).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe('contrastRatio', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio(0xffffff, 0x000000)).toBeCloseTo(21, 6);
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 6);
    expect(contrastRatio(0x123456, 0x123456)).toBe(1);
    expect(contrastRatio(0x777777, 0xffffff)).toBeCloseTo(4.48, 2);
    expect(contrastRatio(0x767676, 0xffffff)).toBeGreaterThanOrEqual(4.5);
    expect(relativeLuminance(0xffffff)).toBeCloseTo(1, 9);
    expect(relativeLuminance(0)).toBe(0);
  });
  it('is symmetric and within 1..21 over the club colours', () => {
    for (const c of clubs) {
      const r = contrastRatio(c.primary, c.secondary);
      expect(r).toBeCloseTo(contrastRatio(c.secondary, c.primary), 12);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(21);
    }
  });
  it('measures CIEDE2000: the Sharma reference pairs, zero for equal, large for opposites', () => {
    // Test data of Sharma, Wu and Dalal (2005).
    expect(deltaE2000Lab(50, 2.6772, -79.7751, 50, 0, -82.7485)).toBeCloseTo(2.0425, 4);
    expect(deltaE2000Lab(50, 3.1571, -77.2803, 50, 0, -82.7485)).toBeCloseTo(2.8615, 4);
    expect(deltaE2000Lab(50, 2.8361, -74.02, 50, 0, -82.7485)).toBeCloseTo(3.4412, 4);
    expect(deltaE2000Lab(50, 2.5, 0, 50, 0, -2.5)).toBeCloseTo(4.3065, 4);
    expect(deltaE2000Lab(50, 2.5, 0, 73, 25, -18)).toBeCloseTo(27.1492, 4);
    expect(colorDistance(0x336699, 0x336699)).toBe(0);
    expect(colorDistance(0x000000, 0xffffff)).toBeGreaterThan(90);
    expect(colorDistance(0xff0000, 0xfe0000)).toBeLessThan(2);
  });
  it('defaults the clash threshold to the one clubs.json states', () => {
    expect(PRIMARY_CLASH_DELTA_E).toBe(content.files.clubs.colorRules.clashDeltaE);
  });
});

describe('ensureContrast', () => {
  it('keeps a colour that already passes and moves one that does not the least that works', () => {
    const floor = DEFAULT_ARENA_PALETTES.dark.floor;
    expect(ensureContrast(0xe6b866, floor)).toBe(0xe6b866);
    const fixed = ensureContrast(0x4a443a, floor);
    expect(contrastRatio(fixed, floor)).toBeGreaterThanOrEqual(MIN_ARENA_CONTRAST);
    expect(fixed).not.toBe(0x4a443a);
  });
  it('can always reach 3:1, on dark, mid and light floors', () => {
    for (const floor of [0x000000, 0x1a1a1a, 0x3e3a32, 0x6b6b6b, 0x808080, 0x9a9a9a, 0xbdbdbd, 0xeee7d6, 0xffffff]) {
      for (const c of [0x000000, 0x808080, 0xff0000, 0x00ff00, 0x0000ff, 0xf2b83b, 0x1a2d5a, 0xffffff]) {
        expect(contrastRatio(ensureContrast(c, floor), floor), `${c.toString(16)} on ${floor.toString(16)}`).toBeGreaterThanOrEqual(MIN_ARENA_CONTRAST);
      }
    }
  });
});

describe('the default palettes', () => {
  it('give rings, role glyphs and fx hues 3:1 and text 4.5:1 against the floor, in both themes (04 §9)', () => {
    for (const theme of THEMES) {
      const p = defaultArenaPalette(theme);
      expect(p.theme).toBe(theme);
      expect(contrastRatio(p.sideUs, p.floor)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.sideThem, p.floor)).toBeGreaterThanOrEqual(3);
      for (const role of ROLES) {
        expect(contrastRatio(p.roles[role], p.floor), `${theme} ${role}`).toBeGreaterThanOrEqual(3);
        expect(p.roleGlyphSvg[role]).toMatch(/^<svg [^>]*viewBox='0 0 24 24'>.*<\/svg>$/);
      }
      expect(contrastRatio(p.text, p.floor)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.fxPhysical, p.floor)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.fxArcane, p.floor)).toBeGreaterThanOrEqual(3);
    }
  });
  it('keep the five role glyphs distinct shapes (shape first, colour second)', () => {
    const svgs = ROLES.map((r) => DEFAULT_ARENA_PALETTES.dark.roleGlyphSvg[r]);
    expect(new Set(svgs).size).toBe(5);
  });
});

describe('colorsForMatch', () => {
  const dark = defaultArenaPalette('dark');

  it('gives the player a brass solid ring and the opponent a steel-blue double ring, on either side', () => {
    const a = clubs[0]!;
    const b = clubs[1]!;
    const [home, away] = colorsForMatch(a, b, 0, dark);
    expect([home.ring, home.ringStyle]).toEqual([dark.sideUs, 'solid']);
    expect([away.ring, away.ringStyle]).toEqual([dark.sideThem, 'double']);
    const [home2, away2] = colorsForMatch(a, b, 1, dark);
    expect([home2.ring, home2.ringStyle]).toEqual([dark.sideThem, 'double']);
    expect([away2.ring, away2.ringStyle]).toEqual([dark.sideUs, 'solid']);
  });

  it('between other clubs takes the rings from the clubs\' primaries, home solid and away double', () => {
    const [home, away] = colorsForMatch(clubs[2]!, clubs[3]!, null, dark);
    expect(home.ringStyle).toBe('solid');
    expect(away.ringStyle).toBe('double');
    expect(home.ring).toBe(home.primary);
    expect(away.ring).toBe(away.primary);
    expect(home.ring).not.toBe(dark.sideUs);
  });

  it('makes the away side secondary-dominant when the primaries clash', () => {
    const navy = { primary: 0xf2b83b, secondary: 0x1a2d5a };
    const navyToo = { primary: 0xf4ba3d, secondary: 0xffffff };
    const [home, away] = colorsForMatch(navy, navyToo, 0, dark);
    expect(colorDistance(home.primary, away.primary)).toBeGreaterThanOrEqual(PRIMARY_CLASH_DELTA_E);
    // The clashing primary is not the away body; its secondary leads and the old primary trims.
    expect(away.primary).toBe(ensureContrast(navyToo.secondary, dark.floor));
    expect(away.secondary).toBe(ensureContrast(navyToo.primary, dark.floor));
    // No clash: untouched.
    const [h2, a2] = colorsForMatch({ primary: 0xf2b83b, secondary: 0x111111 }, { primary: 0x2a6fb0, secondary: 0xeeeeee }, 0, dark);
    expect(colorDistance(h2.primary, a2.primary)).toBeGreaterThanOrEqual(PRIMARY_CLASH_DELTA_E);
    expect(a2.primary).toBe(ensureContrast(0x2a6fb0, dark.floor));
  });

  it('separates the bodies even when both of the away side\'s colours clash with the home primary', () => {
    const same = { primary: 0x2a6fb0, secondary: 0x2a70b1 };
    const [home, away] = colorsForMatch(same, same, 0, dark);
    expect(colorDistance(home.primary, away.primary)).toBeGreaterThanOrEqual(PRIMARY_CLASH_DELTA_E);
    // A host with a stricter content rule passes it.
    const [h2, a2] = colorsForMatch({ primary: 0x2a6fb0, secondary: 0xffffff }, { primary: 0x3a7fc0, secondary: 0xe0e0e0 }, 0, dark, { clashDeltaE: 30 });
    expect(colorDistance(h2.primary, a2.primary)).toBeGreaterThanOrEqual(30);
    expect(contrastRatio(away.primary, dark.floor)).toBeGreaterThanOrEqual(3);
  });

  it('holds 3:1 against the floor and the clash rule for every ordered pair of the 48 clubs, in both themes and for every player side', () => {
    let pairs = 0;
    const sides: (Side | null)[] = [0, 1, null];
    for (const theme of THEMES) {
      const palette: ArenaPalette = defaultArenaPalette(theme);
      for (const a of clubs) {
        for (const b of clubs) {
          if (a === b) continue;
          for (const side of sides) {
            const [home, away] = colorsForMatch(a, b, side, palette);
            for (const team of [home, away]) {
              for (const colour of [team.primary, team.secondary, team.ring]) {
                expect(contrastRatio(colour, palette.floor), `${theme} ${a.id} v ${b.id}`).toBeGreaterThanOrEqual(MIN_ARENA_CONTRAST);
              }
            }
            expect(home.ringStyle).not.toBe(away.ringStyle);
            expect(colorDistance(home.primary, away.primary), `${theme} ${a.id} v ${b.id}: bodies clash`).toBeGreaterThanOrEqual(PRIMARY_CLASH_DELTA_E);
            if (side === null) expect(colorDistance(home.ring, away.ring)).toBeGreaterThanOrEqual(PRIMARY_CLASH_DELTA_E);
          }
          pairs++;
        }
      }
    }
    expect(pairs).toBe(48 * 47 * 2);
  });

  it('is deterministic and leaves a club that passes alone', () => {
    const c = colorsForMatch(clubs[5]!, clubs[6]!, 0, dark);
    expect(colorsForMatch(clubs[5]!, clubs[6]!, 0, dark)).toEqual(c);
    const bright = { primary: 0xf2e6c8, secondary: 0xe6b866 };
    const [h] = colorsForMatch(bright, clubs[6]!, 0, dark);
    expect(h.primary).toBe(0xf2e6c8);
    expect(h.secondary).toBe(0xe6b866);
  });
});
