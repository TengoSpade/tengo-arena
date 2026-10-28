/**
 * Team colours and contrast (05-technical-m2 §A5; WP-M2C). PURE.
 *
 * asset-006: the player's side ring is brass (--c-side-us), the opponent's steel blue (--c-side-them); in a
 * match between other clubs both rings use the clubs' primaries with a luminance check. Research §6: when the
 * two primaries are too close the away side becomes secondary-dominant. Every ring and body colour must reach
 * 3:1 against the floor (04 §9); the ring style (solid or double) is the colour-free side cue.
 *
 * Colours are 0xRRGGBB numbers. The palette comes from the host (read from tokens.css); the defaults below only
 * serve tests and the first frame before a host supplies one.
 */
import type { Side } from '../../core/model';
import { InvariantError } from '../../core/util';
import type { ArenaPalette, ClubColors, RoleId, TeamColors } from '../types';

/** Ring, body and trim colours reach this contrast against the arena floor (04 §9, WCAG graphical objects). */
export const MIN_ARENA_CONTRAST = 3;

/**
 * Two body colours closer than this (CIEDE2000) clash: the away side then becomes secondary-dominant (research §6).
 * The default is clubs.json `colorRules.clashDeltaE`; a host that has the content passes its own (`options.clashDeltaE`).
 */
export const PRIMARY_CLASH_DELTA_E = 20;

/** '#1A2D5A' (clubs.json, tokens.css) → 0x1a2d5a. Accepts '#rgb' and '#rrggbb', with or without the '#'. */
export function parseHexColor(hex: string): number {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) throw new InvariantError(`parseHexColor: "${hex}" is not a #rgb or #rrggbb colour`);
  let digits = m[1]!;
  if (digits.length === 3) digits = `${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
  return parseInt(digits, 16);
}

/** Channels 0..255 of a 0xRRGGBB colour. */
function channels(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

function pack(r: number, g: number, b: number): number {
  const q = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return (q(r) << 16) | (q(g) << 8) | q(b);
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a 0xRRGGBB colour (0..1). */
export function relativeLuminance(color: number): number {
  const [r, g, b] = channels(color);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio of two 0xRRGGBB colours (1..21). */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L*a*b* (D65) of a 0xRRGGBB colour. */
function lab(color: number): [number, number, number] {
  const [r8, g8, b8] = channels(color);
  const r = linear(r8);
  const g = linear(g8);
  const b = linear(b8);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const RAD = Math.PI / 180;

function hueDeg(b: number, a: number): number {
  if (a === 0 && b === 0) return 0;
  const h = Math.atan2(b, a) / RAD;
  return h < 0 ? h + 360 : h;
}

/** CIEDE2000 between two L*a*b* colours (Sharma, Wu, Dalal 2005; kL = kC = kH = 1). */
export function deltaE2000Lab(l1: number, a1: number, b1: number, l2: number, a2: number, b2: number): number {
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const cBar7 = Math.pow(cBar, 7);
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + Math.pow(25, 7))));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);
  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp / 2) * RAD);
  const lBarP = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP: number;
  if (c1p * c2p === 0) hBarP = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hBarP = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hBarP = (h1p + h2p + 360) / 2;
  else hBarP = (h1p + h2p - 360) / 2;
  const t = 1 - 0.17 * Math.cos((hBarP - 30) * RAD) + 0.24 * Math.cos(2 * hBarP * RAD) + 0.32 * Math.cos((3 * hBarP + 6) * RAD) - 0.2 * Math.cos((4 * hBarP - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const cBarP7 = Math.pow(cBarP, 7);
  const rc = 2 * Math.sqrt(cBarP7 / (cBarP7 + Math.pow(25, 7)));
  const sl = 1 + (0.015 * (lBarP - 50) ** 2) / Math.sqrt(20 + (lBarP - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(2 * dTheta * RAD) * rc;
  const termL = dLp / sl;
  const termC = dCp / sc;
  const termH = dHp / sh;
  return Math.sqrt(termL * termL + termC * termC + termH * termH + rt * termC * termH);
}

/** Perceptual distance (CIEDE2000) of two colours: about 1 is just noticeable, 20 or more reads as a different colour. */
export function colorDistance(a: number, b: number): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return deltaE2000Lab(l1, a1, b1, l2, a2, b2);
}

function mix(from: number, to: number, t: number): number {
  const [r1, g1, b1] = channels(from);
  const [r2, g2, b2] = channels(to);
  return pack(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

const WHITE = 0xffffff;
const BLACK = 0x000000;

/** Smallest mix of `color` toward `target` (0..1, in steps of 1/64) that reaches `min` contrast with `bg`; null when even the target fails. */
function minMixFor(color: number, target: number, bg: number, min: number): number | null {
  if (contrastRatio(target, bg) < min) return null;
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    if (contrastRatio(mix(color, target, t), bg) >= min) return t;
  }
  return 1;
}

/**
 * The colour itself when it reaches `min` contrast with `bg`; otherwise the nearest mix of it toward white or black
 * that does (hue kept, lightness moved the least). For any background at least one direction can reach 3:1.
 */
export function ensureContrast(color: number, bg: number, min: number = MIN_ARENA_CONTRAST): number {
  if (contrastRatio(color, bg) >= min) return color;
  const toWhite = minMixFor(color, WHITE, bg, min);
  const toBlack = minMixFor(color, BLACK, bg, min);
  if (toWhite === null && toBlack === null) return contrastRatio(WHITE, bg) >= contrastRatio(BLACK, bg) ? WHITE : BLACK;
  if (toBlack === null || (toWhite !== null && toWhite <= toBlack)) return mix(color, WHITE, toWhite!);
  return mix(color, BLACK, toBlack);
}

/** Moves `color` away from `ref` (toward white or black, the smaller move that works) until the two are at least `minDistance` apart and `color` keeps `min` contrast with `bg`. */
function separate(color: number, ref: number, bg: number, minDistance: number): number {
  let best = color;
  let bestDistance = colorDistance(color, ref);
  for (let i = 1; i <= 32; i++) {
    const t = i / 32;
    for (const target of [WHITE, BLACK]) {
      const c = mix(color, target, t);
      if (contrastRatio(c, bg) < MIN_ARENA_CONTRAST) continue;
      const d = colorDistance(c, ref);
      if (d >= minDistance) return c;
      if (d > bestDistance) {
        best = c;
        bestDistance = d;
      }
    }
  }
  return best;
}

/**
 * Side colours for both sides of a match (index 0 = home, 1 = away). playerSide null = a match between other clubs.
 *
 * - Ring: the player's side takes the brass token and a solid ring, the other side the steel-blue token and a double
 *   ring. Between other clubs the rings are the clubs' (adjusted) primaries, home solid and away double: the ring
 *   style is the colour-free side cue either way.
 * - Body: the club's primary, trim its secondary. When the two primaries clash (ΔE < PRIMARY_CLASH_DELTA_E) the away
 *   side becomes secondary-dominant (the farther of its two colours leads); if that still clashes the away body is
 *   lightened or darkened until it does not.
 * - Every colour is first moved the least needed to reach 3:1 against the floor (ensureContrast).
 * `options.clashDeltaE` is clubs.json `colorRules.clashDeltaE` (CIEDE2000), 20 when the host does not pass it.
 */
export function colorsForMatch(home: ClubColors, away: ClubColors, playerSide: Side | null, palette: ArenaPalette, options?: { clashDeltaE?: number }): readonly [TeamColors, TeamColors] {
  const clash = options?.clashDeltaE ?? PRIMARY_CLASH_DELTA_E;
  const floor = palette.floor;
  const fit = (c: number): number => ensureContrast(c, floor, MIN_ARENA_CONTRAST);
  const homePrimary = fit(home.primary);
  const homeSecondary = fit(home.secondary);
  let awayPrimary = fit(away.primary);
  let awaySecondary = fit(away.secondary);

  if (colorDistance(homePrimary, awayPrimary) < clash) {
    // Secondary-dominant away side: lead with the colour farther from the home body.
    if (colorDistance(homePrimary, awaySecondary) > colorDistance(homePrimary, awayPrimary)) {
      [awayPrimary, awaySecondary] = [awaySecondary, awayPrimary];
    }
    if (colorDistance(homePrimary, awayPrimary) < clash) {
      awayPrimary = separate(awayPrimary, homePrimary, floor, clash);
    }
  }

  let homeRing: number;
  let awayRing: number;
  let homeStyle: TeamColors['ringStyle'];
  let awayStyle: TeamColors['ringStyle'];
  if (playerSide === null) {
    homeRing = homePrimary;
    awayRing = awayPrimary;
    homeStyle = 'solid';
    awayStyle = 'double';
  } else {
    const homeIsPlayer = playerSide === 0;
    homeRing = fit(homeIsPlayer ? palette.sideUs : palette.sideThem);
    awayRing = fit(homeIsPlayer ? palette.sideThem : palette.sideUs);
    homeStyle = homeIsPlayer ? 'solid' : 'double';
    awayStyle = homeIsPlayer ? 'double' : 'solid';
  }
  return [
    { primary: homePrimary, secondary: homeSecondary, ring: homeRing, ringStyle: homeStyle },
    { primary: awayPrimary, secondary: awaySecondary, ring: awayRing, ringStyle: awayStyle },
  ];
}

// ---- Defaults (tests and the first frame; the host's computed-style palette replaces them) ---------------------

const GLYPH_OPEN = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>";
const ROLE_GLYPH_SVG: Readonly<Record<RoleId, string>> = {
  tank: `${GLYPH_OPEN}<path d='M12 1.5 21 5v6.2c0 5.4-3.8 9.6-9 11.3-5.2-1.7-9-5.9-9-11.3V5z'/></svg>`,
  melee: `${GLYPH_OPEN}<path d='M12 1 22.5 12 12 23 1.5 12z'/></svg>`,
  ranged: `${GLYPH_OPEN}<path d='M12 2 23 21.5H1z'/></svg>`,
  controller: `${GLYPH_OPEN}<path d='M3 2h18l-7 10 7 10H3l7-10z'/></svg>`,
  healer: `${GLYPH_OPEN}<path fill-rule='evenodd' d='M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21zM10.3 6.3v4H6.3v3.4h4v4h3.4v-4h4v-3.4h-4v-4z'/></svg>`,
};

/** Dark and light arena palettes: the values tokens.css defines (04 §3, asset-006). */
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
  },
};

/** The default palette of a theme. */
export function defaultArenaPalette(theme: 'dark' | 'light'): ArenaPalette {
  return DEFAULT_ARENA_PALETTES[theme];
}
