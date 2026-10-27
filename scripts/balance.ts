/**
 * npm run balance -- [--fights 5000] [--seed balance-1]
 *                    [--mode random-draft|mirror|preset-vs-default|progression|perk-impact|rank-impact|fatigue|squad-match]
 *                    [--profile none|season3|veteran] [--pick auto|uniform] [--per N]
 *                    [--theme default] [--out reports/x.json] [--strict] [--bench 500]
 *
 * Seeded headless fights -> per-class and per-archetype win rates, fight
 * length, overtime and time-cap rates, rarely cast abilities, idle rules and
 * ms per round (V1, vis-002; 03-combat §8). Owner: WP1 / M1.1 WP-A.
 * M1.1 modes (combat-skills.md §8): progression (skills per --profile, chosen
 * by --pick), perk-impact and rank-impact (--per fights per perk / ability;
 * default fights / items), fatigue (the four Freshness profiles; --fights
 * split between them), squad-match (full matches with 7-fighter squads through core/game playMatchAuto; --fights = matches).
 * --bench N times N extra rounds at record 'none' and 'full' (05 §8 budgets).
 * --strict exits 1 when any class or archetype is outside the target band,
 * or (M1.1 modes) any perk, rank or fatigue flag is raised.
 */
import { performance } from 'node:perf_hooks';
import { runBalance, type BalanceMode, type BalanceOptions, type BalanceReport } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { balanceReportLines } from './lib/balance-print';
import { loadThemeOrExit } from './lib/cli-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const fights = intArg(args, 'fights', 5000);
const seed = stringArg(args, 'seed', 'balance-1');
const theme = stringArg(args, 'theme', 'default');
const mode = stringArg(args, 'mode', 'random-draft') as BalanceMode;
const profile = args.has('profile') ? (stringArg(args, 'profile', 'season3') as BalanceOptions['profile']) : undefined;
const pick = args.has('pick') ? (stringArg(args, 'pick', 'auto') as BalanceOptions['pick']) : undefined;
const perItem = args.has('per') ? intArg(args, 'per', 200) : undefined;
const bench = args.has('bench') ? intArg(args, 'bench', 500) || 500 : 0;
const out = args.get('out');

const content = loadThemeOrExit(theme);
const clock = (): number => performance.now();

const t0 = performance.now();
const report = runBalance({ seed, fights, content, mode, clock, profile, pick, perItem });
const ms = performance.now() - t0;

console.log(`balance: ${report.fights} fights (rounds), mode ${mode}${report.profile ? ` (profile ${report.profile}, pick ${report.pick})` : ''}, seed "${seed}", theme "${theme}"`);
for (const line of balanceReportLines(report, mode)) console.log(line);
console.log(`  time: ${ms.toFixed(0)} ms total`);

let benchReport: { none: BalanceReport['timing']; full: BalanceReport['timing'] } | undefined;
if (bench > 0) {
  const none = runBalance({ seed: `${seed}-bench`, fights: bench, content, mode, clock, record: 'none', profile, pick, perItem }).timing;
  const full = runBalance({ seed: `${seed}-bench`, fights: bench, content, mode, clock, record: 'full', profile, pick, perItem }).timing;
  benchReport = { none, full };
  console.log(`  bench ${bench} rounds: none median ${none!.medianMs.toFixed(2)} ms p99 ${none!.p99Ms.toFixed(2)} ms; full median ${full!.medianMs.toFixed(2)} ms p99 ${full!.p99Ms.toFixed(2)} ms (budget: none median <= 2, p99 <= 6; full <= 3x)`);
}

const path = writeReport(typeof out === 'string' ? out : undefined, `balance-${mode}-${seed}.json`, { ...report, timingMs: ms, theme, bench: benchReport });
console.log(`  report: ${path}`);

const m11Flags = (report.perks ?? []).some((p) => p.flags.length > 0) || (report.ranks ?? []).some((r) => r.flags.length > 0) || (report.fatigue ?? []).some((r) => !r.inTarget) || (report.squadMatch?.flags.length ?? 0) > 0;
if (args.has('strict') && (report.outliers.length > 0 || (report.archetypeOutliers ?? []).length > 0 || m11Flags)) process.exitCode = 1;
