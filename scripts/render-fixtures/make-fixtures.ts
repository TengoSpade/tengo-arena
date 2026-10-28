/**
 * npx tsx scripts/render-fixtures/make-fixtures.ts
 *
 * Regenerates the committed fight-log fixtures of the render-state model tests (WP-M2C), in
 * src/render/timeline/fixtures/*.json.gz.
 *
 * Why a script and not live simulation in the tests: src/render may import core/sim as types only (rule
 * render-sim-value, tech-009), test files included. The tests therefore read these gzipped JSON logs, produced by the
 * real simulator from content/default at the engine and log format named in each file's `meta`. The script lives in
 * scripts/ so that rule keeps holding for everything under src/render.
 *
 * Each fixture is one full-level round (FightLog) with a fixed seed and composition; the set was picked by a greedy
 * cover of event types, ability releases, statuses, displacement kinds and interrupt causes. Format 1 today; rerun after
 * WP-M2A (log format 2) and `npm test` to re-check what the tests pin.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { loadContent } from '../../src/core/content';
import { sideInput, simulateRound } from '../../src/core/sim';
import { loadRawContentFromDisk } from '../lib/node-content';

const OUT = fileURLToPath(new URL('../../src/render/timeline/fixtures/', import.meta.url));

/** name: [seed, home classes (slot 0-4), away classes, home captain index, away captain index] */
const FIXTURES: Record<string, [string, string[], string[], number, number]> = {
  long: ['long-14', ['siegebreaker', 'gaoler', 'bladeturner', 'vigilkeeper', 'chirurgeon'], ['vowknight', 'gongbearer', 'siegebreaker', 'aegis_scribe', 'vigilkeeper'], 0, 0],
  a: ['cov-211', ['blightbrewer', 'oathguard', 'bladeturner', 'bloodhowler', 'scarhide'], ['galeshaper', 'snaresetter', 'aegis_scribe', 'longeye', 'deeproot_keeper'], 0, 0],
  b: ['cov-67', ['pavisier', 'gongbearer', 'war_drummer', 'hexmonger', 'runecleaver'], ['vigilkeeper', 'hourglass_sage', 'skullslinger', 'dreamthief', 'chirurgeon'], 0, 0],
  c: ['cov-149', ['harpooner', 'rimebinder', 'headsman', 'sunlance_acolyte', 'phalanx_sergeant'], ['writ_hunter', 'briarback', 'vowknight', 'oathguard', 'cantor'], 0, 0],
  d: ['cov-144', ['siegebreaker', 'emberwright', 'chaffcutter', 'leechblade', 'cantor'], ['gutterknife', 'emberwright', 'gaoler', 'harpooner', 'hushweaver'], 0, 0],
  e: ['cov-43', ['grovetender', 'deeproot_keeper', 'gongbearer', 'twinfang', 'boltrunner'], ['hushweaver', 'netcaster', 'harpooner', 'vigilkeeper', 'pavisier'], 0, 0],
  f: ['chain-0', ['thunderhand', 'snaresetter', 'gaoler', 'deeproot_keeper', 'writ_hunter'], ['headsman', 'chaffcutter', 'cantor', 'longeye', 'hushweaver'], 0, 0],
};

const loaded = loadContent('default', loadRawContentFromDisk('default').raw);
if (!loaded.ok) throw new Error('content/default does not load');
const content = loaded.value;

mkdirSync(OUT, { recursive: true });
for (const [name, [seed, home, away, homeCaptain, awayCaptain]] of Object.entries(FIXTURES)) {
  const out = simulateRound(
    { round: 1, home: sideInput(content, 'home', home, homeCaptain, null), away: sideInput(content, 'away', away, awayCaptain, null) },
    seed,
    content,
    { record: 'full' },
  );
  if (!out.log) throw new Error(`fixture ${name}: the simulator returned no log`);
  const doc = { meta: { name, seed, home, away, durationTicks: out.result.durationTicks, winner: out.result.winner }, log: out.log };
  const gz = gzipSync(Buffer.from(JSON.stringify(doc)), { level: 9 });
  writeFileSync(`${OUT}${name}.json.gz`, gz);
  console.log(`${name}: ${out.log.events.length} events, ${out.result.durationTicks} ticks, ${gz.length} bytes`);
}
