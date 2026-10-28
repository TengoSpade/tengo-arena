// Test support for the pure half of src/render (WP-M2C): the shipped content, the committed fight-log fixtures and a
// round context built from a log. Imported by *.test.ts only. It is an .mts file so the DOM-free, Node-free typecheck of
// the pure half (tsconfig.core.json) does not include it; the project typecheck (tsconfig.json) does.
//
// src/render may import core/sim as types only (rule render-sim-value, tests included), so the logs are fixtures made
// by the real simulator: see fixtures/make-fixtures.mjs.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { loadContent, type ContentDB } from '../../core/content';
import type { FightEvent, FightLog, Side } from '../../core/model';
import { loadRawContentFromDisk } from '../../../scripts/lib/node-content';
import { buildCueTable } from '../cues';
import { colorsForMatch, defaultArenaPalette } from '../colors';
import type { ArenaRoundContext, ArenaUnitInfo, CueTable, RoleId } from '../types';

let contentCache: ContentDB | null = null;
/** content/default, loaded once per test file. */
export function defaultContent(): ContentDB {
  if (contentCache) return contentCache;
  const loaded = loadContent('default', loadRawContentFromDisk('default').raw);
  if (!loaded.ok) throw new Error('content/default does not load');
  contentCache = loaded.value;
  return contentCache;
}

let cueCache: CueTable | null = null;
export function defaultCues(): CueTable {
  cueCache ??= buildCueTable(defaultContent());
  return cueCache;
}

export interface FixtureMeta {
  name: string;
  seed: string;
  home: string[];
  away: string[];
  durationTicks: number;
  winner: Side;
}

export const FIXTURE_NAMES = ['long', 'a', 'b', 'c', 'd', 'e', 'f'] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

const fixtureCache = new Map<string, { meta: FixtureMeta; log: FightLog }>();
/** One committed full-level round of the simulator (format 1). The returned log is shared: copy before changing it. */
export function loadFixture(name: FixtureName): { meta: FixtureMeta; log: FightLog } {
  const hit = fixtureCache.get(name);
  if (hit) return hit;
  const raw = gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url)));
  const doc = JSON.parse(raw.toString('utf8')) as { meta: FixtureMeta; log: FightLog };
  fixtureCache.set(name, doc);
  return doc;
}

/** The log with only the events up to and including `tick`: what a live round has produced by then (no end, no summary). */
export function truncateLog(log: FightLog, tick: number): FightLog {
  const events: FightEvent[] = log.events.filter((e) => e.tick <= tick && e.type !== 'fight.end' && e.type !== 'round.summary');
  return { header: log.header, events, hash: `truncated-${tick}` };
}

const ROLE_OF_ARCHETYPE: Readonly<Record<string, RoleId>> = { tank: 'tank', melee: 'melee', ranged: 'ranged', controller: 'controller', healer: 'healer' };

/** A round context for a log: the player is `playerSide` (home by default), rule counts from each class's default preset. */
export function makeCtx(log: FightLog, content: ContentDB, playerSide: Side | null = 0, kind: 'live' | 'replay' = 'replay'): ArenaRoundContext {
  const palette = defaultArenaPalette('dark');
  const colors = colorsForMatch({ primary: 0x1a2d5a, secondary: 0xf2b83b }, { primary: 0x7a1f2b, secondary: 0xe8e1d0 }, playerSide, palette);
  const units: ArenaUnitInfo[] = log.header.units.map((u) => {
    const cls = content.classes.require(u.classId);
    const preset = content.presets.require(cls.defaultPresetId);
    return {
      unit: u.index,
      side: u.side,
      fighterId: u.fighterId,
      name: `${cls.name} ${u.index}`,
      classId: u.classId,
      className: cls.name,
      roles: cls.archetypes.map((a) => ROLE_OF_ARCHETYPE[a] ?? 'melee'),
      raceId: 'human',
      isHiredBlade: false,
      entered: false,
      freshness: 100,
      fatigueTag: null,
      ruleCount: preset.rules.length,
    };
  });
  return {
    fixtureId: 'fixture',
    round: log.header.round,
    bestOf: 3,
    scoreBefore: { home: 0, away: 0 },
    playerSide,
    sides: [
      { clubId: log.header.units[0]!.clubId, name: 'Home', shortName: 'HOM', colors: colors[0] },
      { clubId: log.header.units[5]!.clubId, name: 'Away', shortName: 'AWY', colors: colors[1] },
    ],
    units,
    kind,
    startTick: 0,
  };
}

/** The events of one type of a log, typed. */
export function eventsOf<T extends FightEvent['type']>(log: FightLog, type: T): Extract<FightEvent, { type: T }>[] {
  return log.events.filter((e): e is Extract<FightEvent, { type: T }> => e.type === type);
}

/** The log with extra events merged in by tick (after the events already at that tick), all seqs renumbered 0..n-1. */
export function withEvents(log: FightLog, extra: readonly Omit<FightEvent, 'seq'>[]): FightLog {
  const merged: Omit<FightEvent, 'seq'>[] = [...log.events];
  for (const e of extra) {
    let at = merged.length;
    while (at > 0 && merged[at - 1]!.tick > e.tick) at--;
    merged.splice(at, 0, e);
  }
  return { ...log, events: merged.map((e, seq) => ({ ...e, seq }) as FightEvent) };
}

/** The log with only its start and frames: a bare arena to which a test adds exactly the events it wants (use withEvents). */
export function skeletonLog(log: FightLog): FightLog {
  return { header: log.header, events: log.events.filter((e) => e.type === 'fight.start' || e.type === 'frame'), hash: 'skeleton' };
}
