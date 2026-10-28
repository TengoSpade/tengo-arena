import { describe, expect, it } from 'vitest';
import { SAVE_BOUNDS } from '../content';
import { STATE_SCHEMA_VERSION, asId, type ClassId, type ClubId, type CompetitionId, type FighterId, type GameState, type SaveEnvelope } from '../model';
import { buildFixtureWorld, fixtureContent, fixtureMatchState, fixturePendingLevelUp } from '../testkit';
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
  GameStateSchema,
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
    expect(MIGRATIONS.map((m) => [m.from, m.to])).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ]);
    expect(STATE_SCHEMA_VERSION).toBe(5);
  });

  /** A world whose player club has a live match (round 1 pending), with the competition and fixture it belongs to. */
  function liveWorld(): GameState {
    const state = world();
    const c = state.playerClubId!;
    const ms = fixtureMatchState(state, c, Object.keys(state.clubs).find((x) => x !== c) as ClubId, content);
    const tierId = state.clubs[c]!.tierId;
    const competitionId = asId<CompetitionId>('lg:1:test');
    state.competitions[competitionId] = { id: competitionId, kind: 'league', season: 1, tierId, clubIds: [ms.home.clubId, ms.away.clubId], wings: [], seedOrder: [], fixtureIds: [ms.fixtureId], bracket: null, status: 'in-progress' };
    state.fixtures[ms.fixtureId] = {
      id: ms.fixtureId,
      competitionId,
      season: 1,
      tierId,
      weekIndex: state.calendar.weekIndex,
      weekId: state.calendar.weekId!,
      stage: 'league',
      matchweek: 1,
      wing: null,
      homeClubId: ms.home.clubId,
      awayClubId: ms.away.clubId,
      bestOf: ms.bestOf,
      venueId: null,
      status: 'scheduled',
    };
    state.liveMatch = ms;
    return state;
  }

  /** The state as an older build wrote it: the same data under an older schema version. */
  function savedAs(state: GameState, version: number): string {
    const s = cloneJson(state) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    s.schemaVersion = version;
    return JSON.stringify({ ...envelopeOf(state), schemaVersion: version, checksum: checksumState(s as unknown as GameState), state: s });
  }

  it('v3 -> v4 (KI-2) is the identity on the data: a v3 save loads (through v4 and v5), reports migratedFrom 3 and keeps every field; a v4 save is refused by a v3 build as too new', () => {
    const state = world();
    const r = parseSave(savedAs(state, 3), content);
    expect(r.ok ? null : r.error).toBeNull();
    if (!r.ok) return;
    expect(r.value.migratedFrom).toBe(3);
    expect(r.value.envelope.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(r.value.envelope.state.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(r.value.envelope.state).toEqual(state);
    expect(r.value.envelope.checksum).toBe(checksumState(state));
    expect(validateState(r.value.envelope.state, content)).toEqual([]);
    // Saved again it is a current save, which loads without a migration.
    const again = parseSave(serializeSave(r.value.envelope), content);
    expect(again.ok && again.value.migratedFrom).toBeNull();
    // A build that knows only v3 reports a newer version, not a damaged save.
    const v4 = parseSaveWith(savedAs(state, 4), content, { migrations: MIGRATIONS.filter((m) => m.to <= 3), currentVersion: 3 });
    expect(v4.ok).toBe(false);
    if (!v4.ok) expect(v4.error).toMatchObject({ code: 'save.too-new', details: { saveVersion: 4, buildVersion: 3 } });
  });

  it('v4 -> v5 (M2) is the identity on the data: a v4 save, a live match between rounds included, loads as v5 and saves back identically; a v5 save is refused by a v4 build as too new', () => {
    // A v4 live match: never watched (v4 builds have no watch flow).
    const state = liveWorld();
    const json = savedAs(state, 4);
    const r = parseSave(json, content);
    expect(r.ok ? null : r.error).toBeNull();
    if (!r.ok) return;
    expect(r.value.migratedFrom).toBe(4);
    const loaded = r.value.envelope.state;
    expect(loaded.schemaVersion).toBe(5);
    expect(r.value.envelope.schemaVersion).toBe(5);
    // Nothing but the version is stamped: no watch on the live match (it is a simulated match), no simHash, no calls.
    const original = JSON.parse(json) as { state: Record<string, unknown> };
    expect({ ...loaded, schemaVersion: 4 }).toEqual(original.state);
    expect(loaded.liveMatch!.watch).toBeUndefined();
    expect(r.value.envelope.checksum).toBe(checksumState(loaded));
    expect(validateState(loaded, content)).toEqual([]);
    // Saved back: a v5 save that loads without a migration, byte for byte the same state again.
    const resaved = serializeSave(createSave(loaded, r.value.envelope.meta, { engineVersion: r.value.envelope.engineVersion }));
    const again = parseSave(resaved, content);
    expect(again.ok ? null : again.error).toBeNull();
    if (!again.ok) return;
    expect(again.value.migratedFrom).toBeNull();
    expect(serializeSave(again.value.envelope)).toBe(resaved);
    expect(checksumState(again.value.envelope.state)).toBe(checksumState(loaded));
    // A build that knows only v4 reports a newer version (save.too-new), not a damaged save.
    const old = parseSaveWith(resaved, content, { migrations: MIGRATIONS.filter((m) => m.to <= 4), currentVersion: 4 });
    expect(old.ok).toBe(false);
    if (!old.ok) expect(old.error).toMatchObject({ code: 'save.too-new', details: { saveVersion: 5, buildVersion: 4 } });
  });

  it('v5 fields (MatchState.watch, RoundLineups.calls, MatchResult.simHash) pass the strict schema; malformed ones do not', () => {
    const state = liveWorld();
    state.liveMatch!.watch = { mode: 'watch', round: 1, cursorTick: 340, calls: [] };
    const issues = (s: GameState): string[] => validateState(s, content).map((i) => `${i.path}: ${i.message}`);
    expect(issues(state)).toEqual([]);
    const reparsed = parseSave(serializeSave(envelopeOf(state)), content);
    expect(reparsed.ok ? reparsed.value.envelope.state.liveMatch!.watch : reparsed.error).toEqual({ mode: 'watch', round: 1, cursorTick: 340, calls: [] });
    // Reserved call records (the calls package): the structure is bounded by SAVE_BOUNDS.callsPerRound, and until the
    // calls package a live match holding calls is refused (core/sim refuses every plan but none: it could not play on).
    const call = { tick: 41, kind: 'focus', target: 7 };
    const withCalls = cloneJson(state);
    const structure = (x: GameState): string[] => {
      const r = GameStateSchema.safeParse(x);
      return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    };
    withCalls.liveMatch!.watch!.calls = Array.from({ length: SAVE_BOUNDS.callsPerRound }, () => ({ ...call }));
    expect(structure(withCalls)).toEqual([]);
    expect(issues(withCalls)).toEqual(['liveMatch.watch.calls: calls are not part of this build']);
    withCalls.liveMatch!.watch!.calls.push({ ...call });
    expect(structure(withCalls).some((p) => p.includes('watch.calls'))).toBe(true);
    const rl = cloneJson(state);
    rl.liveMatch!.roundLineups = [{ round: 1, home: lineup(), away: lineup(), calls: { home: { mode: 'explicit', calls: [call] }, away: { mode: 'policy' } } }];
    rl.liveMatch!.rounds = [];
    expect(issues(rl).filter((p) => p.includes('roundLineups'))).toEqual([]);
    rl.liveMatch!.roundLineups[0]!.calls = { home: { mode: 'sometimes' }, away: { mode: 'none' } } as never;
    expect(issues(rl).some((p) => p.includes('roundLineups'))).toBe(true);
    // The watched round must be the pending round, in mode 'watch'; the cursor a tick within the time cap.
    const bad = (edit: (s: GameState) => void): string[] => {
      const x = cloneJson(state);
      edit(x);
      return issues(x);
    };
    expect(bad((x) => (x.liveMatch!.watch!.round = 2)).some((p) => p.startsWith('liveMatch.watch.round'))).toBe(true);
    expect(bad((x) => (x.liveMatch!.watch!.mode = 'simulate')).some((p) => p.startsWith('liveMatch.watch.round'))).toBe(true);
    expect(bad((x) => (x.liveMatch!.watch!.round = null)).some((p) => p.startsWith('liveMatch.watch.round'))).toBe(true);
    expect(bad((x) => (x.liveMatch!.watch!.cursorTick = 99_999)).some((p) => p.startsWith('liveMatch.watch.cursorTick'))).toBe(true);
    expect(bad((x) => (x.liveMatch!.watch!.cursorTick = -1)).length).toBeGreaterThan(0);
    expect(bad((x) => ((x.liveMatch!.watch as unknown as Record<string, unknown>)['extra'] = 1)).length).toBeGreaterThan(0);
    // Between rounds a watched match has no round on screen; a simulated one never has.
    expect(bad((x) => { x.liveMatch!.phase = 'between_rounds'; x.liveMatch!.watch!.round = null; })).toEqual([]);
    expect(bad((x) => { x.liveMatch!.watch = { mode: 'simulate', round: null, cursorTick: 12, calls: [] }; })).toEqual([]);
  });

  function lineup() {
    return { fighterIds: ['a', 'b', 'c', 'd', 'e'], rows: ['front', 'front', 'front', 'back', 'back'], captainIndex: 0, viceCaptainIndex: 1, captainQuality: 50, freshness: [90, 90, 90, 90, 90], entered: [false, false, false, false, false] } as never;
  }

  it('a compacted result with its kept five (MatchResult.fielded) passes the strict schema; a malformed five does not', () => {
    const state = world();
    const [home, away] = Object.keys(state.clubs) as ClubId[];
    const side = (clubId: ClubId) => ({ clubId, fighters: [], captainIndex: 0, viceCaptainIndex: null, chemistry: 0 });
    const compacted = {
      fixtureId: 'lg:x', competitionId: 'lg:c', stage: 'league', season: 1, weekIndex: 5, weekId: 'MW1', homeClubId: home, awayClubId: away,
      engineVersion: 1, contentHash: 'h', input: { seed: 's', bestOf: 3, home: side(home!), away: side(away!) },
      rounds: [], score: { home: 2, away: 0 }, winnerClubId: home, fighterStats: {}, mvpFighterId: null, hiredBladeIds: [], fighterTotals: {},
      fielded: { home: [['f-1', 0, 55]], away: [['f-2', 1, 61]] },
    };
    const issuesAt = (result: unknown): string[] => {
      const r = GameStateSchema.safeParse({ ...cloneJson(state), results: { 'lg:x': result } });
      return r.success ? [] : r.error.issues.filter((i) => i.path[0] === 'results').map((i) => i.path.join('.'));
    };
    expect(issuesAt(compacted)).toEqual([]);
    expect(issuesAt({ ...compacted, fielded: undefined })).toEqual([]); // saves without it (every older save) stay valid
    expect(issuesAt({ ...compacted, fielded: { home: [['f-1', 2, 55]], away: [] } }).some((p) => p.includes('fielded'))).toBe(true);
    expect(issuesAt({ ...compacted, fielded: { home: [], away: [], extra: [] } }).some((p) => p.includes('fielded'))).toBe(true);
    // M2 (v5): the sim content hash a result was played with is an optional string.
    expect(issuesAt({ ...compacted, simHash: 'a1b2c3' })).toEqual([]);
    expect(issuesAt({ ...compacted, simHash: 7 }).some((p) => p.includes('simHash'))).toBe(true);
  });

  /** A v3 state as a v2 save wrote it: the M1.1 fields removed (in place on a clone). */
  function stripToV2(s: Record<string, any>): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    delete s.liveMatch;
    for (const c of Object.values(s.clubs) as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      delete c.lineup.reserves;
      for (const k of ['levelUpDefault', 'levelUpPacing', 'autoSwap', 'pauseBetweenRounds']) delete c[k];
    }
    for (const f of Object.values(s.fighters) as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      for (const k of ['train100', 'level', 'xpIntoLevel', 'xpNeeded', 'pendingLevelUps', 'levelUpMode', 'abilityRanks', 'perkIds', 'freshness10']) delete f[k];
      for (const k of ['roundXp', 'benchXp', 'levelLog', 'tiredRoundStarts', 'spentRoundStarts', 'restWeeks', 'squadReserveMatches']) delete f.season[k];
      delete f.career.levelsGained;
      for (const m of ['cap100', 'bloom', 'wear100']) delete f[m].stamina;
      for (const row of f.history) for (const k of ['levelStart', 'levelEnd', 'stamina', 'benchXp', 'tiredRoundStarts']) delete row[k];
    }
    return s;
  }

  function v2SaveOf(state: GameState): string {
    const s = stripToV2(cloneJson(state) as unknown as Record<string, any>); // eslint-disable-line @typescript-eslint/no-explicit-any
    s.schemaVersion = 2;
    const env = { ...envelopeOf(state), schemaVersion: 2, checksum: checksumState(s as unknown as GameState), state: s };
    return JSON.stringify(env);
  }

  it('v2 -> v3: Stamina, train100, levels, Freshness and club defaults; shown stats unchanged; deterministic (mig-001, mig-002)', () => {
    const state = world();
    for (const f of Object.values(state.fighters)) f.season.xp = 40;
    const json = v2SaveOf(state);
    const r = parseSave(json, content);
    expect(r.ok ? null : r.error).toBeNull();
    if (!r.ok) return;
    const st = r.value.envelope.state;
    expect(r.value.migratedFrom).toBe(2);
    expect(st.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(validateState(st, content)).toEqual([]);
    for (const f of Object.values(st.fighters)) {
      const before = state.fighters[f.id]!;
      for (const s of content.stats.list) if (s.id !== 'stamina') expect(f.train100[s.id as never]).toBe(before.train100[s.id as never]);
      expect(f.cap100['stamina' as never]).toBeGreaterThanOrEqual(200);
      expect(f.xpIntoLevel).toBe(Math.min(40, f.xpNeeded - 1));
      expect(f.freshness10).toBe(1000);
      expect(f.pendingLevelUps).toEqual([]);
      expect(f.season.roundXp).toBe(40);
    }
    expect(st.clubs[st.playerClubId!]!.levelUpDefault).toBe('manual');
    expect(Object.values(st.clubs).filter((c) => c.id !== st.playerClubId).every((c) => c.levelUpDefault === 'auto')).toBe(true);
    const again = parseSave(json, content);
    expect(again.ok && JSON.stringify(again.value.envelope.state)).toBe(JSON.stringify(st));
  });

  /** A v1 save of the fixture world: one retired fighter still in `fighters`, an agreed renewal as a negotiation. */
  function v1Save(): { json: string; retiredId: FighterId; renewedId: FighterId; injuredId: FighterId } {
    const s = stripToV2(cloneJson(world()) as unknown as Record<string, any>); // eslint-disable-line @typescript-eslint/no-explicit-any
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
    expect(st.schemaVersion).toBe(STATE_SCHEMA_VERSION);
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

  // The runner itself, one version past the current one.
  const state = world();
  const current = serializeSave(envelopeOf(state));
  const renameClub: Migration = {
    from: STATE_SCHEMA_VERSION,
    to: STATE_SCHEMA_VERSION + 1,
    migrate(s) {
      const st = s as GameState;
      for (const c of Object.values(st.clubs)) c.shortName = `${c.shortName}*`;
      return st;
    },
  };

  it('runs each step in order and reports migratedFrom', () => {
    const r = parseSaveWith(current, content, { migrations: [renameClub], currentVersion: STATE_SCHEMA_VERSION + 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.migratedFrom).toBe(STATE_SCHEMA_VERSION);
    expect(r.value.envelope.schemaVersion).toBe(STATE_SCHEMA_VERSION + 1);
    expect(r.value.envelope.state.schemaVersion).toBe(STATE_SCHEMA_VERSION + 1);
    expect(Object.values(r.value.envelope.state.clubs).every((c) => c.shortName.endsWith('*'))).toBe(true);
    expect(r.value.envelope.checksum).toBe(checksumState(r.value.envelope.state));
  });

  it('save.migration when a step is missing or throws', () => {
    const missing = parseSaveWith(current, content, { migrations: [], currentVersion: STATE_SCHEMA_VERSION + 1 });
    expect(missing.ok ? null : missing.error.code).toBe('save.migration');
    const throwing = parseSaveWith(current, content, {
      migrations: [{ from: STATE_SCHEMA_VERSION, to: STATE_SCHEMA_VERSION + 1, migrate: () => { throw new Error('boom'); } }],
      currentVersion: STATE_SCHEMA_VERSION + 1,
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

describe('structure bounds come from SAVE_BOUNDS (the same constants the content validator checks)', () => {
  /** Paths the strict schema refuses (structure only: the references of a hand-built live match are not under test). */
  const structureIssues = (state: GameState): string[] => {
    const r = GameStateSchema.safeParse(state);
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
  };

  it('the queue of unresolved level-ups: SAVE_BOUNDS.pendingLevelUps is accepted, one more is refused', () => {
    const state = world();
    const f = Object.values(state.fighters).find((x) => x.status === 'active')!;
    f.pendingLevelUps = Array.from({ length: SAVE_BOUNDS.pendingLevelUps }, (_, i) => fixturePendingLevelUp(f, content, { level: f.level + 1 + i }));
    expect(structureIssues(state)).toEqual([]);
    f.pendingLevelUps = [...f.pendingLevelUps, fixturePendingLevelUp(f, content, { level: f.level + 9 })];
    expect(structureIssues(state).some((p) => p.includes(`fighters.${f.id}.pendingLevelUps`))).toBe(true);
  });

  it('swaps used in a live match: SAVE_BOUNDS.swapsPerMatch is accepted, one more is refused', () => {
    const state = world();
    const [home, away] = Object.keys(state.clubs) as ClubId[];
    state.liveMatch = fixtureMatchState(state, home!, away!, content);
    state.liveMatch.home.swapsUsed = SAVE_BOUNDS.swapsPerMatch;
    expect(structureIssues(state)).toEqual([]);
    state.liveMatch.home.swapsUsed = SAVE_BOUNDS.swapsPerMatch + 1;
    expect(structureIssues(state).some((p) => p.includes('liveMatch.home.swapsUsed'))).toBe(true);
  });

  it('squad size and reserves: the schema follows SAVE_BOUNDS.squadStarters and squadReserves', () => {
    const state = world();
    const [home, away] = Object.keys(state.clubs) as ClubId[];
    state.liveMatch = fixtureMatchState(state, home!, away!, content);
    expect(state.liveMatch.home.active).toHaveLength(SAVE_BOUNDS.squadStarters);
    expect(state.liveMatch.home.squad.reserves.length).toBeLessThanOrEqual(SAVE_BOUNDS.squadReserves);
    expect(structureIssues(state)).toEqual([]);
    const extra = Object.keys(state.fighters).find((id) => !state.liveMatch!.home.squad.starters.includes(id as FighterId) && !state.liveMatch!.home.squad.reserves.includes(id as FighterId))! as FighterId;
    state.liveMatch.home.squad.reserves = [...state.liveMatch.home.squad.reserves, extra, extra, extra].slice(0, SAVE_BOUNDS.squadReserves + 1);
    expect(structureIssues(state).some((p) => p.startsWith('liveMatch.home.squad.reserves'))).toBe(true);
    state.liveMatch.home.squad.reserves = [];
    state.liveMatch.home.active = state.liveMatch.home.active.slice(0, SAVE_BOUNDS.squadStarters - 1);
    expect(structureIssues(state).some((p) => p.startsWith('liveMatch.home.active'))).toBe(true);
  });

  it('a compacted result (fighterTotals, squads without row maps, no per-round records) is a valid saved result; a malformed tuple is not', () => {
    const state = world();
    const [home, away] = Object.keys(state.clubs) as ClubId[];
    const ms = fixtureMatchState(state, home!, away!, content);
    const emptied = (side: typeof ms.input.home): typeof ms.input.home => ({ ...side, fighters: [], captainIndex: 0, viceCaptainIndex: null });
    const first = ms.home.squad.starters[0]!;
    const result: GameState['results'][keyof GameState['results']] = {
      fixtureId: asId('lg:1:compacted'),
      competitionId: asId('lg:1'),
      stage: 'league',
      season: 1,
      weekIndex: 2,
      weekId: asId('MW1'),
      homeClubId: home!,
      awayClubId: away!,
      engineVersion: 2,
      contentHash: 'abc',
      input: { ...ms.input, home: emptied(ms.input.home), away: emptied(ms.input.away) },
      rounds: [],
      score: { home: 2, away: 1 },
      winnerClubId: home!,
      fighterStats: {},
      mvpFighterId: null,
      hiredBladeIds: [],
      squads: { home: { ...ms.home.squad, rows: {} }, away: { ...ms.away.squad, rows: {} } },
      emergencyEntrants: [],
      fighterTotals: { [first]: [0, 3, 2, 1, 300, 10] },
    };
    const resultIssues = (): string[] => {
      const r = GameStateSchema.safeParse({ ...state, results: { [result.fixtureId]: result } });
      return r.success ? [] : r.error.issues.filter((i) => i.path[0] === 'results').map((i) => i.path.join('.'));
    };
    expect(resultIssues()).toEqual([]);
    result.fighterTotals = { [first]: [2 as never, 3, 2, 1, 300, 10] };
    expect(resultIssues().some((p) => p.includes('fighterTotals'))).toBe(true);
    result.fighterTotals = { [first]: [0, 3, 2, 1, 300] as never };
    expect(resultIssues().some((p) => p.includes('fighterTotals'))).toBe(true);
  });

  it('R2 box score: healingReceived (fighter stats) and freshnessAfter (round lineups) are optional, bounded fields', () => {
    const state = world();
    const [home, away] = Object.keys(state.clubs) as ClubId[];
    const ms = fixtureMatchState(state, home!, away!, content);
    const lineup = (side: typeof ms.home) => ({
      fighterIds: [...side.active],
      rows: [...side.rows],
      captainIndex: 0,
      viceCaptainIndex: null,
      captainQuality: 50,
      freshness: side.active.map(() => 100),
      entered: side.active.map(() => false),
    });
    ms.roundLineups = [{ round: 1, home: lineup(ms.home), away: lineup(ms.away) }];
    const first = ms.home.active[0]!;
    ms.fighterStats[first] = {
      clubId: home!,
      roundsPlayed: 1,
      roundsSurvived: 1,
      ticksOnArena: 600,
      damageDealt: 100,
      damageToShields: 0,
      damageTaken: 50,
      healingDone: 0,
      shieldingDone: 0,
      overheal: 0,
      ccAppliedTicks: 0,
      ccReceivedTicks: 0,
      downsInflicted: 0,
      downsSuffered: 0,
      assists: 0,
      focusSpent: 0,
      casts: {},
      ruleFires: [0],
      ruleCommittedTicks: [0],
      rulesNeverFired: [],
      downs: [],
      opponentIds: [],
    };
    state.liveMatch = ms;
    // Without the new fields (a save from the previous build): valid.
    expect(structureIssues(state)).toEqual([]);
    // With them: valid, and they survive a JSON round trip.
    ms.fighterStats[first]!.healingReceived = 30;
    ms.roundLineups[0]!.home.freshnessAfter = ms.home.active.map(() => 93);
    expect(structureIssues(state)).toEqual([]);
    const back = JSON.parse(JSON.stringify(state)) as GameState;
    expect(back.liveMatch!.fighterStats[first]!.healingReceived).toBe(30);
    expect(back.liveMatch!.roundLineups[0]!.home.freshnessAfter).toEqual([93, 93, 93, 93, 93]);
    // Bounded like the Freshness next to it.
    ms.roundLineups[0]!.home.freshnessAfter = [101, 93, 93, 93, 93];
    expect(structureIssues(state).some((p) => p.includes('freshnessAfter'))).toBe(true);
    ms.roundLineups[0]!.home.freshnessAfter = [93, 93, 93, 93];
    expect(structureIssues(state).some((p) => p.includes('freshnessAfter'))).toBe(true);
  });

  it('the bounds are the documented values (changing one is a save-format change)', () => {
    expect(SAVE_BOUNDS).toEqual({ squadStarters: 5, squadReserves: 2, swapsPerMatch: 2, pendingLevelUps: 3, levelUpOptions: 3, perksPerFighter: 4, callsPerRound: 2 });
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
