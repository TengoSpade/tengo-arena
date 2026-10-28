/**
 * Team colours and contrast (05-technical-m2 §A5, §A9, §A18 decision 4, asset-006, research §6): body colours are the
 * exact club colours, rings reach 3:1 against the floor (club-primary rings shifted in Lab), the clash rule, the default
 * palettes against tokens.css, and the contrast maths.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InvariantError } from '../../core/util';
import type { Side } from '../../core/model';
import { defaultContent } from '../timeline/support.mts';
import type { ArenaMetrics, ArenaPalette, PipKind, RoleId } from '../types';
import {
  DEFAULT_ARENA_PALETTES,
  MIN_ARENA_CONTRAST,
  PRIMARY_CLASH_DELTA_E,
  colorDistance,
  colorsForMatch,
  contrastRatio,
  defaultArenaPalette,
  deltaE2000Lab,
  ensureContrast,
  parseHexColor,
  relativeLuminance,
} from './index';

const content = defaultContent();
const clubs = content.clubs.list.map((c) => ({ id: c.id, primary: parseHexColor(c.colors.primary), secondary: parseHexColor(c.colors.secondary) }));
const THEMES = ['dark', 'light'] as const;
const ROLES: readonly RoleId[] = ['tank', 'melee', 'ranged', 'controller', 'healer'];
const PIPS: readonly PipKind[] = ['buff', 'debuff', 'control-hard', 'control-soft', 'dot', 'hot', 'special'];

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

/** HSL hue of a colour in degrees, and its saturation: a coarse check that a shift kept the hue. */
function hueOf(color: number): { hue: number; chroma: number } {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { hue: 0, chroma: 0 };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: (h * 60 + 360) % 360, chroma: d };
}

describe('ensureContrast (a shift in Lab, hue and chroma kept)', () => {
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
        expect(contrastRatio(ensureContrast(c, floor), floor), c.toString(16) + ' on ' + floor.toString(16)).toBeGreaterThanOrEqual(MIN_ARENA_CONTRAST);
      }
    }
  });
  it('keeps the hue of a saturated colour while it moves its lightness', () => {
    let shifted = 0;
    for (const theme of THEMES) {
      const floor = defaultArenaPalette(theme).floor;
      for (const c of clubs) {
        for (const color of [c.primary, c.secondary]) {
          const out = ensureContrast(color, floor);
          if (out === color) continue;
          const a = hueOf(color);
          const b = hueOf(out);
          if (a.chroma < 0.25 || b.chroma < 0.12) continue; // near-neutral: its hue is not defined enough to compare
          const diff = Math.abs(a.hue - b.hue);
          expect(Math.min(diff, 360 - diff), theme + ' ' + c.id + ' ' + color.toString(16)).toBeLessThan(12);
          shifted++;
        }
      }
    }
    expect(shifted).toBeGreaterThan(20);
  });
});

describe('the default palettes', () => {
  it('give rings, glyphs on their plate, bars, edges, pips and tones their 3:1, and text on the plate 4.5:1, in both themes (04 §9, arena-notes §2)', () => {
    for (const theme of THEMES) {
      const p = defaultArenaPalette(theme);
      expect(p.theme).toBe(theme);
      expect(contrastRatio(p.sideUs, p.floor), theme + ' ring us').toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.sideThem, p.floor), theme + ' ring them').toBeGreaterThanOrEqual(3);
      for (const role of ROLES) expect(contrastRatio(p.roles[role], p.plate), theme + ' ' + role + ' on the plate').toBeGreaterThanOrEqual(3);
      for (const pip of PIPS) expect(contrastRatio(p.pipColor[pip], p.plate), theme + ' pip ' + pip + ' on the plate').toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.edge, p.floor), theme + ' bar edge').toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.select, p.floor), theme + ' selection').toBeGreaterThanOrEqual(3);
      for (const fill of [p.hp, p.shield, p.focus]) expect(contrastRatio(fill, p.track), theme + ' bar fill on its track').toBeGreaterThanOrEqual(3);
      for (const tone of [p.fxPhysical, p.fxArcane, p.fxTrue, p.fxHeal, p.fxShield]) expect(contrastRatio(tone, p.floor), theme + ' tone').toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.text, p.floor)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.ink, p.plate), theme + ' ink on the plate').toBeGreaterThanOrEqual(4.5);
      expect(p.track).toBe(p.plate);
      for (const role of ROLES) expect(p.roleGlyphSvg[role]).toMatch(/^<svg [^>]*viewBox='0 0 24 24'>.*<\/svg>$/);
      for (const pip of PIPS) expect(p.pipGlyphSvg[pip]).toMatch(/^<svg [^>]*viewBox='0 0 24 24'>.*<\/svg>$/);
    }
  });

  it('keep the five role glyphs distinct shapes, the seven pips distinct silhouettes, and no pip glyph equal to a role glyph', () => {
    const p = DEFAULT_ARENA_PALETTES.dark;
    const roles = ROLES.map((r) => p.roleGlyphSvg[r]);
    const pips = PIPS.map((k) => p.pipGlyphSvg[k]);
    expect(new Set(roles).size).toBe(5);
    expect(new Set(pips).size).toBe(7);
    for (const pip of pips) expect(roles).not.toContain(pip);
  });

  // The defaults are the tokens.css values: reading the file keeps them from drifting (the host reads the real ones).
  function tokens(theme: 'dark' | 'light'): (name: string) => string {
    const css = readFileSync(new URL('../../ui/styles/tokens.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    const map = new Map<string, string>();
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // A selector list (":root, :root[data-theme=dark]") applies if any member does; later blocks win, as the cascade has it.
      const members = selector!.split(',').map((s) => s.trim());
      if (!members.some((s) => s === ':root' || s === ':root[data-theme="' + theme + '"]')) continue;
      for (const m of body!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1]!, m[2]!.trim());
    }
    const resolve = (name: string): string => {
      const value = map.get(name);
      if (value === undefined) throw new Error('tokens.css has no ' + name + ' in the ' + theme + ' theme');
      return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolve(inner));
    };
    return resolve;
  }
  const decode = (uri: string): string => decodeURIComponent(/^url\("data:image\/svg\+xml,(.*)"\)$/.exec(uri)![1]!);
  const measure = (value: string): number => (value.endsWith('rem') ? parseFloat(value) * 15 : parseFloat(value));

  it('equal the values of tokens.css in both themes: colours, role and pip glyphs, and the numeric --arena-* tokens', () => {
    for (const theme of THEMES) {
      const t = tokens(theme);
      const hex = (name: string): number => parseHexColor(t(name));
      const p = defaultArenaPalette(theme);
      const colours: Record<string, [number, string]> = {
        sideUs: [p.sideUs, '--c-side-us'],
        sideThem: [p.sideThem, '--c-side-them'],
        text: [p.text, '--c-text'],
        textMuted: [p.textMuted, '--c-text-muted'],
        floor: [p.floor, '--c-arena-floor'],
        wall: [p.wall, '--c-arena-wall'],
        good: [p.good, '--c-good'],
        bad: [p.bad, '--c-bad'],
        warn: [p.warn, '--c-warn'],
        fxPhysical: [p.fxPhysical, '--c-fx-physical'],
        fxArcane: [p.fxArcane, '--c-fx-arcane'],
        plate: [p.plate, '--c-arena-plate'],
        ink: [p.ink, '--c-arena-ink'],
        edge: [p.edge, '--c-arena-edge'],
        line: [p.line, '--c-arena-line'],
        hp: [p.hp, '--c-arena-hp'],
        track: [p.track, '--c-arena-track'],
        shield: [p.shield, '--c-arena-shield'],
        focus: [p.focus, '--c-arena-focus'],
        select: [p.select, '--c-arena-select'],
        telegraph: [p.telegraph, '--c-arena-telegraph'],
        hitFlash: [p.hitFlash, '--c-arena-hit-flash'],
        fxTrue: [p.fxTrue, '--c-fx-true'],
        fxHeal: [p.fxHeal, '--c-fx-heal'],
        fxShield: [p.fxShield, '--c-fx-shield'],
      };
      for (const [field, [value, token]] of Object.entries(colours)) expect(value, theme + ' ' + field + ' = ' + token).toBe(hex(token));
      for (const role of ROLES) {
        expect(p.roles[role], theme + ' role ' + role).toBe(hex('--c-role-' + role));
        expect(p.roleGlyphSvg[role], 'glyph ' + role).toBe(decode(t('--glyph-' + role)));
      }
      const pipToken: Record<PipKind, string> = {
        buff: '--c-pip-buff',
        debuff: '--c-pip-debuff',
        'control-hard': '--c-pip-control',
        'control-soft': '--c-pip-control',
        dot: '--c-pip-debuff',
        hot: '--c-pip-buff',
        special: '--c-arena-ink',
      };
      for (const pip of PIPS) {
        expect(p.pipColor[pip], theme + ' pip ' + pip).toBe(hex(pipToken[pip]));
        expect(p.pipGlyphSvg[pip], 'pip glyph ' + pip).toBe(decode(t('--glyph-pip-' + pip)));
      }
      const metrics: Record<keyof ArenaMetrics, string> = {
        ringWidthPx: '--arena-ring-w',
        ringLinePx: '--arena-ring-line',
        ringGapPx: '--arena-ring-gap',
        downOpacity: '--arena-down-opacity',
        zoneAlpha: '--arena-zone-alpha',
        telegraphFillAlpha: '--arena-telegraph-fill',
        telegraphEdgeAlpha: '--arena-telegraph-edge',
        telegraphProgressAlpha: '--arena-telegraph-progress',
        hitFlashAlpha: '--arena-hit-flash-alpha',
        hitFlashMs: '--arena-hit-flash-ms',
        flashLimitPerSecond: '--arena-flash-limit',
        fxFadeMs: '--arena-fx-fade-ms',
        numberMergeMs: '--arena-number-merge-ms',
        numberRisePx: '--arena-number-rise',
        pulseMs: '--arena-pulse-ms',
        easeMs: '--arena-ease-ms',
        labelSizePx: '--arena-label-size',
        pipSizePx: '--arena-pip-size',
        barHeightPx: '--arena-bar-h',
        barWidthM: '--arena-bar-w',
        plateRadiusM: '--arena-plate-r',
        glyphSizeM: '--arena-glyph',
        plateRadiusHybridM: '--arena-plate-r-hybrid',
        glyphSizeHybridM: '--arena-glyph-hybrid',
      };
      for (const [field, token] of Object.entries(metrics)) {
        const raw = t(token);
        // --arena-label-size is the --fs-xs step: resolve it through its own token.
        const value = raw.includes('rem') || /^[\d.]+(px|ms)?$/.test(raw) ? raw : t('--fs-xs');
        expect(p.metrics[field as keyof ArenaMetrics], theme + ' ' + field + ' = ' + token).toBeCloseTo(measure(value), 9);
      }
    }
  });
});

describe('colorsForMatch (A18 decision 4: exact bodies, 3:1 rings)', () => {
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

  it('leaves every body and trim colour exactly as the club has it, whatever the floor', () => {
    for (const theme of THEMES) {
      const palette = defaultArenaPalette(theme);
      for (const side of [0, 1, null] as const) {
        const [home, away] = colorsForMatch(clubs[7]!, clubs[20]!, side, palette);
        expect([home.primary, home.secondary]).toEqual([clubs[7]!.primary, clubs[7]!.secondary]);
        expect(new Set([away.primary, away.secondary])).toEqual(new Set([clubs[20]!.primary, clubs[20]!.secondary]));
      }
    }
    // A colour well under 3:1 on the floor stays as it is: the body carries identity only.
    const dim = { primary: 0x2a2620, secondary: 0x3e3a33 };
    expect(contrastRatio(dim.primary, dark.floor)).toBeLessThan(3);
    const [home] = colorsForMatch(dim, clubs[3]!, 0, dark);
    expect([home.primary, home.secondary]).toEqual([dim.primary, dim.secondary]);
  });

  it('between other clubs takes the rings from the clubs\' leading colours, home solid and away double, shifted to 3:1', () => {
    const dim = { primary: 0x2a2620, secondary: 0xf2e6c8 };
    const [home, away] = colorsForMatch(dim, clubs[3]!, null, dark);
    expect(home.ringStyle).toBe('solid');
    expect(away.ringStyle).toBe('double');
    expect(home.ring).toBe(ensureContrast(home.primary, dark.floor));
    expect(away.ring).toBe(ensureContrast(away.primary, dark.floor));
    expect(contrastRatio(home.ring, dark.floor)).toBeGreaterThanOrEqual(3);
    expect(home.ring).not.toBe(home.primary);
    expect(home.ring).not.toBe(dark.sideUs);
    // A primary that already reaches 3:1 is its own ring, untouched.
    const bright = { primary: 0xf2e6c8, secondary: 0x1a2d5a };
    expect(colorsForMatch(bright, clubs[3]!, null, dark)[0].ring).toBe(0xf2e6c8);
  });

  it('makes the away side secondary-dominant when the primaries clash, without altering a colour', () => {
    const gold = { primary: 0xf2b83b, secondary: 0x1a2d5a };
    const gold2 = { primary: 0xf4ba3d, secondary: 0xffffff };
    const [home, away] = colorsForMatch(gold, gold2, 0, dark);
    expect(colorDistance(home.primary, away.primary)).toBeGreaterThanOrEqual(PRIMARY_CLASH_DELTA_E);
    expect(away.primary).toBe(gold2.secondary);
    expect(away.secondary).toBe(gold2.primary);
    // No clash: untouched.
    const [h2, a2] = colorsForMatch({ primary: 0xf2b83b, secondary: 0x111111 }, { primary: 0x2a6fb0, secondary: 0xeeeeee }, 0, dark);
    expect([h2.primary, a2.primary, a2.secondary]).toEqual([0xf2b83b, 0x2a6fb0, 0xeeeeee]);
    // A host with a stricter content rule passes it.
    const [h3, a3] = colorsForMatch({ primary: 0x2a6fb0, secondary: 0xffffff }, { primary: 0x3a7fc0, secondary: 0xe0e0e0 }, 0, dark, { clashDeltaE: 30 });
    expect(colorDistance(h3.primary, a3.primary)).toBeGreaterThanOrEqual(30);
  });

  it('when both of the away side\'s colours clash, it leads with the farther one and still alters nothing', () => {
    const same = { primary: 0x2a6fb0, secondary: 0x2a70b1 };
    const [home, away] = colorsForMatch(same, same, 0, dark);
    expect([home.primary, home.secondary]).toEqual([same.primary, same.secondary]);
    expect(new Set([away.primary, away.secondary])).toEqual(new Set([same.primary, same.secondary]));
    expect(colorDistance(home.primary, away.primary)).toBeGreaterThanOrEqual(colorDistance(home.primary, away.secondary));
    // The ring and its style still tell the sides apart.
    expect([home.ringStyle, away.ringStyle]).toEqual(['solid', 'double']);
  });

  it('holds 3:1 for every ring and the clash rule for every ordered pair of the 48 clubs, in both themes and for every player side', () => {
    let pairs = 0;
    let swapped = 0;
    let unresolved = 0;
    const sides: (Side | null)[] = [0, 1, null];
    for (const theme of THEMES) {
      const palette: ArenaPalette = defaultArenaPalette(theme);
      for (const a of clubs) {
        for (const b of clubs) {
          if (a === b) continue;
          for (const side of sides) {
            const [home, away] = colorsForMatch(a, b, side, palette);
            // Rings carry meaning: 3:1 against the floor. Bodies are exact (A18 decision 4) and are not held to it.
            for (const team of [home, away]) expect(contrastRatio(team.ring, palette.floor), theme + ' ' + a.id + ' v ' + b.id + ' ring').toBeGreaterThanOrEqual(MIN_ARENA_CONTRAST);
            expect(home.ringStyle).not.toBe(away.ringStyle);
            expect([home.primary, home.secondary]).toEqual([a.primary, a.secondary]);
            const lead = away.primary === b.primary ? 'primary' : 'secondary';
            expect(new Set([away.primary, away.secondary])).toEqual(new Set([b.primary, b.secondary]));
            const clash = colorDistance(a.primary, b.primary) < PRIMARY_CLASH_DELTA_E;
            if (!clash) expect(lead).toBe('primary');
            else if (lead === 'secondary') swapped++;
            if (colorDistance(home.primary, away.primary) < PRIMARY_CLASH_DELTA_E) unresolved++;
            if (side === null) {
              expect(home.ring).toBe(ensureContrast(home.primary, palette.floor));
              expect(away.ring).toBe(ensureContrast(away.primary, palette.floor));
            } else {
              expect([home.ring, away.ring].sort()).toEqual([palette.sideUs, palette.sideThem].sort());
            }
          }
          pairs++;
        }
      }
    }
    expect(pairs).toBe(48 * 47 * 2);
    expect(swapped).toBeGreaterThan(0);
    // The club validator guarantees a kit distance of 25 between any two clubs, so the secondary-dominant rule resolves the clash.
    expect(unresolved).toBe(0);
  });

  it('is deterministic', () => {
    expect(colorsForMatch(clubs[5]!, clubs[6]!, 0, dark)).toEqual(colorsForMatch(clubs[5]!, clubs[6]!, 0, dark));
  });
});
