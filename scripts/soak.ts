/**
 * npm run soak -- [--seasons 10] [--seed soak-1] [--theme default] [--out reports/x.json]
 *                 [--determinism-seasons N] [--stand-ins]
 *
 * N seasons headless with AI managing every club; economy, age, roster and
 * league invariants (vis-008). Owner: WP5. Exits 1 if any check fails.
 * --stand-ins runs on core/game's stand-in modules instead of the real ones
 * (pre-integration smoke of the loop and the checks; not a balance result).
 * If a real module is still a stub, the checks it blocks are reported as pending.
 */
import { performance } from 'node:perf_hooks';
import { createStandInPorts } from '../src/core/game';
import { runSoak } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const seasons = intArg(args, 'seasons', 10);
const seed = stringArg(args, 'seed', 'soak-1');
const theme = stringArg(args, 'theme', 'default');
const out = args.get('out');
const standIns = args.get('stand-ins') === true;
const determinismSeasons = args.has('determinism-seasons') ? intArg(args, 'determinism-seasons', seasons) : undefined;

const content = loadThemeOrExit(theme);

console.log(`soak: ${seasons} seasons, seed "${seed}", theme "${theme}"${standIns ? '  [STAND-INS: not the real modules]' : ''}`);
const t0 = performance.now();
let last = t0;
const seasonMs: number[] = [];
const report = runSoak({
  seed,
  seasons,
  content,
  ...(standIns ? { ports: createStandInPorts() } : {}),
  ...(determinismSeasons !== undefined ? { determinismSeasons } : {}),
  onSeason: (s) => {
    const now = performance.now();
    seasonMs.push(now - last);
    last = now;
    console.log(
      `  season ${String(s.season).padStart(2)}: ${(seasonMs[seasonMs.length - 1]! / 1000).toFixed(2)} s  pop ${s.population} (rostered ${s.rostered}), pool P1 ${s.freeAgentsAtP1}, median human-age ${s.medianHumanAge.toFixed(1)}, retirements ${s.retirements}, rookies ${s.rookies}, solvent ${(s.solventShareBp / 100).toFixed(1)}%, median wage ${s.medianWage}, AI refusals ${s.aiRejections}`,
    );
  },
});
const ms = performance.now() - t0;

if (report.stub) console.log('  [STUB: a module is not implemented yet; blocked checks are pending]');
if (report.error) console.log(`  stopped: ${report.error}`);
console.log(`  seasons completed: ${report.seasonsCompleted}/${report.seasonsRequested}`);
for (const check of report.checks) {
  console.log(`  [${check.status.toUpperCase().padEnd(7)}] ${check.id.padEnd(20)} ${check.description}${check.detail ? ` (${check.detail})` : ''}`);
}
const rejections = Object.entries(report.aiRejections).sort((a, b) => b[1] - a[1]);
if (rejections.length) console.log(`  AI commands refused by the rulebook: ${rejections.map(([k, n]) => `${k} x${n}`).join(', ')}`);
const median = seasonMs.length ? [...seasonMs].sort((a, b) => a - b)[Math.trunc(seasonMs.length / 2)]! : 0;
console.log(`  time: ${ms.toFixed(0)} ms total (incl. determinism replay); median season ${(median / 1000).toFixed(2)} s`);
const path = writeReport(typeof out === 'string' ? out : undefined, `soak-${seed}${standIns ? '-stand-ins' : ''}.json`, {
  ...report,
  timingMs: ms,
  seasonMs,
  theme,
  standIns,
});
console.log(`  report: ${path}`);

if (report.checks.some((c) => c.status === 'fail')) process.exitCode = 1;
