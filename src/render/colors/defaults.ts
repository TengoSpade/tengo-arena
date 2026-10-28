/**
 * Default arena palettes: the tokens.css values (04 §3, asset-006, §A18; a test reads tokens.css and compares), for tests
 * and the first frame. The real palette comes from the host, read from computed style (arena-notes §3). PURE.
 */
import type { ArenaMetrics, ArenaPalette, PipKind, RoleId } from '../types';

const GLYPH_OPEN = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>";
const glyph = (path: string): string => `${GLYPH_OPEN}${path}</svg>`;

const ROLE_GLYPH_SVG: Readonly<Record<RoleId, string>> = {
  tank: glyph("<path d='M12 1.5 21 5v6.2c0 5.4-3.8 9.6-9 11.3-5.2-1.7-9-5.9-9-11.3V5z'/>"),
  melee: glyph("<path d='M12 1 22.5 12 12 23 1.5 12z'/>"),
  ranged: glyph("<path d='M12 2 23 21.5H1z'/>"),
  controller: glyph("<path d='M3 2h18l-7 10 7 10H3l7-10z'/>"),
  healer: glyph("<path fill-rule='evenodd' d='M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21zM10.3 6.3v4H6.3v3.4h4v4h3.4v-4h4v-3.4h-4v-4z'/>"),
};

const PIP_GLYPH_SVG: Readonly<Record<PipKind, string>> = {
  buff: glyph("<path d='M3 10.2 12 1.6l9 8.6-2.6 2.6L12 6.8l-6.4 6zM3 19.2l9-8.6 9 8.6-2.6 2.6-6.4-6-6.4 6z'/>"),
  debuff: glyph("<path d='M3 13.8l9 8.6 9-8.6-2.6-2.6-6.4 6-6.4-6zM3 4.8l9 8.6 9-8.6-2.6-2.6-6.4 6-6.4-6z'/>"),
  'control-hard': glyph("<path fill-rule='evenodd' d='M8.2 2h7.6L22 8.2v7.6L15.8 22H8.2L2 15.8V8.2zM6.5 10.2v3.6h11v-3.6z'/>"),
  'control-soft': glyph("<path fill-rule='evenodd' d='M8.2 2h7.6L22 8.2v7.6L15.8 22H8.2L2 15.8V8.2zM9 5.6 5.6 9v6L9 18.4h6l3.4-3.4V9L15 5.6z'/>"),
  dot: glyph("<path d='M12 1.8c3.9 4.9 6.6 8.3 6.6 11.9a6.6 6.6 0 0 1-13.2 0c0-3.6 2.7-7 6.6-11.9z'/>"),
  hot: glyph("<path d='M12 21.5C5.2 15.8 2.5 12.4 2.5 8.7A5.1 5.1 0 0 1 12 6.3a5.1 5.1 0 0 1 9.5 2.4c0 3.7-2.7 7.1-9.5 12.8z'/>"),
  special: glyph("<path d='M12 1.5l2.5 8 8 2.5-8 2.5-2.5 8-2.5-8-8-2.5 8-2.5z'/>"),
};

/** The numeric --arena-* tokens at the reference root size of 15 px (1 rem = 15 px): the host measures the rem ones for real. */
export const DEFAULT_ARENA_METRICS: ArenaMetrics = {
  ringWidthPx: 3.5,
  ringLinePx: 2,
  ringGapPx: 1.5,
  downOpacity: 0.4,
  zoneAlpha: 0.22,
  telegraphFillAlpha: 0.16,
  telegraphEdgeAlpha: 0.9,
  telegraphProgressAlpha: 0.3,
  hitFlashAlpha: 0.7,
  hitFlashMs: 90,
  flashLimitPerSecond: 3,
  fxFadeMs: 400,
  numberMergeMs: 100,
  numberRisePx: 13.5,
  pulseMs: 220,
  easeMs: 220,
  labelSizePx: 12,
  pipSizePx: 15,
  barHeightPx: 6,
};

/** Dark and light arena palettes: the values tokens.css defines. */
export const DEFAULT_ARENA_PALETTES: Readonly<Record<'dark' | 'light', ArenaPalette>> = {
  dark: {
    theme: 'dark',
    sideUs: 0xe6b866,
    sideThem: 0xa7b4c6,
    roles: { tank: 0x56b4e9, melee: 0xee7a3c, ranged: 0xf0e442, controller: 0xd88bb6, healer: 0x1fb88a },
    roleGlyphSvg: ROLE_GLYPH_SVG,
    text: 0xebe6da,
    textMuted: 0xaaa69c,
    floor: 0x3e3a32,
    wall: 0x716857,
    good: 0x5fcb92,
    bad: 0xf27a69,
    warn: 0xeebf52,
    fxPhysical: 0xf2e6c8,
    fxArcane: 0xa98bff,
    plate: 0x14161a,
    ink: 0xebe6da,
    edge: 0x8d897f,
    line: 0x5a5448,
    hp: 0xebe6da,
    track: 0x14161a,
    shield: 0x8fd6ee,
    focus: 0xb8a8f7,
    select: 0xf2c46d,
    telegraph: 0xfff0cf,
    hitFlash: 0xffffff,
    fxTrue: 0xffffff,
    fxHeal: 0x5fcb92,
    fxShield: 0x8fd6ee,
    pipColor: { buff: 0x96eddc, debuff: 0xb6c24a, 'control-hard': 0xc58ef7, 'control-soft': 0xc58ef7, dot: 0xb6c24a, hot: 0x96eddc, special: 0xebe6da },
    pipGlyphSvg: PIP_GLYPH_SVG,
    metrics: DEFAULT_ARENA_METRICS,
  },
  light: {
    theme: 'light',
    sideUs: 0x8a5a12,
    sideThem: 0x4a5a70,
    roles: { tank: 0x0b6fae, melee: 0xc1500c, ranged: 0x957b00, controller: 0xa8457e, healer: 0x007f5c },
    roleGlyphSvg: ROLE_GLYPH_SVG,
    text: 0x1d1c19,
    textMuted: 0x54514a,
    floor: 0xeee7d6,
    wall: 0x857a64,
    good: 0x166d3f,
    bad: 0xb43626,
    warn: 0x8a6100,
    fxPhysical: 0x4a3b22,
    fxArcane: 0x5a2fd0,
    plate: 0xfbf8ee,
    ink: 0x1d1c19,
    edge: 0x5b5445,
    line: 0xcfc4a8,
    hp: 0x1d1c19,
    track: 0xfbf8ee,
    shield: 0x0f6b86,
    focus: 0x5b3fc4,
    select: 0x9a6514,
    telegraph: 0x2b2418,
    hitFlash: 0xffffff,
    fxTrue: 0x15130f,
    fxHeal: 0x166d3f,
    fxShield: 0x0f6b86,
    pipColor: { buff: 0x087a6b, debuff: 0x76680a, 'control-hard': 0x7437d0, 'control-soft': 0x7437d0, dot: 0x76680a, hot: 0x087a6b, special: 0x1d1c19 },
    pipGlyphSvg: PIP_GLYPH_SVG,
    metrics: DEFAULT_ARENA_METRICS,
  },
};

/** The default palette of a theme. */
export function defaultArenaPalette(theme: 'dark' | 'light'): ArenaPalette {
  return DEFAULT_ARENA_PALETTES[theme];
}
