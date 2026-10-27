import { describe, expect, it } from 'vitest';
import type { ResolvedConfig } from 'vite';
import { hashContent } from '../../src/core/content/index.ts';
import { loadRawContentFromDisk, sourceContentHashes as hashesOnDisk } from '../lib/node-content.ts';
import { isContentJson, sourceContentHashes, stripDocKeysFromJson, stripDocKeysPlugin } from './strip-doc-keys.ts';

type Hook = (this: unknown, code: string, id: string) => { code: string; map: null } | null;

function plugin(root: string) {
  const p = stripDocKeysPlugin();
  (p.configResolved as (c: ResolvedConfig) => void)({ root } as ResolvedConfig);
  return { p, transform: (id: string, code = '{"_doc":"x","a":1}') => (p.transform as Hook).call({}, code, id) };
}

describe('strip-doc-keys plugin', () => {
  it('runs in production builds only, before the JSON step', () => {
    const p = stripDocKeysPlugin();
    expect(p.apply).toBe('build');
    expect(p.enforce).toBe('pre');
  });

  it('drops _ keys at every depth and keeps the rest, compact', () => {
    const text = JSON.stringify({ _doc: 'a', x: [{ _note: 'n', y: 1.5 }, '_doc'], z: { _label: 'l', w: null } }, null, 2);
    expect(stripDocKeysFromJson(text)).toBe('{"x":[{"y":1.5},"_doc"],"z":{"w":null}}');
  });

  it('fails loudly on invalid JSON instead of shipping it', () => {
    expect(() => stripDocKeysFromJson('{"a":')).toThrow();
  });

  it('touches only content/<theme>/*.json under the project root', () => {
    const { transform } = plugin('C:/work/game');
    expect(transform('C:/work/game/content/default/combat.json')).toEqual({ code: '{"a":1}', map: null });
    expect(transform('C:/work/game/content/default/combat.json?import')).toEqual({ code: '{"a":1}', map: null });
    expect(transform('C:/work/game/src/core/testkit/fixture-content.json')).toBeNull();
    expect(transform('C:/work/game/node_modules/x/content/default/a.json')).toBeNull();
    expect(transform('C:/work/game/content/default/readme.md')).toBeNull();
    expect(transform('C:/work/game/package.json')).toBeNull();
  });

  it('matches content paths by prefix', () => {
    expect(isContentJson('/p/content/default/a.json', '/p/content/')).toBe(true);
    expect(isContentJson('/p/content-old/default/a.json', '/p/content/')).toBe(false);
    expect(isContentJson('/p/content/default/a.ts', '/p/content/')).toBe(false);
  });

  it('defines the hash of the source files as written, per theme (the content identity ignores the stripping)', async () => {
    const hashes = await sourceContentHashes();
    expect(hashes).toEqual(hashesOnDisk());
    expect(hashes['default']).toBe(hashContent(loadRawContentFromDisk('default').raw));
    const config = await (stripDocKeysPlugin().config as unknown as () => Promise<{ define: Record<string, string> }>)();
    expect(JSON.parse(config.define['__CONTENT_HASHES__']!)).toEqual(hashes);
  }, 60_000);
});
