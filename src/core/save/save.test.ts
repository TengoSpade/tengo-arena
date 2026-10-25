import { describe, expect, it } from 'vitest';
import { asId, type ClassId, type FighterId, type GameState, type SaveEnvelope } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { cloneJson } from '../util';
import {
  MIGRATIONS,
  checksumState,
  createSave,
  parseSave,
  parseSaveWith,
  saveMetaFor,
  serializeSave,
  validateState,
  type Migration,
} from './index';

const content = fixtureContent();

function world(): GameState {
  return buildFixtureWorld({ clubLimit: 4, fightersPerClub: 6, freeAgents: 4 });
}

function envelopeOf(state: GameState): SaveEnvelope {
  const meta = saveMetaFor(state, { slotId: 'manual-1', kind: 'manual', label: 'Test', savedAt: '2026-10-25T10:00:00Z', playtimeSec: 61.7, gameVersion: '0.1.0' });
  return createSave(state, meta, { engineVersion: 1 });
}

/** Re-seal an edited envelope (so the check after the checksum is the one that fails). */
function reseal(env: SaveEnvelope): string {
  return serializeSave({ ...env, checksum: checksumState(env.state) });
}

describe('save envelope', () => {
  it('saveMetaFor reads calendar and player club', () => {
    const state = world();
    const meta = envelopeOf(state).meta;
    expect(meta).toMatchObject({ slotId: 'manual-1', kind: 'manual', season: 1, weekIndex: 1, weekId: 'P1', phase: 'preseason', playtimeSec: 61 });
    expect(meta.playerClubId).toBe(state.playerClubId);
    expect(meta.playerClubName).toBe(state.clubs[state.playerClubId!]!.name);
  });

  it('round trip: serialize -> parse gives a deep-equal state', () => {
    const state = world();
    const env = createSave(state, envelopeOf(state).meta, { engineVersion: 1 }, [
      { seq: 1, season: 1, weekIndex: 1, command: { type: 'news.markRead', newsIds: [] } },
    ]);
    const parsed = parseSave(serializeSave(env), content);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.envelope.state).toEqual(state);
    expect(parsed.value.envelope.checksum).toBe(checksumState(state));
    expect(parsed.value.envelope.commandLog).toHaveLength(1);
    expect(parsed.value.migratedFrom).toBeNull();
    expect(parsed.value.warnings).toEqual([]);
  });

  it('checksum does not depend on key order', () => {
    const state = world();
    const reordered = JSON.parse(JSON.stringify(state, Object.keys(state).sort().reverse())) as GameState;
    expect(checksumState(state)).toBe(checksumState({ ...reordered, ...state }));
  });
});

describe('parseSave error codes', () => {
  const state = world();
  const env = envelopeOf(state);
  const code = (json: string): string | null => {
    const r = parseSave(json, content);
    return r.ok ? null : r.error.code;
  };

  it('save.json for truncated JSON', () => {
    const json = serializeSave(env);
    expect(code(json.slice(0, json.length - 10))).toBe('save.json');
    expect(code('')).toBe('save.json');
  });

  it('save.format for a foreign file or a malformed envelope', () => {
    expect(code('{"hello":1}')).toBe('save.format');
    expect(code('[]')).toBe('save.format');
    expect(code(JSON.stringify({ ...env, meta: { slotId: 'x' } }))).toBe('save.format');
  });

  it('save.too-new for a newer schema version', () => {
    const r = parseSave(JSON.stringify({ ...env, schemaVersion: 99 }), content);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'save.too-new', details: { saveVersion: 99, buildVersion: 1 } });
  });

  it('save.checksum when the state was edited', () => {
    const edited = cloneJson(env);
    edited.state.clubs[state.playerClubId!]!.finance.balance += 1000;
    expect(code(serializeSave(edited))).toBe('save.checksum');
  });

  it('save.structure for a malformed state', () => {
    const edited = cloneJson(env);
    (edited.state as unknown as Record<string, unknown>).calendar = { season: 'one' };
    expect(code(reseal(edited))).toBe('save.structure');
    const extra = cloneJson(env);
    (extra.state.fighters[asId<FighterId>('f-1')] as unknown as Record<string, unknown>).stats = {};
    expect(code(reseal(extra))).toBe('save.structure');
  });

  it('save.references for a lineup fighter off the roster and a broken ledger', () => {
    const edited = cloneJson(env);
    const clubs = Object.values(edited.state.clubs);
    clubs[0]!.lineup.fighters[0]!.fighterId = clubs[1]!.lineup.fighters[0]!.fighterId;
    expect(code(reseal(edited))).toBe('save.references');
    const ledger = cloneJson(env);
    Object.values(ledger.state.clubs)[0]!.finance.balance += 5;
    const r = parseSave(reseal(ledger), content);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('save.references');
      expect(r.error.message).toContain('balance');
    }
  });

  it('save.content-missing for unknown content ids or another theme; a new hash only warns', () => {
    const edited = cloneJson(env);
    edited.state.fighters[asId<FighterId>('f-1')]!.classId = asId<ClassId>('no-such-class');
    expect(code(reseal(edited))).toBe('save.content-missing');
    const theme = cloneJson(env);
    theme.state.content.id = 'other-theme';
    expect(code(reseal(theme))).toBe('save.content-missing');
    const hash = cloneJson(env);
    hash.state.content.hash = 'f'.repeat(32);
    const r = parseSave(reseal(hash), content);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.warnings).toHaveLength(1);
  });

  it('never returns a partial state on failure', () => {
    const edited = cloneJson(env);
    edited.state.clubs[state.playerClubId!]!.finance.balance += 1;
    const r = parseSave(serializeSave(edited), content);
    expect(r.ok).toBe(false);
    expect('value' in r).toBe(false);
  });
});

describe('migrations', () => {
  it('MIGRATIONS is empty at schema version 1', () => {
    expect(MIGRATIONS).toEqual([]);
  });

  const state = world();
  const v1 = serializeSave(envelopeOf(state));
  const renameClub: Migration = {
    from: 1,
    to: 2,
    migrate(s) {
      const st = s as GameState;
      for (const c of Object.values(st.clubs)) c.shortName = `${c.shortName}*`;
      return st;
    },
  };

  it('runs each step in order and reports migratedFrom', () => {
    const r = parseSaveWith(v1, content, { migrations: [renameClub], currentVersion: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.migratedFrom).toBe(1);
    expect(r.value.envelope.schemaVersion).toBe(2);
    expect(r.value.envelope.state.schemaVersion).toBe(2);
    expect(Object.values(r.value.envelope.state.clubs).every((c) => c.shortName.endsWith('*'))).toBe(true);
    expect(r.value.envelope.checksum).toBe(checksumState(r.value.envelope.state));
  });

  it('save.migration when a step is missing or throws', () => {
    const missing = parseSaveWith(v1, content, { migrations: [], currentVersion: 2 });
    expect(missing.ok ? null : missing.error.code).toBe('save.migration');
    const throwing = parseSaveWith(v1, content, {
      migrations: [{ from: 1, to: 2, migrate: () => { throw new Error('boom'); } }],
      currentVersion: 2,
    });
    expect(throwing.ok ? null : throwing.error.code).toBe('save.migration');
  });
});

describe('validateState', () => {
  it('accepts the fixture world', () => {
    expect(validateState(world(), content)).toEqual([]);
  });

  it('reports structure, content and reference problems with paths', () => {
    const state = world();
    const f = state.fighters[asId<FighterId>('f-2')]!;
    f.clubId = null; // still 'active' with a contract and in a lineup
    const issues = validateState(state, content);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.path.startsWith('fighters.f-2'))).toBe(true);
    expect(issues.some((i) => i.path.includes('lineup'))).toBe(true);
  });

  it('checks id counters against allocated ids', () => {
    const state = world();
    state.ids.fighter = 1;
    expect(validateState(state, content).map((i) => i.path)).toContain('ids.fighter');
  });
});
