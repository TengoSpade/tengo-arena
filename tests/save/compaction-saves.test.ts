/**
 * KI-2: saves with compacted results (leagues.json matchRecords.compactAiMatchesAfterWeeks, default 3).
 *
 * No schema bump: `MatchResult.fielded` is an optional field (like `fighterTotals` before it), so every older save
 * loads unchanged. What matters is that (1) a state holding compacted results saves, loads and plays on identically,
 * (2) the owner's real careers (the R001 playtest saves: M1 whole-match results, one with an M1-compacted previous
 * season) are caught up by the rule at their next week without changing anything but the detail, and (3) a report of
 * a compacted match still builds.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { formatContentIssues, loadContent, type ContentDB } from '../../src/core/content';
import { advanceWeek, applyCommand, buildMatchReport, createWorld, getBlockers, realGamePorts, suggestLineup } from '../../src/core/game';
import { compactedResult, isCompactedResult, standings } from '../../src/core/league';
import { fieldedFive, type ClubId, type GameState, type MatchResult } from '../../src/core/model';
import { createSave, parseSave, saveMetaFor, serializeSave, validateState } from '../../src/core/save';
import { cloneJson, hashString, stableStringify } from '../../src/core/util';
import { REPO_ROOT, loadRawContentFromDisk } from '../../scripts/lib/node-content';

const diskRaw = loadRawContentFromDisk('default').raw;

/** content/default with its own compaction setting; the content hash is the source's, so states compare equal. */
function defaultContent(after?: number): ContentDB {
  const raw = structuredClone(diskRaw) as Record<string, Record<string, unknown>>;
  const hash = loadContent('default', diskRaw);
  if (!hash.ok) throw new Error(formatContentIssues(hash.error));
  if (after !== undefined) raw['leagues']!['matchRecords'] = { compactAiMatchesAfterWeeks: after };
  const r = loadContent('default', raw, { hash: hash.value.ref.hash });
  if (!r.ok) throw new Error(formatContentIssues(r.error));
  return r.value;
}

const content = defaultContent();
const never = defaultContent(99);
const hash = (value: unknown): string => hashString(stableStringify(value));
const saveMeta = (s: GameState) => saveMetaFor(s, { slotId: 'auto-1', kind: 'auto', label: 'test', savedAt: '1970-01-01T00:00:00Z', playtimeSec: 0, gameVersion: 'test' });

function week(c: ContentDB, state: GameState): GameState {
  let s = state;
  if (s.playerClubId !== null && getBlockers(s, c).some((b) => b.code.startsWith('lineup'))) {
    const fixed = applyCommand(s, suggestLineup(s, s.playerClubId, c), c);
    if (fixed.ok) s = fixed.value.state;
  }
  const r = advanceWeek(s, c);
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value.state;
}

const involvesPlayer = (s: GameState, r: MatchResult): boolean => s.playerClubId !== null && (r.homeClubId === s.playerClubId || r.awayClubId === s.playerClubId);

/** The state with every result between other clubs in its compacted form, so a full and a compacted run compare equal. */
function withoutDetail(state: GameState): GameState {
  const out = cloneJson(state);
  for (const [id, r] of Object.entries(out.results)) if (!involvesPlayer(out, r)) out.results[id as keyof typeof out.results] = compactedResult(r);
  return out;
}

function tables(state: GameState, c: ContentDB): unknown {
  return Object.values(state.competitions)
    .filter((k) => k.kind === 'league')
    .map((k) => ({ id: k.id, tier: standings(state, k.id, 'tier', c), wings: k.wings.map((w) => standings(state, k.id, w.wingId, c)) }));
}

describe('a state that holds compacted results', () => {
  it('saves, loads (strict schema, checksum, references) and plays on identically: save -> load -> advance equals advance', () => {
    const w = createWorld(content, { rootSeed: 'ki2-saves' });
    if (!w.ok) throw new Error(w.error.message);
    const chosen = applyCommand(w.value, { type: 'club.choose', clubId: Object.keys(w.value.clubs).sort()[3] as ClubId }, content);
    if (!chosen.ok) throw new Error(chosen.error.message);
    let s = chosen.value.state;
    while (s.calendar.weekIndex < 14) s = week(content, s);
    const compacted = Object.values(s.results).filter(isCompactedResult);
    expect(compacted.length).toBeGreaterThan(50);
    expect(compacted.every((r) => r.fielded !== undefined && fieldedFive(r, 'home').length === 5 && fieldedFive(r, 'away').length === 5)).toBe(true);
    expect(Object.values(s.results).filter((r) => involvesPlayer(s, r)).every((r) => !isCompactedResult(r))).toBe(true);

    const parsed = parseSave(serializeSave(createSave(s, saveMeta(s), { engineVersion: realGamePorts.sim.engineVersion })), content);
    if (!parsed.ok) throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
    expect(parsed.value.migratedFrom).toBeNull();
    const loaded = parsed.value.envelope.state;
    expect(validateState(loaded, content)).toEqual([]);
    expect(hash(loaded)).toBe(hash(s));
    expect(hash(week(content, loaded))).toBe(hash(week(content, s)));
  }, 120_000);
});

describe.each(['r001-t004', 'r001-t004-s2w3-v2'] as const)("the owner's R001 career %s", (name) => {
  const json = gunzipSync(readFileSync(join(REPO_ROOT, 'tests', 'fixtures', 'saves', `${name}.json.gz`))).toString('utf8');
  const parsed = parseSave(json, content);
  if (!parsed.ok) throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
  const start = parsed.value.envelope.state;

  it('loads with no result compacted by the new rule, and plays three weeks with it on or off giving the same game', () => {
    expect(validateState(start, content)).toEqual([]);
    let on = start;
    let off = start;
    const seasons = new Set<number>();
    for (let i = 0; i < 3; i++) {
      on = week(content, on);
      off = week(never, off);
      seasons.add(on.calendar.season);
      expect(hash(withoutDetail(on))).toBe(hash(withoutDetail(off)));
      expect(hash(tables(on, content))).toBe(hash(tables(off, never)));
    }
    expect(seasons.size).toBe(1);
    // The matches of the weeks before the window were compacted in the first week, whatever format they were played in
    // (M1: whole-match sims). The season-2 save starts before its first match, so it has none yet.
    const season = on.calendar.season;
    const aged = Object.values(on.results).filter((r) => r.season === season && r.weekIndex <= on.calendar.weekIndex - 1 - 3 && !involvesPlayer(on, r));
    if (start.calendar.weekIndex > 9) expect(aged.length).toBeGreaterThan(0);
    expect(aged.every(isCompactedResult)).toBe(true);
    for (const r of aged) {
      expect(fieldedFive(r, 'home')).toHaveLength(5);
      expect(fieldedFive(r, 'away')).toHaveLength(5);
    }
    // The player's own matches are in full.
    expect(Object.values(on.results).filter((r) => r.season === season && involvesPlayer(on, r)).every((r) => !isCompactedResult(r))).toBe(true);
    expect(validateState(on, content)).toEqual([]);
  }, 120_000);

  it('builds the report of a compacted match (compacted in season by this build, or last season by an older one): score and round results, the summary flag, no timeline', () => {
    let s = start;
    for (let i = 0; i < 2; i++) s = week(content, s);
    const result = Object.values(s.results).find((r) => !involvesPlayer(s, r) && isCompactedResult(r));
    expect(result).toBeDefined();
    const report = buildMatchReport(s, result!.fixtureId, content);
    if (!report.ok) throw new Error(`${report.error.code}: ${report.error.message}`);
    expect(report.value.compacted).toBe(true);
    expect(report.value.timelineAvailable).toBe(false);
    expect(report.value.score).toEqual(result!.score);
    expect(report.value.rounds).toHaveLength(result!.rounds.length);
    // An M1 compaction (older build) kept no fighter totals: its report has the score and rounds only.
    if (result!.fighterTotals) expect(report.value.fighters.length).toBeGreaterThan(0);
  }, 120_000);

  it('saves again and loads as the same state', () => {
    const s = week(content, start);
    const again = parseSave(serializeSave(createSave(s, saveMeta(s), { engineVersion: realGamePorts.sim.engineVersion })), content);
    if (!again.ok) throw new Error(`${again.error.code}: ${again.error.message}`);
    expect(hash(again.value.envelope.state)).toBe(hash(s));
  }, 120_000);
});

describe('a real v3 save written by main (d440107: state v3, no in-season compaction), season 2 week 7', () => {
  const json = gunzipSync(readFileSync(join(REPO_ROOT, 'tests', 'fixtures', 'saves', 'ki2-v3-main-s2w7.json.gz'))).toString('utf8');
  const parsed = parseSave(json, content);
  if (!parsed.ok) throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
  const start = parsed.value.envelope.state;

  it('loads through the v3 -> v4 and v4 -> v5 steps: migratedFrom 3, schema 5, valid, nothing but the version stamped; older results keep their shape', () => {
    expect((JSON.parse(json) as { schemaVersion: number }).schemaVersion).toBe(3);
    expect(parsed.value.migratedFrom).toBe(3);
    expect(parsed.value.envelope.schemaVersion).toBe(5);
    expect(start.schemaVersion).toBe(5);
    expect(parsed.value.warnings.every((w) => w.includes('different content'))).toBe(true);
    expect(validateState(start, content)).toEqual([]);
    const original = (JSON.parse(json) as { state: GameState }).state;
    expect(hash({ ...start, schemaVersion: 3 })).toBe(hash(original));
    // Season 1 was compacted by main's season-end rule (no `fielded`); season 2 so far is in full.
    const results = Object.values(start.results);
    expect(results.filter((r) => r.season === 1 && !involvesPlayer(start, r)).every((r) => isCompactedResult(r) && r.fielded === undefined)).toBe(true);
    expect(results.filter((r) => r.season === 2).every((r) => !isCompactedResult(r))).toBe(true);
  });

  it('plays on: from its next week the rule compacts season 2 matches between other clubs, and the game is the same as with the rule off', () => {
    let on = start;
    let off = start;
    for (let i = 0; i < 3; i++) {
      on = week(content, on);
      off = week(never, off);
      expect(hash(withoutDetail(on))).toBe(hash(withoutDetail(off)));
      expect(hash(tables(on, content))).toBe(hash(tables(off, never)));
    }
    const current = Object.values(on.results).filter((r) => r.season === 2);
    const aged = current.filter((r) => r.weekIndex <= 6 && !involvesPlayer(on, r));
    expect(aged.length).toBeGreaterThan(20);
    expect(aged.every((r) => isCompactedResult(r) && fieldedFive(r, 'home').length === 5 && fieldedFive(r, 'away').length === 5)).toBe(true);
    expect(current.filter((r) => involvesPlayer(on, r)).every((r) => !isCompactedResult(r))).toBe(true);
    expect(current.filter((r) => r.weekIndex >= 7).every((r) => !isCompactedResult(r))).toBe(true);
    // Last season's results are as main left them.
    expect(Object.values(on.results).filter((r) => r.season === 1).every((r) => r.fielded === undefined)).toBe(true);
    // Saved again it is a v4 save that loads without a migration.
    const again = parseSave(serializeSave(createSave(on, saveMeta(on), { engineVersion: realGamePorts.sim.engineVersion })), content);
    if (!again.ok) throw new Error(`${again.error.code}: ${again.error.message}`);
    expect(again.value.migratedFrom).toBeNull();
    expect(hash(again.value.envelope.state)).toBe(hash(on));
  }, 120_000);
});
