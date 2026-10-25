/**
 * npm run balance -- [--fights 5000] [--seed balance-1] [--mode random-draft|mirror|preset-vs-default]
 *                    [--theme default] [--out reports/x.json] [--strict] [--bench 500]
 *
 * Seeded headless fights -> per-class and per-archetype win rates, fight
 * length, overtime and time-cap rates, rarely cast abilities, idle rules and
 * ms per round (V1, vis-002; 03-combat §8). Owner: WP1.
 * --bench N times N extra rounds at record 'none' and 'full' (05 §8 budgets).
 * --strict exits 1 when any class or archetype is outside the target band.
 */
import { performance } from 'node:perf_hooks';
import { runBalance, type BalanceMode, type BalanceReport } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const fights = intArg(args, 'fights', 5000);
const seed = stringArg(args, 'seed', 'balance-1');
const theme = stringArg(args, 'theme', 'default');
const mode = stringArg(args, 'mode', 'random-draft') as BalanceMode;
const bench = args.has('bench') ? intArg(args, 'bench', 500) || 500 : 0;
const out = args.get('out');

const content = loadThemeOrExit(theme);
const clock = (): number => performance.now();

const t0 = performance.now();
const report = runBalance({ seed, fights, content, mode, clock });
const ms = performance.now() - t0;

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
console.log(`balance: ${report.fights} fights (rounds), mode ${mode}, seed "${seed}", theme "${theme}"`);
console.log('  class                     games   wins   win%   95% CI          dmg   heal  life s');
for (const row of report.classes) {
  const ci = `${pct(row.ciLow ?? 0)}-${pct(row.ciHigh ?? 0)}`;
  const flag = report.outliers.includes(row.classId) ? '  <-- outlier' : '';
  console.log(
    `  ${row.classId.padEnd(24)} ${String(row.appearances).padStart(6)} ${String(row.wins).padStart(6)} ${pct(row.winRate).padStart(6)}   ${ci.padEnd(13)} ${String(row.avgDamage ?? 0).padStart(6)} ${String(row.avgHealing ?? 0).padStart(6)} ${String(row.avgLifetimeS ?? 0).padStart(6)}${flag}`,
  );
}
console.log('  archetype (pure classes; hybrids pooled):');
for (const g of report.archetypes ?? []) console.log(`    ${g.id.padEnd(12)} ${String(g.appearances).padStart(6)} ${pct(g.winRate).padStart(6)}${(report.archetypeOutliers ?? []).includes(g.id) ? '  <-- outlier' : ''}`);
if (mode === 'preset-vs-default') for (const s of report.styles ?? []) console.log(`    style ${s.id.padEnd(20)} ${String(s.appearances).padStart(6)} ${pct(s.winRate).padStart(6)}`);
const fl = report.fightLength!;
console.log(`  fight length: median ${fl.medianS.toFixed(2)} s, P10 ${fl.p10S.toFixed(2)} s, P90 ${fl.p90S.toFixed(2)} s; overtime ${pct(fl.overtimeRate)}; time cap ${pct(fl.timeCapRate)}; home wins ${pct(fl.homeWinRate)}`);
console.log(`  tiebreak steps: ${JSON.stringify(fl.tiebreakSteps)}`);
console.log(`  detectors: healing/damage ${pct(report.detectors!.healingPerDamage)}, overheal ${pct(report.detectors!.overhealShare)}, hard-CC uptime ${pct(report.detectors!.hardCcUptime)}`);
console.log(`  class outliers (outside ${Math.round(report.targetBand.min * 100)}-${Math.round(report.targetBand.max * 100)}%): ${report.outliers.join(', ') || 'none'}`);
console.log(`  archetype outliers: ${(report.archetypeOutliers ?? []).join(', ') || 'none'}`);
console.log(`  abilities never cast in >50% of rounds: ${(report.rarelyCastAbilities ?? []).length}; preset rules never fired in >80%: ${(report.idleRules ?? []).length}`);
if (report.timing) console.log(`  ms per round (record none): median ${report.timing.medianMs.toFixed(2)}, p99 ${report.timing.p99Ms.toFixed(2)}, mean ${report.timing.meanMs.toFixed(2)}`);
console.log(`  time: ${ms.toFixed(0)} ms total`);

let benchReport: { none: BalanceReport['timing']; full: BalanceReport['timing'] } | undefined;
if (bench > 0) {
  const none = runBalance({ seed: `${seed}-bench`, fights: bench, content, mode, clock, record: 'none' }).timing;
  const full = runBalance({ seed: `${seed}-bench`, fights: bench, content, mode, clock, record: 'full' }).timing;
  benchReport = { none, full };
  console.log(`  bench ${bench} rounds: none median ${none!.medianMs.toFixed(2)} ms p99 ${none!.p99Ms.toFixed(2)} ms; full median ${full!.medianMs.toFixed(2)} ms p99 ${full!.p99Ms.toFixed(2)} ms (budget: none median <= 2, p99 <= 6; full <= 3x)`);
}

const path = writeReport(typeof out === 'string' ? out : undefined, `balance-${mode}-${seed}.json`, { ...report, timingMs: ms, theme, bench: benchReport });
console.log(`  report: ${path}`);

if (args.has('strict') && (report.outliers.length > 0 || (report.archetypeOutliers ?? []).length > 0)) process.exitCode = 1;
