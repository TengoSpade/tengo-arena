/**
 * Team colours and contrast (05-technical-m2 §A5, amended by §A18 decision 4; WP-M2C). PURE.
 *
 * asset-006: the player's side ring is brass (--c-side-us), the opponent's steel blue (--c-side-them); in a
 * match between other clubs both rings use the clubs' primaries, shifted in Lab (hue and chroma kept) until they reach
 * 3:1 against the floor. Research §6: when the two primaries are too close the away side becomes secondary-dominant.
 * Body colours are the exact club colours (A18 decision 4: the body is enclosed by the ring and keylines and carries
 * identity only); 3:1 binds the rings, the glyph plate and glyph, the bars and the pip outlines. The ring style (solid
 * or double) is the colour-free side cue.
 *
 * Colours are 0xRRGGBB numbers. The palette comes from the host (read from tokens.css); the defaults (defaults.ts) only
 * serve tests and the first frame before a host supplies one.
 */
import type { Side } from '../../core/model';
import { InvariantError } from '../../core/util';
import type { ArenaPalette, ClubColors, TeamColors } from '../types';

export * from './defaults';

/** Rings, the glyph plate and glyph, bars and pip outlines reach this contrast (04 §9, WCAG graphical objects). Bodies are exempt (A18). */
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

const LAB_EPS = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

/** A 0xRRGGBB colour from L*a*b* (D65), clipped to the sRGB gamut (clipping is the only thing that moves hue or chroma). */
function fromLab(l: number, a: number, b: number): number {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (f: number): number => (f * f * f > LAB_EPS ? f * f * f : (116 * f - 16) / LAB_KAPPA);
  const x = inv(fx) * 0.95047;
  const y = l > LAB_KAPPA * LAB_EPS ? fy * fy * fy : l / LAB_KAPPA;
  const z = inv(fz) * 1.08883;
  const encode = (v: number): number => {
    const c = Math.min(1, Math.max(0, v));
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  };
  return pack(encode(3.2404542 * x - 1.5371385 * y - 0.4985314 * z), encode(-0.969266 * x + 1.8760108 * y + 0.041556 * z), encode(0.0556434 * x - 0.2040259 * y + 1.0572252 * z));
}

/**
 * The colour itself when it reaches `min` contrast with `bg`; otherwise the nearest colour of the same hue and chroma
 * (L* moved the least, in Lab) that does. If the gamut leaves none (an extreme background), the nearest mix toward white
 * or black. For any background some lightness reaches 3:1.
 */
export function ensureContrast(color: number, bg: number, min: number = MIN_ARENA_CONTRAST): number {
  if (contrastRatio(color, bg) >= min) return color;
  const [l0, a, b] = lab(color);
  let best: { color: number; shift: number } | null = null;
  for (const dir of [1, -1]) {
    for (let step = 0.5; step <= 100; step += 0.5) {
      const l = l0 + dir * step;
      if (l < 0 || l > 100) break;
      const c = fromLab(l, a, b);
      if (contrastRatio(c, bg) >= min) {
        if (!best || step < best.shift) best = { color: c, shift: step };
        break;
      }
    }
  }
  if (best) return best.color;
  for (let i = 1; i <= 64; i++) {
    for (const target of [WHITE, BLACK]) {
      const c = mix(color, target, i / 64);
      if (contrastRatio(c, bg) >= min) return c;
    }
  }
  return contrastRatio(WHITE, bg) >= contrastRatio(BLACK, bg) ? WHITE : BLACK;
}

/**
 * Side colours for both sides of a match (index 0 = home, 1 = away). playerSide null = a match between other clubs.
 *
 * - Body and trim: the exact club colours (A18 decision 4). When the two primaries clash (CIEDE2000 below the clash
 *   threshold) the away side becomes secondary-dominant: it leads with whichever of its two colours is farther from the
 *   home primary. No colour is ever altered to separate the bodies; the ring and its style carry the side regardless.
 * - Ring: the player's side takes the brass token and a solid ring, the other side the steel-blue token and a double
 *   ring. Between other clubs the rings are the clubs' leading colours (home solid, away double), shifted in Lab (hue and
 *   chroma kept) until they reach 3:1 against the floor. Tokens that already pass are untouched.
 * `options.clashDeltaE` is clubs.json `colorRules.clashDeltaE` (CIEDE2000), 20 when the host does not pass it.
 */
export function colorsForMatch(home: ClubColors, away: ClubColors, playerSide: Side | null, palette: ArenaPalette, options?: { clashDeltaE?: number }): readonly [TeamColors, TeamColors] {
  const clash = options?.clashDeltaE ?? PRIMARY_CLASH_DELTA_E;
  const floor = palette.floor;
  const fit = (c: number): number => ensureContrast(c, floor, MIN_ARENA_CONTRAST);
  const homePrimary = home.primary;
  const homeSecondary = home.secondary;
  let awayPrimary = away.primary;
  let awaySecondary = away.secondary;
  if (colorDistance(homePrimary, awayPrimary) < clash && colorDistance(homePrimary, awaySecondary) > colorDistance(homePrimary, awayPrimary)) {
    [awayPrimary, awaySecondary] = [awaySecondary, awayPrimary];
  }

  let homeRing: number;
  let awayRing: number;
  let homeStyle: TeamColors['ringStyle'];
  let awayStyle: TeamColors['ringStyle'];
  if (playerSide === null) {
    homeRing = fit(homePrimary);
    awayRing = fit(awayPrimary);
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
