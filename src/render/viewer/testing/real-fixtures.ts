/**
 * Test support: the shipped content, WP-M2C's committed simulator rounds and a round context, for tests that run the
 * viewer on the REAL model (real-model.test.ts). The same helpers as src/render/timeline/support.mts, but with paths from
 * the working directory (the viewer's tests run in happy-dom, where import.meta.url is not a file URL). Node only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { CONTENT_FILE_NAMES, loadContent, type ContentDB, type RawContentFiles } from '../../../core/content';
import type { FightEvent, FightLog, Side } from '../../../core/model';
import { colorsForMatch, defaultArenaPalette } from '../../colors';
import { buildCueTable } from '../../cues';
import type { ArenaRoundContext, ArenaUnitInfo, CueTable, RoleId } from '../../types';

let content: ContentDB | null = null;
/** content/default, loaded once per test file. */
export function defaultContent(): ContentDB {
  if (content) return content;
  const raw: RawContentFiles = {};
  for (const name of CONTENT_FILE_NAMES) raw[name] = JSON.parse(readFileSync(join(process.cwd(), 'content', 'default', `${name}.json`), 'utf8')) as unknown;
  const loaded = loadContent('default', raw);
  if (!loaded.ok) throw new Error('content/default does not load');
  content = loaded.value;
  return content;
}

let cues: CueTable | null = null;
export function defaultCues(): CueTable {
  cues ??= buildCueTable(defaultContent());
  return cues;
}

export type FixtureName = 'long' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f';

/** One committed full-level round of the real simulator (format 1). */
export function loadFixture(name: FixtureName): { log: FightLog } {
  const raw = gunzipSync(readFileSync(join(process.cwd(), 'src', 'render', 'timeline', 'fixtures', `${name}.json.gz`)));
  return JSON.parse(raw.toString('utf8')) as { log: FightLog };
}

/** The log with only the events up to and including `tick`: what a live round has produced by then. */
export function truncateLog(log: FightLog, tick: number): FightLog {
  const events: FightEvent[] = log.events.filter((e) => e.tick <= tick && e.type !== 'fight.end' && e.type !== 'round.summary');
  return { header: log.header, events, hash: `truncated-${tick}` };
}

const ROLE_OF_ARCHETYPE: Readonly<Record<string, RoleId>> = { tank: 'tank', melee: 'melee', ranged: 'ranged', controller: 'controller', healer: 'healer' };

/** A round context for a log: the player is `playerSide`, rule counts from each class's default preset. */
export function makeCtx(log: FightLog, playerSide: Side | null = 0, kind: 'live' | 'replay' = 'replay'): ArenaRoundContext {
  const c = defaultContent();
  const colors = colorsForMatch({ primary: 0x1a2d5a, secondary: 0xf2b83b }, { primary: 0x7a1f2b, secondary: 0xe8e1d0 }, playerSide, defaultArenaPalette('dark'));
  const units: ArenaUnitInfo[] = log.header.units.map((u) => {
    const cls = c.classes.require(u.classId);
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
      ruleCount: c.presets.require(cls.defaultPresetId).rules.length,
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
