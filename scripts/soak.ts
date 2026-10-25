/**
 * npm run soak -- [--seasons 10] [--seed soak-1] [--theme default] [--out reports/x.json]
 *                 [--determinism-seasons N] [--stand-ins] [--stand-ins sim,tactics]
 *
 * N seasons headless with AI managing every club; economy, age, roster and
 * league invariants (vis-008). Owner: WP5. Exits 1 if any check fails.
 * --stand-ins runs on core/game's stand-in modules instead of the real ones
 * (pre-integration smoke of the loop and the checks; not a balance result);
 * --stand-ins sim,tactics replaces only the listed modules.
 * If a real module is still a stub, the checks it blocks are reported as pending.
 */
import { performance } from 'node:perf_hooks';
import { createAi } from '../src/core/ai';
import { aiPortsOf, createStandInPorts, realGamePorts, type GamePorts } from '../src/core/game';
import { runSoak } from '../src/core/harness';
import { intArg, parseArgs, stringArg } from './lib/args';
import { loadThemeOrExit } from './lib/cli-content';
import { writeReport } from './lib/report';

const args = parseArgs(process.argv.slice(2));
const seasons = intArg(args, 'seasons', 10);
const seed = stringArg(args, 'seed', 'soak-1');
const theme = stringArg(args, 'theme', 'default');
const out = args.get('out');
const standInArg = args.get('stand-ins');
const MODULES = ['sim', 'tactics', 'fighters', 'league', 'economy'] as const;
const standInList: string[] = standInArg === true ? [...MODULES] : typeof standInArg === 'string' ? standInArg.split(',') : [];
for (const m of standInList) if (!(MODULES as readonly string[]).includes(m)) throw new Error(`--stand-ins: unknown module "${m}" (use ${MODULES.join(', ')})`);
const standIns = standInList.length > 0;
function portsFor(list: readonly string[]): GamePorts | undefined {
  if (list.length === 0) return undefined;
  if (list.length === MODULES.length) return createStandInPorts();
  const s = createStandInPorts();
  const pick = <K extends (typeof MODULES)[number]>(k: K): GamePorts[K] => (list.includes(k) ? s[k] : realGamePorts[k]);
  const base = { sim: pick('sim'), tactics: pick('tactics'), fighters: pick('fighters'), league: pick('league'), economy: pick('economy') };
  return { ...base, ai: createAi(aiPortsOf({ ...base, ai: realGamePorts.ai })) };
}
const determinismSeasons = args.has('determinism-seasons') ? intArg(args, 'determinism-seasons', seasons) : undefined;

const content = loadThemeOrExit(theme);

console.log(`soak: ${seasons} seasons, seed "${seed}", theme "${theme}"${standIns ? `  [STAND-INS for ${standInList.join(', ')}: not the real modules]` : ''}`);
const t0 = performance.now();
let last = t0;
const seasonMs: number[] = [];
const report = runSoak({
  seed,
  seasons,
  content,
  ...(standIns ? { ports: portsFor(standInList)! } : {}),
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
const path = writeReport(typeof out === 'string' ? out : undefined, `soak-${seed}${standIns ? `-stand-ins-${standInList.join('-')}` : ''}.json`, {
  ...report,
  timingMs: ms,
  seasonMs,
  theme,
  standIns: standInList,
});
console.log(`  report: ${path}`);

if (report.checks.some((c) => c.status === 'fail')) process.exitCode = 1;
