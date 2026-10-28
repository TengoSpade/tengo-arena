/**
 * npx tsx scripts/smoke/run.ts [options]      (the package script `smoke:arena` is to be added by the architect)
 *
 * The M2 arena smoke (WP-M2F, 05-technical-m2 §A11): builds `vite build --mode smoke`, serves it with `vite preview`,
 * launches headless Edge (or Chrome) over the DevTools protocol, and drives the game through the test hook and through
 * one seeded new career in the real UI. Writes reports/smoke/<run>/report.json and report.md (git-ignored).
 *
 * Exit codes: 0 pass, 1 a check failed, 2 the driver could not start, 3 blocked (the viewer or its hook is not in the build).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { join, relative } from 'node:path';
import { loadThemeOrExit } from '../lib/cli-content';
import { REPO_ROOT } from '../lib/node-content';
import { SmokeSetupError, cleanupLaunchedSync, findBrowser, launchBrowser, sweepStaleProfiles, type LaunchedBrowser } from './lib/browser';
import { CdpClient } from './lib/cdp';
import { DEFAULT_CONSOLE_ALLOW, checkConsole, splitConsole, type PerfContext } from './lib/checks';
import { HELP, parseOptions, type RunOptions } from './lib/options';
import { PageDriver } from './lib/page';
import { Recorder } from './lib/recorder';
import { countChecks, exitCodeOf, runIdFor, verdictOf, writeSmokeReport, type SmokeReport } from './lib/report';
import { buildSmoke, startPreview, type Served } from './lib/serve';
import { runCareerJourney } from './journeys/career';
import { runCrossJourney } from './journeys/cross-hash';
import type { JourneyEnv } from './journeys/env';
import { runFixtureJourney } from './journeys/fixture';
import { mockHeadless, runMockCareer, runMockVis003, startMock } from './journeys/mock';
import { runVis003Capture } from './journeys/vis003-capture';

function gitInfo(): { commit: string; dirty: boolean } {
  const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { commit: head.status === 0 ? head.stdout.trim() : 'unknown', dirty: status.status === 0 && status.stdout.trim().length > 0 };
}

async function main(): Promise<number> {
  const parsed = parseOptions(process.argv.slice(2));
  if (parsed === 'help') {
    console.log(HELP);
    return 0;
  }
  const opts: RunOptions = parsed;
  const started = new Date();
  const t0 = Date.now();
  const runId = runIdFor(started);
  const outDir = join(opts.reportsDir, runId);
  mkdirSync(outDir, { recursive: true });
  const rec = new Recorder((line) => {
    if (!opts.quiet) console.log(line);
  });
  const git = gitInfo();
  const buildInfo: SmokeReport['build'] = { mode: opts.selfTest ? 'self-test (mock arena)' : 'smoke', commit: git.commit, dirty: git.dirty, url: '', buildMs: null, source: opts.selfTest ? 'mock' : opts.url ? 'url' : 'built' };
  const browserInfo: SmokeReport['browser'] = { product: 'unknown', userAgent: '', exe: '', gpuMode: opts.gpu, gpuRenderer: null, softwareGl: null };

  let served: Served | null = null;
  let browser: LaunchedBrowser | null = null;
  let client: CdpClient | null = null;
  let setupFailure: string | null = null;

  // Ctrl+C, a kill, a crash: never leave the browser (a tree of processes), its profile folder or the preview server behind.
  // The browser module keeps the list of what it launched (from the moment its profile folder exists), so this also covers
  // the seconds before the browser has answered.
  const emergency = (): void => {
    cleanupLaunchedSync();
    void served?.close();
  };
  process.once('SIGINT', () => {
    emergency();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    emergency();
    process.exit(143);
  });
  for (const event of ['unhandledRejection', 'uncaughtException'] as const) {
    process.on(event, (e: unknown) => {
      console.error(`
${event}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
      emergency();
      process.exit(1);
    });
  }
  const swept = sweepStaleProfiles();
  if (swept.length > 0) console.log(`removed ${swept.length} stale browser profile folder(s) left by earlier runs`);

  try {
    console.log(`arena smoke ${runId}: ${[...opts.only].join(', ')}${opts.selfTest ? ' (self-test on the mock arena)' : ''}`);
    const content = loadThemeOrExit('default');
    let mock: Awaited<ReturnType<typeof startMock>> | null = null;

    // ---- build and serve --------------------------------------------------------------------------------------
    if (opts.selfTest) {
      mock = await startMock(content);
      served = mock.served;
    } else if (opts.url) {
      buildInfo.url = opts.url;
    } else {
      const outBuild = join(opts.reportsDir, 'build');
      if (!opts.noBuild) {
        console.log('building the smoke bundle (vite build --mode smoke) ...');
        buildInfo.buildMs = buildSmoke(REPO_ROOT, outBuild).ms;
      }
      served = await startPreview(REPO_ROOT, outBuild);
    }
    const baseUrl = (served?.url ?? opts.url ?? '').replace(/\/$/, '');
    buildInfo.url = baseUrl;

    // ---- the browser ------------------------------------------------------------------------------------------
    const exe = findBrowser(opts.browser);
    browser = await launchBrowser({ exe, gpu: opts.gpu, headless: !opts.headed });
    client = await CdpClient.connect(browser.wsUrl);
    browserInfo.product = browser.version.product;
    browserInfo.userAgent = browser.version.userAgent;
    browserInfo.exe = exe;
    const probePage = await PageDriver.open(client, { width: 800, height: 600 });
    const gpu = await probePage.probe<{ renderer: string | null }>('gpu');
    await probePage.close();
    browserInfo.gpuRenderer = gpu.renderer;
    browserInfo.softwareGl = gpu.renderer === null ? null : /swiftshader|llvmpipe|software|microsoft basic/i.test(gpu.renderer);
    console.log(`browser ${browser.version.product}, WebGL: ${gpu.renderer ?? 'none'}${browserInfo.softwareGl ? ' (software)' : ''}`);

    const perf: PerfContext = { softwareGl: browserInfo.softwareGl, strict: opts.strictPerf };
    const env: JourneyEnv = {
      rec,
      client,
      baseUrl,
      outDir,
      opts,
      perf,
      content,
      commit: git.commit,
      ...(mock ? { headless: mockHeadless(mock.round) } : {}),
      collectConsole: (page) => {
        rec.console.push(...page.console);
        page.console.length = 0;
      },
    };

    // ---- journeys -----------------------------------------------------------------------------------------------
    if (opts.only.has('cross')) await runCrossJourney(env);
    if (opts.only.has('fixture')) await runFixtureJourney(env);
    if (opts.only.has('career')) await (opts.selfTest ? runMockCareer(env) : runCareerJourney(env));
    if (opts.only.has('vis003')) await (mock ? runMockVis003(env, mock.round) : runVis003Capture(env));
  } catch (e) {
    setupFailure = e instanceof Error ? e.message : String(e);
    rec.check({ id: 'env.setup', title: 'The driver started (build, server, browser)', status: 'fail', actual: setupFailure.slice(0, 800) });
    console.error(`\nsetup failed: ${setupFailure}`);
  } finally {
    client?.close();
    await browser?.close();
    await served?.close();
  }

  // ---- console, report ------------------------------------------------------------------------------------------
  const split = splitConsole(rec.console, [...DEFAULT_CONSOLE_ALLOW, ...opts.allowConsole]);
  if (!setupFailure) rec.check(checkConsole(split.errors, split.ignored));
  const finished = new Date();
  const report: SmokeReport = {
    format: 'arena-league-smoke',
    version: 1,
    runId,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: Date.now() - t0,
    verdict: verdictOf(rec.checks, rec.blocked),
    counts: countChecks(rec.checks),
    blocked: rec.blocked,
    build: buildInfo,
    browser: browserInfo,
    host: { platform: `${process.platform} ${process.arch}`, cpus: cpus().length, memoryGb: Math.round(totalmem() / 2 ** 30), node: process.version },
    options: {
      only: [...opts.only].join(','),
      seed: opts.seed,
      seconds: opts.seconds,
      heapLoads: opts.heapLoads,
      gpu: opts.gpu,
      strictPerf: opts.strictPerf,
      selfTest: opts.selfTest,
      noShots: opts.noShots,
    },
    steps: rec.steps,
    checks: rec.checks,
    measurements: rec.measurements,
    screenshots: rec.screenshots,
    consoleErrors: split.errors.map((r) => ({ source: r.source, text: r.text, ...(r.url ? { url: r.url } : {}) })),
    consoleWarnings: split.warnings,
    artifacts: rec.artifacts,
  };
  const written = writeSmokeReport(opts.reportsDir, report);
  const c = report.counts;
  console.log(`\n${report.verdict.toUpperCase()}: ${c.pass} pass, ${c.fail} fail, ${c.warn} warn, ${c.skip} skipped, ${report.blocked.length} blocked`);
  for (const b of report.blocked) console.log(`  blocked at ${b.step}: ${b.message.split('\n')[0]}`);
  for (const k of rec.checks.filter((x) => x.status === 'fail')) console.log(`  FAIL ${k.id}: ${k.actual ?? ''}`);
  console.log(`report: ${relative(REPO_ROOT, written.md).split('\\').join('/')}`);
  return setupFailure && !report.checks.some((x) => x.id !== 'env.setup' && x.status === 'fail') ? 2 : exitCodeOf(report.verdict);
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    if (e instanceof SmokeSetupError) console.error(`${e.code}: ${e.message}`);
    else console.error(e);
    process.exit(2);
  },
);
