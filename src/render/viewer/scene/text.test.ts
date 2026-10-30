/**
 * Releasing a bitmap font must not make PixiJS warn "[BindGroup] a 'textureSource' / 'textureSampler' was destroyed while
 * still bound to a shader" (final QA, D4). The cause, shown here with PixiJS's own classes and no GPU: a label of 50 or
 * more glyphs is drawn as a graphic of its own whose texture bind group PixiJS caches for good and which listens to the
 * font page's source and sampler; destroying the page makes that group warn. `uninstallFont` drops the stale listeners
 * first. (A real browser reproduces it with a 51-glyph BitmapText: no warning up to 49 glyphs, one pair from 50.)
 */
import { BindGroup, BitmapFont, Cache, Texture, TextureSource } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uninstallFont } from './text';

/** A stand-in for an installed dynamic bitmap font with one page, as BitmapFont.uninstall finds and destroys it. */
function installFakeFont(name: string): { texture: Texture; group: BindGroup } {
  const texture = new Texture({ source: new TextureSource({ width: 8, height: 8 }) });
  // The bind group of a non-batched label's draw: the page's source and sampler (PixiJS caches it for good).
  const group = new BindGroup({ 0: texture.source, 1: texture.source.style });
  const font = {
    pages: [{ texture }],
    destroy: () => {
      texture.destroy(true);
      Cache.remove(`${name}-bitmap`);
    },
  };
  Cache.set(`${name}-bitmap`, font);
  return { texture, group };
}

const warnings = (spy: { mock: { calls: unknown[][] } }): string[] => spy.mock.calls.map((c) => c.map(String).join(' '));

afterEach(() => vi.restoreAllMocks());

describe('releasing a bitmap font', () => {
  it('PixiJS itself warns once per source and sampler when a page is destroyed under a live bind group (the bug)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installFakeFont('qa-control');
    BitmapFont.uninstall('qa-control');
    const text = warnings(warn).join('\n');
    expect(text).toContain("'textureSource' was destroyed while still bound");
    expect(text).toContain("'textureSampler' was destroyed while still bound");
  });

  it('uninstallFont releases the same font without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { texture } = installFakeFont('qa-fixed');
    uninstallFont('qa-fixed');
    expect(warnings(warn)).toEqual([]);
    expect(texture.destroyed).toBe(true); // the page is released all the same
    expect(Cache.has('qa-fixed-bitmap')).toBe(false);
  });

  it('is safe for a font that is not installed, and twice', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installFakeFont('qa-twice');
    uninstallFont('qa-twice');
    expect(() => uninstallFont('qa-twice')).not.toThrow();
    expect(() => uninstallFont('never-installed')).not.toThrow();
    expect(warnings(warn)).toEqual([]);
  });
});
