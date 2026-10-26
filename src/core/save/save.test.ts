import { describe, expect, it } from 'vitest';
import { STATE_SCHEMA_VERSION, asId, type ClassId, type FighterId, type GameState, type SaveEnvelope } from '../model';
import { buildFixtureWorld, fixtureContent } from '../testkit';
import { cloneJson, deepFreeze } from '../util';
import {
  MIGRATIONS,
  checksumState,
  checksumV1,
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

  it('keeps the optional career id in the meta; saves without one still load', () => {
    const state = world();
    const env = envelopeOf(state);
    const withId = parseSave(serializeSave({ ...env, meta: { ...env.meta, careerId: 'c-0123456789abcdef' } }), content);
    expect(withId.ok && withId.value.envelope.meta.careerId).toBe('c-0123456789abcdef');
    const without = parseSave(serializeSave(env), content);
    expect(without.ok && without.value.envelope.meta.careerId).toBeUndefined();
    expect(parseSave(serializeSave({ ...env, meta: { ...env.meta, careerId: '' } }), content).ok).toBe(false);
  });

  it('checksum v2 covers the state as written: a JSON round trip keeps it, an edit changes it', () => {
    const state = world();
    const parsed = JSON.parse(JSON.stringify(state)) as GameState;
    expect(checksumState(parsed)).toBe(checksumState(state));
    Object.values(parsed.clubs)[0]!.finance.balance += 1;
    expect(checksumState(parsed)).not.toBe(checksumState(state));
  });

  it('serializeSave is JSON.stringify of the envelope, also when frozen entries come from the cache', () => {
    const state = world();
    state.history = [deepFreeze({ season: 0, tiers: [], retirements: [], rookieIds: [] })];
    const env = envelopeOf(state);
    expect(serializeSave(env)).toBe(JSON.stringify(env));
    expect(serializeSave(env)).toBe(JSON.stringify(env));
    expect(checksumState(state)).toBe(checksumState(JSON.parse(JSON.stringify(state)) as GameState));
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
    if (!r.ok) expect(r.error).toMatchObject({ code: 'save.too-new', details: { saveVersion: 99, buildVersion: STATE_SCHEMA_VERSION } });
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
  it('MIGRATIONS lead from schema version 1 to the current one', () => {
    expect(MIGRATIONS.map((m) => [m.from, m.to])).toEqual([[1, 2]]);
    expect(STATE_SCHEMA_VERSION).toBe(2);
  });

  /** A v1 save of the fixture world: one retired fighter still in `fighters`, an agreed renewal as a negotiation. */
  function v1Save(): { json: string; retiredId: FighterId; renewedId: FighterId; injuredId: FighterId } {
    const s = cloneJson(world()) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    delete s.alumni;
    s.schemaVersion = 1;
    const fighters = Object.values(s.fighters) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const f of fighters) {
      if (f.contract) delete f.contract.next;
      if (f.freeAgency) delete f.freeAgency.enteredAt;
    }
    const retired = fighters.find((f) => f.status === 'free-agent');
    retired.status = 'retired';
    const [renewed, injured] = fighters.filter((f) => f.status === 'active' && f.contract);
    s.market.negotiations.push({ fighterId: renewed.id, clubId: renewed.contract.clubId, season: 1, kind: 'renewal', patienceLeft: 2, counterWage: 777, validUntilWeek: null });
    injured.injury = { severity: 'serious', weeksOut: 999, fixtureId: null, round: null, causeFighterId: null, damageBp: 10_000, since: { season: 1, weekIndex: 1 } };
    const env = { ...envelopeOf(world()), schemaVersion: 1, checksum: checksumV1(s), state: s };
    return { json: JSON.stringify(env), retiredId: retired.id, renewedId: renewed.id, injuredId: injured.id };
  }

  it('v1 -> v2: departed fighters become alumni, agreed renewals move to Contract.next, new fields are filled', () => {
    const v1 = v1Save();
    const r = parseSave(v1.json, content);
    expect(r.ok ? null : r.error).toBeNull();
    if (!r.ok) return;
    const st = r.value.envelope.state;
    expect(r.value.migratedFrom).toBe(1);
    expect(st.schemaVersion).toBe(2);
    expect(st.fighters[v1.retiredId]).toBeUndefined();
    expect(st.alumni[v1.retiredId]).toMatchObject({ id: v1.retiredId, cause: 'age' });
    expect(st.fighters[v1.renewedId]!.contract!.next).toEqual({ wagePerWeek: 777, endSeason: st.fighters[v1.renewedId]!.contract!.endSeason });
    expect(st.market.negotiations.some((n) => n.fighterId === v1.renewedId)).toBe(false);
    expect(st.fighters[v1.injuredId]!.injury!.careerEnding).toBe(true);
    for (const f of Object.values(st.fighters)) {
      if (f.contract && f.id !== v1.renewedId) expect(f.contract.next).toBeNull();
      if (f.freeAgency) expect(f.freeAgency.enteredAt).toBeDefined();
    }
    expect(r.value.envelope.checksum).toBe(checksumState(st));
    expect(validateState(st, content)).toEqual([]);
  });

  it('a v1 save is checked with the v1 checksum rule', () => {
    const v1 = v1Save();
    const edited = v1.json.replace('"counterWage":777', '"counterWage":778');
    const r = parseSave(edited, content);
    expect(r.ok ? null : r.error.code).toBe('save.checksum');
  });

  const state = world();
  const v2 = serializeSave(envelopeOf(state));
  const renameClub: Migration = {
    from: 2,
    to: 3,
    migrate(s) {
      const st = s as GameState;
      for (const c of Object.values(st.clubs)) c.shortName = `${c.shortName}*`;
      return st;
    },
  };

  it('runs each step in order and reports migratedFrom', () => {
    const r = parseSaveWith(v2, content, { migrations: [renameClub], currentVersion: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.migratedFrom).toBe(2);
    expect(r.value.envelope.schemaVersion).toBe(3);
    expect(r.value.envelope.state.schemaVersion).toBe(3);
    expect(Object.values(r.value.envelope.state.clubs).every((c) => c.shortName.endsWith('*'))).toBe(true);
    expect(r.value.envelope.checksum).toBe(checksumState(r.value.envelope.state));
  });

  it('save.migration when a step is missing or throws', () => {
    const missing = parseSaveWith(v2, content, { migrations: [], currentVersion: 3 });
    expect(missing.ok ? null : missing.error.code).toBe('save.migration');
    const throwing = parseSaveWith(v2, content, {
      migrations: [{ from: 2, to: 3, migrate: () => { throw new Error('boom'); } }],
      currentVersion: 3,
    });
    expect(throwing.ok ? null : throwing.error.code).toBe('save.migration');
  });
});

describe('tampered saves: inherited names as ids or keys', () => {
  const state = world();
  const env = envelopeOf(state);
  const code = (json: string): string | null => {
    const r = parseSave(json, content);
    return r.ok ? null : r.error.code;
  };
  const tamper = (edit: (s: GameState) => void): string => {
    const e = cloneJson(env);
    edit(e.state);
    return reseal(e);
  };
  const someFighter = (s: GameState) => Object.values(s.fighters).find((f) => f.contract !== null)!;

  it('rejects inherited names as ids: player club, lineup, contract, ledger, news', () => {
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(code(tamper((s) => { s.playerClubId = asId(name); }))).toBe('save.structure');
      expect(code(tamper((s) => { Object.values(s.clubs)[0]!.lineup.fighters[0]!.fighterId = asId(name); }))).toBe('save.structure');
      expect(code(tamper((s) => { someFighter(s).contract!.clubId = asId(name); }))).toBe('save.structure');
      expect(code(tamper((s) => { s.ledger.entries.push({ seq: s.ledger.nextSeq, season: 1, weekIndex: 1, clubId: asId(name), amount: 0, category: 'operations' }); s.ledger.nextSeq += 1; }))).toBe('save.structure');
      expect(code(tamper((s) => { s.news.push({ id: asId('n-990'), at: { season: 1, weekIndex: 1 }, key: 'x', params: {}, clubId: asId(name), refs: {}, importance: 'info', read: false }); s.ids.news = 991; }))).toBe('save.structure');
      expect(code(tamper((s) => { Object.values(s.clubs)[0]!.shortlist.push(asId(name)); }))).toBe('save.structure');
    }
  });

  it('rejects inherited names and __proto__ as map keys (clubs, fighters, ledger balances, lineup tactics)', () => {
    const own = (obj: object, key: string, value: unknown) => Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
    for (const name of ['__proto__', 'constructor', 'toString']) {
      expect(code(tamper((s) => { own(s.clubs, name, cloneJson(Object.values(s.clubs)[0]!)); }))).toBe('save.structure');
      expect(code(tamper((s) => { own(s.fighters, name, cloneJson(someFighter(s))); }))).toBe('save.structure');
      expect(code(tamper((s) => { own(s.ledger.openingBalances, name, 0); }))).toBe('save.structure');
      expect(code(tamper((s) => { own(Object.values(s.clubs)[0]!.lineup.tactics, name, { kind: 'preset', presetId: 'x' }); }))).toBe('save.structure');
    }
  });

  it('validateState names the path; a clean world has none', () => {
    const s = world();
    expect(validateState(s, content)).toEqual([]);
    s.playerClubId = asId('constructor');
    expect(validateState(s, content)).toEqual([{ path: 'playerClubId', message: 'reserved name "constructor" is not a valid id' }]);
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
