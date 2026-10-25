/**
 * npm run balance -- [--fights 5000] [--seed balance-1] [--mode random-draft|mirror|preset-vs-default]
 *                    [--theme default] [--out reports/x.json] [--strict]
 *
 * Seeded headless fights -> per-class win rates (V1, vis-002). Owner: WP1.
 * Until core/sim lands, core/harness runBalance plays placeholder coin flips.
 * --strict exits 1 when any class is outside the target band.
 */
import { performance } from 'node:perf_hooks';
import { runBalance, type BalanceMode } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const fights = intArg(args, 'fights', 5000);
const seed = stringArg(args, 'seed', 'balance-1');
const theme = stringArg(args, 'theme', 'default');
const mode = stringArg(args, 'mode', 'random-draft') as BalanceMode;
const out = args.get('out');

const content = loadThemeOrExit(theme);

const t0 = performance.now();
const report = runBalance({ seed, fights, content, mode });
const ms = performance.now() - t0;

console.log(`balance: ${fights} fights, mode ${mode}, seed "${seed}", theme "${theme}"${report.stub ? '  [STUB: coin-flip fights until core/sim exists]' : ''}`);
console.log('  class                     games   wins   win%');
for (const row of report.classes) {
  console.log(`  ${row.classId.padEnd(24)} ${String(row.appearances).padStart(6)} ${String(row.wins).padStart(6)} ${(row.winRate * 100).toFixed(1).padStart(6)}`);
}
console.log(`  outliers (outside ${Math.round(report.targetBand.min * 100)}-${Math.round(report.targetBand.max * 100)}%): ${report.outliers.join(', ') || 'none'}`);
console.log(`  time: ${ms.toFixed(0)} ms (${fights ? (ms / fights).toFixed(3) : '0'} ms/fight)`);
const path = writeReport(typeof out === 'string' ? out : undefined, `balance-${mode}-${seed}.json`, { ...report, timingMs: ms, theme });
console.log(`  report: ${path}`);

if (args.has('strict') && report.outliers.length > 0 && !report.stub) process.exitCode = 1;
