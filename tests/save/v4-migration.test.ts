/**
 * Save schema v4 -> v5 (M2; docs/design/_drafts/05-technical-m2.md §A3, §A13, tech-023) on a real v4 save.
 *
 * Fixture `m11-v4-s1mw1-between.json.gz`: written by the pre-M2 build on main @ bdfd5bc (state schema 4, engine 2;
 * generator kept out of the repository), a new career (seed "v4-fixture-1", the first club of the lowest tier) paused
 * on the between-round screen of its first match (MW1, after round 1), so it carries a v4 live match. The step is the
 * identity plus the version stamp: the save loads as v5 with nothing else changed, saves back byte-identically, and
 * plays on (the match to its end, the rest of the week).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { formatContentIssues, loadContent, type ContentDB } from '../../src/core/content';
import { advance } from '../../src/core/game';
import { STATE_SCHEMA_VERSION, type GameState, type SaveEnvelope } from '../../src/core/model';
import { checksumState, createSave, parseSave, serializeSave, validateState } from '../../src/core/save';
import { ENGINE_VERSION } from '../../src/core/sim';
import { stableStringify } from '../../src/core/util';
import { REPO_ROOT, loadRawContentFromDisk } from '../../scripts/lib/node-content';

function defaultContent(): ContentDB {
  const r = loadContent('default', loadRawContentFromDisk('default').raw);
  if (!r.ok) throw new Error(formatContentIssues(r.error));
  return r.value;
}

const content = defaultContent();
const json = gunzipSync(readFileSync(join(REPO_ROOT, 'tests', 'fixtures', 'saves', 'm11-v4-s1mw1-between.json.gz'))).toString('utf8');
const v4 = JSON.parse(json) as SaveEnvelope;

function load(text: string): { state: GameState; from: number | null; warnings: string[] } {
  const r = parseSave(text, content);
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return { state: r.value.envelope.state, from: r.value.migratedFrom, warnings: r.value.warnings };
}

function save(state: GameState): string {
  return serializeSave(createSave(state, v4.meta, { engineVersion: ENGINE_VERSION }));
}

/** The state without its schema stamp, for comparing across the migration. */
const body = (s: GameState): string => stableStringify({ ...s, schemaVersion: 0 });

describe('save v4 -> v5 on a real v4 save (paused between rounds)', () => {
  const loaded = load(json);

  it('is a v4 save from the pre-M2 build with a live match between rounds', () => {
    expect(v4.schemaVersion).toBe(4);
    expect(v4.state.schemaVersion).toBe(4);
    expect(v4.state.liveMatch?.phase).toBe('between_rounds');
    expect(v4.state.liveMatch?.rounds).toHaveLength(1);
  });

  it('loads as v5: migrated from 4, valid, unchanged apart from the version, no watch state', () => {
    expect(STATE_SCHEMA_VERSION).toBe(5);
    expect(loaded.from).toBe(4);
    expect(loaded.state.schemaVersion).toBe(5);
    expect(validateState(loaded.state, content)).toEqual([]);
    expect(loaded.warnings).toEqual([]); // same content (unchanged since the save was written)
    expect(body(loaded.state)).toBe(body(v4.state));
    expect(loaded.state.liveMatch?.watch).toBeUndefined(); // a v4 live match is a simulated one
  });

  it('saves back identically: v5 text round-trips byte for byte and checksum for checksum', () => {
    const first = save(loaded.state);
    const again = load(first);
    expect(again.from).toBeNull();
    expect(checksumState(again.state)).toBe(checksumState(loaded.state));
    expect(save(again.state)).toBe(first);
  });

  it('plays on: the match finishes, the week completes, and the result saves and loads', () => {
    let s = loaded.state;
    const fixtureId = s.liveMatch!.fixtureId;
    let week = null;
    for (let i = 0; i < 6 && week === null; i++) {
      const r = advance(s, content);
      if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
      s = r.value.state;
      week = r.value.week;
    }
    expect(week).not.toBeNull();
    expect(s.liveMatch).toBeNull();
    const result = s.results[fixtureId]!;
    expect(result.rounds.length).toBeGreaterThanOrEqual(2);
    expect(result.rounds[0]!.checksum).toBe(v4.state.liveMatch!.rounds[0]!.checksum); // the committed round stays committed
    expect(validateState(s, content)).toEqual([]);
    const back = load(save(s));
    expect(checksumState(back.state)).toBe(checksumState(s));
  });
});
