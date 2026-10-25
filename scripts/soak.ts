/**
 * npm run soak -- [--seasons 10] [--seed soak-1] [--theme default] [--out reports/x.json]
 *
 * N seasons headless with AI managing every club; economy, age, roster and
 * league invariants (vis-008). Owner: WP5. Exits 1 if any check fails.
 * Until core/game lands, core/harness runSoak reports every check as pending.
 */
import { performance } from 'node:perf_hooks';
import { runSoak } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const seasons = intArg(args, 'seasons', 10);
const seed = stringArg(args, 'seed', 'soak-1');
const theme = stringArg(args, 'theme', 'default');
const out = args.get('out');

const content = loadThemeOrExit(theme);

const t0 = performance.now();
const report = runSoak({ seed, seasons, content });
const ms = performance.now() - t0;

console.log(`soak: ${seasons} seasons, seed "${seed}", theme "${theme}"${report.stub ? '  [STUB: season engine not implemented yet]' : ''}`);
console.log(`  seasons completed: ${report.seasonsCompleted}/${report.seasonsRequested}`);
for (const check of report.checks) {
  console.log(`  [${check.status.toUpperCase().padEnd(7)}] ${check.id.padEnd(20)} ${check.description}${check.detail ? ` (${check.detail})` : ''}`);
}
console.log(`  time: ${ms.toFixed(0)} ms`);
const path = writeReport(typeof out === 'string' ? out : undefined, `soak-${seed}.json`, { ...report, timingMs: ms, theme });
console.log(`  report: ${path}`);

if (report.checks.some((c) => c.status === 'fail')) process.exitCode = 1;
