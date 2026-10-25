import { beforeAll, describe, expect, it } from 'vitest';
import { createGameEngine, createStandInPorts } from '../game';
import { asId, type ClubId, type GameState, type SeasonRecord, type TierId } from '../model';
import { checksumState, createSave, parseSave, saveMetaFor, serializeSave } from '../save';
import { fixtureContent } from '../testkit';
import { NotImplementedError, cloneJson } from '../util';
import { SOAK_CHECKS, dynastyFlags, ledgerMismatches, lineupProblems, overCap, runSoak, scheduleProblems } from './soak';

const content = fixtureContent();

describe('runSoak on stand-ins', () => {
  it('runs every catalogue check over two seasons and passes the engine invariants', { timeout: 120_000 }, () => {
    const report = runSoak({ seed: 'soak-test', seasons: 2, content, ports: createStandInPorts() });
    expect(report.checks.map((c) => c.id)).toEqual(SOAK_CHECKS.map((c) => c.id));
    expect(report.stub).toBe(false);
    expect(report.error).toBeNull();
    expect(report.seasonsCompleted).toBe(2);
    const status = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
    // Engine invariants (stand-in rules do not decide these):
    for (const id of ['determinism', 'ledger-balance', 'roster-size', 'schedule-integrity', 'references', 'save-roundtrip']) expect(status[id], id).toBe('pass');
    for (const c of report.checks) expect(c.status).not.toBe('pending');
    expect(report.seasons).toHaveLength(2);
    expect(report.finalChecksum).toMatch(/^[0-9a-f]{32}$/);
  });

  it('reports blocked checks as pending when a module is a stub', () => {
    // Default ports are the real modules; on the fixture content the real sim may still be a stub.
    const ports = createStandInPorts();
    const stubbed = { ...ports, sim: { ...ports.sim, simulateMatch: () => { throw new NotImplementedError('sim.simulateMatch'); } } };
    const report = runSoak({ seed: 'soak-stub', seasons: 1, content, ports: stubbed });
    expect(report.stub).toBe(true);
    expect(report.checks.every((c) => c.status === 'pending')).toBe(true);
    expect(report.checks[0]!.detail).toContain('sim.simulateMatch');
  });

  it('fails the checks it could not reach when the engine itself fails', () => {
    const ports = createStandInPorts();
    const broken = { ...ports, economy: { ...ports.economy, weeklyCosts: () => { throw new Error('boom'); } } };
    const report = runSoak({ seed: 'soak-broken', seasons: 1, content, ports: broken });
    expect(report.error).toContain('boom');
    expect(report.checks.some((c) => c.status === 'fail')).toBe(true);
  });

  it('rejects a bad season count', () => {
    expect(() => runSoak({ seed: 's', seasons: -1, content })).toThrow(RangeError);
  });
});

describe('individual checks', () => {
  const engine = createGameEngine(createStandInPorts());
  let mw2: GameState;
  let seasonEnd: GameState;
  beforeAll(() => {
    const w = engine.createWorld(content, { rootSeed: 'checks-1' });
    if (!w.ok) throw new Error(w.error.message);
    let s = w.value;
    while (s.calendar.phase !== 'season-end') {
      const r = engine.advanceWeek(s, content);
      if (!r.ok) throw new Error(r.error.message);
      s = r.value.state;
      if (s.calendar.weekId === 'MW2') mw2 = s;
    }
    seasonEnd = s;
  }, 60_000);

  it('ledger-balance: detects a balance that does not match the ledger', () => {
    expect(ledgerMismatches(mw2)).toEqual([]);
    const s = cloneJson(mw2);
    Object.values(s.clubs)[0]!.finance.balance += 1;
    expect(ledgerMismatches(s)).toHaveLength(1);
  });

  it('roster-size: detects a short or foreign lineup and an over-cap club after kick-off', () => {
    const results = Object.values(mw2.results);
    expect(lineupProblems(mw2, results)).toEqual([]);
    const s = cloneJson(mw2);
    const r = Object.values(s.results)[0]!;
    r.input.home.fighters = r.input.home.fighters.slice(0, 4);
    expect(lineupProblems(s, [r]).length).toBeGreaterThan(0);
    expect(overCap(mw2, content)).toEqual([]);
    const over = cloneJson(mw2);
    const clubId = Object.keys(over.clubs)[0] as ClubId;
    for (const f of Object.values(over.fighters).filter((x) => x.status === 'free-agent').slice(0, 20)) {
      f.clubId = clubId;
      f.status = 'active';
    }
    expect(overCap(over, content)).toHaveLength(1);
  });

  it('schedule-integrity: a complete season is clean; an unplayed fixture is reported', () => {
    expect(scheduleProblems(seasonEnd, content)).toEqual([]);
    const s = cloneJson(seasonEnd);
    const id = Object.keys(s.results)[0]!;
    delete s.results[id as keyof typeof s.results];
    expect(scheduleProblems(s, content).length).toBeGreaterThan(0);
  });

  it('competitive-balance: flags 4 Reckoning titles in 8 seasons and 6 Shields in 10', () => {
    const tierId = asId<TierId>(content.leagues.tiers[0]!.id);
    const rec = (season: number, champion: string, shield: string): SeasonRecord => ({
      season,
      tiers: [{ tierId, wingTables: [], tierTable: [], reckoningChampionId: asId(champion), reckoningRunnerUpId: null, shieldWinnerId: asId(shield), promotedIds: [], relegatedIds: [] }],
      retirements: [],
      rookieIds: [],
    });
    const fair = Array.from({ length: 10 }, (_, i) => rec(i + 1, `c${i % 4}`, `s${i % 3}`));
    expect(dynastyFlags(fair, content)).toEqual([]);
    const dynasty = Array.from({ length: 8 }, (_, i) => rec(i + 1, i % 2 === 0 ? 'x' : `c${i}`, `s${i}`));
    expect(dynastyFlags(dynasty, content).some((f) => f.includes('Reckoning titles'))).toBe(true);
    const shields = Array.from({ length: 10 }, (_, i) => rec(i + 1, `c${i}`, i < 6 ? 'y' : `s${i}`));
    expect(dynastyFlags(shields, content).some((f) => f.includes('Shields'))).toBe(true);
  });

  it('save-roundtrip and resume: save -> parse -> advance equals advance', () => {
    const meta = saveMetaFor(mw2, { slotId: 'auto-1', kind: 'auto', label: 't', savedAt: 'x', playtimeSec: 0, gameVersion: 't' });
    const parsed = parseSave(serializeSave(createSave(mw2, meta, { engineVersion: engine.ports.sim.engineVersion })), content);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(checksumState(parsed.value.envelope.state)).toBe(checksumState(mw2));
    const a = engine.advanceWeek(mw2, content);
    const b = engine.advanceWeek(parsed.value.envelope.state, content);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(checksumState(b.value.state)).toBe(checksumState(a.value.state));
  });
});
