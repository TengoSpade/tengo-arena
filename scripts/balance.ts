/**
 * npm run balance -- [--fights 5000] [--seed balance-1] [--theme default] [--out reports/x.json] [--strict]
 *
 * Runs many seeded headless fights and prints per-class win rates.
 * PHASE A: core/harness runBalance is a stub (coin flips) until core/sim lands.
 * --strict exits 1 when any class is outside the target band (for CI once real).
 */
import { performance } from 'node:perf_hooks';
import { runBalance } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { classIdsFromRaw, loadRawContentFromDisk } from './lib/node-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const fights = intArg(args, 'fights', 5000);
const seed = stringArg(args, 'seed', 'balance-1');
const theme = stringArg(args, 'theme', 'default');
const out = args.get('out');

const content = loadRawContentFromDisk(theme);
const classIds = classIdsFromRaw(content.raw);

const t0 = performance.now();
const report = runBalance({ seed, fights, classIds });
const ms = performance.now() - t0;

console.log(`balance: ${fights} fights, seed "${seed}", theme "${theme}"${report.stub ? '  [STUB: placeholder coin-flip fights until core/sim exists]' : ''}`);
if (content.missing.length) console.log(`  content files not found yet: ${content.missing.join(', ')}`);
if (content.errors.length) console.log(`  content JSON errors:\n    ${content.errors.join('\n    ')}`);
console.log(`  classes: ${report.classes.length}${classIds.length ? '' : ' (placeholder ids; classes.json not readable yet)'}`);
console.log('  class                     games   wins   win%');
for (const row of report.classes) {
  console.log(`  ${row.classId.padEnd(24)} ${String(row.appearances).padStart(6)} ${String(row.wins).padStart(6)} ${(row.winRate * 100).toFixed(1).padStart(6)}`);
}
console.log(`  outliers (outside ${Math.round(report.targetBand.min * 100)}-${Math.round(report.targetBand.max * 100)}%): ${report.outliers.join(', ') || 'none'}`);
console.log(`  time: ${ms.toFixed(0)} ms (${fights ? (ms / fights).toFixed(3) : '0'} ms/fight)`);
const path = writeReport(typeof out === 'string' ? out : undefined, `balance-${seed}.json`, { ...report, timingMs: ms, theme });
console.log(`  report: ${path}`);

if (args.has('strict') && report.outliers.length > 0 && !report.stub) process.exitCode = 1;
