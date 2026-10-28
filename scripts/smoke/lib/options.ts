/** Command-line options of the smoke driver (`npx tsx scripts/smoke/run.ts`; the package script `smoke:arena` is to be added). */
import { join } from 'node:path';
import { intArg, parseArgs, stringArg } from '../../lib/args';
import { REPO_ROOT } from '../../lib/node-content';
import type { GpuMode } from './browser';

export const JOURNEYS = ['cross', 'fixture', 'career', 'vis003'] as const;
export type JourneyName = (typeof JOURNEYS)[number];

export interface RunOptions {
  /** Browser executable (default: Edge, then Chrome). */
  browser: string | undefined;
  gpu: GpuMode;
  headed: boolean;
  /** Reuse reports/smoke/build instead of building. */
  noBuild: boolean;
  /** Test an already served build instead of building and serving one. */
  url: string | undefined;
  /** Run against the built-in mock arena (a test of the driver itself, not of the game). */
  selfTest: boolean;
  /** Seed typed into the new-career screen (a seeded path through the real UI). */
  seed: string;
  /** Wall seconds of playback measured at each of 1x and 4x. */
  seconds: number;
  /** Consecutive round loads for the heap check. */
  heapLoads: number;
  /** A performance miss on software WebGL is a failure, not a warning. */
  strictPerf: boolean;
  /** Journeys to run (default: cross, fixture, career). */
  only: ReadonlySet<JourneyName>;
  /** vis-003 capture: how many fights to capture (5). */
  fights: number;
  /** vis-003 capture: a frame every N seconds of fight time. */
  everySec: number;
  /** Skip the screenshot matrix (faster). */
  noShots: boolean;
  /** Extra console messages to ignore (regular expressions). */
  allowConsole: RegExp[];
  /** Extra ring colours to look for (css colours, comma separated on the command line). */
  ringColors: string[];
  /** Folder the run folders go in. */
  reportsDir: string;
  quiet: boolean;
}

const HELP = `usage: npx tsx scripts/smoke/run.ts [options]   (the package script smoke:arena is to be added)

  --only cross,fixture,career,vis003   journeys to run (default cross,fixture,career; vis003 captures the observer packets)
  --no-build            reuse the build in reports/smoke/build
  --url <http://...>    test an already served build (no build, no preview)
  --self-test           run against the built-in mock arena: tests the driver, not the game
  --seed <text>         seed typed on the new-career screen (default arena-smoke-1)
  --seconds <n>         wall seconds of playback measured at 1x and at 4x (default 10)
  --heap-loads <n>      consecutive round loads for the heap check (default 20)
  --gpu auto|hardware|software   WebGL source (default auto: the GPU if the browser finds one)
  --strict-perf         a performance miss on software WebGL fails instead of warning
  --browser <path>      msedge.exe or chrome.exe (or set SMOKE_BROWSER)
  --headed              open a window instead of running headless
  --fights <n>          vis-003: fights to capture (default 5)
  --every <seconds>     vis-003: a frame every n seconds of fight time (default 4)
  --no-shots            skip the screenshot matrix
  --allow-console <re>  ignore console errors matching this regular expression (repeatable as a,b)
  --ring-colors <css,css>  extra ring colours for the token check
  --out <dir>           reports folder (default reports/smoke)
  --quiet               less output
  --help

exit codes: 0 pass, 1 a check failed, 2 the driver could not start (no browser, build failed), 3 blocked (the viewer or its test hook is not in the build yet)`;

export function parseOptions(argv: readonly string[]): RunOptions | 'help' {
  const args = parseArgs(argv);
  if (args.has('help') || args.has('h')) return 'help';
  const onlyRaw = stringArg(args, 'only', '');
  const only = new Set<JourneyName>();
  for (const part of onlyRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!(JOURNEYS as readonly string[]).includes(part)) throw new Error(`--only: unknown journey "${part}" (use ${JOURNEYS.join(', ')})`);
    only.add(part as JourneyName);
  }
  if (only.size === 0) for (const j of ['cross', 'fixture', 'career'] as const) only.add(j);
  const gpu = stringArg(args, 'gpu', 'auto');
  if (gpu !== 'auto' && gpu !== 'hardware' && gpu !== 'software') throw new Error(`--gpu must be auto, hardware or software, got "${gpu}"`);
  const out = stringArg(args, 'out', '');
  const url = stringArg(args, 'url', '');
  const browser = stringArg(args, 'browser', '');
  return {
    browser: browser || undefined,
    gpu,
    headed: args.has('headed'),
    noBuild: args.has('no-build'),
    url: url || undefined,
    selfTest: args.has('self-test'),
    seed: stringArg(args, 'seed', 'arena-smoke-1'),
    seconds: intArg(args, 'seconds', 10),
    heapLoads: intArg(args, 'heap-loads', 20),
    strictPerf: args.has('strict-perf'),
    only,
    fights: intArg(args, 'fights', 5),
    everySec: intArg(args, 'every', 4),
    noShots: args.has('no-shots'),
    allowConsole: stringArg(args, 'allow-console', '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => new RegExp(s, 'i')),
    ringColors: stringArg(args, 'ring-colors', '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    reportsDir: out ? (out.startsWith('/') || /^[a-z]:/i.test(out) ? out : join(REPO_ROOT, out)) : join(REPO_ROOT, 'reports', 'smoke'),
    quiet: args.has('quiet'),
  };
}

export { HELP };
