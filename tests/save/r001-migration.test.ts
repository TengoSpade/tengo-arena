/**
 * M1.1 save migration v2 -> v3 on the owner's real R001 career (critical: the
 * live career in IndexedDB must load). Fixtures are the playtest ticket saves
 * AL-R001-T001 (season 1, week 1) and AL-R001-T004 (season 1, week 17),
 * gzipped, plus r001-t004-s2w3-v2: T004 played on with the M1 (v2) code through
 * the season end to season 2 week 3 (history rows, rookies, a second season).
 * Load, migrate, validate, advance a week, save again.
 * Spec: docs/design/_drafts/m1.1/progression.md §6 (mig-001 .. mig-003).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { formatContentIssues, loadContent, type ContentDB } from '../../src/core/content';
import { effectiveStats, rating } from '../../src/core/fighters';
import { advanceWeek, getBlockers, suggestLineup, applyCommand } from '../../src/core/game';
import { FRESHNESS10_MAX, STATE_SCHEMA_VERSION, type Fighter, type GameState, type SaveEnvelope } from '../../src/core/model';
import { createSave, parseSave, serializeSave, validateState } from '../../src/core/save';
import { REPO_ROOT, loadRawContentFromDisk } from '../../scripts/lib/node-content';

function defaultContent(): ContentDB {
  const r = loadContent('default', loadRawContentFromDisk('default').raw);
  if (!r.ok) throw new Error(formatContentIssues(r.error));
  return r.value;
}

const content = defaultContent();
const SAVES = ['r001-t001', 'r001-t004', 'r001-t004-s2w3-v2'] as const;
const read = (name: string): string => gunzipSync(readFileSync(join(REPO_ROOT, 'tests', 'fixtures', 'saves', `${name}.json.gz`))).toString('utf8');

function migrated(json: string): { state: GameState; warnings: string[]; from: number | null } {
  const r = parseSave(json, content);
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return { state: r.value.envelope.state, warnings: r.value.warnings, from: r.value.migratedFrom };
}

describe.each(SAVES)('R001 save %s: v2 -> v3', (name) => {
  const json = read(name);
  const v2 = JSON.parse(json) as SaveEnvelope;
  const { state, warnings, from } = migrated(json);
  const before = v2.state.fighters as Record<string, Fighter>;

  it('loads: migrates from v2 and validates against the v3 schema and references', () => {
    expect(v2.schemaVersion).toBe(2);
    expect(from).toBe(2);
    expect(state.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(validateState(state, content)).toEqual([]);
    // The content changed under the career (M1.1): it loads with the hash warning only.
    expect(warnings.every((w) => w.includes('different content'))).toBe(true);
  });

  it('keeps every shown stat except Stamina (mig-001)', () => {
    let changed = 0;
    for (const [id, f] of Object.entries(state.fighters)) {
      const old = effectiveStats(before[id]!, content);
      const now = effectiveStats(f, content);
      for (const s of content.stats.list) if (s.id !== 'stamina' && old[s.id as keyof typeof old] !== now[s.id as keyof typeof now]) changed++;
      expect(now['stamina' as keyof typeof now]).toBeGreaterThanOrEqual(1);
    }
    expect(changed).toBe(0);
  });

  it('derives the v3 fields: level, XP bar below one level, Freshness 100, nothing pending (mig-001)', () => {
    for (const f of Object.values(state.fighters)) {
      const old = before[f.id]!;
      expect(f.level).toBeGreaterThanOrEqual(1);
      expect(f.xpIntoLevel).toBe(Math.min(old.season.xp, f.xpNeeded - 1));
      expect(f.xpNeeded).toBeGreaterThanOrEqual(content.levels.xpPerLevel.min);
      expect(f.xpNeeded).toBeLessThanOrEqual(content.levels.xpPerLevel.max);
      expect(f.freshness10).toBe(FRESHNESS10_MAX);
      expect(f.pendingLevelUps).toEqual([]);
      expect(f.perkIds).toEqual([]);
      expect(f.abilityRanks).toEqual({ a1: 1, a2: 1, passive: 1 });
      expect(f.season.roundXp).toBe(old.season.xp);
      expect(Object.keys(f.train100).sort()).toEqual(content.stats.list.map((s) => s.id).sort());
      // peakRating moves with the reweight (mig-003): never below the current rating's distance from it.
      expect(f.career.peakRating - rating(f, content)).toBeGreaterThanOrEqual(Math.min(0, old.career.peakRating - rating(f, content)) - 2);
    }
    // T001 was filed before the club choice (playerClubId null): every club then has the AI defaults.
    const player = state.playerClubId === null ? null : state.clubs[state.playerClubId]!;
    if (player) {
      expect(player.levelUpDefault).toBe('manual');
      expect(player.pauseBetweenRounds).toBe('always');
      expect(player.autoSwap.freshnessBelow).toBe(content.levels.aiSubstitution.playerAutoDefault);
    }
    for (const c of Object.values(state.clubs)) {
      expect(c.lineup.reserves).toEqual([]);
      expect(c.autoSwap.lostRoundBonus).toBe(content.levels.aiSubstitution.lostRoundThresholdBonus);
      if (c.id !== player?.id) expect(c.levelUpDefault).toBe('auto');
    }
    expect(state.liveMatch).toBeNull();
  });

  it('gives starters a plausible Stamina (levels.json soakTargets.starterStaminaMedian, loosely)', () => {
    const values = Object.values(state.clubs)
      .flatMap((c) => c.lineup.fighters.map((e) => state.fighters[e.fighterId]))
      .filter((f): f is Fighter => f !== undefined)
      .map((f) => effectiveStats(f, content)['stamina' as keyof ReturnType<typeof effectiveStats>] as number)
      .sort((a, b) => a - b);
    const median = values[values.length >> 1]!;
    expect(median).toBeGreaterThanOrEqual(7);
    expect(median).toBeLessThanOrEqual(16);
  });

  it('is deterministic: migrating the same save twice is byte-identical (mig-002)', () => {
    expect(JSON.stringify(migrated(json).state)).toBe(JSON.stringify(state));
  });

  it('advances a week on the migrated state, and the result saves and loads as v3', () => {
    let s = state;
    for (const b of getBlockers(s, content)) {
      // A ticket save may sit before the player's lineup is complete: fill it the way the UI's auto-pick does.
      if (b.code.startsWith('lineup')) {
        const r = applyCommand(s, suggestLineup(s, s.playerClubId!, content), content);
        if (r.ok) s = r.value.state;
      }
    }
    if (s.playerClubId === null) {
      // Filed before the club choice: pick a club (first by id) through club.choose, as the club picker would, so the player defaults apply.
      const pick = applyCommand(s, { type: 'club.choose', clubId: Object.keys(s.clubs).sort()[0] as never }, content);
      if (!pick.ok) throw new Error(pick.error.message);
      s = pick.value.state;
      expect(s.clubs[s.playerClubId!]!.levelUpDefault).toBe('manual');
    }
    const r = advanceWeek(s, content);
    if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
    const next = r.value.state;
    expect(next.calendar.weekIndex).toBe(s.calendar.weekIndex + 1);
    expect(validateState(next, content)).toEqual([]);
    const meta = { ...v2.meta };
    const again = parseSave(serializeSave(createSave(next, meta, { engineVersion: v2.engineVersion })), content);
    if (!again.ok) throw new Error(`${again.error.code}: ${again.error.message}`);
    expect(again.value.migratedFrom).toBeNull();
  });
});
