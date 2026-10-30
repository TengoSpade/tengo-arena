/**
 * The dev harness's REAL inputs (no fakes): the shipped content/default, a fight log made by the real simulator (the
 * committed WP-M2C fixtures: src/render/timeline/fixtures/*.json.gz, format 1), and a round context for it. Browser
 * only (Vite's import.meta.glob, fetch, DecompressionStream). Not bundled into the app.
 */
import { CONTENT_FILE_NAMES, loadContent, type ContentDB, type RawContentFiles } from '../../../core/content';
import type { FightLog, Side } from '../../../core/model';
import { colorsForMatch, defaultArenaPalette } from '../../colors';
import type { ArenaRoundContext, ArenaUnitInfo, RoleId } from '../../types';

const FILES = import.meta.glob('/content/default/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

let cached: ContentDB | null = null;
/** content/default as the game loads it. */
export function realContent(): ContentDB {
  if (cached) return cached;
  const raw: RawContentFiles = {};
  for (const name of CONTENT_FILE_NAMES) {
    const value = FILES[`/content/default/${name}.json`];
    if (value !== undefined) raw[name] = value;
  }
  const loaded = loadContent('default', raw);
  if (!loaded.ok) throw new Error('content/default does not load');
  cached = loaded.value;
  return cached;
}

export const FIXTURES = ['long', 'a', 'b', 'c', 'd', 'e', 'f'] as const;

/**
 * One committed full-level round of the real simulator. Vite's dev server sends the .gz fixture with
 * Content-Encoding: gzip, so the browser may already have decoded it: look at the first bytes before decompressing.
 */
export async function realLog(name: (typeof FIXTURES)[number] = 'long'): Promise<FightLog> {
  const res = await fetch(new URL(`../../timeline/fixtures/${name}.json.gz`, import.meta.url));
  if (!res.ok) throw new Error(`fixture ${name}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = gzipped ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(bytes);
  return (JSON.parse(text) as { log: FightLog }).log;
}

const ROLE_OF_ARCHETYPE: Readonly<Record<string, RoleId>> = { tank: 'tank', melee: 'melee', ranged: 'ranged', controller: 'controller', healer: 'healer' };

/** A round context for a log, as the timeline tests build one: the player is `playerSide`, rule counts from the class presets. */
export function realContext(log: FightLog, content: ContentDB, kind: 'live' | 'replay' = 'replay', playerSide: Side | null = 0, theme: 'dark' | 'light' = 'dark'): ArenaRoundContext {
  const palette = defaultArenaPalette(theme);
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
      overall: 38 + ((u.index * 7) % 13),
      freshness: u.index === 2 ? 42 : u.index === 7 ? 18 : u.index === 4 ? 70 : 100,
      fatigueTag: u.index === 2 ? 'tired' : u.index === 7 ? 'spent' : u.index === 4 ? 'ready' : null,
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
