import { beforeAll, describe, expect, it } from 'vitest';
import { asId, personName, type ClubId, type FighterId, type GameState } from '../model';
import { STREAM, deriveSeed } from '../rng';
import { fixtureContent } from '../testkit';
import { cloneJson, deepFreeze, hashString, stableStringify } from '../util';
import { createGameEngine, createStandInPorts, realGamePorts, type GameEngine } from './index';

const content = fixtureContent();
const checksum = (state: unknown): string => hashString(stableStringify(state));

function newEngine(): GameEngine {
  return createGameEngine(createStandInPorts());
}

function world(engine: GameEngine, seed: string): GameState {
  const w = engine.createWorld(content, { rootSeed: seed });
  if (!w.ok) throw new Error(w.error.message);
  return w.value;
}

/** Advance until `stop` (with the player's auto-pick when blocked by an incomplete lineup). */
function advanceUntil(engine: GameEngine, state: GameState, stop: (s: GameState) => boolean): GameState {
  let s = state;
  for (let guard = 0; guard < 40 && !stop(s); guard++) {
    if (s.playerClubId !== null && engine.getBlockers(s, content).length > 0) {
      const fixed = engine.applyCommand(s, engine.suggestLineup(s, s.playerClubId, content), content);
      if (!fixed.ok) throw new Error(fixed.error.message);
      s = fixed.value.state;
    }
    const r = engine.advanceWeek(s, content);
    if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
    s = r.value.state;
  }
  return s;
}

const atSeasonEnd = (s: GameState): boolean => s.calendar.phase === 'season-end';

describe('createWorld', () => {
  it('builds 48 clubs with rosters, contracts, a free-agent pool and the season-1 schedule; no player club yet', () => {
    const engine = newEngine();
    const s = world(engine, 'world-1');
    expect(Object.keys(s.clubs)).toHaveLength(content.clubs.list.length);
    expect(s.playerClubId).toBeNull();
    expect(s.calendar).toMatchObject({ season: 1, weekIndex: 1, weekId: 'P1', phase: 'preseason' });
    for (const club of Object.values(s.clubs)) {
      const roster = engine.roster(s, club.id, content);
      expect(roster.length).toBeGreaterThanOrEqual(5);
      for (const f of roster) expect(f.contract?.clubId).toBe(club.id);
      expect(club.captainId).not.toBeNull();
      expect(club.lineup.fighters).toHaveLength(5);
    }
    const pool = Object.values(s.fighters).filter((f) => f.status === 'free-agent');
    expect(pool.length).toBeGreaterThanOrEqual(Math.round(content.clubs.list.length * content.development.generation.worldGen.freeAgentsPerClub));
    expect(Object.keys(s.fixtures).length).toBeGreaterThan(0);
  });

  it('is deterministic per seed and differs between seeds', () => {
    const a = world(newEngine(), 'world-2');
    const b = world(newEngine(), 'world-2');
    const c = world(newEngine(), 'world-3');
    expect(checksum(a)).toBe(checksum(b));
    expect(checksum(a)).not.toBe(checksum(c));
  });

  it('rejects an invalid seed', () => {
    const r = newEngine().createWorld(content, { rootSeed: '' });
    expect(r.ok ? null : r.error.code).toBe('world.seed');
  });
});

describe('season-1 start (D-P)', () => {
  const engine = createGameEngine(realGamePorts);
  let s: GameState;
  beforeAll(() => {
    s = world(engine, 'start-1');
  }, 60_000);

  it('a Trials Day class of exactly one rookie per club, from the rookie generator', () => {
    const clubs = Object.keys(s.clubs).sort();
    expect(Object.keys(s.market.trialsRookies).sort()).toEqual(clubs);
    for (const c of clubs) expect(s.market.trialsRookies[c as ClubId]).toHaveLength(1);
    const ids = Object.values(s.market.trialsRookies).flat();
    expect(new Set(ids).size).toBe(clubs.length);
    for (const id of ids) expect(s.fighters[id]).toMatchObject({ status: 'free-agent', debutSeason: 1, contract: null });
  });

  it('the AI season-start setup ran for every club before P1: captain, vice, lineup, opening offers', () => {
    for (const c of Object.values(s.clubs)) {
      expect(c.captainId).not.toBeNull();
      expect(c.viceCaptainId).not.toBeNull();
      expect(c.lineup.fighters).toHaveLength(5);
    }
    expect(s.market.offers.length).toBeGreaterThan(0);
    // Trials signings wait for the first processing: every trials rookie is still unsigned.
    for (const id of Object.values(s.market.trialsRookies).flat()) expect(s.fighters[id]!.clubId).toBeNull();
  });

  it('the first P1 processing: AI clubs sign trials rookies, the player decides on their own', () => {
    const player = Object.keys(s.clubs).sort()[3] as ClubId;
    const own = s.market.trialsRookies[player]![0]!;
    const chosen = engine.applyCommand(s, { type: 'club.choose', clubId: player }, content);
    if (!chosen.ok) throw new Error(chosen.error.message);
    const r = engine.advanceWeek(chosen.value.state, content);
    if (!r.ok) throw new Error(r.error.message);
    const p1 = r.value.state;
    expect(p1.fighters[own]!.clubId).toBeNull(); // not signed for the player
    const signed = Object.entries(s.market.trialsRookies).filter(([c, [id]]) => c !== player && p1.fighters[id!]?.clubId === c);
    expect(signed.length).toBeGreaterThan(0);
  });

  it('starting balance and the first grant installment are counted once', () => {
    for (const c of Object.values(s.clubs)) {
      const setup = s.ledger.entries.filter((e) => e.clubId === c.id);
      const grants = setup.filter((e) => e.category === 'centralGrant');
      expect(grants).toHaveLength(1);
      const grant = content.tierProfile(content.tiers.require(c.tierId).level).centralGrant;
      expect(grants[0]!.amount).toBe(Math.trunc(grant / 2));
      // P1 balance = starting balance (opening) + the setup credits, nothing else.
      expect(c.finance.balance).toBe(s.ledger.openingBalances[c.id]! + setup.reduce((a, e) => a + e.amount, 0));
    }
  });
});

describe('a full season', () => {
  const engine = newEngine();
  let start: GameState;
  let end: GameState;
  let next: GameState;

  beforeAll(() => {
    start = world(engine, 'season-1');
    const chosen = engine.applyCommand(start, { type: 'club.choose', clubId: Object.keys(start.clubs).sort()[5] as ClubId }, content);
    if (!chosen.ok) throw new Error(chosen.error.message);
    start = chosen.value.state;
    end = advanceUntil(engine, start, atSeasonEnd);
    const r = engine.runSeasonEnd(end, content);
    if (!r.ok) throw new Error(r.error.message);
    next = r.value.state;
  }, 60_000);

  it('the same seed twice gives an identical state checksum after a full season', () => {
    const again = newEngine();
    let s = world(again, 'season-1');
    const chosen = again.applyCommand(s, { type: 'club.choose', clubId: Object.keys(s.clubs).sort()[5] as ClubId }, content);
    if (!chosen.ok) throw new Error(chosen.error.message);
    s = advanceUntil(again, chosen.value.state, atSeasonEnd);
    const r = again.runSeasonEnd(s, content);
    if (!r.ok) throw new Error(r.error.message);
    expect(checksum(r.value.state)).toBe(checksum(next));
  }, 60_000);

  it('plays 16 league matches per club, a Reckoning per tier, and every lineup is legal', () => {
    const results = Object.values(end.results).filter((r) => r.season === 1);
    expect(results.length).toBe(content.leagues.tiers.length * (8 * content.leagues.regularSeason.matchesPerClub + 7));
    for (const r of results) {
      for (const side of [r.input.home, r.input.away]) {
        const ids = side.fighters.map((f) => f.fighterId);
        expect(new Set(ids).size).toBe(5);
        for (const id of ids) {
          if (r.hiredBladeIds.includes(id)) continue;
          // A fielded fighter was on the club's roster at the time (contract held by the side's club or retired since).
          expect(end.fighters[id]).toBeDefined();
        }
      }
      expect(r.input.seed).toBe(deriveSeed(end.rng.root, STREAM.match, 1, r.fixtureId));
    }
  });

  it('season end: next season P1, archive, +1 age, new schedule, AI opening phase', () => {
    expect(next.calendar).toMatchObject({ season: 2, weekIndex: 1, weekId: 'P1', phase: 'preseason' });
    expect(next.history).toHaveLength(1);
    expect(next.history[0]!.season).toBe(1);
    expect(next.history[0]!.tiers).toHaveLength(content.leagues.tiers.length);
    const aged = Object.values(end.fighters).filter((f) => f.status === 'active');
    for (const f of aged.slice(0, 20)) {
      // A fighter who retired at this season end is an alumnus now.
      const now = next.fighters[f.id];
      if (now) expect(now.age).toBe(f.age + 1);
      else expect(next.alumni[f.id]).toBeDefined();
    }
    expect(Object.values(next.fixtures).some((x) => x.season === 2)).toBe(true);
    for (const c of Object.values(next.clubs)) expect(c.history.some((h) => h.season === 1)).toBe(true);
  });

  it('season end: fighters who left become alumni and nothing on a roster still names them', () => {
    const record = next.history[0]!;
    expect(record.retirements.length).toBeGreaterThan(0);
    for (const r of record.retirements) {
      expect(next.fighters[r.fighterId]).toBeUndefined();
      expect(next.alumni[r.fighterId]).toMatchObject({ id: r.fighterId, leftSeason: 1, lastClubId: r.lastClubId });
      expect(personName(next, r.fighterId)).toEqual(end.fighters[r.fighterId]!.name);
    }
    expect(Object.values(next.fighters).some((f) => f.status === 'retired' || (f.status === 'hired-blade' && f.clubId === null))).toBe(false);
    const gone = new Set<string>(Object.keys(next.alumni));
    for (const c of Object.values(next.clubs)) {
      expect(c.shortlist.filter((id) => gone.has(id))).toEqual([]);
      expect(c.lineup.fighters.filter((e) => gone.has(e.fighterId))).toEqual([]);
      expect(Object.keys(c.lineup.tactics).filter((id) => gone.has(id))).toEqual([]);
    }
  });

  it('advanceWeek and runSeasonEnd never mutate their input (frozen states work)', () => {
    const frozen = deepFreeze(cloneJson(start));
    expect(engine.advanceWeek(frozen, content).ok).toBe(true);
    const frozenEnd = deepFreeze(cloneJson(end));
    expect(engine.runSeasonEnd(frozenEnd, content).ok).toBe(true);
  });

  it('save -> load -> advance equals advance (resume guarantee)', () => {
    let mid = advanceUntil(engine, start, (s) => s.calendar.weekId === 'MW5');
    const fix = engine.applyCommand(mid, engine.suggestLineup(mid, mid.playerClubId!, content), content);
    if (fix.ok) mid = fix.value.state;
    expect(engine.getBlockers(mid, content)).toEqual([]);
    const reloaded = JSON.parse(JSON.stringify(mid)) as GameState;
    const a = engine.advanceWeek(mid, content);
    const b = engine.advanceWeek(reloaded, content);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(checksum(b.value.state)).toBe(checksum(a.value.state));
  });

  it('a week report lists the fixtures in simulation order and the player fixture', () => {
    const mw1 = advanceUntil(engine, start, (s) => s.calendar.weekId === 'MW1');
    const r = engine.advanceWeek(mw1, content);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { report, state } = r.value;
    expect(report.weekId).toBe('MW1');
    expect(report.fixtureIds).toHaveLength(content.leagues.tiers.length * 8);
    expect(report.playerFixtureId).not.toBeNull();
    expect(report.ledgerSeqTo).toBeGreaterThan(report.ledgerSeqFrom);
    expect(state.calendar.weekId).toBe('MW2');
    for (const id of report.fixtureIds) expect(state.fixtures[id]!.status).toBe('played');
  });
});

describe('match preparation and reports', () => {
  const engine = newEngine();
  let s: GameState;
  beforeAll(() => {
    s = advanceUntil(engine, world(engine, 'report-1'), (x) => x.calendar.weekId === 'MW2');
  }, 60_000);

  it('prepareMatchInput: the stored input for a played fixture, a fresh one from the lineups otherwise', () => {
    const played = Object.values(s.results)[0]!;
    const r = engine.prepareMatchInput(s, played.fixtureId, content);
    expect(r.ok && r.value).toEqual(played.input);
    const next = Object.values(s.fixtures).find((x) => x.status === 'scheduled' && x.weekId === 'MW2')!;
    const p = engine.prepareMatchInput(s, next.id, content);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.home.fighters).toHaveLength(5);
    expect(p.value.away.fighters).toHaveLength(5);
    expect(p.value.seed).toBe(deriveSeed(s.rng.root, STREAM.match, s.calendar.season, next.id));
    expect(p.value.home.fighters[p.value.home.captainIndex]).toBeDefined();
    expect(engine.prepareMatchInput(s, asId('lg:9:x'), content).ok).toBe(false);
  });

  it('buildMatchReport re-simulates the timeline and carries the aftermath', () => {
    const played = Object.values(s.results)[0]!;
    const r = engine.buildMatchReport(s, played.fixtureId, content);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.timelineAvailable).toBe(true);
    expect(r.value.rounds).toHaveLength(played.rounds.length);
    expect(r.value.rounds.every((x) => x.keyEvents.some((e) => e.kind === 'down'))).toBe(true);
    expect(r.value.fighters).toHaveLength(10);
    expect(Object.keys(r.value.aftermath.xp)).toHaveLength(10);
    expect(r.value.aftermath.gold.some((g) => g.reason === 'gate')).toBe(true);
    // Per-round rule fires and skip reasons from the summary recaps.
    expect(r.value.ruleDetails).toHaveLength(10);
    expect(r.value.ruleDetails[0]!.rounds).toHaveLength(played.rounds.length);
    expect(r.value.ruleDetails[0]!.rounds[0]!.ruleSkips[1]).toEqual({ no_target: 1 });
    const unplayed = Object.values(s.fixtures).find((x) => x.status === 'scheduled')!;
    const e = engine.buildMatchReport(s, unplayed.id, content);
    expect(e.ok ? null : e.error.code).toBe('report.not-played');
    // A result from another engine version has no timeline but still reports.
    const other = cloneJson(s);
    other.results[played.fixtureId]!.engineVersion = -1;
    const o = engine.buildMatchReport(other, played.fixtureId, content);
    expect(o.ok && o.value.timelineAvailable).toBe(false);
  });

  it('views: roster by lineup slot, free agents by market wage, fighter view, auto-pick', () => {
    const clubId = Object.keys(s.clubs).sort()[0] as ClubId;
    const roster = engine.roster(s, clubId, content);
    const lineup = s.clubs[clubId]!.lineup.fighters.map((e) => e.fighterId);
    expect(roster.slice(0, lineup.length).map((f) => f.id)).toEqual(lineup);
    const fas = engine.freeAgents(s, content);
    const wages = fas.map((f) => engine.ports.economy.marketWage(s, f.id, content));
    expect([...wages].sort((a, b) => b - a)).toEqual(wages);
    const view = engine.fighterView(s, roster[0]!.id, content);
    expect(view.fighter.id).toBe(roster[0]!.id);
    expect(view.rating).toBeGreaterThan(0);
    expect(view.available).toBe(true);
    expect(view.captaincy.letter).not.toBe('');
    const cmd = engine.suggestLineup(s, clubId, content);
    expect(cmd.type).toBe('lineup.set');
    expect(engine.applyCommand(s, cmd, content).ok).toBe(true);
    expect(() => engine.fighterView(s, asId<FighterId>('f-0'), content)).toThrow();
  });

  it('releasePreview states the payout and the balance after, and matches the release', () => {
    const clubId = Object.keys(s.clubs).sort()[0] as ClubId;
    const id = engine.roster(s, clubId, content).at(-1)!.id;
    const preview = engine.releasePreview(s, clubId, id, content)!;
    expect(preview.payout).toBeGreaterThan(0);
    const r = engine.applyCommand(s, { type: 'roster.release', clubId, fighterId: id }, content);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.state.clubs[clubId]!.finance.balance).toBe(preview.balanceAfter);
    expect(engine.releasePreview(s, clubId, asId<FighterId>('f-0'), content)).toBeNull();
  });
});

describe('blockers (02 §3)', () => {
  const engine = newEngine();
  let mw1: GameState;
  let clubId: ClubId;
  beforeAll(() => {
    const s = world(engine, 'blockers-1');
    clubId = Object.keys(s.clubs).sort()[2] as ClubId;
    const c = engine.applyCommand(s, { type: 'club.choose', clubId }, content);
    if (!c.ok) throw new Error(c.error.message);
    mw1 = advanceUntil(engine, c.value.state, (x) => x.calendar.weekId === 'MW1');
    const fix = engine.applyCommand(mw1, engine.suggestLineup(mw1, clubId, content), content);
    if (!fix.ok) throw new Error(fix.error.message);
    mw1 = fix.value.state;
  }, 60_000);

  it('club.not-chosen and phase.season-end', () => {
    const w = world(engine, 'blockers-2');
    expect(engine.getBlockers(w, content).map((b) => b.code)).toEqual(['club.not-chosen']);
    const se = cloneJson(mw1);
    se.calendar = { season: 1, weekIndex: 24, weekId: null, phase: 'season-end' };
    expect(engine.getBlockers(se, content).map((b) => b.code)).toEqual(['phase.season-end']);
  });

  it('a valid lineup has no blockers', () => {
    expect(engine.getBlockers(mw1, content)).toEqual([]);
  });

  it('an injured starter blocks and is named; advanceWeek refuses with advance.blocked', () => {
    const s = cloneJson(mw1);
    const id = s.clubs[clubId]!.lineup.fighters[0]!.fighterId;
    s.fighters[id]!.injury = { severity: 'minor', weeksOut: 2, fixtureId: null, round: null, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 5 } };
    const blockers = engine.getBlockers(s, content);
    expect(blockers).toContainEqual({ code: 'lineup.unavailable', fighterId: id });
    expect(blockers.map((b) => b.code)).toContain('lineup.incomplete');
    const r = engine.advanceWeek(s, content);
    expect(r.ok ? null : r.error.code).toBe('advance.blocked');
  });

  it('an incomplete lineup blocks only while fit fighters are left out (hired blades cover a short roster)', () => {
    const s = cloneJson(mw1);
    s.clubs[clubId]!.lineup.fighters = s.clubs[clubId]!.lineup.fighters.slice(0, 4);
    expect(engine.getBlockers(s, content).map((b) => b.code)).toEqual(['lineup.incomplete']);
    const short = cloneJson(s);
    const injury = { severity: 'minor' as const, weeksOut: 3, fixtureId: null, round: null, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 5 } };
    const inLineup = new Set(short.clubs[clubId]!.lineup.fighters.map((e) => e.fighterId));
    for (const f of Object.values(short.fighters)) if (f.clubId === clubId && !inLineup.has(f.id)) f.injury = injury;
    expect(engine.getBlockers(short, content)).toEqual([]);
    const r = engine.advanceWeek(short, content);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const result = r.value.state.results[r.value.report.playerFixtureId!]!;
      expect(result.hiredBladeIds.length).toBe(1);
    }
  });

  it('a lineup naming someone off the roster blocks; over the cap blocks from kick-off', () => {
    const s = cloneJson(mw1);
    const other = Object.values(s.fighters).find((f) => f.status === 'free-agent')!.id;
    s.clubs[clubId]!.lineup.fighters[0] = { fighterId: other, row: 'front' };
    expect(engine.getBlockers(s, content)).toContainEqual({ code: 'lineup.not-on-roster', fighterId: other });
    const over = cloneJson(mw1);
    const cap = content.tiers.require(over.clubs[clubId]!.tierId).rosterCap;
    let n = Object.values(over.fighters).filter((f) => f.clubId === clubId && f.status === 'active').length;
    for (const f of Object.values(over.fighters)) {
      if (n > cap) break;
      if (f.status !== 'free-agent') continue;
      f.clubId = clubId;
      f.status = 'active';
      f.freeAgency = null;
      f.contract = { clubId, wagePerWeek: 10, startSeason: 1, endSeason: 1, signedAt: { season: 1, weekIndex: 1 }, dropClauseApplied: false };
      n++;
    }
    expect(engine.getBlockers(over, content).map((b) => b.code)).toContain('roster.over-cap');
    const p2 = cloneJson(over);
    p2.calendar = { season: 1, weekIndex: 2, weekId: asId('P2'), phase: 'preseason' };
    expect(engine.getBlockers(p2, content).map((b) => b.code)).not.toContain('roster.over-cap');
  });
});
