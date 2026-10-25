/**
 * npm run soak -- [--seasons 10] [--seed soak-1] [--theme default] [--out reports/x.json]
 *
 * Plays N seasons headless with AI managing every club and checks economy,
 * age, roster and league invariants. Exits 1 if any check fails.
 * PHASE A: core/harness runSoak is a stub (all checks "pending") until core/game lands.
 */
import { performance } from 'node:perf_hooks';
import { runSoak } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadRawContentFromDisk } from './lib/node-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const seasons = intArg(args, 'seasons', 10);
const seed = stringArg(args, 'seed', 'soak-1');
const theme = stringArg(args, 'theme', 'default');
const out = args.get('out');

const content = loadRawContentFromDisk(theme);

const t0 = performance.now();
const report = runSoak({ seed, seasons });
const ms = performance.now() - t0;

console.log(`soak: ${seasons} seasons, seed "${seed}", theme "${theme}"${report.stub ? '  [STUB: season engine not implemented yet]' : ''}`);
if (content.missing.length) console.log(`  content files not found yet: ${content.missing.join(', ')}`);
if (content.errors.length) console.log(`  content JSON errors:\n    ${content.errors.join('\n    ')}`);
console.log(`  seasons completed: ${report.seasonsCompleted}/${report.seasonsRequested}`);
for (const check of report.checks) {
  console.log(`  [${check.status.toUpperCase().padEnd(7)}] ${check.id.padEnd(20)} ${check.description}${check.detail ? ` (${check.detail})` : ''}`);
}
console.log(`  time: ${ms.toFixed(0)} ms`);
const path = writeReport(typeof out === 'string' ? out : undefined, `soak-${seed}.json`, { ...report, timingMs: ms, theme });
console.log(`  report: ${path}`);

if (report.checks.some((c) => c.status === 'fail')) process.exitCode = 1;
