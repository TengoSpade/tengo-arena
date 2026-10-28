/**
 * In-season compaction of matches between other clubs (leagues.json matchRecords.compactAiMatchesAfterWeeks,
 * KI-2, owner answer to Q36).
 *
 * The rule is a save-size rule and nothing else: the same seed with compaction on and off must give the same game.
 * These tests run real modules over several seasons twice (a content set that never compacts in season against one
 * that compacts after 1 or 3 weeks) and compare, every week, the whole state except the detail compaction removes,
 * plus the views that read match records: the standings (downs tie-break included), each club's last fielded five
 * and the renewal asks (which read who started a club's matches). The save side (a state that holds compacted
 * results saves, loads and plays on identically; older saves are caught up) is tests/save/compaction-saves.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { loadContent, type ContentDB } from '../content';
import { createGameEngine, realGamePorts } from './index';
import { compactedResult, isCompactedResult } from '../league';
import { fieldedFive, type ClubId, type GameState, type MatchResult } from '../model';
import { FIXTURE_CONTENT_RAW, fixtureContent } from '../testkit';
import { cloneJson, hashString, stableStringify } from '../util';

const base = fixtureContent();
const engine = createGameEngine(realGamePorts);
const NEVER = 99;

/** The fixture content with its own compaction setting and the same content hash (the hash is not what is under test). */
function contentWith(after: number): ContentDB {
  const raw = structuredClone(FIXTURE_CONTENT_RAW) as Record<string, { matchRecords?: unknown }>;
  raw['leagues']!.matchRecords = { compactAiMatchesAfterWeeks: after };
  const r = loadContent('fixture', raw, { profile: 'fixture', hash: base.ref.hash });
  if (!r.ok) throw new Error('content variant is invalid');
  return r.value;
}

function newWorld(content: ContentDB, seed: string, player: boolean): GameState {
  const w = engine.createWorld(content, { rootSeed: seed });
  if (!w.ok) throw new Error(w.error.message);
  if (!player) return w.value;
  const club = Object.keys(w.value.clubs).sort()[5] as ClubId;
  const c = engine.applyCommand(w.value, { type: 'club.choose', clubId: club }, content);
  if (!c.ok) throw new Error(c.error.message);
  return c.value.state;
}

/** One week as the browser plays it: the auto-picked lineup for the player, then Continue. */
function week(content: ContentDB, state: GameState): GameState {
  let s = state;
  if (s.playerClubId !== null) {
    const fixed = engine.applyCommand(s, engine.suggestLineup(s, s.playerClubId, content), content);
    if (fixed.ok) s = fixed.value.state;
  }
  const r = engine.advanceWeek(s, content);
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value.state;
}

function seasonEnd(content: ContentDB, state: GameState): GameState {
  const r = engine.runSeasonEnd(state, content);
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value.state;
}

const involvesPlayer = (s: GameState, r: MatchResult): boolean => s.playerClubId !== null && (r.homeClubId === s.playerClubId || r.awayClubId === s.playerClubId);

/** The state with every result between other clubs reduced to its compacted form, so a full and a compacted run compare equal. */
function withoutDetail(state: GameState): GameState {
  const out = cloneJson(state);
  for (const [id, r] of Object.entries(out.results)) if (!involvesPlayer(out, r)) out.results[id as keyof typeof out.results] = compactedResult(r);
  return out;
}

const hash = (value: unknown): string => hashString(stableStringify(value));

/** Path of the first difference between two JSON values, for a failure message. */
function firstDiff(a: unknown, b: unknown, path = '$'): string | null {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b) ? null : `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of [...keys].sort()) {
    const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    if (d !== null) return d;
  }
  return null;
}

/** The views that read match records, as plain JSON. */
function views(state: GameState, content: ContentDB, withAsks: boolean): unknown {
  const tables: Record<string, unknown> = {};
  for (const comp of Object.values(state.competitions)) {
    if (comp.kind !== 'league') continue;
    tables[comp.id] = { tier: realGamePorts.league.standings(state, comp.id, 'tier', content), wings: comp.wings.map((w) => realGamePorts.league.standings(state, comp.id, w.wingId, content)) };
  }
  // The last five each club fielded this season (Home and Squad, D-R).
  const latest = new Map<ClubId, MatchResult>();
  for (const r of Object.values(state.results)) {
    if (r.season !== state.calendar.season) continue;
    for (const c of [r.homeClubId, r.awayClubId]) {
      const seen = latest.get(c);
      if (!seen || r.weekIndex > seen.weekIndex) latest.set(c, r);
    }
  }
  const fives: Record<string, unknown> = {};
  for (const [c, r] of [...latest].sort(([a], [b]) => (a < b ? -1 : 1))) fives[c] = fieldedFive(r, r.homeClubId === c ? 'home' : 'away');
  // The renewal ask of every contracted fighter: it reads how often he started this season.
  const asks: Record<string, number> = {};
  if (withAsks) {
    for (const f of Object.values(state.fighters)) {
      if (f.status !== 'active' || f.clubId === null || f.contract === null) continue;
      asks[f.id] = realGamePorts.economy.ask(state, f.id, f.clubId, 2, content);
    }
  }
  return { tables, fives, asks };
}

/**
 * One reference run that never compacts in season and one run per `afters` entry, all from the same seed, in lockstep.
 * After every week: each run's state equals the reference but for the compacted detail, and the record-reading
 * views are equal. Returns, per variant, how many matches it had compacted at its busiest and how many of them
 * were the player's.
 */
function lockstep(opts: { afters: number[]; seed: string; player: boolean; seasons: number }): { after: number; compactedPeak: number; compactedPlayer: number }[] {
  const off = contentWith(NEVER);
  let ref = newWorld(off, opts.seed, opts.player);
  const variants = opts.afters.map((after) => ({ after, content: contentWith(after), state: newWorld(contentWith(after), opts.seed, opts.player), compactedPeak: 0, compactedPlayer: 0 }));
  const compare = (where: string, withAsks: boolean): void => {
    const nr = withoutDetail(ref);
    const vr = views(ref, off, withAsks);
    for (const v of variants) {
      const nv = withoutDetail(v.state);
      if (hash(nr) !== hash(nv)) expect.fail(`N=${v.after}, ${where}: states differ at ${firstDiff(nr, nv)}`);
      const vv = views(v.state, v.content, withAsks);
      if (hash(vr) !== hash(vv)) expect.fail(`N=${v.after}, ${where}: views differ at ${firstDiff(vr, vv)}`);
    }
  };
  for (let season = 1; season <= opts.seasons; season++) {
    while (ref.calendar.phase !== 'season-end') {
      ref = week(off, ref);
      for (const v of variants) v.state = week(v.content, v.state);
      compare(`season ${season} after ${ref.calendar.weekId ?? ref.calendar.phase}`, ref.calendar.weekIndex % 5 === 0 || ref.calendar.phase === 'season-end');
      expect(Object.values(ref.results).some((r) => isCompactedResult(r) && r.season === season)).toBe(false); // the reference never compacts in season
      for (const v of variants) {
        const mine = Object.values(v.state.results).filter((r) => r.season === season && isCompactedResult(r));
        v.compactedPeak = Math.max(v.compactedPeak, mine.length);
        v.compactedPlayer += mine.filter((r) => involvesPlayer(v.state, r)).length;
      }
    }
    ref = seasonEnd(off, ref);
    for (const v of variants) v.state = seasonEnd(v.content, v.state);
    compare(`season ${season} end`, true);
    // After the season end every run holds the same results outright: the season-end rule compacts what is left.
    for (const v of variants) expect(hash(v.state.results)).toBe(hash(ref.results));
  }
  return variants.map(({ after, compactedPeak, compactedPlayer }) => ({ after, compactedPeak, compactedPlayer }));
}

describe('compaction on or off gives the same game (KI-2)', () => {
  it('after 3 weeks (the default) and after 1 week, a player club, a season and its end: states, standings, last fives and renewal asks are identical every week', () => {
    const [three, one] = lockstep({ afters: [3, 1], seed: 'compaction-1', player: true, seasons: 1 });
    // Not vacuous: most of a season's other matches were compacted in season, more of them the smaller N.
    expect(three!.compactedPeak).toBeGreaterThan(250);
    expect(one!.compactedPeak).toBeGreaterThan(three!.compactedPeak);
    // The player's own matches are never compacted in season.
    expect(three!.compactedPlayer).toBe(0);
    expect(one!.compactedPlayer).toBe(0);
  }, 240_000);
});
