/**
 * The arena palette (05-technical-m2 §A5, §A18; mockups/arena-notes.md §3): read from the CSS custom properties of
 * tokens.css for the current theme and handed to the viewer as ONE object, so the arena and the DOM share one colour
 * source and follow the theme, the status-palette option, reduced motion and the interface scale. The host reads it
 * once per viewer and again after a theme, motion or scale change, never per frame.
 *
 * - `var()` aliases (--c-fx-heal, --c-arena-select, ...) are resolved by getComputedStyle, so nothing here follows them.
 * - Colours become 0xRRGGBB; ms and unitless values become numbers; rem sizes are measured with a hidden probe element
 *   (the host never multiplies by hand, so --ui-scale reaches labels, bars and pips).
 * - Glyph tokens (roles and pips) are `url("data:image/svg+xml,...")` and are decoded to SVG markup.
 * Where a token is missing (a test, a stylesheet that has not loaded) each value falls back on its own to the dark
 * theme's designed value, so a partial stylesheet never blanks the arena.
 */
import type { ArenaMetrics, ArenaPalette, PipKind, RoleId } from '../../../render';

const ROLES: readonly RoleId[] = ['tank', 'melee', 'ranged', 'controller', 'healer'];
const PIPS: readonly PipKind[] = ['buff', 'debuff', 'control-hard', 'control-soft', 'dot', 'hot', 'special'];

/** The designed values of tokens.css, per theme (the fallback for a missing token). */
const FALLBACK = {
  dark: {
    sideUs: 0xe6b866, sideThem: 0xa7b4c6, text: 0xebe6da, textMuted: 0xaaa69c, floor: 0x3e3a32, wall: 0x716857, line: 0x5a5448, plate: 0x14161a, ink: 0xebe6da, edge: 0x8d897f, hp: 0xebe6da, track: 0x14161a,
    shield: 0x8fd6ee, focus: 0xb8a8f7, select: 0xf2c46d, telegraph: 0xfff0cf, hitFlash: 0xffffff, fxPhysical: 0xf2e6c8, fxArcane: 0xa98bff, fxTrue: 0xffffff, fxHeal: 0x5fcb92, fxShield: 0x8fd6ee,
    good: 0x5fcb92, bad: 0xf27a69, warn: 0xeebf52, pipBuff: 0x96eddc, pipDebuff: 0xb6c24a, pipControl: 0xc58ef7,
  },
  light: {
    sideUs: 0x8a5a12, sideThem: 0x4a5a70, text: 0x1d1c19, textMuted: 0x54514a, floor: 0xeee7d6, wall: 0x857a64, line: 0xcfc4a8, plate: 0xfbf8ee, ink: 0x1d1c19, edge: 0x5b5445, hp: 0x1d1c19, track: 0xfbf8ee,
    shield: 0x0f6b86, focus: 0x5b3fc4, select: 0x9a6514, telegraph: 0x2b2418, hitFlash: 0xffffff, fxPhysical: 0x4a3b22, fxArcane: 0x5a2fd0, fxTrue: 0x15130f, fxHeal: 0x166d3f, fxShield: 0x0f6b86,
    good: 0x166d3f, bad: 0xb43626, warn: 0x8a6100, pipBuff: 0x087a6b, pipDebuff: 0x76680a, pipControl: 0x7437d0,
  },
} as const;

const ROLE_FALLBACK: Record<'dark' | 'light', Record<RoleId, number>> = {
  dark: { tank: 0x56b4e9, melee: 0xee7a3c, ranged: 0xf0e442, controller: 0xd88bb6, healer: 0x1fb88a },
  light: { tank: 0x0b6fae, melee: 0xc1500c, ranged: 0x957b00, controller: 0xa8457e, healer: 0x007f5c },
};

const svg = (d: string, extra = ''): string => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path ${extra}d='${d}'/></svg>`;

/** The five role shapes (D-J) and the seven pip silhouettes when the tokens cannot be read: the same shapes as tokens.css. */
const GLYPH_FALLBACK: Record<RoleId, string> = {
  tank: svg('M12 1.5 21 5v6.2c0 5.4-3.8 9.6-9 11.3-5.2-1.7-9-5.9-9-11.3V5z'),
  melee: svg('M12 1 22.5 12 12 23 1.5 12z'),
  ranged: svg('M12 2 23 21.5H1z'),
  controller: svg('M3 2h18l-7 10 7 10H3l7-10z'),
  healer: svg('M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21zM10.3 6.3v4H6.3v3.4h4v4h3.4v-4h4v-3.4h-4v-4z', "fill-rule='evenodd' "),
};
const PIP_GLYPH_FALLBACK: Record<PipKind, string> = {
  buff: svg('M3 10.2 12 1.6l9 8.6-2.6 2.6L12 6.8l-6.4 6zM3 19.2l9-8.6 9 8.6-2.6 2.6-6.4-6-6.4 6z'),
  debuff: svg('M3 13.8l9 8.6 9-8.6-2.6-2.6-6.4 6-6.4-6zM3 4.8l9 8.6 9-8.6-2.6-2.6-6.4 6-6.4-6z'),
  'control-hard': svg('M8.2 2h7.6L22 8.2v7.6L15.8 22H8.2L2 15.8V8.2zM6.5 10.2v3.6h11v-3.6z', "fill-rule='evenodd' "),
  'control-soft': svg('M8.2 2h7.6L22 8.2v7.6L15.8 22H8.2L2 15.8V8.2zM9 5.6 5.6 9v6L9 18.4h6l3.4-3.4V9L15 5.6z', "fill-rule='evenodd' "),
  dot: svg('M12 1.8c3.9 4.9 6.6 8.3 6.6 11.9a6.6 6.6 0 0 1-13.2 0c0-3.6 2.7-7 6.6-11.9z'),
  hot: svg('M12 21.5C5.2 15.8 2.5 12.4 2.5 8.7A5.1 5.1 0 0 1 12 6.3a5.1 5.1 0 0 1 9.5 2.4c0 3.7-2.7 7.1-9.5 12.8z'),
  special: svg('M12 1.5l2.5 8 8 2.5-8 2.5-2.5 8-2.5-8-8-2.5 8-2.5z'),
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

/** '90ms', '0.09s', '3.5px' or '3' as a number (ms, ms, px, unitless); null when it is none of those. */
export function cssNumber(value: string): number | null {
  const m = /^(-?\d*\.?\d+)\s*(ms|s|px)?$/.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === 's' ? n * 1000 : n;
}

/** A `url("data:image/svg+xml,...")` token as its SVG markup; null when it is not one. */
export function glyphTokenToSvg(value: string): string | null {
  const m = /^url\(\s*(["']?)data:image\/svg\+xml[;,](?:utf8,)?(.*)\1\s*\)$/s.exec(value.trim());
  if (!m) return null;
  try {
    const s = decodeURIComponent(m[2]!);
    return s.includes('<svg') ? s : null;
  } catch {
    return null;
  }
}

const METRICS_FALLBACK: ArenaMetrics = {
  ringWidthPx: 3.5, ringLinePx: 2, ringGapPx: 1.5, downOpacity: 0.4, zoneAlpha: 0.22, telegraphFillAlpha: 0.16, telegraphEdgeAlpha: 0.9, telegraphProgressAlpha: 0.3,
  hitFlashAlpha: 0.7, hitFlashMs: 90, flashLimitPerSecond: 3, fxFadeMs: 400, numberMergeMs: 100, numberRisePx: 14, pulseMs: 220, easeMs: 220, labelSizePx: 12, pipSizePx: 16, barHeightPx: 6,
  barWidthM: 1.3, plateRadiusM: 0.33, glyphSizeM: 0.44, plateRadiusHybridM: 0.36, glyphSizeHybridM: 0.34,
};

/** Read the palette for `theme` from `root`'s computed style (once per viewer and after a theme, motion or scale change). */
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
  const num = (name: string, fallback: number): number => cssNumber(read(name)) ?? fallback;
  // Lengths in rem (or any CSS length) are measured: the browser applies --ui-scale and the root size for us.
  const holder: { el: HTMLElement | null } = { el: null };
  const length = (name: string, fallback: number): number => {
    if (!read(name)) return fallback;
    if (typeof document === 'undefined' || !(root instanceof HTMLElement)) return num(name, fallback);
    const probe = (holder.el ??= document.createElement('div'));
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:var(${name});height:0`;
    root.appendChild(probe);
    const px = parseFloat(getComputedStyle(probe).width);
    return Number.isFinite(px) && px > 0 ? px : (cssNumber(read(name)) ?? fallback);
  };
  const f = FALLBACK[theme];
  const roles = {} as Record<RoleId, number>;
  const roleGlyphSvg = {} as Record<RoleId, string>;
  for (const r of ROLES) {
    roles[r] = color([`--c-role-${r}`], ROLE_FALLBACK[theme][r]);
    roleGlyphSvg[r] = glyphTokenToSvg(read(`--glyph-${r}`)) ?? GLYPH_FALLBACK[r];
  }
  const ink = color(['--c-arena-ink'], f.ink);
  const pipBuff = color(['--c-pip-buff'], f.pipBuff);
  const pipDebuff = color(['--c-pip-debuff'], f.pipDebuff);
  const pipControl = color(['--c-pip-control'], f.pipControl);
  // The data-pip mapping of tokens.css: dot follows debuff, hot follows buff, special is the plate ink.
  const pipColor: Record<PipKind, number> = { buff: pipBuff, debuff: pipDebuff, 'control-hard': pipControl, 'control-soft': pipControl, dot: pipDebuff, hot: pipBuff, special: ink };
  const pipGlyphSvg = {} as Record<PipKind, string>;
  for (const k of PIPS) pipGlyphSvg[k] = glyphTokenToSvg(read(`--glyph-pip-${k}`)) ?? PIP_GLYPH_FALLBACK[k];
  const m = METRICS_FALLBACK;
  const metrics: ArenaMetrics = {
    ringWidthPx: num('--arena-ring-w', m.ringWidthPx),
    ringLinePx: num('--arena-ring-line', m.ringLinePx),
    ringGapPx: num('--arena-ring-gap', m.ringGapPx),
    downOpacity: num('--arena-down-opacity', m.downOpacity),
    zoneAlpha: num('--arena-zone-alpha', m.zoneAlpha),
    telegraphFillAlpha: num('--arena-telegraph-fill', m.telegraphFillAlpha),
    telegraphEdgeAlpha: num('--arena-telegraph-edge', m.telegraphEdgeAlpha),
    telegraphProgressAlpha: num('--arena-telegraph-progress', m.telegraphProgressAlpha),
    hitFlashAlpha: num('--arena-hit-flash-alpha', m.hitFlashAlpha),
    hitFlashMs: num('--arena-hit-flash-ms', m.hitFlashMs),
    flashLimitPerSecond: num('--arena-flash-limit', m.flashLimitPerSecond),
    fxFadeMs: num('--arena-fx-fade-ms', m.fxFadeMs),
    numberMergeMs: num('--arena-number-merge-ms', m.numberMergeMs),
    numberRisePx: length('--arena-number-rise', m.numberRisePx),
    pulseMs: num('--arena-pulse-ms', m.pulseMs),
    easeMs: num('--arena-ease-ms', m.easeMs),
    labelSizePx: length('--arena-label-size', m.labelSizePx),
    pipSizePx: length('--arena-pip-size', m.pipSizePx),
    barHeightPx: length('--arena-bar-h', m.barHeightPx),
    // Unitless proportions in metres of arena: read as numbers, never measured.
    barWidthM: num('--arena-bar-w', m.barWidthM),
    plateRadiusM: num('--arena-plate-r', m.plateRadiusM),
    glyphSizeM: num('--arena-glyph', m.glyphSizeM),
    plateRadiusHybridM: num('--arena-plate-r-hybrid', m.plateRadiusHybridM),
    glyphSizeHybridM: num('--arena-glyph-hybrid', m.glyphSizeHybridM),
  };
  holder.el?.remove();
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
    plate: color(['--c-arena-plate'], f.plate),
    ink,
    edge: color(['--c-arena-edge'], f.edge),
    line: color(['--c-arena-line'], f.line),
    hp: color(['--c-arena-hp'], f.hp),
    track: color(['--c-arena-track'], f.track),
    shield: color(['--c-arena-shield'], f.shield),
    focus: color(['--c-arena-focus'], f.focus),
    select: color(['--c-arena-select'], f.select),
    telegraph: color(['--c-arena-telegraph'], f.telegraph),
    hitFlash: color(['--c-arena-hit-flash'], f.hitFlash),
    fxTrue: color(['--c-fx-true'], f.fxTrue),
    fxHeal: color(['--c-fx-heal'], f.fxHeal),
    fxShield: color(['--c-fx-shield'], f.fxShield),
    pipColor,
    pipGlyphSvg,
    metrics,
  };
}
