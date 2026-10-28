import { afterEach, describe, expect, it } from 'vitest';
import { cssColorToNumber, cssNumber, glyphTokenToSvg, readArenaPalette } from './palette';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('arena palette (read once from the CSS tokens)', () => {
  it('parses the colour notations tokens and clubs use', () => {
    expect(cssColorToNumber('#E6B866')).toBe(0xe6b866);
    expect(cssColorToNumber(' #abc ')).toBe(0xaabbcc);
    expect(cssColorToNumber('rgb(26, 45, 90)')).toBe(0x1a2d5a);
    expect(cssColorToNumber('rgba(26,45,90,0.5)')).toBe(0x1a2d5a);
    expect(cssColorToNumber('')).toBeNull();
    expect(cssColorToNumber('var(--x)')).toBeNull();
  });

  it('parses ms, s, px and unitless token values', () => {
    expect(cssNumber('90ms')).toBe(90);
    expect(cssNumber('0.09s')).toBeCloseTo(90);
    expect(cssNumber('3.5px')).toBe(3.5);
    expect(cssNumber('3')).toBe(3);
    expect(cssNumber('calc(1 + 1)')).toBeNull();
  });

  it('decodes a --glyph-* data URL token to SVG markup', () => {
    const token = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1 22.5 12 12 23 1.5 12z'/%3E%3C/svg%3E")`;
    const svg = glyphTokenToSvg(token);
    expect(svg).toContain('<svg');
    expect(svg).toContain("d='M12 1 22.5 12 12 23 1.5 12z'");
    expect(glyphTokenToSvg('nope')).toBeNull();
  });

  it('reads the tokens it finds and falls back, per token, for the rest (the designer tokens may not exist yet)', () => {
    const root = document.documentElement;
    root.style.setProperty('--c-side-us', '#112233');
    root.style.setProperty('--c-role-tank', '#445566');
    root.style.setProperty('--c-arena-plate', '#102030');
    root.style.setProperty('--c-pip-buff', 'rgb(1, 2, 3)');
    root.style.setProperty('--arena-ring-w', '5px');
    root.style.setProperty('--arena-hit-flash-ms', '0.12s');
    const dark = readArenaPalette('dark', root);
    expect(dark.theme).toBe('dark');
    expect(dark.sideUs).toBe(0x112233);
    expect(dark.roles.tank).toBe(0x445566);
    // No --c-arena-floor token: the fallback, a mid value.
    expect(dark.floor).toBeGreaterThan(0);
    for (const role of ['tank', 'melee', 'ranged', 'controller', 'healer'] as const) expect(dark.roleGlyphSvg[role]).toContain('<svg');
    // The designer's arena tokens (A18): plate, ink, HP, pips and the numeric metrics.
    expect(dark.plate).toBeGreaterThan(0);
    expect(dark.pipColor['control-hard']).toBe(dark.pipColor['control-soft']);
    expect(dark.pipColor.dot).toBe(dark.pipColor.debuff);
    expect(dark.pipColor.hot).toBe(dark.pipColor.buff);
    expect(dark.pipColor.special).toBe(dark.ink);
    for (const k of ['buff', 'debuff', 'control-hard', 'control-soft', 'dot', 'hot', 'special'] as const) expect(dark.pipGlyphSvg[k]).toContain('<svg');
    expect(dark.plate).toBe(0x102030);
    expect(dark.pipColor.buff).toBe(0x010203);
    expect(dark.metrics.ringWidthPx).toBe(5);
    expect(dark.metrics.hitFlashMs).toBe(120);
    expect(dark.metrics.flashLimitPerSecond).toBe(3); // no token: the designed value
    const light = readArenaPalette('light', root);
    expect(light.theme).toBe('light');
    expect(light.text).not.toBe(dark.text);
  });
});
