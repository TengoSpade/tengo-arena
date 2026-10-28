/**
 * Palette helpers for the viewer (WP-M2D).
 *
 * `ArenaPalette` comes from the host (read from tokens.css custom properties for the current theme). Until the UI
 * designer's `--c-arena-*` / `--c-fx-*` tokens exist, `defaultArenaPalette` supplies the arena-only values
 * (floor, wall, hit tones) and mirrors the shipped `tokens.css` values for the rest, so a host without tokens
 * (tests, the dev harness) still gets a valid palette. The viewer itself never reads a colour literal for
 * game meaning: it reads the palette it was given.
 */
import type { ArenaPalette, RoleId } from '../types';

/** The five role ids in D-J order. */
export const ROLE_IDS: readonly RoleId[] = ['tank', 'melee', 'ranged', 'controller', 'healer'];

const SVG_HEAD = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>";
/** The `--glyph-*` shapes of tokens.css (D-J), decoded. */
const GLYPH_SVG: Readonly<Record<RoleId, string>> = {
  tank: `${SVG_HEAD}<path d='M12 1.5 21 5v6.2c0 5.4-3.8 9.6-9 11.3-5.2-1.7-9-5.9-9-11.3V5z'/></svg>`,
  melee: `${SVG_HEAD}<path d='M12 1 22.5 12 12 23 1.5 12z'/></svg>`,
  ranged: `${SVG_HEAD}<path d='M12 2 23 21.5H1z'/></svg>`,
  controller: `${SVG_HEAD}<path d='M3 2h18l-7 10 7 10H3l7-10z'/></svg>`,
  healer: `${SVG_HEAD}<path fill-rule='evenodd' d='M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21zM10.3 6.3v4H6.3v3.4h4v4h3.4v-4h4v-3.4h-4v-4z'/></svg>`,
};

const DARK: ArenaPalette = {
  theme: 'dark',
  sideUs: 0xe6b866,
  sideThem: 0xa7b4c6,
  roles: { tank: 0x56b4e9, melee: 0xee7a3c, ranged: 0xf0e442, controller: 0xd88bb6, healer: 0x1fb88a },
  roleGlyphSvg: GLYPH_SVG,
  text: 0xebe6da,
  textMuted: 0xaaa69c,
  // Arena-only values (designer token request): a mid-value sand-and-stone floor, 3:1 against both side colours.
  floor: 0x4a463c,
  wall: 0x8a8272,
  good: 0x5fcb92,
  bad: 0xf27a69,
  warn: 0xeebf52,
  fxPhysical: 0xf4c58f,
  fxArcane: 0xb9a0ff,
};

const LIGHT: ArenaPalette = {
  theme: 'light',
  sideUs: 0x8a5a12,
  sideThem: 0x4a5a70,
  roles: { tank: 0x0b6fae, melee: 0xc1500c, ranged: 0x957b00, controller: 0xa8457e, healer: 0x007f5c },
  roleGlyphSvg: GLYPH_SVG,
  text: 0x1d1c19,
  textMuted: 0x54514a,
  floor: 0xd9d2c0,
  wall: 0x8a8270,
  good: 0x166d3f,
  bad: 0xb43626,
  warn: 0x8a6100,
  fxPhysical: 0xb3541a,
  fxArcane: 0x6a4cc4,
};

/** A valid palette for a theme from the shipped tokens (the host overrides it from computed style). */
export function defaultArenaPalette(theme: 'dark' | 'light' = 'dark'): ArenaPalette {
  return theme === 'dark' ? DARK : LIGHT;
}

/** Linear mix of two 0xRRGGBB colours (t = 0 gives a, 1 gives b). */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const r = Math.round(ar + (((b >> 16) & 255) - ar) * t);
  const g = Math.round(ag + (((b >> 8) & 255) - ag) * t);
  const bl = Math.round(ab + ((b & 255) - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** The hit and cue tone colour of an effect or ability (EffectRenderState.tone). */
export function toneColor(tone: 'physical' | 'arcane' | 'true' | 'heal' | 'shield' | 'neutral', palette: ArenaPalette): number {
  switch (tone) {
    case 'physical':
      return palette.fxPhysical;
    case 'arcane':
      return palette.fxArcane;
    case 'true':
      return palette.text;
    case 'heal':
      return palette.good;
    case 'shield':
      return mixColor(palette.text, palette.floor, 0.25);
    case 'neutral':
      return palette.textMuted;
  }
}

/** Derived chrome colours (bar tracks, glyph plates, outlines): computed from the palette, never literals. */
export interface Chrome {
  /** Dark (dark theme) or light (light theme) plate behind glyphs and bar tracks, so every hue keeps 3:1. */
  plate: number;
  /** The colour of outlines and text strokes that separate marks from the floor. */
  outline: number;
  /** Bar track. */
  track: number;
  /** Ring colour of a hard-controlled fighter. */
  grey: number;
}

export function chromeFor(palette: ArenaPalette): Chrome {
  const dark = palette.theme === 'dark';
  return {
    plate: mixColor(palette.floor, dark ? 0x000000 : 0xffffff, 0.8),
    outline: mixColor(palette.floor, dark ? 0x000000 : 0xffffff, 0.92),
    track: mixColor(palette.floor, dark ? 0x000000 : 0xffffff, 0.7),
    grey: mixColor(palette.textMuted, palette.floor, 0.45),
  };
}
