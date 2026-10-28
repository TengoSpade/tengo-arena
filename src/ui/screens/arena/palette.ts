/**
 * The arena palette (05-technical-m2 §A5): read ONCE from the CSS custom properties of tokens.css for the current
 * theme and handed to the viewer as an object, so the arena and the UI share one colour source and follow the theme.
 * Arena tokens the UI designer is adding (--c-arena-floor, --c-arena-wall, --c-fx-physical, --c-fx-arcane) fall back
 * to existing tokens (and, failing those, to the constants below) until they merge.
 */
import type { ArenaPalette, RoleId } from '../../../render';

const ROLES: readonly RoleId[] = ['tank', 'melee', 'ranged', 'controller', 'healer'];

/** Fallbacks when a token is missing (tests, a stylesheet that has not loaded): the dark theme's values. */
const FALLBACK = {
  dark: { sideUs: 0xe6b866, sideThem: 0xa7b4c6, text: 0xebe6da, textMuted: 0xaaa69c, floor: 0x3d3a33, wall: 0x24221e, good: 0x5fcb92, bad: 0xf27a69, warn: 0xeebf52, fxPhysical: 0xf0e2c0, fxArcane: 0xa48df0 },
  light: { sideUs: 0x8a5a12, sideThem: 0x4a5a70, text: 0x1d1c19, textMuted: 0x54514a, floor: 0xcfc4a8, wall: 0x8e846d, good: 0x166d3f, bad: 0xb43626, warn: 0x8a6100, fxPhysical: 0x5b4a2a, fxArcane: 0x5a3fb5 },
} as const;

const ROLE_FALLBACK: Record<'dark' | 'light', Record<RoleId, number>> = {
  dark: { tank: 0x56b4e9, melee: 0xee7a3c, ranged: 0xf0e442, controller: 0xd88bb6, healer: 0x1fb88a },
  light: { tank: 0x0b6fae, melee: 0xc1500c, ranged: 0x957b00, controller: 0xa8457e, healer: 0x007f5c },
};

/** The five role shapes (D-J) when the tokens cannot be read: the same silhouettes as tokens.css. */
const GLYPH_FALLBACK: Record<RoleId, string> = {
  tank: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 1.5 21 5v6.2c0 5.4-3.8 9.6-9 11.3-5.2-1.7-9-5.9-9-11.3V5z'/></svg>`,
  melee: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 1 22.5 12 12 23 1.5 12z'/></svg>`,
  ranged: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2 23 21.5H1z'/></svg>`,
  controller: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 2h18l-7 10 7 10H3l7-10z'/></svg>`,
  healer: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill-rule='evenodd' d='M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21zM10.3 6.3v4H6.3v3.4h4v4h3.4v-4h4v-3.4h-4v-4z'/></svg>`,
};

/** '#1a2d5a', '#abc', 'rgb(26, 45, 90)' or 'rgba(...)' as 0xRRGGBB; null when it is none of those. */
export function cssColorToNumber(value: string): number | null {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(v);
  if (m) return parseInt(m[1]!, 16);
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m) return parseInt(m[1]! + m[1]! + m[2]! + m[2]! + m[3]! + m[3]!, 16);
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(v);
  if (m) return ((Number(m[1]) & 255) << 16) | ((Number(m[2]) & 255) << 8) | (Number(m[3]) & 255);
  return null;
}

/** A `url("data:image/svg+xml,...")` token as its SVG markup; null when it is not one. */
export function glyphTokenToSvg(value: string): string | null {
  const m = /^url\(\s*(["']?)data:image\/svg\+xml[;,](?:utf8,)?(.*)\1\s*\)$/s.exec(value.trim());
  if (!m) return null;
  try {
    const svg = decodeURIComponent(m[2]!);
    return svg.includes('<svg') ? svg : null;
  } catch {
    return null;
  }
}

/** Read the palette for `theme` from `root`'s computed style (once per viewer and again after a theme change). */
export function readArenaPalette(theme: 'dark' | 'light', root: Element = document.documentElement): ArenaPalette {
  const css = typeof getComputedStyle === 'function' ? getComputedStyle(root) : null;
  const read = (name: string): string => css?.getPropertyValue(name).trim() ?? '';
  const color = (names: readonly string[], fallback: number): number => {
    for (const n of names) {
      const c = cssColorToNumber(read(n));
      if (c !== null) return c;
    }
    return fallback;
  };
  const f = FALLBACK[theme];
  const roles = {} as Record<RoleId, number>;
  const roleGlyphSvg = {} as Record<RoleId, string>;
  for (const r of ROLES) {
    roles[r] = color([`--c-role-${r}`], ROLE_FALLBACK[theme][r]);
    roleGlyphSvg[r] = glyphTokenToSvg(read(`--glyph-${r}`)) ?? GLYPH_FALLBACK[r];
  }
  return {
    theme,
    sideUs: color(['--c-side-us'], f.sideUs),
    sideThem: color(['--c-side-them'], f.sideThem),
    roles,
    roleGlyphSvg,
    text: color(['--c-text'], f.text),
    textMuted: color(['--c-text-muted'], f.textMuted),
    floor: color(['--c-arena-floor'], f.floor),
    wall: color(['--c-arena-wall'], f.wall),
    good: color(['--c-good'], f.good),
    bad: color(['--c-bad'], f.bad),
    warn: color(['--c-warn'], f.warn),
    fxPhysical: color(['--c-fx-physical'], f.fxPhysical),
    fxArcane: color(['--c-fx-arcane'], f.fxArcane),
  };
}
