import { afterEach, describe, expect, it } from 'vitest';
import { cssColorToNumber, glyphTokenToSvg, readArenaPalette } from './palette';

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
    const dark = readArenaPalette('dark', root);
    expect(dark.theme).toBe('dark');
    expect(dark.sideUs).toBe(0x112233);
    expect(dark.roles.tank).toBe(0x445566);
    // No --c-arena-floor token: the fallback, a mid value.
    expect(dark.floor).toBeGreaterThan(0);
    for (const role of ['tank', 'melee', 'ranged', 'controller', 'healer'] as const) expect(dark.roleGlyphSvg[role]).toContain('<svg');
    const light = readArenaPalette('light', root);
    expect(light.theme).toBe('light');
    expect(light.text).not.toBe(dark.text);
  });
});
