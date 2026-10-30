/**
 * Derived lookup indexes over GameState (performance; 05 §8).
 *
 * Rosters, free agents, results per club-season and fixtures per week are
 * looked up thousands of times per week. Scanning every fighter, result or
 * fixture each time made week processing grow with the save. These indexes
 * are DERIVED (never persisted, never authoritative) and are used only on
 * states that core/game has put in "indexed" mode (`enableIndexes`): drafts
 * inside a transition and the committed states it returns. Everywhere else
 * (unit tests that build states by hand) the same functions fall back to a
 * full scan, so results never depend on whether an index exists.
 *
 * Correctness rule (enforced by tests/architecture/indexed-writes.test.ts): on an
 * indexed state, production code changes rosters, results and fixtures only
 * through the helpers below (setMembership, putFighter, removeFighter,
 * putResult, removeResult, putFixture, removeFixture), which drop the
 * affected index. Every index rebuilds lazily on its next read, in a fixed
 * order (fighter id / insertion order), so lookups are deterministic.
 */
import type { Fixture } from './competition';
import type { Fighter, FighterStatus } from './fighter';
import type { GameState } from './game-state';
import { idNumber, type ClubId, type FighterId, type FixtureId } from './ids';
import type { MatchResult } from './match';

interface RosterIndex {
  /** Active fighters per club, in fighter id order. */
  byClub: Map<ClubId, Fighter[]>;
  /** Free agents in fighter id order. */
  freeAgents: Fighter[];
}

interface ResultIndex {
  /** Results per `${season}|${clubId}` (home or away), in insertion order. */
  bySeasonClub: Map<string, MatchResult[]>;
}

interface FixtureIndex {
  /** Fixtures per `${season}|${weekIndex}`, in insertion order. */
  byWeek: Map<string, Fixture[]>;
}

const indexed = new WeakSet<GameState>();
const rosters = new WeakMap<GameState, RosterIndex>();
const resultsIdx = new WeakMap<GameState, ResultIndex>();
const fixturesIdx = new WeakMap<GameState, FixtureIndex>();

/** Put a state in indexed mode (core/game does this on every draft it creates). */
export function enableIndexes(state: GameState): void {
  indexed.add(state);
}

export function indexesEnabled(state: GameState): boolean {
  return indexed.has(state);
}

/** Drop every index of a state (after a bulk rewrite such as a migration or compaction). */
export function invalidateIndexes(state: GameState): void {
  rosters.delete(state);
  resultsIdx.delete(state);
  fixturesIdx.delete(state);
}

function compareFighters(a: Fighter, b: Fighter): number {
  return idNumber(a.id) - idNumber(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function buildRosters(state: GameState): RosterIndex {
  const byClub = new Map<ClubId, Fighter[]>();
  const freeAgents: Fighter[] = [];
  for (const f of Object.values(state.fighters)) {
    if (f.status === 'active' && f.clubId !== null) {
      let list = byClub.get(f.clubId);
      if (!list) byClub.set(f.clubId, (list = []));
      list.push(f);
    } else if (f.status === 'free-agent') freeAgents.push(f);
  }
  for (const list of byClub.values()) list.sort(compareFighters);
  freeAgents.sort(compareFighters);
  return { byClub, freeAgents };
}

function rosterIndex(state: GameState): RosterIndex | null {
  if (!indexed.has(state)) return null;
  let idx = rosters.get(state);
  if (!idx) rosters.set(state, (idx = buildRosters(state)));
  return idx;
}

const EMPTY: readonly never[] = Object.freeze([]);

/** A club's active roster in fighter id order. Treat the array as read-only. */
export function clubRoster(state: GameState, clubId: ClubId): readonly Fighter[] {
  const idx = rosterIndex(state);
  if (idx) return idx.byClub.get(clubId) ?? EMPTY;
  const out: Fighter[] = [];
  for (const f of Object.values(state.fighters)) if (f.clubId === clubId && f.status === 'active') out.push(f);
  return out.sort(compareFighters);
}

/** Free agents in fighter id order. Treat the array as read-only. */
export function freeAgentList(state: GameState): readonly Fighter[] {
  const idx = rosterIndex(state);
  if (idx) return idx.freeAgents;
  const out: Fighter[] = [];
  for (const f of Object.values(state.fighters)) if (f.status === 'free-agent') out.push(f);
  return out.sort(compareFighters);
}

/** The ONLY way production code changes a fighter's club or status. */
export function setMembership(state: GameState, fighter: Fighter, clubId: ClubId | null, status: FighterStatus): void {
  fighter.clubId = clubId;
  fighter.status = status;
  rosters.delete(state);
}

/** Insert (or replace) a fighter. */
export function putFighter(state: GameState, fighter: Fighter): void {
  state.fighters[fighter.id] = fighter;
  rosters.delete(state);
}

/** Remove a fighter (e.g. compacted into alumni). */
export function removeFighter(state: GameState, fighterId: FighterId): void {
  delete state.fighters[fighterId];
  rosters.delete(state);
}

// ---- results ---------------------------------------------------------------------------------------

function buildResults(state: GameState): ResultIndex {
  const bySeasonClub = new Map<string, MatchResult[]>();
  const add = (key: string, r: MatchResult): void => {
    let list = bySeasonClub.get(key);
    if (!list) bySeasonClub.set(key, (list = []));
    list.push(r);
  };
  for (const r of Object.values(state.results)) {
    add(`${r.season}|${r.homeClubId}`, r);
    add(`${r.season}|${r.awayClubId}`, r);
  }
  return { bySeasonClub };
}

/** Results of a club (home or away) in a season, in insertion (play) order. Treat as read-only. */
export function clubResults(state: GameState, season: number, clubId: ClubId): readonly MatchResult[] {
  if (indexed.has(state)) {
    let idx = resultsIdx.get(state);
    if (!idx) resultsIdx.set(state, (idx = buildResults(state)));
    return idx.bySeasonClub.get(`${season}|${clubId}`) ?? EMPTY;
  }
  return Object.values(state.results).filter((r) => r.season === season && (r.homeClubId === clubId || r.awayClubId === clubId));
}

export function putResult(state: GameState, result: MatchResult): void {
  state.results[result.fixtureId] = result;
  resultsIdx.delete(state);
}

export function removeResult(state: GameState, fixtureId: FixtureId): void {
  delete state.results[fixtureId];
  resultsIdx.delete(state);
}

// ---- fixtures ----------------------------------------------------------------------------------------

function buildFixtures(state: GameState): FixtureIndex {
  const byWeek = new Map<string, Fixture[]>();
  for (const fx of Object.values(state.fixtures)) {
    const key = `${fx.season}|${fx.weekIndex}`;
    let list = byWeek.get(key);
    if (!list) byWeek.set(key, (list = []));
    list.push(fx);
  }
  return { byWeek };
}

/** Fixtures of a season week, in insertion order. Treat as read-only. */
export function weekFixtures(state: GameState, season: number, weekIndex: number): readonly Fixture[] {
  if (indexed.has(state)) {
    let idx = fixturesIdx.get(state);
    if (!idx) fixturesIdx.set(state, (idx = buildFixtures(state)));
    return idx.byWeek.get(`${season}|${weekIndex}`) ?? EMPTY;
  }
  return Object.values(state.fixtures).filter((fx) => fx.season === season && fx.weekIndex === weekIndex);
}

export function putFixture(state: GameState, fixture: Fixture): void {
  state.fixtures[fixture.id] = fixture;
  fixturesIdx.delete(state);
}

export function removeFixture(state: GameState, fixtureId: FixtureId): void {
  delete state.fixtures[fixtureId];
  fixturesIdx.delete(state);
}
