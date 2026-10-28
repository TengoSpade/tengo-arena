// Regenerates the committed fight-log fixtures of the render-state model tests (WP-M2C).
//
//   npx tsx src/render/timeline/fixtures/make-fixtures.mjs
//
// Why a script and not live simulation in the tests: src/render may import core/sim as types only (rule
// render-sim-value, tech-009), test files included. The tests therefore read these gzipped JSON logs, produced by
// the real simulator from content/default at the engine and log format named in each file's `meta`.
// Each fixture is one full-level round (FightLog) with a fixed seed and composition; the set was picked by a greedy
// cover of event types, ability releases, statuses, displacement kinds and interrupt causes. Format 1 today; rerun
// after WP-M2A (log format 2) to refresh them and `npm test` to re-check the pinned numbers in the tests.
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { loadContent } from '../../../core/content/index.ts';
import { sideInput, simulateRound } from '../../../core/sim/index.ts';
import { loadRawContentFromDisk } from '../../../../scripts/lib/node-content.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** name: [seed, home classes (slot 0-4), away classes, home captain index, away captain index] */
const FIXTURES = {
  long: ['long-14', ['siegebreaker', 'gaoler', 'bladeturner', 'vigilkeeper', 'chirurgeon'], ['vowknight', 'gongbearer', 'siegebreaker', 'aegis_scribe', 'vigilkeeper'], 0, 0],
  a: ['cov-211', ['blightbrewer', 'oathguard', 'bladeturner', 'bloodhowler', 'scarhide'], ['galeshaper', 'snaresetter', 'aegis_scribe', 'longeye', 'deeproot_keeper'], 0, 0],
  b: ['cov-67', ['pavisier', 'gongbearer', 'war_drummer', 'hexmonger', 'runecleaver'], ['vigilkeeper', 'hourglass_sage', 'skullslinger', 'dreamthief', 'chirurgeon'], 0, 0],
  c: ['cov-149', ['harpooner', 'rimebinder', 'headsman', 'sunlance_acolyte', 'phalanx_sergeant'], ['writ_hunter', 'briarback', 'vowknight', 'oathguard', 'cantor'], 0, 0],
  d: ['cov-144', ['siegebreaker', 'emberwright', 'chaffcutter', 'leechblade', 'cantor'], ['gutterknife', 'emberwright', 'gaoler', 'harpooner', 'hushweaver'], 0, 0],
  e: ['cov-43', ['grovetender', 'deeproot_keeper', 'gongbearer', 'twinfang', 'boltrunner'], ['hushweaver', 'netcaster', 'harpooner', 'vigilkeeper', 'pavisier'], 0, 0],
  f: ['chain-0', ['thunderhand', 'snaresetter', 'gaoler', 'deeproot_keeper', 'writ_hunter'], ['headsman', 'chaffcutter', 'cantor', 'longeye', 'hushweaver'], 0, 0],
};

const disk = loadRawContentFromDisk('default');
const loaded = loadContent('default', disk.raw);
if (!loaded.ok) throw new Error('content/default does not load');
const content = loaded.value;

mkdirSync(HERE, { recursive: true });
for (const [name, [seed, home, away, hc, ac]] of Object.entries(FIXTURES)) {
  const out = simulateRound(
    { round: 1, home: sideInput(content, 'home', home, hc, null), away: sideInput(content, 'away', away, ac, null) },
    seed,
    content,
    { record: 'full' },
  );
  const doc = { meta: { name, seed, home, away, durationTicks: out.result.durationTicks, winner: out.result.winner }, log: out.log };
  const gz = gzipSync(Buffer.from(JSON.stringify(doc)), { level: 9 });
  writeFileSync(join(HERE, `${name}.json.gz`), gz);
  process.stdout.write(`${name}: ${out.log.events.length} events, ${out.result.durationTicks} ticks, ${gz.length} bytes\n`);
}
