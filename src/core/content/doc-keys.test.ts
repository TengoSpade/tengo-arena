import { describe, expect, it } from 'vitest';
import { cloneJson } from '../util';
import { FIXTURE_CONTENT_RAW } from '../testkit';
import { hashContent, isDocKey, loadContent, stripDocKeys, type RawContentFiles } from './index';

describe('documentation keys', () => {
  it('are the keys that start with an underscore', () => {
    for (const key of ['_doc', '_note', '_label', '_capNote', '__proto__']) expect(isDocKey(key)).toBe(true);
    for (const key of ['doc', 'note', 'id', 'a_doc', 'derived']) expect(isDocKey(key)).toBe(false);
  });

  it('are removed at every depth, inside arrays too, and nothing else is', () => {
    const input = {
      _doc: 'top',
      id: 'x',
      text: '_doc is a value, not a key',
      list: ['_doc', { _note: 'n', keep: 1, deeper: [{ _label: 'l', keep: [1, 2, { _x: 0, y: null }] }] }],
      nested: { _doc: 'd', a: { _doc: 'd', b: true } },
    };
    expect(stripDocKeys(input)).toEqual({
      id: 'x',
      text: '_doc is a value, not a key',
      list: ['_doc', { keep: 1, deeper: [{ keep: [1, 2, { y: null }] }] }],
      nested: { a: { b: true } },
    });
  });

  it('does not modify its input and is idempotent', () => {
    const input = { _doc: 'a', b: { _doc: 'c', d: [1] } };
    const copy = cloneJson(input);
    const once = stripDocKeys(input);
    expect(input).toEqual(copy);
    expect(stripDocKeys(once)).toEqual(once);
  });

  it('stay in the content hash, which covers the files as written; loadContent records a hash it is given', () => {
    // The production build ships the files without the keys and passes the hash of the source (LoadContentOptions.hash).
    const raw = cloneJson(FIXTURE_CONTENT_RAW) as RawContentFiles;
    const stripped = stripDocKeys(raw);
    expect(JSON.stringify(stripped).length).toBeLessThan(JSON.stringify(raw).length); // the fixture does carry some
    expect(hashContent(stripped)).not.toBe(hashContent(raw));
    const sourceHash = hashContent(raw);
    const shipped = loadContent('fixture', stripped, { profile: 'fixture', hash: sourceHash });
    const asWritten = loadContent('fixture', raw, { profile: 'fixture' });
    expect(shipped.ok && asWritten.ok).toBe(true);
    if (shipped.ok && asWritten.ok) expect(shipped.value.ref).toEqual(asWritten.value.ref);
  });

  it('are not needed to load the fixture content: same result without them', () => {
    const raw = cloneJson(FIXTURE_CONTENT_RAW) as RawContentFiles;
    const a = loadContent('fixture', raw, { profile: 'fixture' });
    const b = loadContent('fixture', stripDocKeys(raw), { profile: 'fixture' });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.value.warnings).toEqual(a.value.warnings);
  });
});
