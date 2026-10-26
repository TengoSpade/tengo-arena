import { beforeAll, describe, expect, it } from 'vitest';
import { createGameEngine, createStandInPorts } from '../game';
import { asId, type ClubId, type GameState, type SeasonRecord, type TierId } from '../model';
import { checksumState, createSave, parseSave, saveMetaFor, serializeSave } from '../save';
import { fixtureContent } from '../testkit';
import { NotImplementedError, cloneJson } from '../util';
import { SOAK_CHECKS, ageMatchedBenchRatio, dynastyFlags, freshnessStarts, ledgerMismatches, levelAgeBands, lineupProblems, overCap, parseCohort, runSoak, scheduleProblems, squadRecordProblems, swapCounts, type AgeBandLevels } from './soak';

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
    // The age-matched bench ratio's tallies: one entry per human-age band, every season.
    for (const season of report.seasons) expect(Object.keys(season.levels.ageBands)).toEqual(levelAgeBands(content).map((b) => b.key));
  });

  it('reports blocked checks as pending when a module is a stub', () => {
    // Default ports are the real modules; on the fixture content the real sim may still be a stub.
    const ports = createStandInPorts();
    const stubbed = { ...ports, sim: { ...ports.sim, simulateRound: () => { throw new NotImplementedError('sim.simulateRound'); } } };
    const report = runSoak({ seed: 'soak-stub', seasons: 1, content, ports: stubbed });
    expect(report.stub).toBe(true);
    expect(report.checks.every((c) => c.status === 'pending')).toBe(true);
    expect(report.checks[0]!.detail).toContain('sim.simulateRound');
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

describe('M1.1: a match saved between rounds (sw-009) and the squad checks', () => {
  const engine = createGameEngine(createStandInPorts());
  function atMw1(seed: string): GameState {
    const w = engine.createWorld(content, { rootSeed: seed });
    if (!w.ok) throw new Error(w.error.message);
    const club = Object.keys(w.value.clubs).sort()[0] as ClubId;
    const c = engine.applyCommand(w.value, { type: 'club.choose', clubId: club }, content);
    if (!c.ok) throw new Error(c.error.message);
    let s = c.value.state;
    for (let guard = 0; guard < 10 && s.calendar.weekId !== 'MW1'; guard++) {
      const r = engine.advanceWeek(s, content);
      if (!r.ok) throw new Error(r.error.message);
      s = r.value.state;
    }
    return s;
  }

  it('saving on the between-round screen and loading resumes on the same screen with the same results', { timeout: 60_000 }, () => {
    const r = engine.advance(atMw1('live-save'), content);
    if (!r.ok) throw new Error(r.error.message);
    const paused = r.value.state;
    expect(paused.liveMatch?.phase).toBe('between_rounds');
    const env = createSave(paused, saveMetaFor(paused, { slotId: 'auto', kind: 'auto', label: 'x', savedAt: '2026-10-26T00:00:00Z', playtimeSec: 0, gameVersion: 't' }), { engineVersion: 1 });
    const parsed = parseSave(serializeSave(env), content);
    if (!parsed.ok) throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
    const loaded = parsed.value.envelope.state;
    expect(checksumState(loaded)).toBe(checksumState(paused));
    expect(loaded.liveMatch!.rounds).toEqual(paused.liveMatch!.rounds);
    expect(loaded.liveMatch!.playerDecisions).toBeNull();
    expect(engine.betweenRoundView(loaded, content)).toEqual(r.value.pause);
    const a = engine.advance(paused, content);
    const b = engine.advance(loaded, content);
    if (!a.ok || !b.ok) throw new Error('advance failed');
    expect(checksumState(b.value.state)).toBe(checksumState(a.value.state));
  });

  it('squadRecordProblems flags a withdrawn fighter who plays again, a sixth fighter and a swap from outside the squad', { timeout: 60_000 }, () => {
    const s = atMw1('squad-check');
    const r = engine.advanceWeek(s, content);
    if (!r.ok) throw new Error(r.error.message);
    const results = r.value.report.fixtureIds.map((id) => r.value.state.results[id]!);
    expect(squadRecordProblems(results, content)).toEqual([]);
    const bad = cloneJson(results[0]!);
    const rl = bad.roundLineups!;
    rl[1] = cloneJson(rl[0]!);
    rl[1].round = 2;
    const out = rl[0]!.home.fighterIds[0]!;
    bad.betweenRounds = [{ afterRound: 1, home: [{ out, in: asId('f-99999'), row: 'front', reason: 'auto', costsSwap: true }], away: [], injured: [], actingCaptain: { home: null, away: null }, freshness: {} }];
    const problems = squadRecordProblems([bad], content);
    expect(problems.some((p) => p.includes('returned'))).toBe(true);
    expect(problems.some((p) => p.includes('no reserve'))).toBe(true);
    expect(swapCounts([bad]).swaps).toBe(1);
    expect(freshnessStarts(r.value.state, [bad]).starts).toBe(rl.length * 10);
  });

  it('parseCohort reads the levels.json cohort keys', () => {
    expect(parseCohort('18-20 potential>=70')).toMatchObject({ minAge: 18, maxAge: 20, potMin: 70, potMax: 999 });
    expect(parseCohort('24-26 potential 50-65')).toMatchObject({ minAge: 24, maxAge: 26, potMin: 50, potMax: 65 });
    expect(parseCohort('35+')).toMatchObject({ minAge: 35, maxAge: 999, potMin: 0 });
    expect(() => parseCohort('young')).toThrow();
  });
});

describe('level-ups: the age-matched bench ratio', () => {
  const band = (starters: [number, number], bench: [number, number]): AgeBandLevels => ({
    starters: { fighters: starters[0], levels: starters[1] },
    bench: { fighters: bench[0], levels: bench[1] },
  });

  it('levelAgeBands: one band per distinct lower age edge of the cohort keys, potential ignored, covering every age', () => {
    const bands = levelAgeBands(content);
    // "18-20 potential>=70", "21-23", "24-26 potential 50-65", "27-30", "31-34", "35+"
    expect(bands.map((b) => b.key)).toEqual(['18-20', '21-23', '24-26', '27-30', '31-34', '35+']);
    expect(bands[0]!.minAge).toBe(0); // fighters below 18 count in the first band
    expect(bands[bands.length - 1]!.maxAge).toBe(999);
    for (let i = 1; i < bands.length; i++) expect(bands[i]!.minAge).toBe(bands[i - 1]!.maxAge + 1);
  });

  it('removes the age skew: a bench half as young as it is old reads 0.40 in every band, not the pooled 0.64', () => {
    // Young band: starters average 500 / 100 = 5.0 levels, bench 200 / 100 = 2.0 (0.4 of a starter).
    // Old band:   starters average 80 / 100 = 0.8 levels, bench 3.2 / 10 = 0.32 (also 0.4 of a starter).
    const young = band([100, 500], [100, 200]);
    const old = band([100, 80], [10, 3.2]);
    const matched = ageMatchedBenchRatio([young, old])!;
    // sum(bench levels) / sum(bench fighters x starter mean) = (200 + 3.2) / (100 x 5.0 + 10 x 0.8)
    expect(matched.ratio).toBeCloseTo((200 + 3.2) / (100 * 5 + 10 * 0.8), 12);
    expect(matched.ratio).toBeCloseTo(0.4, 12);
    expect(matched.benchFighters).toBe(110);
    expect(matched.bands).toBe(2);
    // The pooled ratio the check used before: bench mean over starter mean across all ages.
    const pooled = (203.2 / 110) / ((500 + 80) / 200);
    expect(pooled).toBeGreaterThan(0.6);
    expect(pooled).toBeGreaterThan(matched.ratio + 0.2);
  });

  it('leaves out a band without a reliable starter reference (fewer than 8 starters, or no starter levels) or without bench fighters', () => {
    const good = band([100, 500], [100, 200]);
    const base = ageMatchedBenchRatio([good])!.ratio;
    expect(ageMatchedBenchRatio([good, band([3, 30], [50, 500])])!.ratio).toBe(base);
    expect(ageMatchedBenchRatio([good, band([50, 0], [20, 20])])!.ratio).toBe(base);
    expect(ageMatchedBenchRatio([good, band([50, 100], [0, 0])])!.ratio).toBe(base);
    expect(ageMatchedBenchRatio([band([3, 30], [50, 500])])).toBeNull();
    expect(ageMatchedBenchRatio([])).toBeNull();
  });
});
