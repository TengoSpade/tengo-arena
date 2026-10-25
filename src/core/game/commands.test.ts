import { beforeAll, describe, expect, it } from 'vitest';
import { asId, type ClubId, type Command, type FighterId, type GameState, type NewsId, type TacticsPresetId } from '../model';
import { checksumState } from '../save';
import { fixtureContent } from '../testkit';
import { cloneJson } from '../util';
import { createGameEngine, createStandInPorts } from './index';

const content = fixtureContent();
const engine = createGameEngine(createStandInPorts());
let base: GameState;

beforeAll(() => {
  const w = engine.createWorld(content, { rootSeed: 'commands-1' });
  if (!w.ok) throw new Error(w.error.message);
  base = w.value;
});

function clubs(state: GameState): ClubId[] {
  return Object.keys(state.clubs).sort() as ClubId[];
}
function rosterOf(state: GameState, clubId: ClubId): FighterId[] {
  return Object.values(state.fighters)
    .filter((f) => f.clubId === clubId && f.status === 'active')
    .map((f) => f.id)
    .sort();
}
function freeAgent(state: GameState): FighterId {
  const trials = new Set(Object.values(state.market.trialsRookies).flat());
  return Object.values(state.fighters).find((f) => f.status === 'free-agent' && !trials.has(f.id))!.id;
}
/** Apply and return the error code (null on success); the input must never change. */
function code(state: GameState, command: Command): string | null {
  const before = checksumState(state);
  const r = engine.applyCommand(state, command, content);
  expect(checksumState(state)).toBe(before);
  return r.ok ? null : r.error.code;
}
function apply(state: GameState, command: Command): GameState {
  const r = engine.applyCommand(state, command, content);
  if (!r.ok) throw new Error(`${command.type}: ${r.error.code} ${r.error.message}`);
  return r.value.state;
}

describe('club.choose', () => {
  it('sets the player club once', () => {
    const c = clubs(base)[0]!;
    const s = apply(base, { type: 'club.choose', clubId: c });
    expect(s.playerClubId).toBe(c);
    expect(code(s, { type: 'club.choose', clubId: c })).toBe('club.already-chosen');
    expect(code(base, { type: 'club.choose', clubId: asId<ClubId>('nowhere') })).toBe('club.unknown');
  });
});

describe('lineup.set', () => {
  it('validates size, duplicates, roster membership, rows and the match captain', () => {
    const c = clubs(base)[0]!;
    const ids = rosterOf(base, c);
    const entry = (id: FighterId) => ({ fighterId: id, row: 'front' as const });
    expect(code(base, { type: 'lineup.set', clubId: c, fighters: ids.slice(0, 5).map(entry), matchCaptainId: ids[0]! })).toBeNull();
    expect(code(base, { type: 'lineup.set', clubId: c, fighters: ids.slice(0, 6).map(entry), matchCaptainId: null })).toBe('lineup.size');
    expect(code(base, { type: 'lineup.set', clubId: c, fighters: [entry(ids[0]!), entry(ids[0]!)], matchCaptainId: null })).toBe('lineup.duplicate');
    const other = rosterOf(base, clubs(base)[1]!)[0]!;
    expect(code(base, { type: 'lineup.set', clubId: c, fighters: [entry(other)], matchCaptainId: null })).toBe('lineup.not-on-roster');
    expect(code(base, { type: 'lineup.set', clubId: c, fighters: [{ fighterId: ids[0]!, row: 'middle' as never }], matchCaptainId: null })).toBe('lineup.row');
    expect(code(base, { type: 'lineup.set', clubId: c, fighters: [entry(ids[0]!)], matchCaptainId: ids[1]! })).toBe('lineup.captain-not-fielded');
    expect(code(base, { type: 'lineup.set', clubId: asId<ClubId>('x'), fighters: [], matchCaptainId: null })).toBe('club.unknown');
  });

  it('stores the lineup and gives new starters a default preset', () => {
    const c = clubs(base)[0]!;
    const ids = rosterOf(base, c);
    const s = apply(base, { type: 'lineup.set', clubId: c, fighters: ids.slice(-5).map((id) => ({ fighterId: id, row: 'back' })), matchCaptainId: null });
    expect(s.clubs[c]!.lineup.fighters.map((e) => e.fighterId)).toEqual(ids.slice(-5));
    for (const id of ids.slice(-5)) expect(s.clubs[c]!.lineup.tactics[id]).toBeDefined();
  });
});

describe('tactics.assign, captaincy.set, training.set', () => {
  it('a preset must belong to the fighter class; custom lists wait for M3', () => {
    const c = clubs(base)[0]!;
    const id = rosterOf(base, c)[0]!;
    const klass = content.classes.require(base.fighters[id]!.classId);
    const other = content.classes.list.find((k) => k.id !== klass.id)!;
    expect(code(base, { type: 'tactics.assign', clubId: c, fighterId: id, tactics: { kind: 'preset', presetId: asId<TacticsPresetId>(klass.presetIds[1]!) } })).toBeNull();
    expect(code(base, { type: 'tactics.assign', clubId: c, fighterId: id, tactics: { kind: 'preset', presetId: asId<TacticsPresetId>(other.presetIds[0]!) } })).toBe('tactics.preset-class');
    expect(code(base, { type: 'tactics.assign', clubId: c, fighterId: id, tactics: { kind: 'custom', name: 'x', rules: [], stance: 'steady' } })).toBe('tactics.custom-unavailable');
    expect(code(base, { type: 'tactics.assign', clubId: c, fighterId: freeAgent(base), tactics: { kind: 'preset', presetId: asId<TacticsPresetId>(klass.presetIds[0]!) } })).toBe('tactics.not-on-roster');
  });

  it('captain and vice-captain must be different roster fighters', () => {
    const c = clubs(base)[0]!;
    const [a, b] = rosterOf(base, c);
    const s = apply(base, { type: 'captaincy.set', clubId: c, captainId: a!, viceCaptainId: b! });
    expect([s.clubs[c]!.captainId, s.clubs[c]!.viceCaptainId]).toEqual([a, b]);
    expect(code(base, { type: 'captaincy.set', clubId: c, captainId: a!, viceCaptainId: a! })).toBe('captaincy.same-fighter');
    expect(code(base, { type: 'captaincy.set', clubId: c, captainId: freeAgent(base), viceCaptainId: null })).toBe('captaincy.not-on-roster');
  });

  it('training emphasis is a roster setting and can be switched off for a career', () => {
    const c = clubs(base)[0]!;
    const id = rosterOf(base, c)[0]!;
    expect(apply(base, { type: 'training.set', clubId: c, fighterId: id, emphasis: 'mind' }).fighters[id]!.trainingEmphasis).toBe('mind');
    expect(code(base, { type: 'training.set', clubId: c, fighterId: id, emphasis: 'feet' as never })).toBe('training.emphasis');
    const off = cloneJson(base);
    off.options.trainingEmphasis = false;
    expect(code(off, { type: 'training.set', clubId: c, fighterId: id, emphasis: 'body' })).toBe('training.disabled');
  });
});

describe('market commands', () => {
  it('offer.make pends until processing; withdraw releases it', () => {
    const c = clubs(base)[0]!;
    const fa = freeAgent(base);
    const r = engine.applyCommand(base, { type: 'offer.make', clubId: c, fighterId: fa, wagePerWeek: 60, seasons: 2, acceptCounter: false }, content);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.response).toEqual({ kind: 'pending' });
    expect(r.value.state.market.offers.some((o) => o.clubId === c && o.fighterId === fa)).toBe(true);
    expect(r.value.state.fighters[fa]!.status).toBe('free-agent');
    expect(code(r.value.state, { type: 'offer.withdraw', clubId: c, fighterId: fa })).toBeNull();
    expect(code(base, { type: 'offer.withdraw', clubId: c, fighterId: fa })).toBe('offer.none');
    expect(code(base, { type: 'offer.make', clubId: c, fighterId: fa, wagePerWeek: 3999, seasons: 1, acceptCounter: false })).toBe('offer.wage-budget');
  });

  it('offer.make error codes', () => {
    const c = clubs(base)[0]!;
    const fa = freeAgent(base);
    const own = rosterOf(base, c)[0]!;
    expect(code(base, { type: 'offer.make', clubId: c, fighterId: own, wagePerWeek: 100, seasons: 1, acceptCounter: false })).toBe('offer.not-free-agent');
    expect(code(base, { type: 'offer.make', clubId: c, fighterId: fa, wagePerWeek: 100, seasons: 4, acceptCounter: false })).toBe('offer.length');
    expect(code(base, { type: 'offer.make', clubId: c, fighterId: fa, wagePerWeek: 0, seasons: 1, acceptCounter: false })).toBe('offer.wage');
    const trials = cloneJson(base);
    trials.market.trialsRookies[clubs(base)[1]!] = [fa];
    expect(code(trials, { type: 'offer.make', clubId: c, fighterId: fa, wagePerWeek: 100, seasons: 1, acceptCounter: false })).toBe('offer.trials-rookie');
    // Economy-owned legality passes through unchanged (stand-in code for a full roster).
    const full = cloneJson(base);
    const cap = content.tiers.require(full.clubs[c]!.tierId).rosterCap;
    const pool = Object.values(full.fighters).filter((f) => f.status === 'free-agent' && f.id !== fa);
    for (const f of pool.slice(0, cap - rosterOf(full, c).length)) {
      f.clubId = c;
      f.status = 'active';
      f.contract = { clubId: c, wagePerWeek: 0, startSeason: 1, endSeason: 1, signedAt: { season: 1, weekIndex: 1 }, dropClauseApplied: false };
      f.freeAgency = null;
    }
    expect(code(full, { type: 'offer.make', clubId: c, fighterId: fa, wagePerWeek: 100, seasons: 1, acceptCounter: false })).toBe('offer.cap');
  });

  it('contract.renew and trials.sign answer at once', () => {
    const c = clubs(base)[0]!;
    const expiring = rosterOf(base, c).find((id) => base.fighters[id]!.contract!.endSeason === 1)!;
    const wage = base.fighters[expiring]!.contract!.wagePerWeek;
    const r = engine.applyCommand(base, { type: 'contract.renew', clubId: c, fighterId: expiring, wagePerWeek: wage, seasons: 2 }, content);
    expect(r.ok && r.value.response?.kind).toBe('accepted');
    expect(code(base, { type: 'contract.renew', clubId: c, fighterId: freeAgent(base), wagePerWeek: 100, seasons: 1 })).toBe('renew.not-on-roster');
    const fa = freeAgent(base);
    expect(code(base, { type: 'trials.sign', clubId: c, fighterId: fa, wagePerWeek: 100, seasons: 1 })).toBe('trials.not-offered');
    const trials = cloneJson(base);
    trials.market.trialsRookies[c] = [fa];
    const t = engine.applyCommand(trials, { type: 'trials.sign', clubId: c, fighterId: fa, wagePerWeek: 60, seasons: 3 }, content);
    expect(t.ok && t.value.response?.kind).toBe('accepted');
    if (t.ok) expect(t.value.state.fighters[fa]!.clubId).toBe(c);
  });

  it('roster.release frees the fighter, tidies lineup and captaincy, and names an interim captain', () => {
    const c = clubs(base)[0]!;
    const chosen = apply(base, { type: 'club.choose', clubId: c });
    const captain = chosen.clubs[c]!.captainId!;
    const r = engine.applyCommand(chosen, { type: 'roster.release', clubId: c, fighterId: captain }, content);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.value.state;
    expect(s.fighters[captain]!.status).toBe('free-agent');
    expect(s.clubs[c]!.lineup.fighters.some((e) => e.fighterId === captain)).toBe(false);
    expect(s.clubs[c]!.lineup.tactics[captain]).toBeUndefined();
    expect(s.clubs[c]!.captainId).not.toBeNull();
    expect(s.clubs[c]!.captainId).not.toBe(captain);
    expect(r.value.newsIds.map((id) => s.news.find((n) => n.id === id)!.key)).toContain('captain.interim');
    expect(s.ai[c]!.voluntaryReleasesThisSeason).toBe(1);
    expect(code(base, { type: 'roster.release', clubId: c, fighterId: freeAgent(base) })).toBe('release.not-on-roster');
  });
});

describe('shortlist.toggle and news.markRead', () => {
  it('toggle and mark read', () => {
    const c = clubs(base)[0]!;
    const fa = freeAgent(base);
    const s = apply(base, { type: 'shortlist.toggle', clubId: c, fighterId: fa });
    expect(s.clubs[c]!.shortlist).toEqual([fa]);
    expect(apply(s, { type: 'shortlist.toggle', clubId: c, fighterId: fa }).clubs[c]!.shortlist).toEqual([]);
    expect(code(base, { type: 'shortlist.toggle', clubId: c, fighterId: asId<FighterId>('f-999999') })).toBe('shortlist.unknown-fighter');
    const withNews = cloneJson(base);
    withNews.news.push({ id: asId<NewsId>('n-900'), at: { season: 1, weekIndex: 1 }, key: 'x', params: {}, clubId: null, refs: {}, importance: 'info', read: false });
    withNews.ids.news = 901;
    expect(apply(withNews, { type: 'news.markRead', newsIds: [asId<NewsId>('n-900')] }).news.at(-1)!.read).toBe(true);
    expect(code(withNews, { type: 'news.markRead', newsIds: [asId<NewsId>('n-1234')] })).toBe('news.unknown');
  });
});

describe('one rulebook', () => {
  it('the player club and an AI club get the same answer for the same command', () => {
    const [p, a] = clubs(base);
    const chosen = apply(base, { type: 'club.choose', clubId: p! });
    const fa = freeAgent(base);
    for (const clubId of [p!, a!]) {
      expect(code(chosen, { type: 'offer.make', clubId, fighterId: fa, wagePerWeek: 0, seasons: 1, acceptCounter: false })).toBe('offer.wage');
      expect(code(chosen, { type: 'lineup.set', clubId, fighters: [], matchCaptainId: asId<FighterId>('f-1') })).toBe('lineup.captain-not-fielded');
    }
  });

  it('club decisions wait while the season-end step is pending', () => {
    const s = cloneJson(base);
    s.calendar = { season: 1, weekIndex: content.leagues.calendar.weeks.length + 1, weekId: null, phase: 'season-end' };
    const c = clubs(base)[0]!;
    expect(code(s, { type: 'training.set', clubId: c, fighterId: rosterOf(s, c)[0]!, emphasis: 'body' })).toBe('phase.season-end');
    expect(code(s, { type: 'shortlist.toggle', clubId: c, fighterId: freeAgent(s) })).toBeNull();
  });
});
